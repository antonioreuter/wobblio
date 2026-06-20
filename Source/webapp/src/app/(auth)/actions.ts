'use server'

import { createHmac } from 'crypto'
import {
  CognitoIdentityProviderClient,
  SignUpCommand,
  AdminConfirmSignUpCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
} from '@aws-sdk/client-cognito-identity-provider'
import { provisionUser } from '@/lib/provision-user'

function cognitoClient() {
  return new CognitoIdentityProviderClient({
    region: process.env.COGNITO_REGION ?? 'eu-west-1',
    endpoint: process.env.COGNITO_ENDPOINT,
  })
}

const clientId = () => process.env.COGNITO_CLIENT_ID!
const userPoolId = () => process.env.COGNITO_USER_POOL_ID!
const isLocal = () => Boolean(process.env.COGNITO_ENDPOINT)

// The AWS web client is created with a secret (generateSecret: true), so every
// non-admin Cognito API call must carry a SecretHash. cognito-local issues no
// secret, so we omit it there (returns undefined → field dropped from request).
function secretHash(username: string): string | undefined {
  const secret = process.env.COGNITO_CLIENT_SECRET
  if (!secret) return undefined
  return createHmac('sha256', secret)
    .update(username + clientId())
    .digest('base64')
}

export async function registerUser(
  email: string,
  password: string,
): Promise<{ error?: string }> {
  try {
    // Sign-up collects credentials only — identical to the Cognito Hosted UI on
    // AWS (local↔dev parity). The full profile (name, consent, birthdate,
    // country, language) is gathered in the onboarding step and stored in the DB.
    const signUpResult = await cognitoClient().send(
      new SignUpCommand({
        ClientId: clientId(),
        Username: email,
        Password: password,
        SecretHash: secretHash(email),
        UserAttributes: [{ Name: 'email', Value: email }],
      }),
    )

    const cognitoSub = signUpResult.UserSub

    if (isLocal()) {
      // cognito-local fires no Lambda triggers — auto-confirm and provision the
      // (empty-profile, not-yet-onboarded) app_user row that the prod
      // post-confirmation hook would create.
      await cognitoClient().send(
        new AdminConfirmSignUpCommand({
          UserPoolId: userPoolId(),
          Username: email,
        }),
      )

      if (cognitoSub) {
        await provisionUser({ cognitoSub, email }).catch(
          err => console.error('[provision] registration provision failed', err),
        )
      }
    }

    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Registration failed'
    if (message.includes('UsernameExistsException') || message.includes('already exists')) {
      return { error: 'An account with this email already exists.' }
    }
    if (message.includes('InvalidPasswordException') || message.includes('Password')) {
      return { error: 'Password must be at least 12 characters with uppercase, lowercase, numbers, and symbols.' }
    }
    return { error: message }
  }
}


export async function sendPasswordResetCode(email: string): Promise<{ error?: string }> {
  try {
    await cognitoClient().send(
      new ForgotPasswordCommand({
        ClientId: clientId(),
        Username: email,
        SecretHash: secretHash(email),
      }),
    )
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send reset code'
    if (message.includes('UserNotFoundException') || message.includes('not found')) {
      // Return success anyway — don't reveal whether email exists
      return {}
    }
    return { error: message }
  }
}

export async function confirmPasswordReset(
  email: string,
  code: string,
  newPassword: string,
): Promise<{ error?: string }> {
  try {
    await cognitoClient().send(
      new ConfirmForgotPasswordCommand({
        ClientId: clientId(),
        Username: email,
        ConfirmationCode: code,
        Password: newPassword,
        SecretHash: secretHash(email),
      }),
    )
    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to reset password'
    if (message.includes('CodeMismatchException') || message.includes('Invalid verification code')) {
      return { error: 'Invalid or expired verification code.' }
    }
    if (message.includes('InvalidPasswordException') || message.includes('Password')) {
      return { error: 'Password must be at least 12 characters with uppercase, lowercase, numbers, and symbols.' }
    }
    return { error: message }
  }
}
