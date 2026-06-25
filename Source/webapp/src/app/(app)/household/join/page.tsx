'use client'

import { Suspense, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Users, XCircle } from 'lucide-react'
import { Button, Card } from '@/components/ds'

type JoinState =
  | { status: 'joining' }
  | { status: 'joined'; name: string }
  | { status: 'error'; message: string }

function JoinFlow() {
  const params = useSearchParams()
  const router = useRouter()
  const token = params.get('token') ?? ''
  const [state, setState] = useState<JoinState>({ status: 'joining' })

  const accept = useCallback(async () => {
    if (!token) {
      setState({ status: 'error', message: 'This invite link is missing its token.' })
      return
    }
    setState({ status: 'joining' })
    try {
      const res = await fetch(`/api/households/accept-invite/${encodeURIComponent(token)}`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { message?: string }
        setState({
          status: 'error',
          message: body.message ?? 'This invite link is invalid or has expired.',
        })
        return
      }
      const household = (await res.json()) as { name: string }
      setState({ status: 'joined', name: household.name })
    } catch {
      setState({ status: 'error', message: 'Couldn’t join right now — please try again.' })
    }
  }, [token])

  useEffect(() => { void accept() }, [accept])

  return (
    <div className="pane">
      <h2 className="pane-title">Join household</h2>
      <Card className="panel hh-empty" data-testid="household-join">
        {state.status === 'joining' && (
          <>
            <div className="hh-empty-icon"><Users size={22} /></div>
            <h3 className="hh-empty-title">Joining…</h3>
            <p className="hh-empty-body">Validating your invite link.</p>
          </>
        )}
        {state.status === 'joined' && (
          <>
            <div className="hh-empty-icon hh-join-ok"><CheckCircle2 size={22} /></div>
            <h3 className="hh-empty-title">You’re in</h3>
            <p className="hh-empty-body">
              You joined <strong>{state.name}</strong>. Uploads you target at the household now
              draw from its shared weekly pool.
            </p>
            <Button onClick={() => router.push('/household')} data-testid="household-join-continue">
              Go to household
            </Button>
          </>
        )}
        {state.status === 'error' && (
          <>
            <div className="hh-empty-icon hh-join-err"><XCircle size={22} /></div>
            <h3 className="hh-empty-title">Couldn’t join</h3>
            <p className="hh-empty-body" data-testid="household-join-error">{state.message}</p>
            <Link href="/dashboard" className="btn btn--outline">Back to dashboard</Link>
          </>
        )}
      </Card>
    </div>
  )
}

export default function HouseholdJoinPage() {
  return (
    <Suspense fallback={<div className="pane"><h2 className="pane-title">Join household</h2></div>}>
      <JoinFlow />
    </Suspense>
  )
}
