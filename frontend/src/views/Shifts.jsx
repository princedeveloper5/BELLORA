import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from 'bootstrap'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Shifts.css'

const emptyShiftForm = () => ({
  shift_name: '',
  start_time: '',
  end_time: '',
  teacher_changeover_minutes: 5
})

export default function Shifts() {
  const [searchParams] = useSearchParams()
  const modalRef = useRef(null)

  const [shifts, setShifts] = useState([])
  const [shiftForm, setShiftForm] = useState(emptyShiftForm)
  const [isEditing, setIsEditing] = useState(false)
  const [currentShift, setCurrentShift] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, shift: null, loading: false })
  const [formMessage, setFormMessage] = useState('')
  const [modalMessage, setModalMessage] = useState('')

  const resetShiftForm = () => {
    setShiftForm(emptyShiftForm())
    setIsEditing(false)
    setCurrentShift(null)
    setModalMessage('')
  }

  const formatTime = (time) => {
    if (!time) return '-'
    const [hours, minutes] = time.split(':')
    const hour = parseInt(hours)
    const ampm = hour >= 12 ? 'PM' : 'AM'
    const displayHour = hour % 12 || 12
    return `${displayHour}:${minutes} ${ampm}`
  }

  const loadShifts = async () => {
    setLoading(true)
    setFormMessage('')
    try {
      const response = await api.get('/shifts')
      setShifts(response.data.shifts || [])
    } catch (error) {
      setFormMessage(error.response?.data?.message || 'Failed to load shifts.')
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    resetShiftForm()
    const modal = Modal.getOrCreateInstance(modalRef.current)
    modal.show()
  }

  const openEditModal = (shift) => {
    setIsEditing(true)
    setCurrentShift(shift)
    setShiftForm({ ...shift })
    setModalMessage('')
    const modal = Modal.getOrCreateInstance(modalRef.current)
    modal.show()
  }

  const saveShift = async () => {
    setSaving(true)
    setModalMessage('')
    try {
      const response = isEditing
        ? await api.put(`/shifts/${currentShift.shift_id}`, shiftForm)
        : await api.post('/shifts', shiftForm)

      if (isEditing) {
        setShifts((current) => current.map((s) => (s.shift_id === currentShift.shift_id ? response.data.shift : s)))
      } else {
        setShifts((current) => [...current, response.data.shift])
      }

      const modal = Modal.getOrCreateInstance(modalRef.current)
      modal.hide()
      resetShiftForm()
    } catch (error) {
      setModalMessage(error.response?.data?.message || 'Failed to save shift.')
    } finally {
      setSaving(false)
    }
  }

  const deleteShift = async (shift) => {
    setDeleteDialog({ open: true, shift, loading: false })
  }

  const confirmDeleteShift = async () => {
    const shift = deleteDialog.shift
    if (!shift) return

    setDeleteDialog((current) => ({ ...current, loading: true }))
    try {
      await api.delete(`/shifts/${shift.shift_id}`)
      setShifts((current) => current.filter((s) => s.shift_id !== shift.shift_id))
      setDeleteDialog({ open: false, shift: null, loading: false })
    } catch (error) {
      setFormMessage(error.response?.data?.message || 'Failed to delete shift.')
    } finally {
      setDeleteDialog((current) => ({ ...current, loading: false }))
    }
  }

  const openCreateFromQuery = () => {
    if (searchParams.get('action') === 'add') openAddModal()
  }

  useEffect(() => {
    openCreateFromQuery()
  }, [searchParams.get('action'), searchParams.get('create')])

  useEffect(() => {
    loadShifts()
    openCreateFromQuery()
  }, [])

  return (
    <AppLayout>
      <div className="shifts-container">
        <div className="card-custom">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="h3 fw-semibold text-dark mb-1">Saved Shifts</h2>
              <p className="text-muted mb-0">Create shifts that appear in the Classes shift dropdown. Each shift can have its own teacher changeover time.</p>
            </div>
            <div className="header-actions">
              <button className="btn-primary" type="button" onClick={openAddModal}>Add New Shift</button>
              <button className="btn-outline-secondary" disabled={loading} onClick={loadShifts}>Refresh</button>
              <span className="badge">{shifts.length} shifts</span>
            </div>
          </div>

          {formMessage ? (
            <div className="alert alert-danger">
              {formMessage}
            </div>
          ) : null}

          {loading ? (
            <div className="text-center py-5">
              <span className="spinner"></span> Loading shifts...
            </div>
          ) : !shifts.length ? (
            <div className="text-center text-muted py-5">
              No shifts created yet
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table-custom">
                <thead>
                  <tr>
                    <th>Shift Name</th>
                    <th>Start Time</th>
                    <th>End Time</th>
                    <th>Changeover</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.map((shift) => (
                    <tr key={shift.shift_id}>
                      <td className="fw-medium">{shift.shift_name}</td>
                      <td>{formatTime(shift.start_time)}</td>
                      <td>{formatTime(shift.end_time)}</td>
                      <td>{shift.teacher_changeover_minutes} min</td>
                      <td>
                        <button className="btn-edit me-2" onClick={() => openEditModal(shift)}>Edit</button>
                        <button className="btn-delete" onClick={() => deleteShift(shift)}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal fade" id="shiftModal" ref={modalRef} tabIndex={-1} aria-hidden="true">
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">{isEditing ? 'Edit Shift' : 'Add New Shift'}</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {modalMessage ? <div className="alert alert-danger">{modalMessage}</div> : null}
                <form onSubmit={(event) => { event.preventDefault(); saveShift() }}>
                  <div className="mb-3">
                    <label className="form-label">Shift Name *</label>
                    <input
                      value={shiftForm.shift_name}
                      onChange={(event) => setShiftForm({ ...shiftForm, shift_name: event.target.value })}
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Start Time *</label>
                    <input
                      value={shiftForm.start_time}
                      onChange={(event) => setShiftForm({ ...shiftForm, start_time: event.target.value })}
                      type="time"
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">End Time *</label>
                    <input
                      value={shiftForm.end_time}
                      onChange={(event) => setShiftForm({ ...shiftForm, end_time: event.target.value })}
                      type="time"
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="mb-3">
                    <label className="form-label">Changeover Minutes</label>
                    <input
                      value={shiftForm.teacher_changeover_minutes}
                      onChange={(event) => setShiftForm({ ...shiftForm, teacher_changeover_minutes: event.target.value === '' ? '' : Number(event.target.value) })}
                      type="number"
                      min="0"
                      className="form-control"
                    />
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="btn-primary" onClick={saveShift} disabled={saving}>
                  {saving ? 'Saving...' : (isEditing ? 'Update Shift' : 'Add Shift')}
                </button>
              </div>
            </div>
          </div>
        </div>
        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Shift"
          description={`Delete shift ${deleteDialog.shift?.shift_name || 'this shift'}?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={deleteDialog.loading}
          danger
          onClose={() => setDeleteDialog({ open: false, shift: null, loading: false })}
          onConfirm={confirmDeleteShift}
        />
      </div>
    </AppLayout>
  )
}
