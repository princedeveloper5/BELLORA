import { useState } from 'react'
import {
  Plus,
  Search,
  Download,
  DoorOpen,
  Pencil,
  Trash2,
  LoaderCircle,
  FlaskConical,
  Monitor,
  Library,
  Presentation,
  Trophy
} from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import DataTable from '@/sa/components/DataTable'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { downloadCsv } from '@/sa/format'

const roomTypes = ['Classroom', 'Laboratory', 'Computer Lab', 'Library', 'Hall', 'Sports Facility', 'Other']

const columns = [
  { key: 'room_name', label: 'Room', sortable: true },
  { key: 'room_type', label: 'Type', sortable: true },
  { key: 'capacity', label: 'Capacity', sortable: true },
  { key: 'usage', label: 'Scheduled Usage' }
]

const TONES = {
  Laboratory: { bg: 'bg-[#FFF7E6] text-[#b45309]', badge: 'bg-[#FFF7E6] text-[#b45309]', icon: FlaskConical },
  'Computer Lab': { bg: 'bg-[#E7F5F2] text-[#0F9D8A]', badge: 'bg-[#E7F5F2] text-[#0F9D8A]', icon: Monitor },
  Library: { bg: 'bg-[#F0EEFF] text-[#6D5CE7]', badge: 'bg-[#F0EEFF] text-[#6D5CE7]', icon: Library },
  Hall: { bg: 'bg-[#E7F5F2] text-[#0B7F70]', badge: 'bg-[#E7F5F2] text-[#0B7F70]', icon: Presentation },
  'Sports Facility': { bg: 'bg-[#FEECEC] text-[#B91C1C]', badge: 'bg-[#FEECEC] text-[#B91C1C]', icon: Trophy }
}

const blank = { room_name: '', room_type: 'Classroom', capacity: 40 }

export default function DosRooms() {
  const store = useStore(dosStore)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const typeTone = (type) => TONES[type] || { bg: 'bg-[#E7F5F2] text-[#0F9D8A]', badge: 'bg-[#E7F5F2] text-[#0F9D8A]', icon: DoorOpen }

  const filtered = (() => {
    const q = search.toLowerCase()
    return store.rooms.filter((r) => {
      if (typeFilter && (r.room_type || 'Classroom') !== typeFilter) return false
      if (q && !r.room_name?.toLowerCase().includes(q)) return false
      return true
    })
  })()

  const usage = (roomId) =>
    store.week.filter((w) => w.room_name && store.rooms.find((r) => r.room_id === roomId)?.room_name === w.room_name).length

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
    setForm({ room_name: row.room_name, room_type: row.room_type || 'Classroom', capacity: row.capacity || 40 })
    setFormOpen(true)
  }

  async function save() {
    const nextErrors = {}
    if (form.room_name.length < 2) nextErrors.room_name = 'Room name is required.'
    if (!form.capacity || form.capacity < 1) nextErrors.capacity = 'Capacity must be at least 1.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length) return
    setSaving(true)
    try {
      if (editing) {
        await dosActions.updateRoom(editing.room_id, { ...form })
        dosActions.success(`${form.room_name} updated.`, 'Room updated')
      } else {
        await dosActions.createRoom({ ...form })
        dosActions.success(`${form.room_name} created.`, 'Room added')
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
      await dosActions.deleteRoom(deleteTarget.room_id)
      dosActions.success(`${deleteTarget.room_name} deleted.`)
    } catch (e) {
      dosActions.apiError(e)
    }
    setDeleteTarget(null)
  }

  function exportCsv() {
    downloadCsv(
      'rooms.csv',
      [
        { label: 'Room', value: 'room_name' },
        { label: 'Type', value: 'room_type' },
        { label: 'Capacity', value: 'capacity' },
        { label: 'Scheduled periods', value: (r) => usage(r.room_id) }
      ],
      filtered
    )
    dosActions.success('Rooms exported.', 'Export complete')
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Rooms</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            {filtered.length} of {store.rooms.length} rooms · used by timetable scheduling
          </p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" onClick={exportCsv}>
            <Download size={15} /> Export
          </button>
          <button type="button" className="sa-btn primary panta-primary-btn" onClick={openAdd}>
            <Plus size={16} /> Add Room
          </button>
        </div>
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9fb0c7]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value.trim())}
            type="search"
            className="sa-input !pl-9"
            placeholder="Search rooms…"
            aria-label="Search rooms"
          />
        </div>
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="sa-select" aria-label="Filter by room type">
          <option value="">All types</option>
          {roomTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey="room_id"
        loading={!store.ready}
        itemLabel="rooms"
        defaultSort="room_name"
        emptyIcon={DoorOpen}
        emptyTitle="No rooms yet"
        emptyMessage="Add classrooms and labs so the timetable generator can schedule lessons into them."
        actions={(row) => (
          <ActionMenu
            items={[
              { label: 'Edit room', icon: Pencil, handler: () => openEdit(row) },
              {
                label: 'Delete',
                icon: Trash2,
                danger: true,
                handler: () => {
                  setDeleteTarget(row)
                }
              }
            ]}
            label={`Actions for ${row.room_name}`}
          />
        )}
        emptyAction={
          <button type="button" className="sa-btn primary sm panta-primary-btn" onClick={openAdd}>
            <Plus size={15} /> Add Room
          </button>
        }
      />

      <Modal
        open={formOpen}
        title={editing ? 'Edit Room' : 'Add Room'}
        onClose={() => setFormOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="room-form" className="sa-btn primary panta-primary-btn" disabled={saving}>
              {saving ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {editing ? 'Save changes' : 'Add room'}
            </button>
          </>
        }
      >
        <form
          id="room-form"
          className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <div className="sm:col-span-2">
            <label className="sa-label" htmlFor="rf-name">
              Room name <span className="req">*</span>
            </label>
            <input
              id="rf-name"
              value={form.room_name}
              onChange={(event) => setField('room_name', event.target.value.trim())}
              className={`sa-input ${errors.room_name ? 'err' : ''}`}
              placeholder="e.g. Room 101"
            />
            {errors.room_name ? <p className="sa-err">{errors.room_name}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="rf-type">
              Room type <span className="req">*</span>
            </label>
            <select id="rf-type" value={form.room_type} onChange={(event) => setField('room_type', event.target.value)} className="sa-select">
              {roomTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sa-label" htmlFor="rf-cap">
              Capacity <span className="req">*</span>
            </label>
            <input
              id="rf-cap"
              value={form.capacity}
              onChange={(event) => setField('capacity', Number(event.target.value))}
              type="number"
              min="1"
              max="500"
              className={`sa-input ${errors.capacity ? 'err' : ''}`}
            />
            {errors.capacity ? <p className="sa-err">{errors.capacity}</p> : null}
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title="Delete room?"
        danger
        confirmLabel="Delete room"
        message={`${deleteTarget?.room_name} will be permanently removed. Rooms used by timetable entries cannot be deleted.`}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={doDelete}
      />
    </DashboardLayout>
  )
}
