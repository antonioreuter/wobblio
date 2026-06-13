'use client'

import { Users, UserPlus, Shield, Activity, Check } from 'lucide-react'

export default function HouseholdPage() {
  const members = [
    {
      name: 'Antonio Reuter',
      role: 'Head of House',
      roleColor: 'text-indigo-500 bg-indigo-500/10',
      scans: 5,
      limit: 5,
      avatar: 'AR',
      status: 'Active'
    },
    {
      name: 'Gemini Agent',
      role: 'Co-CFO',
      roleColor: 'text-teal-500 bg-teal-500/10',
      scans: 2,
      limit: 5,
      avatar: 'GA',
      status: 'Active'
    }
  ]

  const activities = [
    {
      user: 'Antonio Reuter',
      action: 'uploaded a receipt from AH To Go',
      time: '2 hours ago',
      amount: '€12.15'
    },
    {
      user: 'Gemini Agent',
      action: 'verified a receipt from Jumbo Oostpoort',
      time: '5 hours ago',
      amount: '€28.74'
    },
    {
      user: 'Antonio Reuter',
      action: 'updated Dining category budget limit',
      time: '1 day ago'
    }
  ]

  const totalScansUsed = members.reduce((acc, m) => acc + m.scans, 0)
  const totalLimit = 10
  const pctUsed = Math.round((totalScansUsed / totalLimit) * 100)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[24px] font-bold text-[#0f172a] dark:text-[#f1f5f9]">Household Sync</h1>
          <p className="text-sm text-[#64748b] dark:text-[#94a3b8] mt-1">
            Collaborate on budgets, scan pools, and price indices with family members.
          </p>
        </div>
        <button
          className="inline-flex h-10 items-center justify-center rounded-lg bg-aurora-teal px-4 text-xs font-semibold text-white hover:bg-[#0f766e] min-h-[44px]"
          onClick={() => alert('Invite member flow coming soon!')}
        >
          <UserPlus size={14} className="mr-1.5" />
          Invite Member
        </button>
      </div>

      <div className="household-grid">
        {/* Left Column: Members Pool */}
        <div className="flex flex-col gap-5">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <Users size={14} className="text-aurora-teal" />
            Household Members
          </h2>

          <div className="flex flex-col gap-4">
            {members.map((m, idx) => (
              <div key={idx} className="glass-card p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-teal-500 text-white font-bold flex items-center justify-center text-sm">
                    {m.avatar}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f1f5f9]">
                        {m.name}
                      </h3>
                      {m.name.includes('(You)') && (
                        <span className="text-[9px] bg-slate-200 dark:bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-bold">
                          YOU
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${m.roleColor}`}>
                        {m.role}
                      </span>
                      <span className="text-[10px] text-teal-500 font-semibold flex items-center gap-0.5">
                        <Check size={10} /> {m.status}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-slate-400 block font-semibold">Usage Pool</span>
                  <span className="text-sm font-bold text-[var(--text-primary)] font-mono">
                    {m.scans} / {m.limit} scans
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Shared Scans & Log */}
        <div className="flex flex-col gap-6 sticky top-6">
          {/* Quota display */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-1.5 border-b border-[var(--color-glass-border)] pb-3">
              <Shield size={14} className="text-indigo-400" />
              Shared Upload Pool
            </h3>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1.5">
                <span>Combined Monthly Quota</span>
                <span>{totalScansUsed} / {totalLimit} uploads used</span>
              </div>
              <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-teal-500 rounded-full transition-all duration-500"
                  style={{ width: `${pctUsed}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold">
                <span>{pctUsed}% Limit reached</span>
                <span>Reset in 18 days</span>
              </div>
            </div>

            <button
              onClick={() => alert('Upgrade options coming soon!')}
              className="btn btn--primary py-2 justify-center"
              style={{ fontSize: '12.5px' }}
            >
              Upgrade Storage Pool
            </button>
          </div>

          {/* Activity Log */}
          <div className="glass-card p-5 flex flex-col gap-4">
            <h3 className="text-sm font-bold text-[#0f172a] dark:text-[#f1f5f9] flex items-center gap-1.5 border-b border-[var(--color-glass-border)] pb-3">
              <Activity size={14} className="text-teal-400" />
              Recent Sync Activity
            </h3>

            <div className="flex flex-col gap-4">
              {activities.map((act, idx) => (
                <div key={idx} className="flex gap-2.5 items-start text-xs border-l-2 border-slate-700 pl-3">
                  <div className="flex-1">
                    <p className="text-slate-500 dark:text-slate-400 leading-normal">
                      <strong className="text-[var(--text-primary)]">{act.user}</strong> {act.action}
                      {act.amount && <span className="font-bold text-[var(--text-primary)] font-mono ml-1">{act.amount}</span>}
                    </p>
                    <span className="text-[10px] text-slate-400 block mt-0.5 font-medium">{act.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

