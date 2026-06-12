'use server'

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

export async function registerUser(
  email: string,
  password: string,
  fullName: string,
  country: string,
  language: string,
  currency: string,
): Promise<{ error?: string }> {
  try {
    const signUpResult = await cognitoClient().send(
      new SignUpCommand({
        ClientId: clientId(),
        Username: email,
        Password: password,
        UserAttributes: [
          { Name: 'email',            Value: email },
          { Name: 'custom:full_name', Value: fullName },
          { Name: 'custom:country',   Value: country },
          { Name: 'custom:language',  Value: language },
          { Name: 'custom:currency',  Value: currency },
        ],
      }),
    )

    const cognitoSub = signUpResult.UserSub

    if (isLocal()) {
      // cognito-local doesn't fire Lambda triggers — auto-confirm and provision manually
      await cognitoClient().send(
        new AdminConfirmSignUpCommand({
          UserPoolId: userPoolId(),
          Username: email,
        }),
      )

      if (cognitoSub) {
        await provisionUser({ cognitoSub, email, fullName, country, language, currency }).catch(
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
