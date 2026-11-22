import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Rooms.css'

const emptyRoomForm = () => ({
  room_id: null,
  room_name: '',
  room_type: '',
  capacity: 30
})

export default function Rooms() {
  const [searchParams] = useSearchParams()
  const toastTimerRef = useRef(null)

  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, room: null })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const [roomForm, setRoomForm] = useState(emptyRoomForm)

  const showMessage = (text, type = 'success') => {
    setMessage(text)
    setMessageType(type)
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => {
      setMessage((current) => (current === text ? '' : current))
    }, 3500)
  }

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
  }, [])

  const resetForm = () => {
    setIsEditing(false)
    setRoomForm(emptyRoomForm())
  }

  const openAddForm = () => {
    resetForm()
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    resetForm()
  }

  const loadRooms = async () => {
    setLoading(true)
    try {
      const response = await api.get('/rooms')
      setRooms(response.data.rooms || [])
    } catch (error) {
      showMessage("We couldn't load rooms right now. Please try again.", 'danger')
    } finally {
      setLoading(false)
    }
  }

  const saveRoom = async (event) => {
    if (event) event.preventDefault()
    setSaving(true)
    try {
      const payload = {
        room_name: roomForm.room_name.trim(),
        room_type: roomForm.room_type.trim(),
        capacity: Number(roomForm.capacity)
      }
      const response = isEditing
        ? await api.put(`/rooms/${roomForm.room_id}`, payload)
        : await api.post('/rooms', payload)
      const savedRoom = response.data.room

      if (isEditing) {
        setRooms((current) => current.map((room) => (room.room_id === savedRoom.room_id ? savedRoom : room)))
      } else {
        setRooms((current) => [...current, savedRoom])
      }

      showMessage(isEditing ? 'Room updated successfully.' : 'Room added successfully.')
      closeForm()
    } catch (error) {
      const validationMessage = error.response?.data?.errors?.[0]?.msg
      showMessage(validationMessage || "We couldn't save this room. Please check the details and try again.", 'danger')
    } finally {
      setSaving(false)
    }
  }

  const editRoom = (room) => {
    setIsEditing(true)
    setRoomForm({ ...room })
    setShowForm(true)
  }

  const deleteRoom = (room) => {
    setDeleteDialog({ open: true, room })
  }

  const confirmDeleteRoom = async () => {
    const room = deleteDialog.room
    if (!room) return

    setDeletingId(room.room_id)
    try {
      await api.delete(`/rooms/${room.room_id}`)
      setRooms((current) => current.filter((item) => item.room_id !== room.room_id))
      showMessage('Room deleted successfully.')
      setDeleteDialog({ open: false, room: null })
    } catch (error) {
      showMessage("We couldn't delete this room right now. Please try again.", 'danger')
    } finally {
      setDeletingId(null)
    }
  }

  const openCreateFromQuery = () => {
    if (searchParams.get('action') === 'add') openAddForm()
  }

  useEffect(() => {
    openCreateFromQuery()
  }, [searchParams.get('action'), searchParams.get('create')])

  useEffect(() => {
    ;(async () => {
      await loadRooms()
      openCreateFromQuery()
    })()
  }, [])

  return (
    <AppLayout>
      <div className="rooms-container">
        <div className="card-custom">
          <div className="page-header">
            <div>
              <h1>Rooms Management</h1>
              <p>Create, update, and remove classroom spaces.</p>
            </div>
            <div className="header-actions">
              <button className="btn-primary" type="button" onClick={openAddForm}>Add New Room</button>
              <button className="btn-secondary" disabled={loading} onClick={loadRooms}>
                {loading ? 'Refreshing...' : 'Refresh'}
              </button>
            </div>
          </div>

          {message ? (
            <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`}>
              {message}
            </div>
          ) : null}
        </div>

        {showForm ? (
          <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
            <div className="form-card modal-card" role="dialog" aria-modal="true">
              <div className="form-header">
                <h2>{isEditing ? 'Edit Room' : 'Add New Room'}</h2>
                <button className="btn-secondary" type="button" onClick={closeForm}>Cancel</button>
              </div>

              <form className="room-form" onSubmit={saveRoom}>
                <div>
                  <label className="form-label">Room Name *</label>
                  <input
                    value={roomForm.room_name}
                    onChange={(event) => setRoomForm({ ...roomForm, room_name: event.target.value })}
                    className="form-control"
                    required
                    placeholder="Example: Room 101"
                  />
                </div>
                <div>
                  <label className="form-label">Room Type *</label>
                  <input
                    value={roomForm.room_type}
                    onChange={(event) => setRoomForm({ ...roomForm, room_type: event.target.value })}
                    className="form-control"
                    required
                    placeholder="Classroom, Lab, Hall"
                  />
                </div>
                <div>
                  <label className="form-label">Capacity *</label>
                  <input
                    value={roomForm.capacity}
                    onChange={(event) => setRoomForm({ ...roomForm, capacity: event.target.value === '' ? '' : Number(event.target.value) })}
                    type="number"
                    min="1"
                    className="form-control"
                    required
                  />
                </div>
                <div className="form-actions">
                  <button className="btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving...' : (isEditing ? 'Update Room' : 'Add Room')}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <div className="card-custom">
          <div className="table-header">
            <h2>Saved Rooms</h2>
            <span className="badge">{rooms.length} rooms</span>
          </div>

          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Type</th>
                  <th>Capacity</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rooms.map((room) => (
                  <tr key={room.room_id}>
                    <td>{room.room_name}</td>
                    <td>{room.room_type}</td>
                    <td>{room.capacity}</td>
                    <td>
                      <button className="btn-edit" onClick={() => editRoom(room)}>Edit</button>
                      <button className="btn-delete" disabled={deletingId === room.room_id} onClick={() => deleteRoom(room)}>
                        {deletingId === room.room_id ? 'Deleting...' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!rooms.length && (
                  <tr>
                    <td colSpan={4} className="empty-row">{loading ? 'Loading rooms...' : 'No rooms found'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Room"
          description={`Are you sure you want to permanently delete ${deleteDialog.room?.room_name || 'this room'}?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={Boolean(deletingId)}
          danger
          onClose={() => setDeleteDialog({ open: false, room: null })}
          onConfirm={confirmDeleteRoom}
        />
      </div>
    </AppLayout>
  )
}
