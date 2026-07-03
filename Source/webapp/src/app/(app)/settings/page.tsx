'use client'

import { useCallback, useEffect, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import {
  Check,
  ChevronDown,
  Construction,
  CreditCard,
  Download,
  Globe,
  Languages,
  MapPin,
  User,
  Users,
  Wallet,
} from 'lucide-react'
import { Badge, Button, Card, Input, ProgressBar, Switch } from '@/components/ds'
import {
  ExportRateLimitedError,
  fetchBillingPortalUrl,
  fetchExportDownload,
  fetchLatestExport,
  fetchMine,
  fetchProfile,
  requestExport,
  saveProfile,
  setPriceContributionOptout,
  useWorkspace,
  type ExportDownloadStatus,
  type ExportRequest,
  type HouseholdDetail,
  type Profile,
} from '@/components/workspace'
import { COUNTRIES, DEFAULT_COUNTRY, LANGUAGES, type Country } from '@/lib/locale-options'

const EXPORT_POLL_MS = 3000

export default function SettingsPage() {
  const { data: session } = useSession()
  const { showToast, usage } = useWorkspace()
  const role = session?.user?.role

  const [profile, setProfile] = useState<Profile | null>(null)
  const [household, setHousehold] = useState<HouseholdDetail | null>(null)
  const [loading, setLoading] = useState(true)

  const [fullName, setFullName] = useState('')
  const [country, setCountry] = useState<Country>(DEFAULT_COUNTRY)
  const [language, setLanguage] = useState(DEFAULT_COUNTRY.defaultLanguage)
  const [regionCode, setRegionCode] = useState('')
  const [regions, setRegions] = useState<{ code: string; name: string }[]>([])
  const [savingProfile, setSavingProfile] = useState(false)

  const [optout, setOptout] = useState(false)
  const [togglingOptout, setTogglingOptout] = useState(false)

  const [exportRequest, setExportRequest] = useState<ExportRequest | null>(null)
  const [requestingExport, setRequestingExport] = useState(false)
  const [resolvingDownload, setResolvingDownload] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [p, h, latest] = await Promise.all([
        fetchProfile(),
        fetchMine().catch(() => null),
        fetchLatestExport().catch(() => null),
      ])
      setProfile(p)
      setFullName(p.fullName)
      setLanguage(p.language)
      setRegionCode(p.regionCode ?? '')
      setCountry(COUNTRIES.find((c) => c.code === p.country) ?? DEFAULT_COUNTRY)
      setOptout(p.priceContributionOptout)
      setHousehold(h)
      setExportRequest(latest)
    } catch {
      showToast('Couldn’t load your settings — please refresh.', 'danger')
    } finally {
      setLoading(false)
    }
  }, [showToast])

  useEffect(() => { void load() }, [load])

  // Region options follow the selected country, mirroring the onboarding form.
  useEffect(() => {
    let active = true
    fetch(`/api/reference/regions?country=${country.code}`)
      .then((res) => (res.ok ? res.json() : { subdivisions: [] }))
      .then((data: { subdivisions?: { code: string; name: string }[] }) => {
        if (active) setRegions(data.subdivisions ?? [])
      })
      .catch(() => { if (active) setRegions([]) })
    return () => { active = false }
  }, [country.code])

  // Poll while an export is in flight; stops once it reaches a terminal status.
  useEffect(() => {
    if (!exportRequest || (exportRequest.status !== 'PENDING' && exportRequest.status !== 'PROCESSING')) return
    const timer = setTimeout(async () => {
      try {
        setExportRequest(await fetchLatestExport())
      } catch {
        // transient — the next poll tick will retry
      }
    }, EXPORT_POLL_MS)
    return () => clearTimeout(timer)
  }, [exportRequest])

  function handleCountryChange(code: string) {
    const c = COUNTRIES.find((x) => x.code === code) ?? DEFAULT_COUNTRY
    setCountry(c)
    setLanguage(c.defaultLanguage)
    setRegionCode('')
  }

  async function handleSaveProfile(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!profile) return
    const trimmed = fullName.trim()
    if (!trimmed) return showToast('Please enter your full name.', 'danger')
    if (regions.length > 0 && !regionCode) return showToast('Please select your region.', 'danger')

    setSavingProfile(true)
    try {
      await saveProfile({
        fullName: trimmed,
        country: country.code,
        regionCode,
        language,
        currency: country.currency,
        birthdate: profile.birthdate ?? '',
        consent: true,
      })
      showToast('Profile updated.', 'success')
      await load()
    } catch {
      showToast('Couldn’t save your profile — please try again.', 'danger')
    } finally {
      setSavingProfile(false)
    }
  }

  async function handleToggleOptout(next: boolean) {
    setOptout(next)
    setTogglingOptout(true)
    try {
      await setPriceContributionOptout(next)
      showToast(
        next
          ? 'You’ve opted out of price contributions.'
          : 'Thanks for contributing anonymous price points.',
        'success',
      )
    } catch {
      setOptout(!next)
      showToast('Couldn’t update this setting — please try again.', 'danger')
    } finally {
      setTogglingOptout(false)
    }
  }

  async function handleRequestExport() {
    setRequestingExport(true)
    try {
      const { requestId } = await requestExport()
      setExportRequest({
        id: requestId,
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
        completedAt: null,
      })
      showToast('Export requested — this can take a few minutes.', 'success')
    } catch (err) {
      showToast(
        err instanceof ExportRateLimitedError
          ? 'You can request one export per day — try again later.'
          : 'Couldn’t request an export — please try again.',
        'danger',
      )
    } finally {
      setRequestingExport(false)
    }
  }

  // Never reuses a previously-fetched URL: a fresh 300s presigned link is minted
  // per click, and the object may have aged past its 7-day lifecycle rule (EXPIRED).
  async function handleDownloadExport() {
    if (!exportRequest) return
    setResolvingDownload(true)
    try {
      const { status, downloadUrl } = await fetchExportDownload(exportRequest.id)
      if (status === 'COMPLETED' && downloadUrl) {
        window.location.href = downloadUrl
      } else {
        showToast(explainDownloadStatus(status), 'danger')
      }
    } catch {
      showToast('Couldn’t prepare your download — please try again.', 'danger')
    } finally {
      setResolvingDownload(false)
    }
  }

  async function handleManageBilling() {
    try {
      window.location.href = await fetchBillingPortalUrl()
    } catch {
      showToast('Couldn’t open the billing portal — please try again.', 'danger')
    }
  }

  if (loading) return <SettingsSkeleton />
  if (!profile) return null

  const usagePct = usage && !usage.unlimited && usage.cap ? Math.round((usage.used / usage.cap) * 100) : 0

  return (
    <div className="pane">
      <h2 className="pane-title">Settings</h2>
      <p className="pane-subtitle">Manage your profile, plan, and privacy preferences.</p>

      <Card className="panel" data-testid="settings-profile">
        <div className="panel-header"><span className="panel-title">Profile</span></div>
        <form onSubmit={handleSaveProfile} className="auth-form" noValidate>
          <Input
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            icon={<User size={16} />}
            data-testid="settings-fullname"
          />

          <div className="auth-grid-2">
            <div className="auth-field">
              <label htmlFor="settings-country" className="auth-field-label">Country</label>
              <div className="auth-control-wrap">
                <span className="lead-icon"><Globe size={16} /></span>
                <select
                  id="settings-country"
                  className="auth-select"
                  value={country.code}
                  onChange={(e) => handleCountryChange(e.target.value)}
                  data-testid="settings-country"
                >
                  {COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.name}</option>
                  ))}
                </select>
                <span className="chevron"><ChevronDown size={16} /></span>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-field-label">Display currency</label>
              <div className="auth-control-wrap">
                <span className="lead-icon"><Wallet size={16} /></span>
                <div className="auth-static" data-testid="settings-currency" aria-readonly="true">
                  <span>{country.currency} · {country.symbol}</span>
                  <span className="auto-tag">Auto</span>
                </div>
              </div>
            </div>
          </div>

          {regions.length > 0 && (
            <div className="auth-field">
              <label htmlFor="settings-region" className="auth-field-label">Region</label>
              <div className="auth-control-wrap">
                <span className="lead-icon"><MapPin size={16} /></span>
                <select
                  id="settings-region"
                  className="auth-select"
                  value={regionCode}
                  onChange={(e) => setRegionCode(e.target.value)}
                  data-testid="settings-region"
                >
                  <option value="">Select your region…</option>
                  {regions.map((r) => (
                    <option key={r.code} value={r.code}>{r.name}</option>
                  ))}
                </select>
                <span className="chevron"><ChevronDown size={16} /></span>
              </div>
            </div>
          )}

          <div className="auth-field">
            <label htmlFor="settings-language" className="auth-field-label">Preferred language</label>
            <div className="auth-control-wrap">
              <span className="lead-icon"><Languages size={16} /></span>
              <select
                id="settings-language"
                className="auth-select"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                data-testid="settings-language"
              >
                {LANGUAGES.map((l) => (
                  <option key={l.code} value={l.code}>{l.label}</option>
                ))}
              </select>
              <span className="chevron"><ChevronDown size={16} /></span>
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={savingProfile}
            iconLeft={savingProfile ? null : <Check size={16} />}
            data-testid="settings-save-profile"
          >
            {savingProfile ? 'Saving…' : 'Save profile'}
          </Button>
        </form>
      </Card>

      <Card className="panel" data-testid="settings-plan">
        <div className="pane-head-row">
          <div className="panel-header">
            <span className="panel-title">Plan &amp; usage</span>
            <Badge tone={role === 'PREMIUM' ? 'success' : 'primary'} style={{ marginLeft: 8 }}>{role}</Badge>
          </div>
          {role === 'PREMIUM' && (
            <Button
              variant="outline"
              iconLeft={<CreditCard size={15} />}
              onClick={handleManageBilling}
              data-testid="settings-manage-billing"
            >
              Manage billing
            </Button>
          )}
        </div>
        <div className="hh-pool-head" style={{ marginTop: 12 }}>
          <span className="hh-pool-title">Credits this week</span>
          <span className="hh-pool-count tabular">
            {usage ? (
              <>{usage.used} / {usage.unlimited ? '∞' : usage.cap} <span className="hh-pool-unit">used</span></>
            ) : '—'}
          </span>
        </div>
        <ProgressBar value={usagePct} ariaLabel={`Weekly credits ${usagePct}% used`} />
      </Card>

      <Card className="panel" data-testid="settings-household">
        <div className="pane-head-row">
          <div className="panel-header"><span className="panel-title">Household</span></div>
          <Link href="/household" className="btn btn--outline" data-testid="settings-manage-household">
            Manage household
          </Link>
        </div>
        <p className="pane-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Users size={14} />
          {household ? `${household.name} · ${household.members.length} member(s)` : 'You’re not in a household yet.'}
        </p>
      </Card>

      <Card className="panel" data-testid="settings-privacy">
        <div className="pane-head-row">
          <div>
            <div className="panel-header"><span className="panel-title">Privacy</span></div>
            <p className="pane-subtitle">
              Contribute anonymous price points to the community index. Helps power the regional
              price index — you can opt out any time.
            </p>
          </div>
          <Switch
            checked={!optout}
            onChange={(e) => handleToggleOptout(!e.target.checked)}
            disabled={togglingOptout}
            data-testid="settings-optout-toggle"
          />
        </div>
      </Card>

      <Card className="panel" data-testid="settings-export">
        <div className="panel-header"><span className="panel-title">Your data</span></div>
        <p className="pane-subtitle">Request a copy of everything Wobblio has stored for you.</p>
        <ExportStatusPanel
          request={exportRequest}
          requesting={requestingExport}
          resolvingDownload={resolvingDownload}
          onRequest={handleRequestExport}
          onDownload={handleDownloadExport}
        />
      </Card>

      <Card className="panel hh-upsell" data-testid="settings-delete">
        <div className="hh-upsell-icon"><Construction size={22} /></div>
        <h3 className="hh-upsell-title">Delete my account</h3>
        <p className="hh-upsell-body">
          Account deletion is coming soon. Once it ships, this will start a 30-day grace period
          during which you can sign back in to cancel.
        </p>
        <Button variant="outline" disabled data-testid="settings-delete-disabled">
          Delete my account
        </Button>
      </Card>
    </div>
  )
}

interface ExportStatusPanelProps {
  request: ExportRequest | null
  requesting: boolean
  resolvingDownload: boolean
  onRequest: () => void
  onDownload: () => void
}

function ExportStatusPanel({ request, requesting, resolvingDownload, onRequest, onDownload }: ExportStatusPanelProps) {
  if (!request || request.status === 'FAILED') {
    return (
      <>
        {request?.status === 'FAILED' && (
          <p className="pane-subtitle" data-testid="settings-export-status">Your last export failed.</p>
        )}
        <Button
          variant="outline"
          onClick={onRequest}
          disabled={requesting}
          iconLeft={<Download size={15} />}
          data-testid="settings-export-request"
        >
          {requesting ? 'Requesting…' : 'Request my data'}
        </Button>
      </>
    )
  }

  if (request.status === 'PENDING' || request.status === 'PROCESSING') {
    return (
      <p className="pane-subtitle" data-testid="settings-export-status">
        Preparing your export… this can take a few minutes.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
      <Button
        variant="outline"
        onClick={onDownload}
        disabled={resolvingDownload}
        iconLeft={<Download size={15} />}
        data-testid="settings-export-download"
      >
        {resolvingDownload ? 'Preparing…' : 'Download your data'}
      </Button>
      <Button variant="text" onClick={onRequest} disabled={requesting} data-testid="settings-export-request-again">
        Request a new export
      </Button>
    </div>
  )
}

function explainDownloadStatus(status: ExportDownloadStatus): string {
  if (status === 'EXPIRED') return 'This export expired 7 days after it was ready — request a new one.'
  return 'Your export isn’t ready yet — try again shortly.'
}

function SettingsSkeleton() {
  return (
    <div className="pane">
      <h2 className="pane-title">Settings</h2>
      <p className="pane-subtitle">Loading your settings…</p>
      <Card className="panel">
        <span className="sk sk-line" style={{ width: 200, height: 13 }} />
        <span className="sk sk-line" style={{ width: '100%', height: 8, marginTop: 16 }} />
        <span className="sk sk-line" style={{ width: 160, height: 11, marginTop: 16 }} />
      </Card>
    </div>
  )
}
