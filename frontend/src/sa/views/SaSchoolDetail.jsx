import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft, MapPin, Mail, Phone, UserRound, Crown, CircleCheck, Ban, Play, Trash2, Pencil,
  Activity, Info, School
} from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import ActionMenu from '@/sa/components/ActionMenu'
import EmptyState from '@/sa/components/EmptyState'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { saStore, saActions, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtDate, timeAgo, initials } from '@/sa/format'

const tabs = [
  { key: 'overview', label: 'Overview' },
  { key: 'leadership', label: 'Leadership' },
  { key: 'subscription', label: 'Subscription' }
]

const roleLabel = (r) => ({ admin: 'School Admin', dos: 'Director of Studies', teacher: 'Teacher', student: 'Student' }[r] || r)

const userColumns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lastLoginAt', label: 'Last Login', sortable: true }
]

export default function SaSchoolDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useStore(saStore)
  const [searchParams] = useSearchParams()
  const [tab, setTab] = useState(String(searchParams.get('tab') || 'overview'))
  const [confirmSuspend, setConfirmSuspend] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  const school = saSelectors.schoolById(store)(id)

  const schoolUsers = store.users.filter((u) => u.schoolId === id)
  const leadershipUsers = schoolUsers.filter((u) => ['admin', 'dos'].includes(u.role))
  const schoolActivity = saSelectors.activitiesSorted(store).filter((a) => a.entityName?.includes(school?.name || '~~~')).slice(0, 8)

  const statStrip = [
    { label: 'User Accounts', value: schoolUsers.length },
    { label: 'Leadership', value: leadershipUsers.length },
    { label: 'Plan', value: school?.plan || '—' },
    { label: 'Status', value: school?.status || '—' }
  ]

  const planPrice = { Premium: '$249', Standard: '$129', Basic: '$49' }[school?.plan] || '$0'

  const infoFields = school ? [
    { label: 'School code', value: school.code },
    { label: 'District', value: school.location },
    { label: 'School leader', value: school.leader },
    { label: 'Contact email', value: school.email },
    { label: 'Phone', value: school.phone || '—' },
    { label: 'Registered', value: fmtDate(school.createdAt) },
    { label: 'Subscription plan', value: `${school.plan} (${planPrice}/month)` },
    { label: 'Status', value: school.status }
  ] : []
  const planToneCls = { Premium: 'text-[#6D5CE7]', Standard: 'text-[#1769E0]', Basic: 'text-[#627D98]' }[school?.plan] || ''

  const moreActions = [
    { label: 'Edit school', icon: Pencil, handler: () => navigate('/super-admin/schools') },
    { label: 'Delete school', icon: Trash2, danger: true, handler: () => { setConfirmDelete(true) } }
  ]

  async function approve() {
    try { await saActions.approveSchool(school.id); saActions.success(`${school.name} is now active.`, 'School approved') } catch (e) { saActions.apiError(e) }
  }
  async function suspend() {
    try { await saActions.suspendSchool(school.id); saActions.success(`${school.name} has been suspended.`, 'School suspended') } catch (e) { saActions.apiError(e) }
    setConfirmSuspend(false)
  }
  async function activate() {
    try { await saActions.activateSchool(school.id); saActions.success(`${school.name} has been reactivated.`, 'School activated') } catch (e) { saActions.apiError(e) }
  }
  async function remove() {
    const name = school.name
    try {
      await saActions.deleteSchool(school.id)
      saActions.success(`${name} was permanently deleted.`, 'School deleted')
      navigate('/super-admin/schools')
    } catch (e) { saActions.apiError(e) }
  }
  async function changePlan(plan) {
    try {
      await saActions.updateSchool(school.id, { plan })
      saActions.success(`${school.name} moved to the ${plan} plan.`, 'Subscription updated')
    } catch (e) { saActions.apiError(e) }
  }
  async function toggleUser(user) {
    const next = user.status === 'active' ? 'suspended' : 'active'
    try {
      await saActions.setUserStatus(user.id, next)
      saActions.success(`${user.name} ${next === 'active' ? 'activated' : 'suspended'}.`, 'Account updated')
    } catch (e) { saActions.apiError(e) }
  }

  return (
    <SaLayout>
      {!school ? (
        <div className="sa-card">
          <EmptyState icon={School} title="School not found" message="This school may have been removed from the platform.">
            <button type="button" className="sa-btn primary sm" onClick={() => navigate('/super-admin/schools')}>Back to schools</button>
          </EmptyState>
        </div>
      ) : (
        <>
          <div className="sa-card p-5 mb-5">
            <div className="flex flex-col lg:flex-row lg:items-center gap-4">
              <button type="button" className="sa-icon-btn !w-9 !h-9 border border-[#DCE5F0] shrink-0" aria-label="Back to schools" onClick={() => navigate('/super-admin/schools')}>
                <ArrowLeft size={17} />
              </button>
              <span className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#1769E0] to-[#0B2A4A] text-white grid place-items-center text-[17px] font-extrabold shrink-0">{school.code}</span>
              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[19px] sm:text-[22px] font-extrabold tracking-tight">{school.name}</h2>
                  <StatusBadge status={school.status} />
                  <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${planToneCls}`}><Crown size={13} /> {school.plan} plan</span>
                </div>
                <p className="text-[13px] text-[#627D98] mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                  <span className="inline-flex items-center gap-1.5"><MapPin size={13} /> {school.location}</span>
                  <span className="inline-flex items-center gap-1.5"><Mail size={13} /> {school.email}</span>
                  {school.phone ? <span className="inline-flex items-center gap-1.5"><Phone size={13} /> {school.phone}</span> : null}
                  <span className="inline-flex items-center gap-1.5"><UserRound size={13} /> Led by {school.leader}</span>
                </p>
                {school.status === 'rejected' && school.rejectReason ? (
                  <p className="mt-2 text-[12.5px] text-[#c62525] bg-[#FEECEC] rounded-lg px-3 py-2 w-fit">
                    Rejection reason: {school.rejectReason}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {school.status === 'pending' || school.status === 'rejected' ? <button type="button" className="sa-btn primary sm" onClick={approve}><CircleCheck size={15} /> Approve</button> : null}
                {school.status === 'active' ? <button type="button" className="sa-btn ghost sm !text-[#EF4444] !border-[#f3caca]" onClick={() => setConfirmSuspend(true)}><Ban size={15} /> Suspend</button> : null}
                {school.status === 'suspended' ? <button type="button" className="sa-btn primary sm" onClick={activate}><Play size={15} /> Reactivate</button> : null}
                <ActionMenu items={moreActions} label={`More actions for ${school.name}`} />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
              {statStrip.map((s) => (
                <div key={s.label} className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-[#829AB1]">{s.label}</p>
                  <p className="text-[20px] font-extrabold text-[#102A43] tabular-nums mt-0.5">{s.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4" role="tablist" aria-label="School sections">
            {tabs.map((t) => (
              <button key={t.key} type="button" role="tab" aria-selected={tab === t.key}
                className={`sa-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>{t.label}</button>
            ))}
          </div>

          {tab === 'overview' ? (
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
              <div className="sa-card xl:col-span-2">
                <div className="sa-card-head"><h3 className="sa-card-title"><Info size={16} className="text-[#1769E0]" /> School Information</h3></div>
                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 p-5 text-[13.5px]">
                  {infoFields.map((f) => (
                    <div key={f.label}>
                      <dt className="text-[11.5px] font-bold uppercase tracking-wide text-[#829AB1]">{f.label}</dt>
                      <dd className="mt-1 font-medium text-[#102A43]">{f.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="sa-card h-fit">
                <div className="sa-card-head"><h3 className="sa-card-title"><Activity size={16} className="text-[#1769E0]" /> Recent Activity</h3></div>
                <ul className="divide-y divide-[#f0f4fa]">
                  {schoolActivity.slice(0, 6).map((a) => (
                    <li key={a.id} className="px-5 py-3">
                      <p className="text-[13px] font-semibold text-[#102A43]">{a.action}</p>
                      <p className="text-[12px] text-[#627D98] truncate">{a.entityName}</p>
                      <time className="text-[11px] text-[#829AB1]">{timeAgo(a.createdAt)}</time>
                    </li>
                  ))}
                  {!schoolActivity.length ? <li className="px-5 py-6 text-center text-[13px] text-[#829AB1]">No activity recorded for this school yet.</li> : null}
                </ul>
              </div>
            </div>
          ) : null}

          {tab === 'leadership' ? (
            <DataTable columns={[
              { ...userColumns[0], render: (row) => (
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-full bg-[#EAF3FF] text-[#1769E0] grid place-items-center text-[11px] font-bold shrink-0">{initials(row.name)}</span>
                  <div className="min-w-0"><p className="font-semibold text-[#102A43] truncate">{row.name}</p><p className="text-[11.5px] text-[#829AB1] truncate">{row.email}</p></div>
                </div>
              ) },
              { ...userColumns[1], render: (row) => <span className="font-semibold text-[#102A43]">{roleLabel(row.role)}</span> },
              { ...userColumns[2], render: (row) => <StatusBadge status={row.status} /> },
              { ...userColumns[3], render: (row) => <span className="text-[#627D98]">{row.lastLoginAt ? timeAgo(row.lastLoginAt) : 'Never'}</span> }
            ]} rows={leadershipUsers} itemLabel="accounts"
              emptyTitle="No leadership accounts" emptyMessage={`Directors of Studies and administrators of ${school.name} will appear here.`}
              actions={(row) => (
                <ActionMenu items={[
                  { label: row.status === 'active' ? 'Suspend account' : 'Activate account', icon: row.status === 'active' ? Ban : Play, danger: row.status === 'active', handler: () => toggleUser(row) }
                ]} label={`Actions for ${row.name}`} />
              )}
            />
          ) : null}

          {tab === 'subscription' ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="sa-card p-5 lg:col-span-2">
                <h3 className="sa-card-title mb-4"><Crown size={16} className="text-[#f59e0b]" /> Current Subscription</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <div className={`rounded-xl border-2 p-5 grow ${school.plan === 'Premium' ? 'border-[#6D5CE7] bg-[#faf7ff]' : school.plan === 'Standard' ? 'border-[#1769E0] bg-[#f5f9ff]' : 'border-[#cbd5e1] bg-[#f8fafd]'}`}>
                    <p className="text-[12px] font-bold uppercase tracking-wide text-[#829AB1]">Plan</p>
                    <p className="text-[24px] font-extrabold text-[#102A43]">{school.plan}</p>
                    <p className="text-[12.5px] text-[#627D98] mt-1">{planPrice}/month · billed per term</p>
                  </div>
                  <div className="grow space-y-3 text-[13.5px]">
                    <p className="flex justify-between border-b border-[#eef2f9] pb-2.5"><span className="text-[#627D98]">Status</span><StatusBadge status={school.status} /></p>
                    <p className="flex justify-between border-b border-[#eef2f9] pb-2.5"><span className="text-[#627D98]">Registered</span><span className="font-semibold">{fmtDate(school.createdAt)}</span></p>
                    <p className="flex justify-between border-b border-[#eef2f9] pb-2.5"><span className="text-[#627D98]">Last activity</span><span className="font-semibold">{timeAgo(school.lastActivityAt)}</span></p>
                  </div>
                </div>
              </div>
              <div className="sa-card p-5 h-fit">
                <h3 className="sa-card-title mb-3">Change Plan</h3>
                <p className="text-[12.5px] text-[#627D98] mb-4">Upgrades take effect immediately; downgrades apply at the next billing term.</p>
                <div className="space-y-2">
                  {['Premium', 'Standard', 'Basic'].map((p) => (
                    <button key={p} type="button"
                      className={`w-full sa-btn ${school.plan === p ? 'primary' : 'ghost'}`} disabled={school.plan === p}
                      onClick={() => changePlan(p)}>{p}{school.plan === p ? ' · current' : ''}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </>
      )}

      <ConfirmDialog open={confirmSuspend} title="Suspend school?" danger confirmLabel="Suspend school"
        message={`Suspending ${school?.name} will block its users from signing in and pause access until reactivated.`}
        onCancel={() => setConfirmSuspend(false)} onConfirm={suspend} />
      <ConfirmDialog open={confirmDelete} title="Delete school permanently?" danger confirmLabel="Delete school"
        message={`This permanently removes ${school?.name}. This cannot be undone.`}
        onCancel={() => setConfirmDelete(false)} onConfirm={remove} />
    </SaLayout>
  )
}
