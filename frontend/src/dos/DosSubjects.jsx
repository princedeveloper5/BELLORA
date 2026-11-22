import { useState } from 'react'
import { Plus, Search, Download, BookOpen, Pencil, Trash2, LoaderCircle } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import DataTable from '@/sa/components/DataTable'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { downloadCsv } from '@/sa/format'

const columns = [
  { key: 'module_name', label: 'Subject', sortable: true },
  { key: 'department', label: 'Department', sortable: true },
  { key: 'hours_per_year', label: 'Hours / Year', sortable: true },
  { key: 'periods', label: 'Periods / week' }
]

const code = (name = '') =>
  name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 4)
    .toUpperCase() || '—'

const blank = { module_name: '', department: '', hours_per_year: 96 }

export default function DosSubjects() {
  const store = useStore(dosStore)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const departments = [...new Set(store.subjects.map((s) => s.department).filter(Boolean))].sort()
  const filtered = (() => {
    const q = search.toLowerCase()
    return store.subjects.filter((s) => {
      if (departmentFilter && (s.department || '') !== departmentFilter) return false
      if (q && !s.module_name?.toLowerCase().includes(q)) return false
      return true
    })
  })()

  const periods = (name) => store.overview?.subjectDist?.find((d) => d.name === name)?.periods || 0

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
    setForm({ module_name: row.module_name, department: row.department || '', hours_per_year: row.hours_per_year ?? 0 })
    setFormOpen(true)
  }

  async function save() {
    if (form.module_name.length < 2) {
      setErrors({ module_name: 'Subject name is required.' })
      return
    }
    setErrors({})
    setSaving(true)
    try {
      if (editing) {
        await dosActions.updateSubject(editing.module_id, { ...form })
        dosActions.success(`${form.module_name} updated.`, 'Subject updated')
      } else {
        await dosActions.createSubject({ ...form })
        dosActions.success(`${form.module_name} created.`, 'Subject added')
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
      await dosActions.deleteSubject(deleteTarget.module_id)
      dosActions.success(`${deleteTarget.module_name} deleted.`)
    } catch (e) {
      dosActions.apiError(e)
    }
    setDeleteTarget(null)
  }

  function exportCsv() {
    downloadCsv(
      'subjects.csv',
      [
        { label: 'Subject', value: 'module_name' },
        { label: 'Department', value: 'department' },
        { label: 'Hours/Year', value: 'hours_per_year' },
        { label: 'Periods/week', value: (r) => periods(r.module_name) }
      ],
      filtered
    )
    dosActions.success('Subjects exported.', 'Export complete')
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Subjects</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            {filtered.length} of {store.subjects.length} subjects offered by your school
          </p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" onClick={exportCsv}>
            <Download size={15} /> Export
          </button>
          <button type="button" className="sa-btn primary panta-primary-btn" onClick={openAdd}>
            <Plus size={16} /> Add Subject
          </button>
        </div>
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829AB1]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value.trim())}
            type="search"
            className="sa-input !pl-9"
            placeholder="Search subjects…"
            aria-label="Search subjects"
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
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey="module_id"
        loading={!store.ready}
        itemLabel="subjects"
        defaultSort="module_name"
        emptyIcon={BookOpen}
        emptyTitle="No subjects yet"
        emptyMessage="Add your first subject to start assigning teachers."
        actions={(row) => (
          <ActionMenu
            items={[
              { label: 'Edit subject', icon: Pencil, handler: () => openEdit(row) },
              {
                label: 'Delete',
                icon: Trash2,
                danger: true,
                handler: () => {
                  setDeleteTarget(row)
                }
              }
            ]}
            label={`Actions for ${row.module_name}`}
          />
        )}
        emptyAction={
          <button type="button" className="sa-btn primary sm panta-primary-btn" onClick={openAdd}>
            <Plus size={15} /> Add Subject
          </button>
        }
      />

      <Modal
        open={formOpen}
        title={editing ? 'Edit Subject' : 'Add Subject'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="subject-form" className="sa-btn primary panta-primary-btn" disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add subject'}
            </button>
          </>
        }
      >
        <form
          id="subject-form"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="sf-name">
              Subject name <span className="req">*</span>
            </label>
            <input
              id="sf-name"
              value={form.module_name}
              onChange={(event) => setField('module_name', event.target.value.trim())}
              className={`sa-input ${errors.module_name ? 'err' : ''}`}
              placeholder="e.g. Mathematics"
            />
            {errors.module_name ? <p className="sa-err">{errors.module_name}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-dept">
              Department
            </label>
            <input
              id="sf-dept"
              value={form.department}
              onChange={(event) => setField('department', event.target.value.trim())}
              className="sa-input"
              placeholder="e.g. Sciences"
            />
          </div>
          <div>
            <label className="sa-label" htmlFor="sf-hours">
              Hours per year
            </label>
            <input
              id="sf-hours"
              value={form.hours_per_year}
              onChange={(event) => setField('hours_per_year', Number(event.target.value))}
              type="number"
              min="0"
              max="400"
              className="sa-input"
            />
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete subject?"
        danger
        confirmLabel="Delete subject"
        message={`${deleteTarget?.module_name} will be permanently removed. Subjects used by assignments cannot be deleted.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
      />
    </DashboardLayout>
  )
}
