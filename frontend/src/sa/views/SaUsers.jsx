import { useEffect, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  UserPlus, Search, Users, LoaderCircle, GraduationCap, Briefcase, ShieldCheck, BookOpenCheck,
  Eye, Pencil, Ban, Play, CircleCheck, Trash2, KeyRound
} from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { saStore, saActions, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtDate, timeAgo, initials } from '@/sa/format'

const ROLE_PRESETS = { students: 'student', teachers: 'teacher', administrators: 'admin', dos: 'dos' }

const roleLabel = (r) => ({ student: 'Student', teacher: 'Teacher', admin: 'School Admin', dos: 'DOS' }[r] || r)
const roleIcon = (r) => ({ student: GraduationCap, teacher: Briefcase, admin: ShieldCheck, dos: BookOpenCheck }[r] || Users)
const roleBadge = (r) => ({
  student: 'bg-[#EAF3FF] text-[#1769E0]', teacher: 'bg-[#E8F8F2] text-[#0E9F70]',
  admin: 'bg-[#FFF7E6] text-[#b07409]', dos: 'bg-[#F0EEFF] text-[#6D5CE7]'
}[r] || 'bg-[#eef2f9] text-[#627D98]')
const avatarTone = (r) => ({
  student: 'bg-[#EAF3FF] text-[#1769E0]', teacher: 'bg-[#E8F8F2] text-[#0E9F70]',
  admin: 'bg-[#FFF7E6] text-[#b07409]', dos: 'bg-[#F0EEFF] text-[#6D5CE7]'
}[r] || 'bg-[#eef2f9] text-[#627D98]')

const columns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'role', label: 'Role', sortable: true },
  { key: 'schoolId', label: 'School', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'lastLoginAt', label: 'Last Login', sortable: true },
  { key: 'createdAt', label: 'Created', sortable: true }
]

const blank = { name: '', email: '', role: 'teacher', schoolId: '', phone: '', status: 'active' }

export default function SaUsers() {
  const { role } = useParams()
  const store = useStore(saStore)
  const [searchParams, setSearchParams] = useSearchParams()
  const queryQ = searchParams.get('q') || ''
  const queryNew = searchParams.get('new')

  const rolePreset = role ? ROLE_PRESETS[role] : ''

  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(String(queryQ))
  const [roleFilter, setRoleFilter] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [form, setForm] = useState({ ...blank })
  const [errors, setErrors] = useState({})

  const schoolById = saSelectors.schoolById(store)
  const activeSchools = saSelectors.activeSchools(store)

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 350)
    if (queryNew === '1') openAdd()
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (queryNew === '1') openAdd()
  }, [queryNew])

  useEffect(() => {
    setSearch(String(queryQ || ''))
  }, [queryQ])

  const pageTitle = {
    student: 'Students', teacher: 'Teachers', admin: 'School Administrators', dos: 'Directors of Studies'
  }[rolePreset] || 'User Management'

  const pool = rolePreset ? store.users.filter((u) => u.role === rolePreset) : store.users

  const filtered = (() => {
    const q = search.toLowerCase()
    return pool.filter((u) => {
      if (roleFilter && u.role !== roleFilter) return false
      if (schoolFilter && u.schoolId !== schoolFilter) return false
      if (statusFilter && u.status !== statusFilter) return false
      if (q && !u.name.toLowerCase().includes(q) && !u.email.toLowerCase().includes(q)) return false
      return true
    })
  })()

  const userActions = (row) => {
    const items = [
      { label: 'View profile', icon: Eye, handler: () => openEdit(row, true) },
      { label: 'Edit user', icon: Pencil, handler: () => openEdit(row) },
      { label: 'Reset password', icon: KeyRound, handler: () => resetPassword(row) }
    ]
    if (row.status === 'pending') items.push({ label: 'Approve account', icon: CircleCheck, handler: () => { saActions.setUserStatus(row.id, 'active'); saActions.success(`${row.name} approved.`, 'Account approved') } })
    items.push(row.status === 'active'
      ? { label: 'Suspend account', icon: Ban, danger: true, handler: () => { saActions.setUserStatus(row.id, 'suspended'); saActions.success(`${row.name} suspended.`, 'Account suspended') } }
      : { label: 'Activate account', icon: Play, handler: () => { saActions.setUserStatus(row.id, 'active'); saActions.success(`${row.name} activated.`, 'Account activated') } })
    items.push({ label: 'Delete user', icon: Trash2, danger: true, handler: () => { setConfirmDelete(row) } })
    return items
  }

  async function resetPassword(row) {
    try {
      const result = await saActions.resetUserPassword(row.id)
      saActions.success(result?.message || `Password reset for ${row.email}.`, 'Password reset')
    } catch (e) {
      saActions.apiError(e, 'Could not reset the password')
    }
  }

  async function doDelete() {
    const target = confirmDelete
    try {
      await saActions.deleteUser(target.id)
      saActions.success(`${target.name} was deleted.`, 'User deleted')
    } catch (e) {
      saActions.apiError(e, 'Could not delete the user')
    }
    setConfirmDelete(null)
  }

  function openAdd() {
    setEditing(null)
    setForm({ ...blank, role: rolePreset || 'teacher' })
    setErrors({})
    setFormOpen(true)
    if (searchParams.get('new')) setSearchParams({}, { replace: true })
  }
  function openEdit(row) {
    setEditing(row)
    setForm({ name: row.name, email: row.email, role: row.role, schoolId: row.schoolId || '', phone: row.phone || '', status: row.status })
    setErrors({})
    setFormOpen(true)
  }

  async function saveUser(event) {
    event.preventDefault()
    const next = {}
    if (form.name.length < 3) next.name = 'Full name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) next.email = 'Enter a valid email address.'
    else if (store.users.some((u) => u.email.toLowerCase() === form.email.toLowerCase() && u.id !== editing?.id)) next.email = 'An account with this email already exists.'
    if (!form.schoolId) next.schoolId = 'Please choose a school.'
    setErrors(next)
    if (Object.keys(next).length) return

    setSaving(true)
    try {
      if (editing) {
        await saActions.updateUser(editing.id, { ...form })
        saActions.success(`${form.name} was updated.`, 'User updated')
      } else {
        await saActions.addUser({ ...form })
        saActions.success(`${form.name} was created.`, 'User created')
      }
      setSaving(false)
      setFormOpen(false)
    } catch (e) {
      setSaving(false)
      saActions.apiError(e, 'Could not save the user')
    }
  }

  return (
    <SaLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">{pageTitle}</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">{filtered.length} of {pool.length} {rolePreset ? rolePreset : 'users'}</p>
        </div>
        <button type="button" className="sa-btn primary" onClick={openAdd}><UserPlus size={16} /> Add User</button>
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829AB1]" />
          <input value={search} onChange={(e) => setSearch(e.target.value.trim())} type="search" className="sa-input !pl-9" placeholder="Search by name or email…" aria-label="Search users" />
        </div>
        {!rolePreset ? (
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="sa-select" aria-label="Filter by role">
            <option value="">All roles</option>
            <option value="student">Students</option>
            <option value="teacher">Teachers</option>
            <option value="admin">School Administrators</option>
            <option value="dos">Directors of Studies</option>
          </select>
        ) : null}
        <select value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="sa-select" aria-label="Filter by school">
          <option value="">All schools</option>
          {store.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sa-select" aria-label="Filter by status">
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <DataTable columns={[
        { ...columns[0], render: (row) => (
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`w-8 h-8 rounded-full grid place-items-center text-[11px] font-bold shrink-0 ${avatarTone(row.role)}`}>{initials(row.name)}</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#102A43] truncate max-w-[200px]">{row.name}</p>
              <p className="text-[11.5px] text-[#829AB1] truncate max-w-[200px]">{row.email}</p>
            </div>
          </div>
        ) },
        { ...columns[1], render: (row) => {
          const RoleIcon = roleIcon(row.role)
          return (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-semibold ${roleBadge(row.role)}`}>
              <RoleIcon size={12} />{roleLabel(row.role)}
            </span>
          )
        } },
        { ...columns[2], render: (row) => (
          schoolById(row.schoolId) ? (
            <Link to={`/super-admin/schools/${row.schoolId}`} className="text-[#1769E0] hover:underline font-medium" onClick={(e) => e.stopPropagation()}>
              {schoolById(row.schoolId)?.name}
            </Link>
          ) : <span>—</span>
        ) },
        { ...columns[3], render: (row) => <StatusBadge status={row.status} /> },
        { ...columns[4], render: (row) => <span className="text-[#627D98]">{row.lastLoginAt ? timeAgo(row.lastLoginAt) : 'Never'}</span> },
        { ...columns[5], render: (row) => fmtDate(row.createdAt) }
      ]} rows={filtered} loading={loading} itemLabel="users" defaultSort="name"
        emptyTitle="No users found" emptyIcon={Users}
        emptyMessage={pool.length ? 'No users match the current search or filters.' : 'User accounts will appear here once created.'}
        actions={(row) => <ActionMenu items={userActions(row)} label={`Actions for ${row.name}`} />}
        emptyAction={<button type="button" className="sa-btn primary sm" onClick={openAdd}><UserPlus size={15} /> Add User</button>}
      />

      <Modal open={formOpen} title={editing ? 'Edit User' : 'Add User'} subtitle={editing ? `Updating ${editing.name}` : 'Create an account on behalf of a school'} onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setFormOpen(false)}>Cancel</button>
            <button type="submit" form="user-form" className="sa-btn primary" disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Create user'}
            </button>
          </>
        }
      >
        <form id="user-form" className="grid grid-cols-1 sm:grid-cols-2 gap-4" noValidate onSubmit={saveUser}>
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="uf-name">Full name <span className="req">*</span></label>
            <input id="uf-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value.trim() }))} className={`sa-input ${errors.name ? 'err' : ''}`} placeholder="e.g. Aline Uwase" />
            {errors.name ? <p className="sa-err">{errors.name}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="uf-email">Email <span className="req">*</span></label>
            <input id="uf-email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value.trim() }))} type="email" className={`sa-input ${errors.email ? 'err' : ''}`} placeholder="name@school.ac.rw" />
            {errors.email ? <p className="sa-err">{errors.email}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="uf-role">Role <span className="req">*</span></label>
            <select id="uf-role" value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="sa-select">
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">School Administrator</option>
              <option value="dos">Director of Studies</option>
            </select>
          </div>
          <div>
            <label className="sa-label" htmlFor="uf-school">School <span className="req">*</span></label>
            <select id="uf-school" value={form.schoolId} onChange={(e) => setForm((f) => ({ ...f, schoolId: e.target.value }))} className={`sa-select ${errors.schoolId ? 'err' : ''}`}>
              <option value="" disabled>Select school…</option>
              {activeSchools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {errors.schoolId ? <p className="sa-err">{errors.schoolId}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="uf-phone">Phone</label>
            <input id="uf-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value.trim() }))} className="sa-input" placeholder="+250 7…" />
          </div>
          <div>
            <label className="sa-label" htmlFor="uf-status">Status</label>
            <select id="uf-status" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="sa-select">
              <option value="active">Active</option>
              <option value="pending">Pending approval</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        </form>
      </Modal>

      <ConfirmDialog open={!!confirmDelete} title="Delete user?" danger confirmLabel="Delete user"
        message={`${confirmDelete?.name} (${confirmDelete?.email}) will lose access immediately and their account will be permanently removed.`}
        onCancel={() => setConfirmDelete(null)} onConfirm={doDelete} />
    </SaLayout>
  )
}
