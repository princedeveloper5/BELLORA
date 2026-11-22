import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Modal } from 'bootstrap'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Modules.css'

const commonDepartments = ['Business', 'Software Development', 'Electrical', 'Electronics', 'Computer Science', 'Information Technology', 'Networking', 'Accounting', 'Finance', 'Marketing', 'Management', 'Hospitality', 'Tourism', 'Construction', 'Mechanical', 'Automotive', 'Agriculture', 'General Studies']
const commonRoomTypes = ['Classroom', 'Computer Lab', 'Science Lab', 'Workshop', 'Hall', 'Library']

const emptyAddForm = () => ({
  module_name: '',
  department: '',
  hours_per_year: '',
  required_room_type: '',
  description: ''
})

const emptyEditForm = () => ({
  module_id: null,
  module_name: '',
  department: '',
  hours_per_year: '',
  required_room_type: '',
  description: ''
})

export default function Modules() {
  const [searchParams] = useSearchParams()
  const addModalRef = useRef(null)
  const editModalRef = useRef(null)

  const [modules, setModules] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDepartment, setSelectedDepartment] = useState('')

  const [newModule, setNewModule] = useState(emptyAddForm)
  const [editModule, setEditModule] = useState(emptyEditForm)

  const [loading, setLoading] = useState(false)
  const [editLoading, setEditLoading] = useState(false)
  const [deleteLoadingId, setDeleteLoadingId] = useState(null)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, module: null })
  const [errors, setErrors] = useState({})
  const [editErrors, setEditErrors] = useState({})
  const [formMessage, setFormMessage] = useState('')
  const [editFormMessage, setEditFormMessage] = useState('')

  const filteredModules = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    return modules.filter((module) => {
      const name = module.module_name || ''
      const department = module.department || 'SSOD'
      const requiredRoomType = module.required_room_type || ''
      const description = module.description || ''
      const matchesDepartment = !selectedDepartment || department === selectedDepartment
      const matchesSearch = name.toLowerCase().includes(query) ||
        department.toLowerCase().includes(query) ||
        requiredRoomType.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)

      return matchesDepartment && matchesSearch
    })
  }, [modules, searchQuery, selectedDepartment])

  const existingDepartments = useMemo(() => {
    const departments = modules
      .map((module) => module.department)
      .filter(Boolean)

    return [...new Set(departments)].sort((a, b) => a.localeCompare(b))
  }, [modules])

  const departmentInputSuggestions = [...new Set([...commonDepartments, ...existingDepartments])]

  const departmentFilterOptions = [...new Set([...commonDepartments, ...existingDepartments])]

  const roomTypeSuggestions = [...new Set([...commonRoomTypes, ...modules.map((module) => module.required_room_type).filter(Boolean)])]

  const resetForm = () => {
    setNewModule(emptyAddForm())
    setErrors({})
    setFormMessage('')
  }

  const resetEditForm = () => {
    setEditModule(emptyEditForm())
    setEditErrors({})
    setEditFormMessage('')
  }

  const openAddModal = () => {
    resetForm()
    Modal.getOrCreateInstance(addModalRef.current).show()
  }

  const openEditModal = (module) => {
    setEditModule({
      module_id: module.module_id,
      module_name: module.module_name || '',
      department: module.department || 'SSOD',
      hours_per_year: Number(module.hours_per_year),
      required_room_type: module.required_room_type || '',
      description: module.description || ''
    })
    setEditErrors({})
    setEditFormMessage('')

    Modal.getOrCreateInstance(editModalRef.current).show()
  }

  const validateModuleForm = (moduleData) => {
    const fieldErrors = {}

    if (!moduleData.module_name.trim()) {
      fieldErrors.module_name = 'Module name is required'
    }

    if (!moduleData.department.trim()) {
      fieldErrors.department = 'Department is required'
    }

    if (!Number.isInteger(moduleData.hours_per_year) || moduleData.hours_per_year < 1) {
      fieldErrors.hours_per_year = 'Hours per year must be a positive whole number'
    }

    return fieldErrors
  }

  const buildModulePayload = (moduleData) => {
    return {
      module_name: moduleData.module_name.trim(),
      department: moduleData.department.trim(),
      hours_per_year: moduleData.hours_per_year,
      required_room_type: moduleData.required_room_type.trim(),
      description: moduleData.description.trim()
    }
  }

  const setValidationErrors = (error) => {
    if (error.response?.data?.errors?.length) {
      const fieldErrors = error.response.data.errors.reduce((currentErrors, item) => {
        if (item.path) currentErrors[item.path] = item.msg
        return currentErrors
      }, {})
      return { fieldErrors, message: 'Please correct the highlighted fields.' }
    }

    if (error.response?.data?.message) {
      return { fieldErrors: null, message: error.response.data.message }
    }

    return null
  }

  const handleAddModule = async () => {
    const fieldErrors = validateModuleForm(newModule)
    setErrors(fieldErrors)
    setFormMessage('')
    if (Object.keys(fieldErrors).length) {
      return
    }

    setLoading(true)
    setErrors({})

    try {
      const payload = buildModulePayload(newModule)

      const response = await api.post('/modules', payload)

      if (response.data.module) {
        setModules((current) => [response.data.module, ...current])
        resetForm()
        Modal.getOrCreateInstance(addModalRef.current).hide()
        showSuccessMessage('Module added successfully!')
      }
    } catch (error) {
      console.error('Error adding module:', error)
      const parsed = setValidationErrors(error)
      if (parsed) {
        if (parsed.fieldErrors) setErrors(parsed.fieldErrors)
        setFormMessage(parsed.message)
      } else {
        showErrorMessage('Failed to add module. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleEditModule = async () => {
    const fieldErrors = validateModuleForm(editModule)
    setEditErrors(fieldErrors)
    setEditFormMessage('')
    if (Object.keys(fieldErrors).length) {
      return
    }

    setEditLoading(true)
    setEditErrors({})
    setEditFormMessage('')

    try {
      const payload = buildModulePayload(editModule)
      const response = await api.put(`/modules/${editModule.module_id}`, payload)
      const updatedModule = response.data.module

      if (updatedModule) {
        setModules((current) => current.map((module) => (module.module_id === updatedModule.module_id ? updatedModule : module)))
      }

      Modal.getOrCreateInstance(editModalRef.current).hide()
      resetEditForm()
      showSuccessMessage('Module updated successfully!')
    } catch (error) {
      console.error('Error updating module:', error)
      const parsed = setValidationErrors(error)
      if (parsed) {
        if (parsed.fieldErrors) setEditErrors(parsed.fieldErrors)
        setEditFormMessage(parsed.message)
      } else {
        showErrorMessage('Failed to update module. Please try again.')
      }
    } finally {
      setEditLoading(false)
    }
  }

  const handleDeleteModule = async (module) => {
    setDeleteDialog({ open: true, module })
  }

  const confirmDeleteModule = async () => {
    const module = deleteDialog.module
    if (!module) return

    setDeleteLoadingId(module.module_id)

    try {
      await api.delete(`/modules/${module.module_id}`)
      setModules((current) => current.filter((item) => item.module_id !== module.module_id))
      showSuccessMessage('Module deleted successfully!')
      setDeleteDialog({ open: false, module: null })
    } catch (error) {
      console.error('Error deleting module:', error)
      showErrorMessage(error.response?.data?.message || 'Failed to delete module. Please try again.')
    } finally {
      setDeleteLoadingId(null)
    }
  }

  const showSuccessMessage = () => {}

  const showErrorMessage = () => {}

  const loadModules = async () => {
    try {
      const response = await api.get('/modules')
      setModules(response.data.modules || [])
    } catch (error) {
      console.error('Error loading modules:', error)
    }
  }

  const openCreateFromQuery = () => {
    if (searchParams.get('action') === 'add') {
      openAddModal()
    }
  }

  useEffect(() => {
    openCreateFromQuery()
  }, [searchParams.get('action'), searchParams.get('create')])

  useEffect(() => {
    ;(async () => {
      await loadModules()
      openCreateFromQuery()
    })()
  }, [])

  return (
    <AppLayout>
      <div className="modules-container">
        <div className="card-custom">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="h3 fw-semibold text-dark">All Modules</h2>
            <button className="btn btn-primary" onClick={openAddModal}>
              Add New Module
            </button>
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-8">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="text"
                placeholder="Search modules..."
                className="form-control"
              />
            </div>
            <div className="col-md-4">
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="form-select"
                aria-label="Filter modules by department"
              >
                <option value="">All departments</option>
                {departmentFilterOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table-custom">
              <thead>
                <tr>
                  <th>Module Name</th>
                  <th>Department</th>
                  <th>Required Room</th>
                  <th>Hours/Year</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredModules.map((module) => (
                  <tr key={module.module_id}>
                    <td className="fw-medium">{module.module_name}</td>
                    <td>
                      <span className="badge">{module.department || 'SSOD'}</span>
                    </td>
                    <td>{module.required_room_type || 'Any room'}</td>
                    <td>{module.hours_per_year}</td>
                    <td>{module.description || 'No description'}</td>
                    <td>
                      <button className="btn-edit" onClick={() => openEditModal(module)}>
                        Edit
                      </button>
                      <button className="btn-delete" onClick={() => handleDeleteModule(module)} disabled={deleteLoadingId === module.module_id}>
                        {deleteLoadingId === module.module_id ? <span>Deleting...</span> : <span>Delete</span>}
                      </button>
                    </td>
                  </tr>
                ))}
                {!filteredModules.length && (
                  <tr>
                    <td colSpan={6} className="text-center py-4">
                      No modules found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal fade" id="addModuleModal" ref={addModalRef} tabIndex={-1} aria-labelledby="addModuleModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="addModuleModalLabel">Add New Module</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {formMessage ? (
                  <div className="alert alert-danger" role="alert">
                    {formMessage}
                  </div>
                ) : null}
                <form onSubmit={(event) => { event.preventDefault(); handleAddModule() }}>
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label htmlFor="moduleName" className="form-label">Module Name *</label>
                      <input
                        type="text"
                        className={`form-control${errors.module_name ? ' is-invalid' : ''}`}
                        id="moduleName"
                        value={newModule.module_name}
                        onChange={(event) => setNewModule({ ...newModule, module_name: event.target.value })}
                        required
                        placeholder="Enter module name"
                      />
                      {errors.module_name ? (
                        <div className="invalid-feedback">
                          {errors.module_name}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="moduleDepartment" className="form-label">Department *</label>
                      <input
                        type="text"
                        className={`form-control${errors.department ? ' is-invalid' : ''}`}
                        id="moduleDepartment"
                        value={newModule.department}
                        onChange={(event) => setNewModule({ ...newModule, department: event.target.value })}
                        required
                        list="departmentSuggestions"
                        placeholder="Enter department"
                      />
                      <datalist id="departmentSuggestions">
                        {departmentInputSuggestions.map((department) => (
                          <option key={department} value={department} />
                        ))}
                      </datalist>
                      <datalist id="roomTypeSuggestions">
                        {roomTypeSuggestions.map((roomType) => (
                          <option key={roomType} value={roomType} />
                        ))}
                      </datalist>
                      {errors.department ? (
                        <div className="invalid-feedback">
                          {errors.department}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="hoursPerYear" className="form-label">Hours per Year *</label>
                      <input
                        type="number"
                        className={`form-control${errors.hours_per_year ? ' is-invalid' : ''}`}
                        id="hoursPerYear"
                        value={newModule.hours_per_year}
                        onChange={(event) => setNewModule({ ...newModule, hours_per_year: event.target.value === '' ? '' : Number(event.target.value) })}
                        required
                        min="1"
                        step="1"
                        placeholder="Enter hours per year"
                      />
                      {errors.hours_per_year ? (
                        <div className="invalid-feedback">
                          {errors.hours_per_year}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="requiredRoomType" className="form-label">Required Room Type</label>
                      <input
                        type="text"
                        className="form-control"
                        id="requiredRoomType"
                        value={newModule.required_room_type}
                        onChange={(event) => setNewModule({ ...newModule, required_room_type: event.target.value })}
                        list="roomTypeSuggestions"
                        placeholder="Any room, Computer Lab, Workshop..."
                      />
                    </div>
                    <div className="col-md-12">
                      <label htmlFor="moduleDescription" className="form-label">Description</label>
                      <textarea
                        className={`form-control${errors.description ? ' is-invalid' : ''}`}
                        id="moduleDescription"
                        value={newModule.description}
                        onChange={(event) => setNewModule({ ...newModule, description: event.target.value })}
                        rows="3"
                        placeholder="Enter module description"
                      ></textarea>
                      {errors.description ? (
                        <div className="invalid-feedback">
                          {errors.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="btn-primary" onClick={handleAddModule} disabled={loading}>
                  {loading ? <span>Adding...</span> : <span>Add Module</span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal fade" id="editModuleModal" ref={editModalRef} tabIndex={-1} aria-labelledby="editModuleModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="editModuleModalLabel">Edit Module</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {editFormMessage ? (
                  <div className="alert alert-danger" role="alert">
                    {editFormMessage}
                  </div>
                ) : null}
                <form onSubmit={(event) => { event.preventDefault(); handleEditModule() }}>
                  <div className="row g-3">
                    <div className="col-md-12">
                      <label htmlFor="editModuleName" className="form-label">Module Name *</label>
                      <input
                        type="text"
                        className={`form-control${editErrors.module_name ? ' is-invalid' : ''}`}
                        id="editModuleName"
                        value={editModule.module_name}
                        onChange={(event) => setEditModule({ ...editModule, module_name: event.target.value })}
                        required
                        placeholder="Enter module name"
                      />
                      {editErrors.module_name ? (
                        <div className="invalid-feedback">
                          {editErrors.module_name}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editModuleDepartment" className="form-label">Department *</label>
                      <input
                        type="text"
                        className={`form-control${editErrors.department ? ' is-invalid' : ''}`}
                        id="editModuleDepartment"
                        value={editModule.department}
                        onChange={(event) => setEditModule({ ...editModule, department: event.target.value })}
                        required
                        list="departmentSuggestions"
                        placeholder="Enter department"
                      />
                      {editErrors.department ? (
                        <div className="invalid-feedback">
                          {editErrors.department}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editHoursPerYear" className="form-label">Hours per Year *</label>
                      <input
                        type="number"
                        className={`form-control${editErrors.hours_per_year ? ' is-invalid' : ''}`}
                        id="editHoursPerYear"
                        value={editModule.hours_per_year}
                        onChange={(event) => setEditModule({ ...editModule, hours_per_year: event.target.value === '' ? '' : Number(event.target.value) })}
                        required
                        min="1"
                        step="1"
                        placeholder="Enter hours per year"
                      />
                      {editErrors.hours_per_year ? (
                        <div className="invalid-feedback">
                          {editErrors.hours_per_year}
                        </div>
                      ) : null}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editRequiredRoomType" className="form-label">Required Room Type</label>
                      <input
                        type="text"
                        className="form-control"
                        id="editRequiredRoomType"
                        value={editModule.required_room_type}
                        onChange={(event) => setEditModule({ ...editModule, required_room_type: event.target.value })}
                        list="roomTypeSuggestions"
                        placeholder="Any room, Computer Lab, Workshop..."
                      />
                    </div>
                    <div className="col-md-12">
                      <label htmlFor="editModuleDescription" className="form-label">Description</label>
                      <textarea
                        className={`form-control${editErrors.description ? ' is-invalid' : ''}`}
                        id="editModuleDescription"
                        value={editModule.description}
                        onChange={(event) => setEditModule({ ...editModule, description: event.target.value })}
                        rows="3"
                        placeholder="Enter module description"
                      ></textarea>
                      {editErrors.description ? (
                        <div className="invalid-feedback">
                          {editErrors.description}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="btn-primary" onClick={handleEditModule} disabled={editLoading}>
                  {editLoading ? <span>Saving...</span> : <span>Save Changes</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Module"
          description={`Delete ${deleteDialog.module?.module_name || 'this module'}? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={Boolean(deleteLoadingId)}
          danger
          onClose={() => setDeleteDialog({ open: false, module: null })}
          onConfirm={confirmDeleteModule}
        />
      </div>
    </AppLayout>
  )
}
