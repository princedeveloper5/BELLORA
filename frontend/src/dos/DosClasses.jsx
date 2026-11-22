import { Plus, Download, Layers, Users, UserPlus, UserMinus, Pencil, Trash2, LoaderCircle } from 'lucide-react'
import { useState } from 'react'
import DashboardLayout from './components/DashboardLayout'
import DataTable from '@/sa/components/DataTable'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import EmptyState from '@/sa/components/EmptyState'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { initials, downloadCsv } from '@/sa/format'

const columns = [
  { key: 'class_name', label: 'Class', sortable: true },
  { key: 'level', label: 'Level', sortable: true },
  { key: 'student_count', label: 'Students' },
  { key: 'class_teacher_name', label: 'Class Teacher', sortable: true },
  { key: 'room_name', label: 'Room', sortable: true },
  { key: 'academic_year', label: 'Year', sortable: true }
]

const blank = { class_name: '', level: '', academic_year: '2026/2027', class_teacher_id: '' }

export default function DosClasses() {
  const store = useStore(dosStore)

  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [rosterClass, setRosterClass] = useState(null)
  const [roster, setRoster] = useState([])
  const [unassigned, setUnassigned] = useState([])
  const [loadingRoster, setLoadingRoster] = useState(false)
  const [enrollTarget, setEnrollTarget] = useState('')
  const [enrolling, setEnrolling] = useState(false)

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
      class_name: row.class_name,
      level: row.level || '',
      academic_year: row.academic_year || '',
      class_teacher_id: store.teachers.find((t) => t.name === row.class_teacher_name)?.teacher_id || ''
    })
    setErrors({})
    setFormOpen(true)
  }

  async function save() {
    if (form.class_name.length < 2) {
      setErrors({ class_name: 'Class name is required.' })
      return
    }
    setErrors({})
    setSaving(true)
    try {
      if (editing) {
        await dosActions.updateClass(editing.class_id, { ...form })
        dosActions.success(`${form.class_name} updated.`, 'Class updated')
      } else {
        await dosActions.createClass({ ...form })
        dosActions.success(`${form.class_name} created.`, 'Class added')
      }
      setFormOpen(false)
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setSaving(false)
    }
  }

  async function doDelete() {
    try {
      await dosActions.deleteClass(deleteTarget.class_id)
      dosActions.success(`${deleteTarget.class_name} deleted.`)
    } catch (e) {
      dosActions.apiError(e)
    }
    setDeleteTarget(null)
  }

  async function openRoster(row) {
    setRosterClass(row)
    setLoadingRoster(true)
    setEnrollTarget('')
    try {
      const [r, u] = await Promise.all([dosActions.getRoster(row.class_id), dosActions.getUnassignedStudents()])
      setRoster(r)
      setUnassigned(u)
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setLoadingRoster(false)
    }
  }

  async function enroll() {
    setEnrolling(true)
    try {
      await dosActions.enrollStudent(enrollTarget, rosterClass.class_id)
      dosActions.success('Student enrolled.', 'Enrolled')
      setEnrollTarget('')
      await openRoster(rosterClass)
      await dosActions.bootstrap({ force: true })
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setEnrolling(false)
    }
  }

  async function unenroll(s) {
    try {
      await dosActions.unenrollStudent(s.student_id)
      dosActions.success(`${s.name} removed from ${rosterClass.class_name}.`)
      await openRoster(rosterClass)
      await dosActions.bootstrap({ force: true })
    } catch (e) {
      dosActions.apiError(e)
    }
  }

  function exportCsv() {
    downloadCsv(
      'classes.csv',
      [
        { label: 'Class', value: 'class_name' },
        { label: 'Level', value: 'level' },
        { label: 'Students', value: 'student_count' },
        { label: 'Class Teacher', value: 'class_teacher_name' },
        { label: 'Room', value: 'room_name' },
        { label: 'Year', value: 'academic_year' }
      ],
      store.classes
    )
    dosActions.success('Classes exported.', 'Export complete')
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Classes</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            {store.classes.length} classes in your school
          </p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" onClick={exportCsv}>
            <Download size={15} /> Export
          </button>
          <button type="button" className="sa-btn primary panta-primary-btn" onClick={openAdd}>
            <Plus size={16} /> Add Class
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={store.classes}
        rowKey="class_id"
        loading={!store.ready}
        itemLabel="classes"
        defaultSort="class_name"
        emptyIcon={Layers}
        emptyTitle="No classes yet"
        emptyMessage="Add your first class to start building the timetable."
        actions={(row) => (
          <ActionMenu
            items={[
              { label: 'View roster', icon: Users, handler: () => openRoster(row) },
              { label: 'Edit class', icon: Pencil, handler: () => openEdit(row) },
              {
                label: 'Delete',
                icon: Trash2,
                danger: true,
                handler: () => {
                  setDeleteTarget(row)
                }
              }
            ]}
            label={`Actions for ${row.class_name}`}
          />
        )}
        emptyAction={
          <button type="button" className="sa-btn primary sm panta-primary-btn" onClick={openAdd}>
            <Plus size={15} /> Add Class
          </button>
        }
      />

      {/* Add / Edit modal */}
      <Modal
        open={formOpen}
        title={editing ? 'Edit Class' : 'Add Class'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="class-form" className="sa-btn primary panta-primary-btn" disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add class'}
            </button>
          </>
        }
      >
        <form
          id="class-form"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div>
            <label className="sa-label" htmlFor="cf-name">
              Class name <span className="req">*</span>
            </label>
            <input
              id="cf-name"
              value={form.class_name}
              onChange={(event) => setField('class_name', event.target.value.trim())}
              className={`sa-input ${errors.class_name ? 'err' : ''}`}
              placeholder="e.g. S4 A"
            />
            {errors.class_name ? <p className="sa-err">{errors.class_name}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="cf-level">
              Level
            </label>
            <input
              id="cf-level"
              value={form.level}
              onChange={(event) => setField('level', event.target.value.trim())}
              className="sa-input"
              placeholder="e.g. S4"
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="cf-year">
              Academic year
            </label>
            <input
              id="cf-year"
              value={form.academic_year}
              onChange={(event) => setField('academic_year', event.target.value.trim())}
              className="sa-input"
              placeholder="e.g. 2026/2027"
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="cf-teacher">
              Class teacher
            </label>
            <select
              id="cf-teacher"
              value={form.class_teacher_id}
              onChange={(event) => setField('class_teacher_id', event.target.value)}
              className="sa-select"
            >
              <option value="">None</option>
              {store.teachers.map((t) => (
                <option key={t.teacher_id} value={t.teacher_id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        </form>
      </Modal>

      {/* Roster modal */}
      <Modal
        open={!!rosterClass}
        title={`${rosterClass?.class_name} — Roster`}
        subtitle={`${roster.length} students enrolled`}
        size="lg"
        onClose={() => setRosterClass(null)}
      >
        <div className="mb-4 flex gap-2">
          <select
            value={enrollTarget}
            onChange={(event) => setEnrollTarget(event.target.value)}
            className="sa-select grow"
            aria-label="Choose student to enroll"
          >
            <option value="">Select a student to enroll…</option>
            {unassigned.map((s) => (
              <option key={s.student_id} value={s.student_id}>
                {s.name} ({s.student_number || 'no ID'})
              </option>
            ))}
          </select>
          <button
            type="button"
            className="sa-btn primary panta-primary-btn shrink-0"
            disabled={!enrollTarget || enrolling}
            onClick={enroll}
          >
            <UserPlus size={15} /> Enroll
          </button>
        </div>
        {loadingRoster ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-9 rounded-lg bg-[#f1f5fb] animate-pulse" />
            ))}
          </div>
        ) : roster.length ? (
          <ul className="divide-y divide-[#f0f4fa] max-h-[340px] overflow-y-auto">
            {roster.map((s) => (
              <li key={s.student_id} className="flex items-center gap-3 py-2.5">
                <span className="w-8 h-8 rounded-full bg-[#EAF3FF] text-[#0F55B8] grid place-items-center text-[11px] font-bold shrink-0">
                  {initials(s.name)}
                </span>
                <div className="min-w-0 grow">
                  <p className="text-[13px] font-semibold text-[#102A43] truncate">{s.name}</p>
                  <p className="text-[11.5px] text-[#829AB1] truncate">
                    {s.student_number || '—'} · {s.email}
                  </p>
                </div>
                <button type="button" className="sa-btn ghost sm !text-[#EF4444]" onClick={() => unenroll(s)}>
                  <UserMinus size={13} /> Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState icon={Users} title="No students enrolled" message="Enroll students using the picker above." />
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete class?"
        danger
        confirmLabel="Delete class"
        message={`${deleteTarget?.class_name} will be permanently removed. Classes with timetable entries cannot be deleted.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
      />
    </DashboardLayout>
  )
}
