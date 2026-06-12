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
      role: string
      status: string
    }
  }
  interface JWT {
    sub: string
    email: string
    role: string
    status: string
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

        const idToken = result.AuthenticationResult?.IdToken
        if (!idToken) return null

        const payload = JSON.parse(
          Buffer.from(idToken.split('.')[1], 'base64url').toString(),
        )

        return {
          id: payload.sub,
          email: payload.email,
          role: payload['custom:role'] ?? 'STANDARD',
          status: payload['custom:status'] ?? 'ACTIVE',
        }
      } catch {
        return null
      }
    },
  })
}

const nextAuth = NextAuth({
  trustHost: true,
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: 'strict',
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
    async jwt({ token, user, account, profile }) {
      if (account && user) {
        token.sub = user.id ?? token.sub
        token.email = user.email ?? token.email ?? ''
        token.role = (user as { role?: string }).role ?? 'STANDARD'
        token.status = (user as { status?: string }).status ?? 'ACTIVE'

        // On first sign-in, ensure the user exists in app_user.
        // Covers: production OIDC sign-ins and local credentials sign-ins.
        // The provision endpoint is idempotent (ON CONFLICT DO NOTHING).
        // Note: provisionUser cannot be called here — auth.ts is imported by middleware
        // which runs on the Edge runtime (no Node.js built-ins, no pg).
        // Provisioning is handled by:
        //   - Local dev: actions.ts registerUser() after AdminConfirmSignUp
        //   - Production: post-confirmation-hook Lambda (Cognito trigger)
      }
      // OIDC provider: extract custom claims from Cognito ID token profile
      if (profile) {
        const p = profile as Record<string, string>
        token.role = p['custom:role'] ?? token.role ?? 'STANDARD'
        token.status = p['custom:status'] ?? token.status ?? 'ACTIVE'
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.sub as string
      session.user.email = token.email as string
      session.user.role = (token.role as string) ?? 'STANDARD'
      session.user.status = (token.status as string) ?? 'ACTIVE'
      return session
    },
  },
})

export const { handlers, signIn, signOut, auth } = nextAuth
export const { GET, POST } = nextAuth.handlers
