import { useState } from 'react'
import { LoaderCircle, DatabaseZap, RotateCcw, ShieldCheck } from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { saStore, saActions } from '@/sa/store'
import { useStore } from '@/stores/useStore'

const tabs = [
  { key: 'general', label: 'General' },
  { key: 'policies', label: 'Policies & Notifications' },
  { key: 'data', label: 'Data & Maintenance' }
]

export default function SaSettings() {
  const store = useStore(saStore)
  const [tab, setTab] = useState('general')
  const [saving, setSaving] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  const settings = store.settings
  const [general, setGeneral] = useState({
    platformName: settings.platformName,
    supportEmail: settings.supportEmail,
    defaultPlan: settings.defaultPlan,
    sessionTimeout: settings.sessionTimeout
  })
  const [errors, setErrors] = useState({})

  const policyRows = [
    { key: 'autoApproveSchools', label: 'Auto-approve new schools', desc: 'When enabled, school registrations skip manual review. Not recommended.' },
    { key: 'conflictDetection', label: 'Timetable conflict detection', desc: 'Continuously scan published timetables for teacher, room and class clashes.' },
    { key: 'emailNotifications', label: 'Email notifications', desc: 'Send approval results and timetable publishes by email.' },
    { key: 'smsNotifications', label: 'SMS notifications', desc: 'Send urgent alerts (conflicts, suspensions) by SMS.' },
    { key: 'weeklyDigest', label: 'Weekly digest', desc: 'Email a platform summary to the Super Admin every Monday.' },
    { key: 'twoFactorRequired', label: 'Require 2FA for admins', desc: 'All school administrators must enrol in two-factor authentication.' },
    { key: 'maintenanceMode', label: 'Maintenance mode', desc: 'Temporarily block school-side access while you work on the platform.' }
  ]

  function saveGeneral(event) {
    event.preventDefault()
    const next = {}
    if (general.platformName.length < 2) next.platformName = 'Platform name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(general.supportEmail)) next.supportEmail = 'Enter a valid email address.'
    if (!general.sessionTimeout || general.sessionTimeout < 5 || general.sessionTimeout > 480) next.sessionTimeout = 'Between 5 and 480 minutes.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setTimeout(() => {
      saActions.updateSettings({ ...general })
      setSaving(false)
      saActions.success('Platform settings saved.', 'Settings updated')
    }, 400)
  }

  function togglePolicy(key) {
    saActions.updateSettings({ [key]: !settings[key] })
    saActions.success(`${policyRows.find((p) => p.key === key)?.label} ${settings[key] ? 'enabled' : 'disabled'}.`, 'Policy updated')
  }

  function resetData() {
    setConfirmReset(false)
    saActions.resetDemoData()
    const s = saStore.getState().settings
    setGeneral({ platformName: s.platformName, supportEmail: s.supportEmail, defaultPlan: s.defaultPlan, sessionTimeout: s.sessionTimeout })
  }

  return (
    <SaLayout>
      <div className="mb-5">
        <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Platform Settings</h2>
        <p className="text-[13px] text-[#627D98] mt-0.5">Global configuration for the PANTA platform.</p>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`sa-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'general' ? (
        <form className="sa-card p-5 sm:p-6 max-w-2xl space-y-4" onSubmit={saveGeneral}>
          <div>
            <label className="sa-label" htmlFor="set-name">Platform name <span className="req">*</span></label>
            <input id="set-name" value={general.platformName} onChange={(e) => setGeneral((g) => ({ ...g, platformName: e.target.value.trim() }))} className={`sa-input ${errors.platformName ? 'err' : ''}`} />
            {errors.platformName ? <p className="sa-err">{errors.platformName}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="set-email">Support email <span className="req">*</span></label>
            <input id="set-email" value={general.supportEmail} onChange={(e) => setGeneral((g) => ({ ...g, supportEmail: e.target.value.trim() }))} type="email" className={`sa-input ${errors.supportEmail ? 'err' : ''}`} />
            {errors.supportEmail ? <p className="sa-err">{errors.supportEmail}</p> : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="sa-label" htmlFor="set-plan">Default subscription plan</label>
              <select id="set-plan" value={general.defaultPlan} onChange={(e) => setGeneral((g) => ({ ...g, defaultPlan: e.target.value }))} className="sa-select"><option>Premium</option><option>Standard</option><option>Basic</option></select>
            </div>
            <div>
              <label className="sa-label" htmlFor="set-timeout">Session timeout (minutes)</label>
              <input id="set-timeout" value={general.sessionTimeout} onChange={(e) => setGeneral((g) => ({ ...g, sessionTimeout: Number(e.target.value) }))} type="number" min="5" max="480" className={`sa-input ${errors.sessionTimeout ? 'err' : ''}`} />
              {errors.sessionTimeout ? <p className="sa-err">{errors.sessionTimeout}</p> : null}
            </div>
          </div>
          <div className="pt-2 flex justify-end">
            <button type="submit" className="sa-btn primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : null} Save settings</button>
          </div>
        </form>
      ) : null}

      {tab === 'policies' ? (
        <div className="sa-card max-w-2xl divide-y divide-[#f0f4fa]">
          {policyRows.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-4 px-5 sm:px-6 py-4">
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-[#102A43]">{p.label}</p>
                <p className="text-[12.5px] text-[#627D98] mt-0.5">{p.desc}</p>
              </div>
              <button type="button" role="switch" aria-checked={!!settings[p.key]} aria-label={p.label}
                className={`relative w-11 h-6 rounded-full transition shrink-0 ${settings[p.key] ? 'bg-[#1769E0]' : 'bg-[#d5e0ef]'}`}
                onClick={() => togglePolicy(p.key)}>
                <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${settings[p.key] ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {tab !== 'general' && tab !== 'policies' ? (
        <div className="max-w-2xl space-y-4">
          <div className="sa-card p-5 sm:p-6">
            <h3 className="sa-card-title mb-1.5"><DatabaseZap size={16} className="text-[#1769E0]" /> Demo Data</h3>
            <p className="text-[13px] text-[#627D98] mb-4">Reset the platform's sample dataset back to its original state. All changes you made (approvals, new schools, settings) will be discarded.</p>
            <button type="button" className="sa-btn ghost !text-[#EF4444] !border-[#f3caca]" onClick={() => setConfirmReset(true)}><RotateCcw size={15} /> Reset demo data</button>
          </div>
          <div className="sa-card p-5 sm:p-6">
            <h3 className="sa-card-title mb-1.5"><ShieldCheck size={16} className="text-[#1769E0]" /> Security Notes</h3>
            <ul className="text-[13px] text-[#627D98] space-y-2 list-disc pl-5 leading-relaxed">
              <li>Sensitive operations (approvals, deletions, plan changes) are confirmed in the UI and recorded in the audit log.</li>
              <li>Role checks are enforced by the router and must also be enforced by the backend API for every endpoint.</li>
              <li>Passwords, tokens and API keys are never displayed in this console.</li>
            </ul>
          </div>
        </div>
      ) : null}

      <ConfirmDialog open={confirmReset} title="Reset demo data?" danger confirmLabel="Reset everything"
        message="This discards all local changes and regenerates the original sample dataset. This action cannot be undone."
        onCancel={() => setConfirmReset(false)} onConfirm={resetData} />
    </SaLayout>
  )
}
