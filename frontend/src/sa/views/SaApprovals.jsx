import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { School, UserRound, Eye, CircleCheck, CircleX, Send, CalendarDays, MapPin, History } from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import EmptyState from '@/sa/components/EmptyState'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { saStore, saActions, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtDate, fmtDateTime, timeAgo } from '@/sa/format'

const roleLabel = (r) => ({ teacher: 'Teacher', dos: 'Director of Studies', admin: 'School Administrator', student: 'Student' }[r] || r)

const historyColumns = [
  { key: 'action', label: 'Decision', sortable: true },
  { key: 'entityName', label: 'Entity', sortable: true },
  { key: 'actor', label: 'Decided By', sortable: true },
  { key: 'status', label: 'Outcome', sortable: true },
  { key: 'createdAt', label: 'Date', sortable: true }
]

export default function SaApprovals() {
  const store = useStore(saStore)
  const navigate = useNavigate()
  const [tab, setTab] = useState('schools')
  const [approveTarget, setApproveTarget] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)

  const pendingSchools = saSelectors.pendingSchools(store)
  const pendingUsers = saSelectors.pendingUsers(store)
  const schoolById = saSelectors.schoolById(store)

  const tabs = [
    { key: 'schools', label: 'Pending Schools', count: pendingSchools.length },
    { key: 'users', label: 'Pending Users', count: pendingUsers.length },
    { key: 'history', label: 'Decision History', count: 0 }
  ]

  const queue = (() => {
    if (tab === 'schools') {
      return pendingSchools.map((s) => ({
        kind: 'school', id: s.id, title: s.name, createdAt: s.createdAt, location: s.location,
        subtitle: `${s.plan} plan · ${s.email} · Leader: ${s.leader}`, submittedBy: s.leader, raw: s
      }))
    }
    return pendingUsers.map((u) => ({
      kind: 'user', id: u.id, title: u.name, createdAt: u.createdAt,
      location: schoolById(u.schoolId)?.location || '',
      subtitle: `${roleLabel(u.role)} · ${u.email} · ${schoolById(u.schoolId)?.name || 'No school'}`,
      submittedBy: u.email, raw: u
    }))
  })()

  const approvalHistory = store.activities.filter((a) => /approv|reject/i.test(a.action)).slice(0, 60)

  const approveMessage = approveTarget?.kind === 'school'
    ? `${approveTarget?.title} will become active and its team will gain access to the platform.`
    : `${approveTarget?.title} will be able to sign in with their registered email.`

  function viewItem(item) {
    if (item.kind === 'school') navigate(`/super-admin/schools/${item.id}`)
    else navigate(`/super-admin/users?q=${encodeURIComponent(item.title)}`)
  }

  async function doApprove() {
    const t = approveTarget
    try {
      if (t.kind === 'school') await saActions.approveSchool(t.id)
      else await saActions.setUserStatus(t.id, 'active')
      saActions.success(`${t.title} has been approved.`, 'Approved')
    } catch (e) {
      saActions.apiError(e, 'Approval failed')
    }
    setApproveTarget(null)
  }

  async function doReject(reason) {
    const t = rejectTarget
    try {
      if (t.kind === 'school') await saActions.rejectSchool(t.id, reason)
      else await saActions.setUserStatus(t.id, 'rejected')
      saActions.success(`${t.title} has been rejected.`, 'Rejected')
    } catch (e) {
      saActions.apiError(e, 'Rejection failed')
    }
    setRejectTarget(null)
  }

  return (
    <SaLayout>
      <div className="mb-5">
        <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Approval Center</h2>
        <p className="text-[13px] text-[#627D98] mt-0.5">Review schools and user accounts waiting for your decision.</p>
      </div>

      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" role="tablist">
        {tabs.map((t) => (
          <button key={t.key} type="button" className={`sa-tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}
            {t.count ? (
              <span className={`ml-1.5 min-w-[19px] h-[19px] px-1 rounded-full text-[10.5px] font-bold inline-flex items-center justify-center ${
                tab === t.key ? 'bg-white/25 text-white' : 'bg-[#FFF7E6] text-[#b07409]'
              }`}>{t.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      {tab !== 'history' ? (
        <div className="space-y-3">
          {queue.map((item) => (
            <article key={item.kind + item.id}
              className="sa-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
              <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${item.kind === 'school' ? 'bg-[#EAF3FF] text-[#1769E0]' : 'bg-[#F0EEFF] text-[#6D5CE7]'}`}>
                {item.kind === 'school' ? <School size={20} /> : <UserRound size={20} />}
              </span>
              <div className="min-w-0 grow">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-[15px] font-bold text-[#102A43]">{item.title}</h3>
                  <StatusBadge status="pending" />
                </div>
                <p className="text-[12.5px] text-[#627D98] mt-1">{item.subtitle}</p>
                <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[12px] text-[#627D98]">
                  <span className="inline-flex items-center gap-1.5"><Send size={12} /> Submitted by {item.submittedBy}</span>
                  <span className="inline-flex items-center gap-1.5"><CalendarDays size={12} /> {fmtDate(item.createdAt)} ({timeAgo(item.createdAt)})</span>
                  {item.location ? <span className="inline-flex items-center gap-1.5"><MapPin size={12} /> {item.location}</span> : null}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button type="button" className="sa-btn ghost sm" onClick={() => viewItem(item)}><Eye size={14} /> Details</button>
                <button type="button" className="sa-btn soft sm !bg-[#FEECEC] !text-[#c62525]" onClick={() => setRejectTarget(item)}><CircleX size={14} /> Reject</button>
                <button type="button" className="sa-btn primary sm" onClick={() => setApproveTarget(item)}><CircleCheck size={14} /> Approve</button>
              </div>
            </article>
          ))}

          {!queue.length ? (
            <div className="sa-card">
              <EmptyState icon={CircleCheck} title="All caught up"
                message={`No ${tab === 'schools' ? 'school applications' : 'user registrations'} are waiting for review. New submissions will appear here automatically.`}>
                <button type="button" className="sa-btn ghost sm" onClick={() => setTab('history')}><History size={14} /> View decision history</button>
              </EmptyState>
            </div>
          ) : null}
        </div>
      ) : (
        <div>
          <DataTable columns={[
            { ...historyColumns[0], render: (row) => <span className="font-semibold text-[#102A43]">{row.action}</span> },
            historyColumns[1],
            historyColumns[2],
            { ...historyColumns[3], render: (row) => <StatusBadge status={row.status} /> },
            { ...historyColumns[4], render: (row) => <span className="text-[#627D98]">{fmtDateTime(row.createdAt)}</span> }
          ]} rows={approvalHistory} itemLabel="decisions" defaultSort="createdAt" defaultSortDir={-1}
            emptyTitle="No approval history" emptyMessage="Approved and rejected items will be recorded here." />
        </div>
      )}

      <ConfirmDialog open={!!approveTarget} danger={false} title={`Approve ${approveTarget?.kind === 'school' ? 'school' : 'account'}?`}
        confirmLabel="Approve" message={approveMessage} onCancel={() => setApproveTarget(null)} onConfirm={doApprove} />
      <ConfirmDialog open={!!rejectTarget} danger title={`Reject ${rejectTarget?.kind === 'school' ? 'school' : 'account'}?`}
        confirmLabel="Reject" requireReason reasonPlaceholder={rejectTarget?.kind === 'school' ? 'e.g. Incomplete registration documents' : 'e.g. Could not verify teaching credentials'}
        message="The applicant will be notified. Please explain the reason clearly."
        onCancel={() => setRejectTarget(null)} onConfirm={doReject} />
    </SaLayout>
  )
}
