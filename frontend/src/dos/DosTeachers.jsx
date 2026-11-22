import { useState } from 'react'
import {
  Plus,
  Search,
  Download,
  Briefcase,
  LoaderCircle,
  Ban,
  Pencil,
  Trash2,
  Eye,
  BookPlus,
  X
} from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { initials, downloadCsv, fmtDate } from '@/sa/format'

const statusOf = (t) => (t.status === 'active' ? 'active' : t.status === 'pending' ? 'pending' : 'suspended')
const code = (name = '') =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || '—'

const blank = { name: '', email: '', department: '', phone: '', status: 'active', qualification: '', gender: '', date_joined: '' }

const DEFAULT_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export default function DosTeachers() {
  const store = useStore(dosStore)

  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [profile, setProfile] = useState(null)
  const [savingAvail, setSavingAvail] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const columns = [
    { key: 'name', label: 'Teacher', sortable: true },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'module_name', label: 'Subjects', sortable: false },
    { key: 'periods', label: 'Periods / week', sortable: false },
    { key: 'status', label: 'Status', sortable: true }
  ]

  const periods = (name) => store.overview?.workload?.find((w) => w.name === name)?.periods || 0
  // Subjects taught — from the timetable distribution joined by assignments; falls back to teacher.module_name
  const subjectsOf = (t) => {
    const fromTeacher = (t.module_name || '').trim()
    if (fromTeacher) return fromTeacher
    const mine = (store.overview?.recentAssignments || []).filter((a) => a.teacher === t.name).map((a) => a.subject)
    return [...new Set(mine)].join(', ')
  }

  const departments = [...new Set(store.teachers.map((t) => t.department).filter(Boolean))].sort()
  const filtered = (() => {
    const q = search.toLowerCase()
    return store.teachers.filter((t) => {
      if (departmentFilter && (t.department || '') !== departmentFilter) return false
      if (statusFilter && statusOf(t) !== statusFilter) return false
      if (q && !t.name?.toLowerCase().includes(q) && !t.email?.toLowerCase().includes(q)) return false
      return true
    })
  })()

  // ---- CRUD -------------------------------------------------------------------
  const [form, setForm] = useState({ ...blank })
  const [errors, setErrors] = useState({})

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))

  function openAdd() {
    setEditing(null)
    setForm({ ...blank })
    setErrors({})
    setFormOpen(true)
  }
  function openEdit(row) {
    setEditing(row)
    setForm({
      name: row.name,
      email: row.email,
      department: row.department || '',
      phone: row.phone || '',
      status: statusOf(row),
      qualification: row.qualification || '',
      gender: row.gender || '',
      date_joined: row.date_joined ? String(row.date_joined).slice(0, 10) : ''
    })
    setErrors({})
    setFormOpen(true)
  }

  async function save() {
    const nextErrors = {}
    if (form.name.length < 3) nextErrors.name = 'Full name is required.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) nextErrors.email = 'Enter a valid email.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      if (editing) {
        await dosActions.updateTeacher(editing.teacher_id, {
          name: form.name,
          department: form.department,
          phone: form.phone,
          status: form.status,
          qualification: form.qualification,
          gender: form.gender,
          date_joined: form.date_joined || null
        })
        dosActions.success(`${form.name} updated.`, 'Teacher updated')
      } else {
        const r = await dosActions.createTeacher({
          name: form.name,
          email: form.email,
          department: form.department,
          phone: form.phone,
          qualification: form.qualification,
          gender: form.gender,
          date_joined: form.date_joined || null
        })
        dosActions.success(r.message || `${form.name} added.`, 'Teacher added')
      }
      setFormOpen(false)
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setSaving(false)
    }
  }

  function rowActions(row) {
    return [
      { label: 'Assign subjects', icon: BookPlus, handler: () => openAssign(row) },
      { label: 'View profile & availability', icon: Eye, handler: () => openProfile(row) },
      { label: 'Edit teacher', icon: Pencil, handler: () => openEdit(row) },
      statusOf(row) === 'active'
        ? { label: 'Suspend', icon: Ban, danger: true, handler: () => suspend(row) }
        : { label: 'Activate', icon: Plus, handler: () => activate(row) },
      {
        label: 'Delete',
        icon: Trash2,
        danger: true,
        handler: () => {
          setDeleteTarget(row)
        }
      }
    ]
  }

  // ---- Teaching assignments (subject + class per teacher) -----------------------
  const [assignTeacher, setAssignTeacher] = useState(null)
  const [assignForm, setAssignForm] = useState({ module_id: '', class_id: '', academic_year: '2026/2027', term: 'Term 1' })
  const [assignError, setAssignError] = useState('')
  const [assigning, setAssigning] = useState(false)

  const teacherAssignments = assignTeacher
    ? store.assignments.filter((a) => Number(a.teacher_id) === Number(assignTeacher.teacher_id))
    : []
  const subjectName = (id) => store.subjects.find((s) => Number(s.module_id) === Number(id))?.module_name || `Subject ${id}`
  const className = (id) => store.classes.find((c) => Number(c.class_id) === Number(id))?.class_name || `Class ${id}`

  const setAssignField = (key, value) => setAssignForm((prev) => ({ ...prev, [key]: value }))

  function openAssign(row) {
    setAssignTeacher(row)
    setAssignForm({ module_id: '', class_id: '', academic_year: '2026/2027', term: 'Term 1' })
    setAssignError('')
  }

  async function addAssignment() {
    setAssignError('')
    if (!assignForm.module_id) {
      setAssignError('Please choose a subject.')
      return
    }
    if (!assignForm.class_id) {
      setAssignError('Please choose a class.')
      return
    }
    setAssigning(true)
    try {
      await dosActions.createAssignment({
        teacher_id: assignTeacher.teacher_id,
        module_id: Number(assignForm.module_id),
        class_id: Number(assignForm.class_id),
        academic_year: assignForm.academic_year,
        term: assignForm.term
      })
      dosActions.success(
        `${subjectName(assignForm.module_id)} assigned to ${assignTeacher.name} for ${className(assignForm.class_id)}.`,
        'Assignment created'
      )
      setAssignForm((prev) => ({ ...prev, module_id: '', class_id: '' }))
    } catch (e) {
      setAssignError(e?.response?.data?.message || 'Could not create the assignment.')
    } finally {
      setAssigning(false)
    }
  }

  async function removeAssignment(a) {
    try {
      await dosActions.deleteAssignment(a.assignment_id)
      dosActions.success('Assignment removed.', 'Removed')
    } catch (e) {
      dosActions.apiError(e)
    }
  }

  async function suspend(row) {
    try {
      await dosActions.updateTeacher(row.teacher_id, { status: 'suspended' })
      dosActions.success(`${row.name} suspended.`)
    } catch (e) {
      dosActions.apiError(e)
    }
  }
  async function activate(row) {
    try {
      await dosActions.updateTeacher(row.teacher_id, { status: 'active' })
      dosActions.success(`${row.name} activated.`)
    } catch (e) {
      dosActions.apiError(e)
    }
  }
  async function bulkSuspend(selected, clear) {
    try {
      await Promise.all(selected.map((t) => dosActions.updateTeacher(t.teacher_id, { status: 'suspended' })))
      dosActions.success(`${selected.length} teacher(s) suspended.`)
      clear()
    } catch (e) {
      dosActions.apiError(e)
    }
  }
  async function doDelete() {
    try {
      await dosActions.deleteTeacher(deleteTarget.teacher_id)
      dosActions.success(`${deleteTarget.name} deleted.`)
    } catch (e) {
      dosActions.apiError(e)
    }
    setDeleteTarget(null)
  }

  // ---- Profile + availability -----------------------------------------------------
  const [avail, setAvail] = useState({ days: [...DEFAULT_DAYS], from: '08:00', to: '16:00' })

  function openProfile(row) {
    setProfile(row)
    const raw = row.available_days || 'Monday,Tuesday,Wednesday,Thursday,Friday'
    let days = raw
      .split(',')
      .map((d) => d.trim())
      .filter((d) => DEFAULT_DAYS.includes(d))
    if (!days.length) days = [...DEFAULT_DAYS]
    setAvail({
      days,
      from: String(row.available_from || '08:00').slice(0, 5),
      to: String(row.available_to || '16:00').slice(0, 5)
    })
  }
  const toggleDay = (d) =>
    setAvail((prev) => ({
      ...prev,
      days: prev.days.includes(d) ? prev.days.filter((x) => x !== d) : [...prev.days, d]
    }))

  async function saveAvailability() {
    setSavingAvail(true)
    try {
      await dosActions.setTeacherAvailability(profile.teacher_id, {
        available_days: avail.days.join(','),
        available_from: avail.from,
        available_to: avail.to
      })
      dosActions.success('Availability saved — the generator will respect it.', 'Saved')
      setProfile(null)
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setSavingAvail(false)
    }
  }

  function exportCsv() {
    downloadCsv(
      'teachers.csv',
      [
        { label: 'Name', value: 'name' },
        { label: 'Email', value: 'email' },
        { label: 'Department', value: 'department' },
        { label: 'Subjects', value: (r) => subjectsOf(r) },
        { label: 'Periods/week', value: (r) => periods(r.name) },
        { label: 'Status', value: 'status' }
      ],
      filtered
    )
    dosActions.success(`${filtered.length} teachers exported.`, 'Export complete')
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Teachers</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            {filtered.length} of {store.teachers.length} teachers · workload from published timetable
          </p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" onClick={exportCsv}>
            <Download size={15} /> Export
          </button>
          <button type="button" className="sa-btn primary panta-primary-btn" onClick={openAdd}>
            <Plus size={16} /> Add Teacher
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829AB1]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value.trim())}
            type="search"
            className="sa-input !pl-9"
            placeholder="Search name or email…"
            aria-label="Search teachers"
          />
        </div>
        <select
          value={departmentFilter}
          onChange={(event) => setDepartmentFilter(event.target.value)}
          className="sa-select"
          aria-label="Filter by department"
        >
          <option value="">All departments</option>
          {departments.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          className="sa-select"
          aria-label="Filter by status"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="pending">Pending</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey="teacher_id"
        loading={!store.ready}
        itemLabel="teachers"
        defaultSort="name"
        selectable
        emptyIcon={Briefcase}
        emptyTitle="No teachers yet"
        emptyMessage="Add your first teacher to start building the timetable."
        actions={(row) => <ActionMenu items={rowActions(row)} label={`Actions for ${row.name}`} />}
        bulk={(selected, clear) =>
          selected.length ? (
            <span className="inline-flex items-center gap-2">
              <span className="text-[12px] font-semibold text-[#0F9D8A]">{selected.length} selected</span>
              <button type="button" className="sa-btn ghost sm" onClick={() => bulkSuspend(selected, clear)}>
                <Ban size={13} /> Suspend
              </button>
            </span>
          ) : null
        }
        emptyAction={
          <button type="button" className="sa-btn primary sm panta-primary-btn" onClick={openAdd}>
            <Plus size={15} /> Add Teacher
          </button>
        }
      />

      {/* Add / Edit modal */}
      <Modal
        open={formOpen}
        title={editing ? 'Edit Teacher' : 'Add Teacher'}
        subtitle="New teachers receive the temporary password Panta@123"
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="teacher-form" className="sa-btn primary panta-primary-btn" disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add teacher'}
            </button>
          </>
        }
      >
        <form
          id="teacher-form"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="tf-name">
              Full name <span className="req">*</span>
            </label>
            <input
              id="tf-name"
              value={form.name}
              onChange={(event) => setField('name', event.target.value.trim())}
              className={`sa-input ${errors.name ? 'err' : ''}`}
              placeholder="e.g. Aline Uwase"
            />
            {errors.name ? <p className="sa-err">{errors.name}</p> : null}
          </div>
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="tf-email">
              Email <span className="req">*</span>
            </label>
            <input
              id="tf-email"
              value={form.email}
              onChange={(event) => setField('email', event.target.value.trim())}
              type="email"
              className={`sa-input ${errors.email ? 'err' : ''}`}
              disabled={!!editing}
              placeholder="teacher@school.rw"
            />
            {errors.email ? <p className="sa-err">{errors.email}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="tf-dept">
              Department
            </label>
            <input
              id="tf-dept"
              value={form.department}
              onChange={(event) => setField('department', event.target.value.trim())}
              className="sa-input"
              placeholder="e.g. Sciences"
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="tf-phone">
              Phone
            </label>
            <input
              id="tf-phone"
              value={form.phone}
              onChange={(event) => setField('phone', event.target.value.trim())}
              className="sa-input"
              placeholder="+250 7…"
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="tf-qual">
              Qualification
            </label>
            <input
              id="tf-qual"
              value={form.qualification}
              onChange={(event) => setField('qualification', event.target.value.trim())}
              className="sa-input"
              placeholder="e.g. B.Ed Mathematics"
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="tf-gender">
              Gender
            </label>
            <select id="tf-gender" value={form.gender} onChange={(event) => setField('gender', event.target.value)} className="sa-select">
              <option value="">—</option>
              <option>Female</option>
              <option>Male</option>
            </select>
          </div>
          <div>
            <label className="sa-label" htmlFor="tf-joined">
              Joining date
            </label>
            <input
              id="tf-joined"
              value={form.date_joined}
              onChange={(event) => setField('date_joined', event.target.value)}
              type="date"
              className="sa-input"
            />
          </div>
          {editing ? (
            <div>
              <label className="sa-label" htmlFor="tf-status">
                Status
              </label>
              <select id="tf-status" value={form.status} onChange={(event) => setField('status', event.target.value)} className="sa-select">
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          ) : null}
        </form>
      </Modal>

      {/* Profile / availability modal */}
      <Modal
        open={!!profile}
        title={profile?.name}
        subtitle={profile?.email}
        size="lg"
        onClose={() => setProfile(null)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setProfile(null)}>
              Close
            </button>
            <button type="button" className="sa-btn primary panta-primary-btn" disabled={savingAvail} onClick={saveAvailability}>
              {savingAvail ? <LoaderCircle size={15} className="animate-spin" /> : null} Save availability
            </button>
          </>
        }
      >
        {profile ? (
          <div className="space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Employee ID</p>
                <p className="text-[14px] font-bold text-[#102A43]">{profile.employee_id || '—'}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Staff ID</p>
                <p className="text-[14px] font-bold text-[#102A43]">{profile.staff_id || '—'}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Department</p>
                <p className="text-[14px] font-bold text-[#102A43]">{profile.department || '—'}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Status</p>
                <p className="text-[14px] font-bold text-[#102A43]">{profile.status}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Qualification</p>
                <p className="text-[14px] font-bold text-[#102A43]">{profile.qualification || '—'}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Joined</p>
                <p className="text-[14px] font-bold text-[#102A43]">{profile.date_joined ? fmtDate(profile.date_joined) : '—'}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Periods/week</p>
                <p className="text-[14px] font-bold text-[#102A43]">{periods(profile.name)}</p>
              </div>
              <div className="rounded-xl bg-[#f8fafd] border border-[#e9eff8] px-4 py-3">
                <p className="text-[10.5px] font-bold uppercase text-[#829AB1]">Subjects</p>
                <p className="text-[14px] font-bold text-[#102A43]">{subjectsOf(profile) || '—'}</p>
              </div>
            </div>
            <div>
              <h4 className="text-[13.5px] font-bold text-[#102A43] mb-2.5">
                Teaching availability <span className="text-[11px] font-medium text-[#829AB1]">(respected by the timetable generator)</span>
              </h4>
              <div className="flex flex-wrap gap-2 mb-3">
                {DEFAULT_DAYS.map((d) => (
                  <label
                    key={d}
                    className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold cursor-pointer transition ${
                      avail.days.includes(d) ? 'border-[#0F9D8A] bg-[#E7F5F2] text-[#0B7F70]' : 'border-[#dde6f2] text-[#627D98]'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="hidden"
                      checked={avail.days.includes(d)}
                      onChange={() => toggleDay(d)}
                    />
                    {d.slice(0, 3)}
                  </label>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="sa-label">Available from</label>
                  <input value={avail.from} onChange={(event) => setAvail((prev) => ({ ...prev, from: event.target.value }))} type="time" className="sa-input" />
                </div>
                <div>
                  <label className="sa-label">Available to</label>
                  <input value={avail.to} onChange={(event) => setAvail((prev) => ({ ...prev, to: event.target.value }))} type="time" className="sa-input" />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete teacher?"
        danger
        confirmLabel="Delete teacher"
        message={`${deleteTarget?.name} will be permanently removed. Teachers with assignments must be suspended instead.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
      />

      {/* Assign subjects modal */}
      <Modal
        open={!!assignTeacher}
        title={`Assign Subjects — ${assignTeacher?.name}`}
        subtitle="Teaching assignments tell the timetable generator who teaches what, and where"
        size="lg"
        onClose={() => setAssignTeacher(null)}
        footer={
          <button type="button" className="sa-btn ghost" onClick={() => setAssignTeacher(null)}>
            Done
          </button>
        }
      >
        <div className="space-y-5">
          {/* New assignment form */}
          <div className="rounded-xl border border-[var(--panta-border)] bg-[#f8fafd] p-4">
            <h4 className="text-[13px] font-bold text-[#0f2549] mb-3">New assignment</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="sa-label" htmlFor="as-subject">
                  Subject <span className="req">*</span>
                </label>
                <select
                  id="as-subject"
                  value={assignForm.module_id}
                  onChange={(event) => setAssignField('module_id', event.target.value)}
                  className={`sa-select ${assignError && !assignForm.module_id ? 'err' : ''}`}
                >
                  <option value="" disabled>
                    Select subject…
                  </option>
                  {store.subjects.map((s) => (
                    <option key={s.module_id} value={s.module_id}>
                      {s.module_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sa-label" htmlFor="as-class">
                  Class <span className="req">*</span>
                </label>
                <select
                  id="as-class"
                  value={assignForm.class_id}
                  onChange={(event) => setAssignField('class_id', event.target.value)}
                  className={`sa-select ${assignError && !assignForm.class_id ? 'err' : ''}`}
                >
                  <option value="" disabled>
                    Select class…
                  </option>
                  {store.classes.map((c) => (
                    <option key={c.class_id} value={c.class_id}>
                      {c.class_name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="sa-label" htmlFor="as-year">
                  Academic year
                </label>
                <input
                  id="as-year"
                  value={assignForm.academic_year}
                  onChange={(event) => setAssignField('academic_year', event.target.value.trim())}
                  className="sa-input"
                  placeholder="2026/2027"
                />
              </div>
              <div>
                <label className="sa-label" htmlFor="as-term">
                  Term
                </label>
                <select id="as-term" value={assignForm.term} onChange={(event) => setAssignField('term', event.target.value)} className="sa-select">
                  <option>Term 1</option>
                  <option>Term 2</option>
                  <option>Term 3</option>
                </select>
              </div>
            </div>
            {assignError ? <p className="sa-err mt-2">{assignError}</p> : null}
            <div className="flex justify-end mt-3">
              <button type="button" className="sa-btn primary sm panta-primary-btn" disabled={assigning} onClick={addAssignment}>
                {assigning ? <LoaderCircle size={14} className="animate-spin" /> : <BookPlus size={14} />} Assign subject
              </button>
            </div>
          </div>

          {/* Current assignments */}
          <div>
            <h4 className="text-[13px] font-bold text-[#0f2549] mb-2">
              Current assignments <span className="text-[11px] font-medium text-[#8aa0bf]">({teacherAssignments.length})</span>
            </h4>
            {teacherAssignments.length ? (
              <ul className="divide-y divide-[#f0f4fa] max-h-[260px] overflow-y-auto">
                {teacherAssignments.map((a) => (
                  <li key={a.assignment_id} className="flex items-center gap-3 py-2.5">
                    <span className="w-8 h-8 rounded-lg bg-[#E7F5F2] text-[#0F9D8A] grid place-items-center text-[10.5px] font-extrabold shrink-0">
                      {code(subjectName(a.module_id))}
                    </span>
                    <div className="min-w-0 grow">
                      <p className="text-[13px] font-semibold text-[#0f2549]">{subjectName(a.module_id)}</p>
                      <p className="text-[11.5px] text-[#8aa0bf]">
                        {className(a.class_id)} · {a.term} {a.academic_year}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="sa-icon-btn !w-8 !h-8 hover:!text-[#dc2626]"
                      aria-label={`Remove ${subjectName(a.module_id)} assignment`}
                      onClick={() => removeAssignment(a)}
                    >
                      <X size={15} />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[12.5px] text-[#8aa0bf] rounded-xl border border-dashed border-[#dce5f0] px-4 py-6 text-center">
                No assignments yet — assign a subject and class above so this teacher appears in timetable generation.
              </p>
            )}
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  )
}
