import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Classes.css'

const emptyClassForm = () => ({
  class_id: null,
  class_name: '',
  level: '',
  academic_year: '',
  section_id: '',
  room_id: '',
  shift_id: '',
  class_teacher_id: ''
})

const uniqueSorted = (items) => [...new Set(items.filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b)))

const nullableId = (value) => (value === '' || value === null || value === undefined ? null : Number(value))
const sameId = (left, right) => String(left || '') === String(right || '')

export default function Classes() {
  const [searchParams] = useSearchParams()
  const toastTimerRef = useRef(null)

  const [classesList, setClassesList] = useState([])
  const [teachers, setTeachers] = useState([])
  const [sections, setSections] = useState([])
  const [rooms, setRooms] = useState([])
  const [shifts, setShifts] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, classItem: null })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')

  const [classForm, setClassForm] = useState(emptyClassForm)

  const levelOptions = uniqueSorted(classesList.map((cls) => cls.level))

  const teacherNameById = useMemo(() => {
    return new Map(teachers.map((teacher) => [String(teacher.teacher_id), teacher.name]))
  }, [teachers])

  const getClassTeacherName = (cls) => {
    if (cls.class_teacher_name) return cls.class_teacher_name
    if (cls.class_teacher_id) return teacherNameById.get(String(cls.class_teacher_id)) || 'Not assigned'
    return 'Not assigned'
  }

  const filteredClasses = classesList.filter((cls) => {
    const query = searchQuery.trim().toLowerCase()
    const classTeacherName = getClassTeacherName(cls).toLowerCase()
    const matchesSearch = !query ||
      cls.class_name?.toLowerCase().includes(query) ||
      cls.level?.toLowerCase().includes(query) ||
      classTeacherName.includes(query) ||
      cls.section_name?.toLowerCase().includes(query) ||
      cls.room_name?.toLowerCase().includes(query) ||
      cls.shift_name?.toLowerCase().includes(query)
    const matchesLevel = !levelFilter || cls.level === levelFilter
    return matchesSearch && matchesLevel
  })

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

  const validateClassForm = () => {
    if (!classForm.class_name.trim()) return 'Class name is required.'
    if (!classForm.level.trim()) return 'Level is required.'
    if (!classForm.academic_year.trim()) return 'Academic year is required.'
    if (!classForm.section_id) return 'Please assign a section to this class.'
    if (!classForm.room_id) return 'Please assign a room to this class.'
    return ''
  }

  const buildPayload = () => ({
    class_name: classForm.class_name.trim(),
    level: classForm.level.trim(),
    academic_year: classForm.academic_year.trim(),
    section_id: nullableId(classForm.section_id),
    room_id: nullableId(classForm.room_id),
    shift_id: nullableId(classForm.shift_id),
    class_teacher_id: nullableId(classForm.class_teacher_id)
  })

  const openAddForm = () => {
    setIsEditing(false)
    setClassForm(emptyClassForm())
    setShowForm(true)
  }

  const openEditForm = (cls) => {
    setIsEditing(true)
    setClassForm({
      class_id: cls.class_id,
      class_name: cls.class_name || '',
      level: cls.level || '',
      academic_year: cls.academic_year || '',
      section_id: cls.section_id || '',
      room_id: cls.room_id || '',
      shift_id: cls.shift_id || '',
      class_teacher_id: cls.class_teacher_id || ''
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setIsEditing(false)
    setClassForm(emptyClassForm())
  }

  const saveClass = async (event) => {
    if (event) event.preventDefault()
    const validationMessage = validateClassForm()
    if (validationMessage) {
      showMessage(validationMessage, 'danger')
      return
    }

    if (classForm.class_teacher_id) {
      const existingClass = classesList.find((cls) =>
        sameId(cls.class_teacher_id, classForm.class_teacher_id) &&
        !sameId(cls.class_id, classForm.class_id)
      )
      if (existingClass) {
        showMessage('This teacher is already a head teacher for another class. A teacher can only be head teacher for one class.', 'danger')
        return
      }
    }

    setSaving(true)
    try {
      const wasEditing = isEditing
      const payload = buildPayload()
      const response = wasEditing
        ? await api.put(`/classes/${classForm.class_id}`, payload)
        : await api.post('/classes', payload)

      const savedClass = response.data.class
      if (savedClass?.class_id) {
        setClassesList((current) => {
          const index = current.findIndex((cls) => sameId(cls.class_id, savedClass.class_id))
          if (index === -1) {
            return [savedClass, ...current]
          }
          return current.map((cls, i) => (i === index ? savedClass : cls))
        })
      }
      showMessage(wasEditing ? 'Class updated successfully.' : 'Class added successfully.')
      closeForm()
    } catch (error) {
      const apiValidationMessage = error.response?.data?.errors?.[0]?.msg
      showMessage(apiValidationMessage || error.response?.data?.message || 'Failed to save class.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const deleteClass = async (cls) => {
    setDeleteDialog({ open: true, classItem: cls })
  }

  const confirmDeleteClass = async () => {
    const cls = deleteDialog.classItem
    if (!cls) return

    setDeletingId(cls.class_id)
    try {
      await api.delete(`/classes/${cls.class_id}`)
      setClassesList((current) => current.filter((item) => !sameId(item.class_id, cls.class_id)))
      showMessage('Class deleted successfully.')
      setDeleteDialog({ open: false, classItem: null })
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to delete class.', 'danger')
    } finally {
      setDeletingId(null)
    }
  }

  const loadClasses = async () => {
    setLoading(true)
    try {
      const response = await api.get('/classes')
      setClassesList(response.data.classes || [])
    } catch (error) {
      showMessage(error.response?.data?.message || 'Failed to load classes.', 'danger')
    } finally {
      setLoading(false)
    }
  }

  const loadOptions = async () => {
    const [teacherRes, sectionRes, roomRes, shiftRes] = await Promise.allSettled([
      api.get('/teachers'),
      api.get('/sections'),
      api.get('/rooms'),
      api.get('/shifts')
    ])

    if (teacherRes.status === 'fulfilled') setTeachers(teacherRes.value.data.teachers || [])
    if (sectionRes.status === 'fulfilled') setSections(sectionRes.value.data.sections || [])
    if (roomRes.status === 'fulfilled') setRooms(roomRes.value.data.rooms || [])
    if (shiftRes.status === 'fulfilled') setShifts(shiftRes.value.data.shifts || [])
  }

  const formatTime = (value) => String(value || '').slice(0, 5)

  const openCreateFromQuery = () => {
    if (searchParams.get('action') === 'add') openAddForm()
  }

  useEffect(() => {
    openCreateFromQuery()
  }, [searchParams.get('action'), searchParams.get('create')])

  useEffect(() => {
    ;(async () => {
      await Promise.all([loadClasses(), loadOptions()])
      openCreateFromQuery()
    })()
  }, [])

  return (
    <AppLayout>
      <div className="classes-container">
        <div className="page-header">
          <div>
            <h1>Classes Management</h1>
            <p>Manage all classes, assign teachers and sections</p>
          </div>
          <button className="btn-primary" onClick={openAddForm}>+ Add New Class</button>
        </div>

        {message ? (
          <div className={`alert ${messageType === 'success' ? 'alert-success' : 'alert-danger'}`}>
            {message}
          </div>
        ) : null}

        {showForm ? (
          <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeForm() }}>
            <div className="form-card modal-card" role="dialog" aria-modal="true">
              <div className="form-header">
                <h2>{isEditing ? 'Edit Class' : 'Add New Class'}</h2>
                <button className="btn-secondary" type="button" onClick={closeForm}>Cancel</button>
              </div>

              <form className="class-form" noValidate onSubmit={saveClass}>
                <div>
                  <label className="form-label">Class Name *</label>
                  <input
                    value={classForm.class_name}
                    onChange={(event) => setClassForm({ ...classForm, class_name: event.target.value })}
                    className="form-control"
                    required
                    placeholder="Example: SODA"
                  />
                </div>

                <div>
                  <label className="form-label">Level *</label>
                  <input
                    value={classForm.level}
                    onChange={(event) => setClassForm({ ...classForm, level: event.target.value })}
                    className="form-control"
                    required
                    placeholder="Example: L3"
                  />
                </div>

                <div>
                  <label className="form-label">Academic Year *</label>
                  <input
                    value={classForm.academic_year}
                    onChange={(event) => setClassForm({ ...classForm, academic_year: event.target.value })}
                    className="form-control"
                    required
                    placeholder="Example: 2025/2026"
                  />
                </div>

                <div>
                  <label className="form-label">Section *</label>
                  <select
                    value={classForm.section_id}
                    onChange={(event) => setClassForm({ ...classForm, section_id: event.target.value })}
                    className="form-control"
                    required
                  >
                    <option value="">Select section</option>
                    {sections.map((section) => (
                      <option key={section.section_id} value={section.section_id}>
                        {section.section_name} ({section.level})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Room *</label>
                  <select
                    value={classForm.room_id}
                    onChange={(event) => setClassForm({ ...classForm, room_id: event.target.value })}
                    className="form-control"
                    required
                  >
                    <option value="">Select room</option>
                    {rooms.map((room) => (
                      <option key={room.room_id} value={room.room_id}>
                        {room.room_name} ({room.capacity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Shift</label>
                  <select
                    value={classForm.shift_id}
                    onChange={(event) => setClassForm({ ...classForm, shift_id: event.target.value })}
                    className="form-control"
                  >
                    <option value="">No shift</option>
                    {shifts.map((shift) => (
                      <option key={shift.shift_id} value={shift.shift_id}>
                        {shift.shift_name} ({formatTime(shift.start_time)} - {formatTime(shift.end_time)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="form-label">Class Teacher</label>
                  <select
                    value={classForm.class_teacher_id}
                    onChange={(event) => setClassForm({ ...classForm, class_teacher_id: event.target.value })}
                    className="form-control"
                  >
                    <option value="">Not assigned</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.teacher_id} value={teacher.teacher_id}>
                        {teacher.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-actions">
                  <button className="btn-primary" type="submit" disabled={saving}>
                    {saving ? 'Saving...' : isEditing ? 'Update Class' : 'Add Class'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}

        <div className="filters-bar">
          <div className="search-input-wrap">
            <svg className="form-signifier-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m21 21-4.35-4.35M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z" />
            </svg>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="search"
              placeholder="Search classes..."
              className="search-input"
            />
          </div>
          <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="filter-select">
            <option value="">All Levels</option>
            {levelOptions.map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <button className="btn-secondary" disabled={loading} onClick={loadClasses}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="table-wrapper">
          <table className="classes-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Level</th>
                <th>Academic Year</th>
                <th>Section</th>
                <th>Room</th>
                <th>Shift</th>
                <th>Class Teacher</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.map((cls) => (
                <tr key={cls.class_id}>
                  <td><strong>{cls.class_name}</strong></td>
                  <td>{cls.level}</td>
                  <td>{cls.academic_year || '-'}</td>
                  <td>{cls.section_name || 'No section'}</td>
                  <td>{cls.room_name || 'No room'}</td>
                  <td>{cls.shift_name || 'No shift'}</td>
                  <td>{getClassTeacherName(cls)}</td>
                  <td className="actions-cell">
                    <button className="btn-edit" onClick={() => openEditForm(cls)}>Edit</button>
                    <button className="btn-delete" onClick={() => deleteClass(cls)} disabled={deletingId === cls.class_id}>
                      {deletingId === cls.class_id ? 'Deleting...' : 'Delete'}
                    </button>
                  </td>
                </tr>
              ))}
              {!filteredClasses.length && (
                <tr>
                  <td colSpan={8} className="empty-row">
                    {loading ? 'Loading classes...' : 'No classes found'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {!classesList.length && !loading && (
          <div className="empty-state">
            <p>No classes created yet</p>
            <button className="btn-primary" onClick={openAddForm}>Add your first class</button>
          </div>
        )}

        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Class"
          description={`Delete class ${deleteDialog.classItem?.class_name || 'this class'}? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={Boolean(deletingId)}
          danger
          onClose={() => setDeleteDialog({ open: false, classItem: null })}
          onConfirm={confirmDeleteClass}
        />
      </div>
    </AppLayout>
  )
}
