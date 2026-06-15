import NextAuth from 'next-auth'
import CognitoProvider from 'next-auth/providers/cognito'
import CredentialsProvider from 'next-auth/providers/credentials'
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
} from '@aws-sdk/client-cognito-identity-provider'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      status: string
      onboarded: boolean
    }
    // Set to 'RefreshAccessTokenError' when silent Cognito refresh fails
    // (refresh token expired after 30d or revoked). The client guard reads
    // this to force a sign-out + redirect to the landing page.
    error?: string
  }
  interface JWT {
    sub: string
    email: string
    name: string
    role: string
    status: string
    onboarded: boolean
    accessToken?: string
    // Cognito ID token — forwarded to the API Gateway Cognito authorizer, which
    // expects an ID token (no OAuth scopes configured on the methods).
    idToken?: string
    refreshToken?: string
    accessTokenExpires?: number
    error?: string
  }
}

const cognitoIssuer = process.env.COGNITO_ENDPOINT
  ? `${process.env.COGNITO_ENDPOINT}/${process.env.COGNITO_USER_POOL_ID}`
  : `https://cognito-idp.${process.env.COGNITO_REGION}.amazonaws.com/${process.env.COGNITO_USER_POOL_ID}`

// Local dev credentials provider — active only when COGNITO_ENDPOINT is set (cognito-local)
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

        const payload = JSON.parse(
          Buffer.from(idToken.split('.')[1], 'base64url').toString(),
        )

        return {
          id: payload.sub,
          email: payload.email,
          // name/role/status/onboarded are sourced from the database in the jwt
          // callback — never from Cognito attributes (those go stale in tokens).
          // Carry Cognito tokens so the jwt callback can persist them for
          // silent refresh. ExpiresIn is seconds-from-now.
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

// Renew the Cognito access token using the stored refresh token.
// Uses fetch (not @aws-sdk) so it stays Edge-runtime safe — auth.ts is
// imported by middleware.ts, which runs on the Edge. On any failure the
// token is flagged so the client guard signs the user out.
async function refreshCognitoTokens(token: Record<string, unknown>) {
  // Local dev (cognito-local) has no Hosted-UI token endpoint — extend the
  // access-token window locally so "Stay logged in" works against the emulator.
  if (process.env.COGNITO_ENDPOINT) {
    return { ...token, accessTokenExpires: Date.now() + 3600 * 1000, error: undefined }
  }

  const domain = process.env.COGNITO_DOMAIN
  const refreshToken = token.refreshToken as string | undefined

  if (!domain || !refreshToken) {
    return { ...token, error: 'RefreshAccessTokenError' }
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.COGNITO_CLIENT_ID!,
      refresh_token: refreshToken,
    })
    if (process.env.COGNITO_CLIENT_SECRET) {
      body.set('client_secret', process.env.COGNITO_CLIENT_SECRET)
    }

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
      // Cognito does not rotate the refresh token here; keep the existing one.
      refreshToken: refreshed.refresh_token ?? refreshToken,
      error: undefined,
    }
  } catch {
    return { ...token, error: 'RefreshAccessTokenError' }
  }
}

interface SessionProfile {
  onboarded: boolean
  name: string
  role: string
  status: string
}

const DEFAULT_PROFILE: SessionProfile = {
  onboarded: false,
  name: '',
  role: 'STANDARD',
  status: 'ACTIVE',
}

// Read the user's profile from the backend — the single source of truth
// (app_user). name/role/status/onboarded all come from here, never from Cognito
// attributes. Uses fetch so it stays Edge-runtime safe. Runs only at
// sign-in/refresh, not per navigation. Defaults (not onboarded) on any error so a
// transient backend issue keeps the user in onboarding rather than past the gate.
async function fetchProfile(idToken: string | undefined): Promise<SessionProfile> {
  if (!idToken) return DEFAULT_PROFILE
  const apiBase = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL
  if (!apiBase) return DEFAULT_PROFILE

  try {
    const res = await fetch(`${apiBase}/me/profile`, {
      headers: { Authorization: `Bearer ${idToken}` },
    })
    if (!res.ok) return DEFAULT_PROFILE
    const p = (await res.json()) as Partial<{
      onboarded: boolean
      fullName: string
      role: string
      status: string
    }>
    return {
      onboarded: Boolean(p.onboarded),
      name: p.fullName ?? '',
      role: p.role ?? 'STANDARD',
      status: p.status ?? 'ACTIVE',
    }
  } catch {
    return DEFAULT_PROFILE
  }
}

const nextAuth = NextAuth({
  trustHost: true,
  session: {
    strategy: 'jwt',
    // Cookie lifetime tracks the Cognito refresh token (30d). The 30-min idle
    // logout is enforced client-side by the SessionTimeoutGuard, not here.
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        // 'lax' (not 'strict') so the Hosted-UI OAuth return — a cross-site
        // top-level redirect — carries the session cookie on the landing request.
        // 'strict' drops it there, which bounces just-signed-in users to /login
        // and makes local (same-origin credentials) diverge from dev/prod.
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
  pages: {
    signIn: '/login',
  },
  callbacks: {
    async jwt({ token, user, account, trigger }) {
      const isSignIn = Boolean(account && user)

      if (account && user) {
        token.sub = user.id ?? token.sub
        token.email = user.email ?? token.email ?? ''

        // Persist Cognito tokens for silent refresh. OIDC sign-ins expose them
        // on `account`; local credentials sign-ins carry them on `user`.
        const u = user as Record<string, unknown>
        token.accessToken = (account.access_token as string) ?? u.accessToken
        token.idToken = (account.id_token as string) ?? u.idToken
        token.refreshToken = (account.refresh_token as string) ?? u.refreshToken
        token.accessTokenExpires = account.expires_at
          ? account.expires_at * 1000
          : (u.accessTokenExpires as number | undefined)

        // app_user is provisioned out-of-band (local: actions.ts registerUser;
        // production: post-confirmation-hook Lambda). provisionUser cannot run
        // here — auth.ts is imported by Edge middleware (no Node built-ins/pg).
      }

      // The database is the single source of truth for the profile. Read it once
      // per sign-in and carry name/role/status/onboarded on the token; the route
      // gates trust the token until the next sign-in/refresh. No Cognito claims.
      if (isSignIn) {
        const p = await fetchProfile(token.idToken as string | undefined)
        token.onboarded = p.onboarded
        token.name = p.name
        token.role = p.role
        token.status = p.status
      }

      // Access token still valid — nothing to do.
      const expires = token.accessTokenExpires as number | undefined
      if (expires && Date.now() < expires && trigger !== 'update') {
        return token
      }

      // Expired, or the client asked to extend the session ("Stay logged in").
      // Refresh only when we actually hold a Cognito refresh token.
      if (token.refreshToken) {
        return refreshCognitoTokens(token as Record<string, unknown>)
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.email = token.email as string
      session.user.name = (token.name as string) ?? ''
      session.user.role = (token.role as string) ?? 'STANDARD'
      session.user.status = (token.status as string) ?? 'ACTIVE'
      session.user.onboarded = Boolean(token.onboarded)
      session.error = token.error as string | undefined
      return session
    },
  },
})

export const { handlers, signIn, signOut, auth } = nextAuth
export const { GET, POST } = nextAuth.handlers
