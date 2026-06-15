import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from './route'

const ENV_KEYS = ['COGNITO_ENDPOINT', 'COGNITO_DOMAIN', 'COGNITO_CLIENT_ID', 'NEXT_PUBLIC_SITE_URL', 'APP_ORIGIN'] as const

function makeReq() {
  return new NextRequest('https://app.dev.wobblio.com/api/auth/cognito-logout')
}

describe('GET /api/auth/cognito-logout', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k]
      delete process.env[k]
    }
    process.env.NEXT_PUBLIC_SITE_URL = 'https://app.dev.wobblio.com'
  })

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k]
      else process.env[k] = saved[k]
    }
  })

  it('redirects to the Cognito Hosted-UI /logout in dev/prod', async () => {
    process.env.COGNITO_DOMAIN = 'wobblio-dev.auth.eu-west-1.amazoncognito.com'
    process.env.COGNITO_CLIENT_ID = 'client123'

    const res = await GET(makeReq())
    const location = res.headers.get('location')!

    expect(res.status).toBe(307)
    expect(location).toContain('https://wobblio-dev.auth.eu-west-1.amazoncognito.com/logout')
    expect(location).toContain('client_id=client123')
    expect(location).toContain(`logout_uri=${encodeURIComponent('https://app.dev.wobblio.com/')}`)
  })

  it('expires the (chunked) NextAuth session cookies so logout forces re-login', async () => {
    process.env.COGNITO_DOMAIN = 'wobblio-dev.auth.eu-west-1.amazoncognito.com'
    process.env.COGNITO_CLIENT_ID = 'client123'

    const res = await GET(makeReq())
    const setCookie = res.headers.get('set-cookie') ?? ''

    // The chunked secure session cookie (the access-granting one under OpenNext)
    // must be cleared with an immediate expiry, not just left to signOut().
    for (const name of ['__Secure-authjs.session-token.0', '__Secure-authjs.session-token.1']) {
      const cleared = res.cookies.get(name)
      expect(cleared?.value).toBe('')
    }
    expect(setCookie).toMatch(/__Secure-authjs\.session-token\.0=;?/)
    expect(setCookie.toLowerCase()).toContain('max-age=0')
  })

  it('short-circuits to the landing page in local dev (cognito-local)', async () => {
    process.env.COGNITO_ENDPOINT = 'http://localhost:9229'
    process.env.COGNITO_DOMAIN = 'wobblio-dev.auth.eu-west-1.amazoncognito.com'
    process.env.COGNITO_CLIENT_ID = 'client123'

    const res = await GET(makeReq())

    expect(res.headers.get('location')).toBe('https://app.dev.wobblio.com/')
  })

  it('falls back to the landing page when Cognito config is absent', async () => {
    const res = await GET(makeReq())
    expect(res.headers.get('location')).toBe('https://app.dev.wobblio.com/')
  })
})
