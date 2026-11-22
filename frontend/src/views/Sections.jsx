import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from 'bootstrap'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Sections.css'

const emptySectionForm = () => ({
  section_id: null,
  section_name: '',
  level: '',
  description: '',
  room_id: null,
  selected_class_ids: []
})

const uniqueSorted = (items) => {
  return [...new Set(items.filter(Boolean))].sort((a, b) => a.localeCompare(b))
}

export default function Sections() {
  const [searchParams] = useSearchParams()
  const modalRef = useRef(null)

  const [sections, setSections] = useState([])
  const [classes, setClasses] = useState([])
  const [rooms, setRooms] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [levelFilter, setLevelFilter] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, section: null, loading: false })
  const [errors, setErrors] = useState({})
  const [formMessage, setFormMessage] = useState('')

  const [sectionForm, setSectionForm] = useState(emptySectionForm)

  const levelOptions = useMemo(() => uniqueSorted(sections.map((section) => section.level)), [sections])
  const levelSuggestions = useMemo(() => uniqueSorted(['Grade 10', 'Grade 11', 'Grade 12', ...sections.map((section) => section.level)]), [sections])

  const filteredSections = sections.filter((section) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesSearch = !query ||
      section.section_name?.toLowerCase().includes(query) ||
      section.level?.toLowerCase().includes(query) ||
      section.description?.toLowerCase().includes(query)
    const matchesLevel = !levelFilter || section.level === levelFilter
    return matchesSearch && matchesLevel
  })

  const filteredSectionGroups = useMemo(() => {
    const groups = new Map()

    filteredSections.forEach((section) => {
      const level = section.level || 'No Level'
      if (!groups.has(level)) {
        groups.set(level, {
          level,
          sections: [],
          classIds: new Set()
        })
      }

      const classIds = String(section.class_ids || '')
        .split(',')
        .map((classId) => classId.trim())
        .filter(Boolean)

      const classesWithRooms = classIds.map((classId) => {
        const classData = classes.find((c) => String(c.class_id) === String(classId))
        return {
          class_id: classId,
          class_name: classData?.class_name || `Class ${classId}`,
          room_name: classData?.room_name || 'No Room'
        }
      }).sort((a, b) => a.class_name.localeCompare(b.class_name))

      const group = groups.get(level)
      const countKeys = classIds.length ? classIds : [section.section_id || section.section_name]
      countKeys.forEach((classItem) => group.classIds.add(classItem))
      group.sections.push({
        ...section,
        room_name: rooms.find((r) => r.room_id === section.room_id)?.room_name || 'No Room',
        classes: String(section.class_names || '')
          .split(',')
          .map((className) => className.trim())
          .filter(Boolean)
          .sort((a, b) => a.localeCompare(b)),
        classesWithRooms
      })
    })

    return [...groups.values()].map((group) => ({
      ...group,
      class_count: group.classIds.size,
      sections: group.sections.sort((a, b) => String(a.section_name).localeCompare(String(b.section_name)))
    }))
  }, [filteredSections, classes, rooms])

  const openAddModal = () => {
    setIsEditing(false)
    setSectionForm(emptySectionForm())
    setErrors({})
    setFormMessage('')
    Modal.getOrCreateInstance(modalRef.current).show()
  }

  const openEditModal = (section) => {
    setIsEditing(true)
    const selectedIds = String(section.class_ids || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map(Number)

    setSectionForm({
      section_id: section.section_id,
      section_name: section.section_name || '',
      level: section.level || '',
      description: section.description || '',
      room_id: section.room_id || null,
      selected_class_ids: selectedIds
    })
    setErrors({})
    setFormMessage('')
    Modal.getOrCreateInstance(modalRef.current).show()
  }

  const validateForm = () => {
    const fieldErrors = {}

    const trimmedSectionName = sectionForm.section_name.trim()
    if (!trimmedSectionName) fieldErrors.section_name = 'Section name is required'
    if (!sectionForm.level.trim()) fieldErrors.level = 'Level is required'

    const duplicateSection = sections.find((section) => {
      return section.section_name?.trim().toLowerCase() === trimmedSectionName.toLowerCase() &&
        section.level?.trim().toLowerCase() === sectionForm.level.trim().toLowerCase() &&
        (!isEditing || section.section_id !== sectionForm.section_id)
    })

    if (duplicateSection) {
      fieldErrors.section_name = 'A section with this name and level already exists'
    }

    setErrors(fieldErrors)
    setFormMessage('')
    return Object.keys(fieldErrors).length === 0
  }

  const buildPayload = () => ({
    section_name: sectionForm.section_name.trim(),
    level: sectionForm.level.trim(),
    description: sectionForm.description?.trim() || null,
    room_id: sectionForm.room_id || null,
    class_ids: sectionForm.selected_class_ids.length > 0 ? sectionForm.selected_class_ids : null
  })

  const saveSection = async () => {
    if (!validateForm()) return

    setLoading(true)

    try {
      const payload = buildPayload()
      await (isEditing
        ? api.put(`/sections/${sectionForm.section_id}`, payload)
        : api.post('/sections', payload))

      Modal.getOrCreateInstance(modalRef.current).hide()
      await loadData()
      showToast(isEditing ? 'Section updated successfully!' : 'Section added successfully!', 'success')
    } catch (error) {
      if (error.response?.data?.errors?.length) {
        setErrors(error.response.data.errors.reduce((fieldErrors, item) => {
          if (item.path) fieldErrors[item.path] = item.msg
          return fieldErrors
        }, {}))
        setFormMessage('Please correct the highlighted fields.')
      } else {
        setFormMessage(error.response?.data?.message || 'Failed to save section.')
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteSection = async (section) => {
    setDeleteDialog({ open: true, section, loading: false })
  }

  const confirmDeleteSection = async () => {
    const section = deleteDialog.section
    if (!section) return

    setDeleteDialog((current) => ({ ...current, loading: true }))
    try {
      await api.delete(`/sections/${section.section_id}`)
      setSections((current) => current.filter((item) => item.section_id !== section.section_id))
      showToast('Section deleted successfully!', 'success')
      setDeleteDialog({ open: false, section: null, loading: false })
    } catch (error) {
      showToast(error.response?.data?.message || 'Failed to delete section.', 'danger')
    } finally {
      setDeleteDialog((current) => ({ ...current, loading: false }))
    }
  }

  const showToast = () => {}

  const loadData = async () => {
    try {
      const [sectionsResponse, classesResponse, roomsResponse] = await Promise.all([
        api.get('/sections/with-count'),
        api.get('/classes'),
        api.get('/rooms')
      ])
      setSections(sectionsResponse.data.sections || [])
      setClasses(classesResponse.data.classes || [])
      setRooms(roomsResponse.data.rooms || [])
    } catch (error) {
      console.error('Failed to load sections:', error)
      showToast('Failed to load sections.', 'danger')
    }
  }

  const refreshSections = () => {
    loadData()
  }

  const openCreateFromQuery = () => {
    if (searchParams.get('action') === 'add') openAddModal()
  }

  useEffect(() => {
    openCreateFromQuery()
  }, [searchParams.get('action'), searchParams.get('create')])

  useEffect(() => {
    loadData()
    openCreateFromQuery()
    window.addEventListener('classes-updated', refreshSections)

    return () => {
      window.removeEventListener('classes-updated', refreshSections)
    }
  }, [])

  const toggleClassSelection = (classId, checked) => {
    setSectionForm((current) => ({
      ...current,
      selected_class_ids: checked
        ? [...current.selected_class_ids, classId]
        : current.selected_class_ids.filter((id) => id !== classId)
    }))
  }

  return (
    <AppLayout>
      <div className="sections-container">
        <div className="card-custom">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="h3 fw-semibold text-dark">All Sections</h2>
            <button className="btn-primary" onClick={openAddModal}>Add New Section</button>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-6">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="text"
                placeholder="Search sections..."
                className="form-control"
              />
            </div>
            <div className="col-md-6">
              <select value={levelFilter} onChange={(event) => setLevelFilter(event.target.value)} className="form-select">
                <option value="">All Levels</option>
                {levelOptions.map((level) => (
                  <option key={level} value={level}>{level}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Level</th>
                  <th>Room</th>
                  <th>Class</th>
                  <th>Description</th>
                  <th>Classes Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSectionGroups.map((group) => (
                  <tr key={group.level}>
                    <td className="fw-medium level-cell">{group.level}</td>
                    <td>
                      <div className="section-class-list">
                        {group.sections.map((section) => (
                          <div key={section.section_id} className="section-class-row">
                            <div className="room-list">
                              <span className="room-chip">
                                {section.room_name || 'No Room'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="section-class-list">
                        {group.sections.map((section) => (
                          <div key={section.section_id} className="section-class-row">
                            <div className="class-list">
                              {section.classesWithRooms.map((classItem) => (
                                <span key={classItem.class_id} className="class-chip">
                                  {classItem.class_name}
                                </span>
                              ))}
                              {!section.classesWithRooms.length && <span className="empty-note">No classes assigned</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td>
                      <div className="description-list">
                        {group.sections.map((section) => (
                          <span key={section.section_id}>
                            <strong>{section.section_name}:</strong> {section.description || 'No description'}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <span className="badge">{group.class_count}</span>
                    </td>
                    <td>
                      <div className="section-actions">
                        {group.sections.map((section) => (
                          <div key={section.section_id} className="section-action-row">
                            <button className="btn-edit" onClick={() => openEditModal(section)}>Edit</button>
                            <button className="btn-delete" onClick={() => deleteSection(section)}>Delete</button>
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
                {!filteredSectionGroups.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-4">No sections found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal fade" id="sectionModal" ref={modalRef} tabIndex={-1} aria-labelledby="sectionModalLabel" aria-hidden="true">
          <div className="modal-dialog">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="sectionModalLabel">{isEditing ? 'Edit Section' : 'Add New Section'}</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {formMessage ? <div className="alert alert-danger" role="alert">{formMessage}</div> : null}
                <form onSubmit={(event) => { event.preventDefault(); saveSection() }}>
                  <div className="mb-3">
                    <label htmlFor="sectionName" className="form-label">Section Name *</label>
                    <input
                      id="sectionName"
                      value={sectionForm.section_name}
                      onChange={(event) => setSectionForm({ ...sectionForm, section_name: event.target.value })}
                      className={`form-control${errors.section_name ? ' is-invalid' : ''}`}
                      required
                      placeholder="Example: A, Science, Arts"
                    />
                    {errors.section_name ? <div className="invalid-feedback">{errors.section_name}</div> : null}
                  </div>
                  <div className="mb-3">
                    <label htmlFor="sectionLevel" className="form-label">Level *</label>
                    <input
                      id="sectionLevel"
                      value={sectionForm.level}
                      onChange={(event) => setSectionForm({ ...sectionForm, level: event.target.value })}
                      className={`form-control${errors.level ? ' is-invalid' : ''}`}
                      required
                      list="levelSuggestions"
                      placeholder="Example: Grade 10, Grade 11"
                    />
                    <datalist id="levelSuggestions">
                      {levelSuggestions.map((level) => (
                        <option key={level} value={level} />
                      ))}
                    </datalist>
                    {errors.level ? <div className="invalid-feedback">{errors.level}</div> : null}
                  </div>
                  <div className="mb-3">
                    <label htmlFor="sectionDescription" className="form-label">Description</label>
                    <textarea
                      id="sectionDescription"
                      value={sectionForm.description}
                      onChange={(event) => setSectionForm({ ...sectionForm, description: event.target.value })}
                      className="form-control"
                      rows="3"
                      placeholder="Optional description"
                    ></textarea>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="sectionRoom" className="form-label">Room</label>
                    <select
                      id="sectionRoom"
                      value={sectionForm.room_id === null || sectionForm.room_id === undefined ? '' : String(sectionForm.room_id)}
                      onChange={(event) => setSectionForm({ ...sectionForm, room_id: event.target.value === '' ? null : Number(event.target.value) })}
                      className="form-control"
                    >
                      <option value="">No room assigned</option>
                      {rooms.map((room) => (
                        <option key={room.room_id} value={room.room_id}>
                          {room.room_name} (Capacity: {room.capacity})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3">
                    <label htmlFor="sectionClasses" className="form-label">Assign Classes</label>
                    <div className="form-control" style={{ height: 'auto', padding: '0.5rem', maxHeight: '250px', overflowY: 'auto', border: '1px solid #e2e8f0' }}>
                      {!classes.length && <div className="text-muted" style={{ padding: '0.5rem' }}>No classes available</div>}
                      {classes.map((classItem) => (
                        <div key={classItem.class_id} style={{ padding: '0.5rem', borderBottom: '1px solid #f0f0f0' }}>
                          <input
                            type="checkbox"
                            id={`class-${classItem.class_id}`}
                            value={classItem.class_id}
                            checked={sectionForm.selected_class_ids.includes(Number(classItem.class_id))}
                            onChange={(event) => toggleClassSelection(Number(classItem.class_id), event.target.checked)}
                          />
                          <label htmlFor={`class-${classItem.class_id}`} style={{ marginLeft: '0.5rem', cursor: 'pointer' }}>
                            {classItem.class_name} ({classItem.level})
                          </label>
                        </div>
                      ))}
                    </div>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="btn-primary" onClick={saveSection} disabled={loading}>
                  {loading ? <span>Saving...</span> : <span>{isEditing ? 'Update Section' : 'Add Section'}</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Section"
          description={`Delete section ${deleteDialog.section?.section_name || 'this section'} (${deleteDialog.section?.level || ''})? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={deleteDialog.loading}
          danger
          onClose={() => setDeleteDialog({ open: false, section: null, loading: false })}
          onConfirm={confirmDeleteSection}
        />
      </div>
    </AppLayout>
  )
}
