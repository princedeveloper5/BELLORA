import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Plus, Search, Download, MapPin, Crown, School, LoaderCircle,
  Eye, Pencil, CircleCheck, CircleX, Ban, Play, Trash2
} from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { saStore, saActions, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtNumber, fmtDate, timeAgo, downloadCsv } from '@/sa/format'

const columns = [
  { key: 'name', label: 'School Name', sortable: true },
  { key: 'location', label: 'Location', sortable: true },
  { key: 'leader', label: 'School Leader', sortable: true },
  { key: 'students', label: 'Students', sortable: false },
  { key: 'teachers', label: 'Teachers', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'plan', label: 'Subscription', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true },
  { key: 'lastActivityAt', label: 'Last Activity', sortable: true }
]

const planTone = (plan) => ({ Premium: 'text-[#6D5CE7]', Standard: 'text-[#1769E0]', Basic: 'text-[#627D98]' }[plan] || 'text-[#627D98]')

const blank = { name: '', code: '', location: '', leader: '', email: '', phone: '', plan: 'Standard' }

export default function SaSchools() {
  const store = useStore(saStore)
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryStatus = searchParams.get('status') || ''
  const queryNew = searchParams.get('new')

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(String(queryStatus))
  const [planFilter, setPlanFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirm, setConfirm] = useState({ suspend: null, delete: null, reject: null, approve: null })
  const [form, setForm] = useState({ ...blank })
  const [errors, setErrors] = useState({})

  const pendingSchools = saSelectors.pendingSchools(store)
  const schoolStats = saSelectors.schoolStats(store)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 350)
    if (queryNew === '1') openAdd()
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (queryNew === '1') openAdd()
  }, [queryNew])

  useEffect(() => {
    setStatusFilter(String(queryStatus || ''))
  }, [queryStatus])

  const stats = (id) => schoolStats(id)

  const filtered = (() => {
    const q = search.toLowerCase()
    return store.schools.filter((s) => {
      if (statusFilter && s.status !== statusFilter) return false
      if (planFilter && s.plan !== planFilter) return false
      if (q && ![s.name, s.code, s.location, s.leader, s.email].some((v) => String(v).toLowerCase().includes(q))) return false
      return true
    })
  })()

  const statusChips = [
    { value: '', label: 'All', count: store.schools.length, dot: 'bg-[#94a3b8]' },
    { value: 'active', label: 'Active', count: store.schools.filter((s) => s.status === 'active').length, dot: 'bg-[#18B981]' },
    { value: 'pending', label: 'Pending', count: pendingSchools.length, dot: 'bg-[#f59e0b]' },
    { value: 'suspended', label: 'Suspended', count: store.schools.filter((s) => s.status === 'suspended').length, dot: 'bg-[#ef4444]' },
    { value: 'rejected', label: 'Rejected', count: store.schools.filter((s) => s.status === 'rejected').length, dot: 'bg-[#94a3b8]' }
  ]

  // ---- Actions ----------------------------------------------------------------
  const schoolActions = (row) => {
    const items = [
      { label: 'View details', icon: Eye, handler: () => navigate(`/super-admin/schools/${row.id}`) },
      { label: 'Edit school', icon: Pencil, handler: () => openEdit(row) }
    ]
    if (row.status === 'pending' || row.status === 'rejected') {
      items.push({ label: 'Approve & activate', icon: CircleCheck, handler: () => setConfirm((c) => ({ ...c, approve: row })) })
    }
    if (row.status === 'pending') {
      items.push({ label: 'Reject application', icon: CircleX, danger: true, handler: () => setConfirm((c) => ({ ...c, reject: row })) })
    }
    if (row.status === 'active') {
      items.push({ label: 'Suspend school', icon: Ban, danger: true, handler: () => setConfirm((c) => ({ ...c, suspend: row })) })
    }
    if (row.status === 'suspended') {
      items.push({
        label: 'Reactivate school', icon: Play, handler: async () => {
          try { await saActions.activateSchool(row.id); saActions.success(`${row.name} has been reactivated.`, 'School activated') } catch (e) { saActions.apiError(e) }
        }
      })
    }
    items.push({ label: 'Delete school', icon: Trash2, danger: true, handler: () => setConfirm((c) => ({ ...c, delete: row })) })
    return items
  }

  async function doApprove() {
    const target = confirm.approve
    try { await saActions.approveSchool(target.id); saActions.success(`${target.name} is now active.`, 'School approved') } catch (e) { saActions.apiError(e) }
    setConfirm((c) => ({ ...c, approve: null }))
  }
  async function doReject(reason) {
    const target = confirm.reject
    try { await saActions.rejectSchool(target.id, reason); saActions.success(`${target.name} application was rejected.`, 'Application rejected') } catch (e) { saActions.apiError(e) }
    setConfirm((c) => ({ ...c, reject: null }))
  }
  async function doSuspend() {
    const target = confirm.suspend
    try { await saActions.suspendSchool(target.id); saActions.success(`${target.name} has been suspended.`, 'School suspended') } catch (e) { saActions.apiError(e) }
    setConfirm((c) => ({ ...c, suspend: null }))
  }
  async function doDelete() {
    const target = confirm.delete
    try { await saActions.deleteSchool(target.id); saActions.success(`${target.name} was permanently deleted.`, 'School deleted') } catch (e) { saActions.apiError(e) }
    setConfirm((c) => ({ ...c, delete: null }))
  }

  // ---- Form ---------------------------------------------------------------------
  function openAdd() {
    setEditing(null)
    setForm({ ...blank })
    setErrors({})
    setFormOpen(true)
    if (searchParams.get('new')) setSearchParams({}, { replace: true })
  }
  function openEdit(row) {
    setEditing(row)
    setForm({ name: row.name, code: row.code, location: row.location, leader: row.leader, email: row.email, phone: row.phone, plan: row.plan })
    setErrors({})
    setFormOpen(true)
  }

  function validate() {
    const next = {}
    if (form.name.length < 3) next.name = 'School name must be at least 3 characters.'
    if (!/^[A-Za-z]{2,5}$/.test(form.code)) next.code = 'Code must be 2–5 letters.'
    else if (store.schools.some((s) => s.code.toUpperCase() === form.code.toUpperCase() && s.id !== editing?.id)) next.code = 'This code is already used by another school.'
    if (form.location.length < 2) next.location = 'Location is required.'
    if (form.leader.length < 3) next.leader = 'School leader is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    setErrors(next)
    return !Object.keys(next).length
  }

  async function saveSchool(event) {
    event.preventDefault()
    if (!validate()) return
    setSaving(true)
    try {
      if (editing) {
        await saActions.updateSchool(editing.id, { ...form, code: form.code.toUpperCase() })
        saActions.success(`${form.name} was updated.`, 'School updated')
      } else {
        const created = await saActions.addSchool({ ...form, code: form.code.toUpperCase() })
        saActions.success(`${created.name} was added and is pending approval.`, 'School added')
      }
      setSaving(false)
      setFormOpen(false)
    } catch (e) {
      setSaving(false)
      saActions.apiError(e, 'Could not save the school')
    }
  }

  function exportCsv() {
    downloadCsv('schools.csv',
      [
        { label: 'School Name', value: 'name' }, { label: 'Code', value: 'code' },
        { label: 'Location', value: 'location' }, { label: 'Leader', value: 'leader' },
        { label: 'Students', value: (r) => stats(r.id).students }, { label: 'Teachers', value: (r) => stats(r.id).teachers },
        { label: 'Status', value: 'status' }, { label: 'Plan', value: 'plan' },
        { label: 'Created', value: (r) => fmtDate(r.createdAt) }
      ], filtered)
    saActions.success(`${filtered.length} schools exported to CSV.`, 'Export complete')
  }

  return (
    <SaLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">School Management</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">{filtered.length} of {store.schools.length} schools · {pendingSchools.length} awaiting approval</p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" onClick={exportCsv}><Download size={15} /> Export</button>
          <button type="button" className="sa-btn primary" onClick={openAdd}><Plus size={16} /> Add School</button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2.5 mb-4">
        {statusChips.map((chip) => (
          <button key={chip.value} type="button"
            className={`flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              statusFilter === chip.value ? 'bg-[#0B2A4A] text-white border-[#0B2A4A]' : 'bg-white text-[#627D98] border-[#dde6f2] hover:border-[#1769E0]'
            }`}
            onClick={() => setStatusFilter(chip.value)}>
            <span className={`w-2 h-2 rounded-full ${chip.dot}`} />{chip.label}
            <span className="opacity-70 tabular-nums">{chip.count}</span>
          </button>
        ))}
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829AB1]" />
          <input value={search} onChange={(e) => setSearch(e.target.value.trim())} type="search" className="sa-input !pl-9" placeholder="Search by name, code, location or leader…" aria-label="Search schools" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sa-select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)} className="sa-select" aria-label="Filter by subscription plan">
          <option value="">All plans</option>
          <option>Premium</option>
          <option>Standard</option>
          <option>Basic</option>
        </select>
      </div>

      <DataTable columns={[
        { ...columns[0], render: (row) => (
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-9 h-9 rounded-lg bg-[#EAF3FF] text-[#1769E0] grid place-items-center text-[12px] font-extrabold shrink-0">{row.code}</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#102A43] truncate max-w-[220px]">{row.name}</p>
              <p className="text-[11.5px] text-[#829AB1] truncate">{row.email}</p>
            </div>
          </div>
        ) },
        { ...columns[1], render: (row) => (
          <span className="inline-flex items-center gap-1.5"><MapPin size={13} className="text-[#829AB1]" />{row.location}</span>
        ) },
        columns[2],
        { ...columns[3], render: (row) => <span className="tabular-nums font-semibold text-[#102A43]">{fmtNumber(stats(row.id).students)}</span> },
        { ...columns[4], render: (row) => <span className="tabular-nums font-semibold text-[#102A43]">{fmtNumber(stats(row.id).teachers)}</span> },
        { ...columns[5], render: (row) => <StatusBadge status={row.status} /> },
        { ...columns[6], render: (row) => (
          <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${planTone(row.plan)}`}>
            <Crown size={13} />{row.plan}
          </span>
        ) },
        { ...columns[7], render: (row) => fmtDate(row.createdAt) },
        { ...columns[8], render: (row) => <span className="text-[#627D98]">{timeAgo(row.lastActivityAt)}</span> }
      ]} rows={filtered} loading={loading} itemLabel="schools"
        defaultSort="name" emptyTitle="No schools found" emptyIcon={School}
        emptyMessage={store.schools.length ? 'No schools match the current search or filters.' : 'Schools registered on the platform will appear here.'}
        actions={(row) => <ActionMenu items={schoolActions(row)} label={`Actions for ${row.name}`} />}
        emptyAction={<button type="button" className="sa-btn primary sm" onClick={openAdd}><Plus size={15} /> Add School</button>}
      />

      <Modal open={formOpen} title={editing ? 'Edit School' : 'Add New School'} subtitle={editing ? `Updating ${editing.name}` : 'The school will be created as pending until approved'} onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" form="school-form" className="sa-btn primary" disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add school'}
            </button>
          </>
        }
      >
        <form id="school-form" className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate onSubmit={saveSchool}>
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="sf-name">School name <span className="req">*</span></label>
            <input id="sf-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.trim() }))} className={`sa-input ${errors.name ? 'err' : ''}`} placeholder="e.g. Green Valley High School" />
            {errors.name ? <p className="sa-err">{errors.name}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-code">School code <span className="req">*</span></label>
            <input id="sf-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.trim() }))} className={`sa-input uppercase ${errors.code ? 'err' : ''}`} placeholder="e.g. GVH" maxLength="5" />
            {errors.code ? <p className="sa-err">{errors.code}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-location">District / Location <span className="req">*</span></label>
            <input id="sf-location" value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value.trim() }))} className={`sa-input ${errors.location ? 'err' : ''}`} placeholder="e.g. Kigali" />
            {errors.location ? <p className="sa-err">{errors.location}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-leader">School leader <span className="req">*</span></label>
            <input id="sf-leader" value={form.leader} onChange={(e) => setForm((f) => ({ ...f, leader: e.target.value.trim() }))} className={`sa-input ${errors.leader ? 'err' : ''}`} placeholder="Head of school" />
            {errors.leader ? <p className="sa-err">{errors.leader}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-plan">Subscription plan <span className="req">*</span></label>
            <select id="sf-plan" value={form.plan} onChange={(e) => setForm((f) => ({ ...f, plan: e.target.value }))} className="sa-select"><option>Premium</option><option>Standard</option><option>Basic</option></select>
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-email">Contact email <span className="req">*</span></label>
            <input id="sf-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim() }))} type="email" className={`sa-input ${errors.email ? 'err' : ''}`} placeholder="info@school.ac.rw" />
            {errors.email ? <p className="sa-err">{errors.email}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-phone">Phone</label>
            <input id="sf-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.trim() }))} className="sa-input" placeholder="+250 7…" />
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirm.suspend} title="Suspend school?" danger confirmLabel="Suspend school"
        message={`Suspending ${confirm.suspend?.name} will block its users from signing in and pause its timetables until reactivated.`}
        onCancel={() => setConfirm((c) => ({ ...c, suspend: null }))} onConfirm={doSuspend} />
      <ConfirmDialog open={!!confirm.delete} title="Delete school permanently?" danger confirmLabel="Delete school"
        message={`This permanently removes ${confirm.delete?.name} together with its users, classes, rooms and timetables. This action cannot be undone.`}
        onCancel={() => setConfirm((c) => ({ ...c, delete: null }))} onConfirm={doDelete} />
      <ConfirmDialog open={!!confirm.reject} title="Reject school application?" danger confirmLabel="Reject application" requireReason
        reasonPlaceholder="e.g. Incomplete registration documents"
        message={`${confirm.reject?.name} will be notified that its application was rejected.`}
        onCancel={() => setConfirm((c) => ({ ...c, reject: null }))} onConfirm={doReject} />
      <ConfirmDialog open={!!confirm.approve} title="Approve school?" danger={false} confirmLabel="Approve & activate"
        message={`${confirm.approve?.name} will become active and its administrators will gain access to the platform.`}
        onCancel={() => setConfirm((c) => ({ ...c, approve: null }))} onConfirm={doApprove} />
    </SaLayout>
  )
}
