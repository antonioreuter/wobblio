import NextAuth from 'next-auth'
import CognitoProvider from 'next-auth/providers/cognito'
import CredentialsProvider from 'next-auth/providers/credentials'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

// Admin console auth — the SAME Cognito user pool as the customer webapp. Only the
// ADMIN role passes the middleware gate; role is DB-canonical (app_user.role), read
// once per sign-in via /me/profile — never from a Cognito attribute (no custom:role).
declare module 'next-auth' {
  interface Session {
    user: { id: string; email: string; name: string; role: string; status: string }
    error?: string
  }
  interface JWT {
    sub: string
    email: string
    name: string
    role: string
    status: string
    accessToken?: string
    idToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}

const cognitoIssuer = process.env.COGNITO_ENDPOINT
  ? `${process.env.COGNITO_ENDPOINT}/${process.env.COGNITO_USER_POOL_ID}`
  : `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`

// Local dev credentials provider — active only against cognito-local.
function buildLocalCredentialsProvider() {
  return CredentialsProvider({
    id: 'credentials',
    name: 'Email & Password',
    credentials: {
      email: { label: 'Email', type: 'email' },
      password: { label: 'Password', type: 'password' },
    },
    async authorize(credentials) {
      if (!credentials?.email || !credentials?.password) return null
      const client = new CognitoIdentityProviderClient({
        region: process.env.COGNITO_REGION ?? 'eu-west-1',
        endpoint: process.env.COGNITO_ENDPOINT,
      })
      try {
        const result = await client.send(
          new InitiateAuthCommand({
            AuthFlow: 'USER_PASSWORD_AUTH',
            ClientId: process.env.COGNITO_CLIENT_ID!,
            AuthParameters: {
              USERNAME: credentials.email as string,
              PASSWORD: credentials.password as string,
            },
          }),
        )
        const auth = result.AuthenticationResult
        const idToken = auth?.IdToken
        if (!idToken) return null
        const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString())
        return {
          id: payload.sub,
          email: payload.email,
          idToken,
          accessToken: auth.AccessToken,
          refreshToken: auth.RefreshToken,
          accessTokenExpires: Date.now() + (auth.ExpiresIn ?? 3600) * 1000,
        }
      } catch {
        return null
      }
    },
  })
}

interface SessionProfile {
  name: string
  role: string
  status: string
}

const DEFAULT_PROFILE: SessionProfile = { name: '', role: 'STANDARD', status: 'ACTIVE' }

// The DB is the single source of truth for role/status. Read once per sign-in via
// the backend (Edge-safe fetch). Defaults to a non-admin role on any error so a
// transient backend issue fails closed (operator hits /403, never a false ADMIN).
async function fetchProfile(idToken: string | undefined): Promise<SessionProfile> {
  if (!idToken) return DEFAULT_PROFILE
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBase) return DEFAULT_PROFILE
  try {
    const res = await fetch(`${apiBase}/me/profile`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return DEFAULT_PROFILE
    const p = (await res.json()) as Partial<{ fullName: string; role: string; status: string }>
    return { name: p.fullName ?? '', role: p.role ?? 'STANDARD', status: p.status ?? 'ACTIVE' }
  } catch {
    return DEFAULT_PROFILE
  }
}

// Renew the Cognito access/ID token via the Hosted-UI token endpoint using the
// stored refresh token. Edge-safe (fetch only). On failure, flag the token so the
// session carries an error. Local (cognito-local) has no token endpoint — just
// extend the window. Mirrors the webapp's refresh.
async function refreshCognitoTokens(token: Record<string, unknown>): Promise<Record<string, unknown>> {
  if (process.env.COGNITO_ENDPOINT) {
    return { ...token, accessTokenExpires: Date.now() + 3600 * 1000, error: undefined }
  }
  const domain = process.env.COGNITO_DOMAIN
  const refreshToken = token.refreshToken as string | undefined
  if (!domain || !refreshToken) return { ...token, error: 'RefreshAccessTokenError' }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.COGNITO_CLIENT_ID!,
      refresh_token: refreshToken,
    })
    if (process.env.COGNITO_CLIENT_SECRET) body.set('client_secret', process.env.COGNITO_CLIENT_SECRET)

    const res = await fetch(`https://${domain}/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })
    if (!res.ok) throw new Error(`token endpoint ${res.status}`)

    const refreshed = (await res.json()) as {
      access_token: string
      id_token?: string
      expires_in: number
      refresh_token?: string
    }
    return {
      ...token,
      accessToken: refreshed.access_token,
      idToken: refreshed.id_token ?? token.idToken,
      accessTokenExpires: Date.now() + refreshed.expires_in * 1000,
      refreshToken: refreshed.refresh_token ?? refreshToken,
      error: undefined,
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

const nextAuth = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 30 * 24 * 60 * 60 },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  providers: [
    CognitoProvider({
      clientId: process.env.COGNITO_CLIENT_ID!,
      clientSecret: process.env.COGNITO_CLIENT_SECRET ?? '',
      issuer: cognitoIssuer,
    }),
    ...(process.env.COGNITO_ENDPOINT ? [buildLocalCredentialsProvider()] : []),
  ],
  pages: { signIn: '/login' },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      const isSignIn = Boolean(account && user)
      if (account && user) {
        token.sub = user.id ?? token.sub
        token.email = user.email ?? token.email ?? ''
        const u = user as Record<string, unknown>
        token.accessToken = (account.access_token as string) ?? u.accessToken
        token.idToken = (account.id_token as string) ?? u.idToken
        token.refreshToken = (account.refresh_token as string) ?? u.refreshToken
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : (u.accessTokenExpires as number | undefined)
      }
      if (isSignIn) {
        const p = await fetchProfile(token.idToken as string | undefined)
        token.name = p.name
        token.role = p.role
        token.status = p.status
      }

      // Cognito access/ID tokens expire in ~1h. Without renewal, every /admin/*
      // call 401s at the API Gateway authorizer once the idToken goes stale. Renew
      // via the stored refresh token before expiry (or when the client extends the
      // session), mirroring the webapp.
      const expires = token.accessTokenExpires as number | undefined
      if (expires && Date.now() < expires && trigger !== 'update') return token
      if (token.refreshToken) return refreshCognitoTokens(token as Record<string, unknown>)
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.email = token.email as string
      session.user.name = (token.name as string) ?? ''
      session.user.role = (token.role as string) ?? 'STANDARD'
      session.user.status = (token.status as string) ?? 'ACTIVE'
      session.error = token.error as string | undefined
      return session
    },
  },
})

export const { handlers, signIn, signOut, auth } = nextAuth
export const { GET, POST } = nextAuth.handlers
