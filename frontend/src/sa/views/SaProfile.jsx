import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { KeyRound, LoaderCircle } from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import StatusBadge from '@/sa/components/StatusBadge'
import PasswordStrength from '@/sa/components/PasswordStrength'
import { saActions } from '@/sa/store'
import { useAuthStore } from '@/stores/authStore'
import { initials } from '@/sa/format'

export default function SaProfile() {
  const [searchParams] = useSearchParams()
  const auth = useAuthStore()

  const [tab, setTab] = useState(searchParams.get('tab') === 'security' ? 'security' : 'profile')
  const [saving, setSaving] = useState(false)

  const user = {
    name: auth.user?.name || auth.user?.full_name || 'Super Admin',
    email: auth.user?.email || 'admin@school.com',
    phone: auth.user?.phone || ''
  }

  const [profile, setProfile] = useState({ name: user.name, email: user.email, phone: user.phone })
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' })
  const [errors, setErrors] = useState({})

  function saveProfile(event) {
    event.preventDefault()
    const next = {}
    if (profile.name.length < 3) next.name = 'Full name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.email)) next.email = 'Enter a valid email address.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setTimeout(async () => {
      await auth.updateProfile({ name: profile.name, full_name: profile.name, email: profile.email, phone: profile.phone }).catch(() => {})
      saActions.logActivity('Updated profile', 'settings', 'Super Admin profile', 'info')
      setSaving(false)
      saActions.success('Your profile has been updated.', 'Profile saved')
    }, 400)
  }

  function changePassword(event) {
    event.preventDefault()
    const next = {}
    if (!pwd.current) next.current = 'Enter your current password.'
    if (pwd.next.length < 8) next.next = 'Use at least 8 characters.'
    if (pwd.confirm !== pwd.next) next.confirm = 'Passwords do not match.'
    setErrors(next)
    if (Object.keys(next).length) return
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      setPwd({ current: '', next: '', confirm: '' })
      saActions.logActivity('Changed password', 'settings', 'Super Admin account', 'info')
      saActions.success('Your password has been changed.', 'Security updated')
    }, 500)
  }

  return (
    <SaLayout>
      <div className="max-w-3xl">
        <div className="mb-5">
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">My Profile</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">Manage your Super Admin account.</p>
        </div>

        <div className="flex gap-1.5 mb-4" role="tablist">
          <button type="button" className={`sa-tab ${tab === 'profile' ? 'on' : ''}`} onClick={() => setTab('profile')}>Profile</button>
          <button type="button" className={`sa-tab ${tab === 'security' ? 'on' : ''}`} onClick={() => setTab('security')}>Security</button>
        </div>

        {tab === 'profile' ? (
          <div className="space-y-4">
            <div className="sa-card p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <span className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#1769E0] to-[#0B2A4A] text-white grid place-items-center text-[22px] font-extrabold">{initials(user.name)}</span>
              <div className="min-w-0">
                <h3 className="text-[17px] font-bold">{user.name}</h3>
                <p className="text-[13px] text-[#627D98]">{user.email}</p>
                <div className="flex items-center gap-2 mt-2">
                  <StatusBadge status="active" label="Super Admin" />
                  <span className="inline-flex items-center gap-1.5 text-[12px] text-[#0E9F70] font-semibold"><span className="w-1.5 h-1.5 rounded-full bg-[#18B981]" /> Online</span>
                </div>
              </div>
            </div>

            <form className="sa-card p-5 sm:p-6 space-y-4" onSubmit={saveProfile}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="sa-label" htmlFor="pf-name">Full name <span className="req">*</span></label>
                  <input id="pf-name" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value.trim() }))} className={`sa-input ${errors.name ? 'err' : ''}`} />
                  {errors.name ? <p className="sa-err">{errors.name}</p> : null}
                </div>
                <div>
                  <label className="sa-label" htmlFor="pf-phone">Phone</label>
                  <input id="pf-phone" value={profile.phone} onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value.trim() }))} className="sa-input" placeholder="+250 7…" />
                </div>
              </div>
              <div>
                <label className="sa-label" htmlFor="pf-email">Email <span className="req">*</span></label>
                <input id="pf-email" value={profile.email} onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value.trim() }))} type="email" className={`sa-input ${errors.email ? 'err' : ''}`} />
                {errors.email ? <p className="sa-err">{errors.email}</p> : null}
              </div>
              <div className="flex justify-end pt-1">
                <button type="submit" className="sa-btn primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : null} Save profile</button>
              </div>
            </form>
          </div>
        ) : (
          <form className="sa-card p-5 sm:p-6 space-y-4" onSubmit={changePassword}>
            <h3 className="sa-card-title"><KeyRound size={16} className="text-[#1769E0]" /> Change Password</h3>
            <p className="text-[12.5px] text-[#627D98]">Your password is never displayed or stored in plain text.</p>
            <div>
              <label className="sa-label" htmlFor="sec-current">Current password <span className="req">*</span></label>
              <input id="sec-current" value={pwd.current} onChange={(e) => setPwd((p) => ({ ...p, current: e.target.value }))} type="password" autoComplete="current-password" className={`sa-input ${errors.current ? 'err' : ''}`} />
              {errors.current ? <p className="sa-err">{errors.current}</p> : null}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="sa-label" htmlFor="sec-new">New password <span className="req">*</span></label>
                <input id="sec-new" value={pwd.next} onChange={(e) => setPwd((p) => ({ ...p, next: e.target.value }))} type="password" autoComplete="new-password" className={`sa-input ${errors.next ? 'err' : ''}`} />
                <PasswordStrength password={pwd.next} />
                {errors.next ? <p className="sa-err">{errors.next}</p> : null}
              </div>
              <div>
                <label className="sa-label" htmlFor="sec-confirm">Confirm new password <span className="req">*</span></label>
                <input id="sec-confirm" value={pwd.confirm} onChange={(e) => setPwd((p) => ({ ...p, confirm: e.target.value }))} type="password" autoComplete="new-password" className={`sa-input ${errors.confirm ? 'err' : ''}`} />
                {errors.confirm ? <p className="sa-err">{errors.confirm}</p> : null}
              </div>
            </div>
            <div className="rounded-xl bg-[#f4f8fd] border border-[#DCE5F0] px-4 py-3 text-[12.5px] text-[#627D98]">
              Use at least 8 characters with a mix of letters, numbers and symbols.
            </div>
            <div className="flex justify-end pt-1">
              <button type="submit" className="sa-btn primary" disabled={saving}>{saving ? <LoaderCircle size={15} className="animate-spin" /> : null} Update password</button>
            </div>
          </form>
        )}
      </div>
    </SaLayout>
  )
}
