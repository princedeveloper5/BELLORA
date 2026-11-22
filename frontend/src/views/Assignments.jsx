import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Modal } from 'bootstrap'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Assignments.css'

const commonDepartments = ['Business', 'Software Development', 'Electrical', 'Electronics', 'Computer Science', 'Information Technology', 'Networking', 'Accounting', 'Finance', 'Marketing', 'Management', 'Hospitality', 'Tourism', 'Construction', 'Mechanical', 'Automotive', 'Agriculture', 'General Studies']

function defaultAcademicYear() {
  const today = new Date()
  const startYear = today.getMonth() >= 6 ? today.getFullYear() : today.getFullYear() - 1
  return `${startYear}-${startYear + 1}`
}

const emptyAssignment = () => ({
  teacher_id: '',
  module_id: '',
  class_id: '',
  academic_year: defaultAcademicYear(),
  term: 'Term 1'
})

export default function Assignments() {
  const [searchParams] = useSearchParams()
  const modalRef = useRef(null)

  const [teachers, setTeachers] = useState([])
  const [modules, setModules] = useState([])
  const [classes, setClasses] = useState([])
  const [assignments, setAssignments] = useState([])
  const [selectedDepartment, setSelectedDepartment] = useState('')
  const [assignmentSearch, setAssignmentSearch] = useState('')
  const [loading, setLoading] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, assignment: null, loading: false })
  const [errors, setErrors] = useState({})
  const [formMessage, setFormMessage] = useState('')

  const [newAssignment, setNewAssignment] = useState(emptyAssignment)

  const resetAssignmentForm = () => {
    setNewAssignment((current) => ({
      teacher_id: '',
      module_id: '',
      class_id: '',
      academic_year: current.academic_year || defaultAcademicYear(),
      term: 'Term 1'
    }))
    setSelectedDepartment('')
    setFormMessage('')
    setErrors({})
  }

  const openAddModal = () => {
    resetAssignmentForm()
    Modal.getOrCreateInstance(modalRef.current).show()
  }

  const teacherDepartments = [...new Set([...commonDepartments, ...teachers.map((teacher) => teacher.department || 'SSOD')])].sort((a, b) => a.localeCompare(b))

  const filteredTeachers = !selectedDepartment
    ? teachers
    : teachers.filter((teacher) => (teacher.department || 'SSOD') === selectedDepartment)

  const filteredAssignments = assignments.filter((assignment) => {
    const query = assignmentSearch.trim().toLowerCase()
    const department = assignment.teacher_department || 'SSOD'
    return !query ||
      assignment.teacher_name?.toLowerCase().includes(query) ||
      department.toLowerCase().includes(query) ||
      assignment.module_name?.toLowerCase().includes(query) ||
      assignment.class_name?.toLowerCase().includes(query) ||
      assignment.shift_name?.toLowerCase().includes(query) ||
      assignment.academic_year?.toLowerCase().includes(query) ||
      assignment.term?.toLowerCase().includes(query)
  })

  useEffect(() => {
    if (!filteredTeachers.some((teacher) => teacher.teacher_id === newAssignment.teacher_id)) {
      setNewAssignment((current) => ({ ...current, teacher_id: '' }))
    }
  }, [selectedDepartment])

  const validateForm = () => {
    const fieldErrors = {}

    if (!newAssignment.teacher_id) fieldErrors.teacher_id = 'Teacher is required'
    if (!newAssignment.module_id) fieldErrors.module_id = 'Module is required'
    if (!newAssignment.class_id) fieldErrors.class_id = 'Class is required'
    if (!newAssignment.academic_year.trim()) fieldErrors.academic_year = 'Academic year is required'
    if (!newAssignment.term.trim()) fieldErrors.term = 'Term is required'

    setErrors(fieldErrors)
    setFormMessage('')
    return Object.keys(fieldErrors).length === 0
  }

  const handleAddAssignment = async (event) => {
    if (event) event.preventDefault()
    if (!validateForm()) return

    setLoading(true)

    try {
      const response = await api.post('/assignments', newAssignment)
      if (response.data.assignment) {
        setAssignments((current) => [response.data.assignment, ...current])
        setNewAssignment({
          teacher_id: '',
          module_id: '',
          class_id: '',
          academic_year: newAssignment.academic_year,
          term: newAssignment.term || 'Term 1'
        })
        setFormMessage('')
        setErrors({})
        Modal.getOrCreateInstance(modalRef.current).hide()
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setFormMessage('Authentication required. Please login again.')
        setTimeout(() => {
          window.location.hash = '#/login'
        }, 2000)
      } else if (error.response?.status === 400) {
        if (error.response?.data?.errors?.length) {
          setErrors(error.response.data.errors.reduce((fieldErrors, item) => {
            if (item.path) fieldErrors[item.path] = item.msg
            return fieldErrors
          }, {}))
          setFormMessage('Please correct the highlighted fields.')
        } else {
          setFormMessage(error.response?.data?.message || 'Validation failed. Please check all fields.')
        }
      } else {
        setFormMessage(error.response?.data?.message || 'Failed to add assignment.')
      }
    } finally {
      setLoading(false)
    }
  }

  const deleteAssignment = async (assignment) => {
    setDeleteDialog({ open: true, assignment, loading: false })
  }

  const confirmDeleteAssignment = async () => {
    const assignment = deleteDialog.assignment
    if (!assignment) return

    setDeleteDialog((current) => ({ ...current, loading: true }))
    try {
      await api.delete(`/assignments/${assignment.assignment_id}`)
      setAssignments((current) => current.filter((item) => item.assignment_id !== assignment.assignment_id))
      setDeleteDialog({ open: false, assignment: null, loading: false })
    } finally {
      setDeleteDialog((current) => ({ ...current, loading: false }))
    }
  }

  const loadData = async () => {
    const [teachersResponse, modulesResponse, classesResponse, assignmentsResponse] = await Promise.all([
      api.get('/teachers/active'),
      api.get('/modules'),
      api.get('/classes'),
      api.get('/assignments')
    ])

    setTeachers(teachersResponse.data.teachers || [])
    setModules(modulesResponse.data.modules || [])
    setClasses(classesResponse.data.classes || [])
    setAssignments(assignmentsResponse.data.assignments || [])
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
  }, [])

  return (
    <AppLayout>
      <div className="assignments-container">
        <div className="card-custom mb-4">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="h3 fw-semibold text-dark">Assignments</h2>
            <div className="header-actions">
              <button className="btn btn-primary" type="button" onClick={openAddModal}>Add Assignment</button>
              <button className="btn btn-outline-primary" onClick={loadData}>Refresh</button>
            </div>
          </div>
        </div>

        <div className="modal fade" id="assignmentModal" ref={modalRef} tabIndex={-1} aria-labelledby="assignmentModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-lg modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title" id="assignmentModalLabel">Add Assignment</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="modal-body">
                {formMessage ? <div className="alert alert-danger" role="alert">{formMessage}</div> : null}

                <form className="row g-3" onSubmit={handleAddAssignment}>
                  <div className="col-md-4">
                    <label htmlFor="teacherDepartment" className="form-label">Teacher Department</label>
                    <select
                      id="teacherDepartment"
                      value={selectedDepartment}
                      onChange={(event) => setSelectedDepartment(event.target.value)}
                      className="form-select"
                    >
                      <option value="">All departments</option>
                      {teacherDepartments.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-4">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <label htmlFor="assignmentTeacher" className="form-label">Teacher *</label>
                      <Link to="/teachers" className="small fw-semibold text-decoration-none mb-2">Add teacher</Link>
                    </div>
                    <select
                      id="assignmentTeacher"
                      value={newAssignment.teacher_id}
                      onChange={(event) => setNewAssignment({ ...newAssignment, teacher_id: event.target.value === '' ? '' : Number(event.target.value) })}
                      className={`form-select${errors.teacher_id ? ' is-invalid' : ''}`}
                      required
                    >
                      <option value="">Select teacher</option>
                      {filteredTeachers.map((teacher) => (
                        <option key={teacher.teacher_id} value={teacher.teacher_id}>
                          {teacher.name} - {teacher.department || 'SSOD'}
                        </option>
                      ))}
                    </select>
                    {errors.teacher_id ? <div className="invalid-feedback">{errors.teacher_id}</div> : null}
                  </div>

                  <div className="col-md-4">
                    <div className="d-flex align-items-center justify-content-between gap-2">
                      <label htmlFor="assignmentModule" className="form-label">Module *</label>
                      <Link to="/modules" className="small fw-semibold text-decoration-none mb-2">Add module</Link>
                    </div>
                    <select
                      id="assignmentModule"
                      value={newAssignment.module_id}
                      onChange={(event) => setNewAssignment({ ...newAssignment, module_id: event.target.value === '' ? '' : Number(event.target.value) })}
                      className={`form-select${errors.module_id ? ' is-invalid' : ''}`}
                      required
                    >
                      <option value="">Select module</option>
                      {modules.map((module) => (
                        <option key={module.module_id} value={module.module_id}>
                          {module.module_name} - {module.department || 'SSOD'}
                        </option>
                      ))}
                    </select>
                    {errors.module_id ? <div className="invalid-feedback">{errors.module_id}</div> : null}
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="assignmentClass" className="form-label">Class *</label>
                    <select
                      id="assignmentClass"
                      value={newAssignment.class_id}
                      onChange={(event) => setNewAssignment({ ...newAssignment, class_id: event.target.value === '' ? '' : Number(event.target.value) })}
                      className={`form-select${errors.class_id ? ' is-invalid' : ''}`}
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((classItem) => (
                        <option key={classItem.class_id} value={classItem.class_id}>
                          {classItem.class_name} - {classItem.level} - {classItem.shift_name || 'No shift'}
                        </option>
                      ))}
                    </select>
                    {errors.class_id ? <div className="invalid-feedback">{errors.class_id}</div> : null}
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="academicYear" className="form-label">Academic Year *</label>
                    <input
                      id="academicYear"
                      value={newAssignment.academic_year}
                      onChange={(event) => setNewAssignment({ ...newAssignment, academic_year: event.target.value })}
                      className={`form-control${errors.academic_year ? ' is-invalid' : ''}`}
                      required
                      placeholder="2024-2025"
                    />
                    {errors.academic_year ? <div className="invalid-feedback">{errors.academic_year}</div> : null}
                  </div>

                  <div className="col-md-4">
                    <label htmlFor="assignmentTerm" className="form-label">Term *</label>
                    <select
                      id="assignmentTerm"
                      value={newAssignment.term}
                      onChange={(event) => setNewAssignment({ ...newAssignment, term: event.target.value })}
                      className={`form-select${errors.term ? ' is-invalid' : ''}`}
                      required
                    >
                      <option value="">Select term</option>
                      <option value="Term 1">Term 1</option>
                      <option value="Term 2">Term 2</option>
                      <option value="Term 3">Term 3</option>
                    </select>
                    {errors.term ? <div className="invalid-feedback">{errors.term}</div> : null}
                  </div>
                </form>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline-primary" data-bs-dismiss="modal">Cancel</button>
                <button className="btn btn-primary" type="button" disabled={loading} onClick={handleAddAssignment}>
                  {loading ? (
                    <span>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                      Saving...
                    </span>
                  ) : <span>Add Assignment</span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="card-custom">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <h2 className="h3 fw-semibold text-dark">All Assignments</h2>
            <input
              value={assignmentSearch}
              onChange={(event) => setAssignmentSearch(event.target.value)}
              className="form-control"
              style={{ maxWidth: '320px' }}
              placeholder="Search assignments..."
            />
          </div>

          <div className="table-responsive">
            <table className="table table-custom">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Department</th>
                  <th>Module</th>
                  <th>Class</th>
                  <th>Shift</th>
                  <th>Academic Year</th>
                  <th>Term</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((assignment) => (
                  <tr key={assignment.assignment_id}>
                    <td>{assignment.teacher_name}</td>
                    <td><span className="badge bg-primary">{assignment.teacher_department || 'SSOD'}</span></td>
                    <td>{assignment.module_name}</td>
                    <td>{assignment.class_name}</td>
                    <td>{assignment.shift_name || 'No shift'}</td>
                    <td>{assignment.academic_year}</td>
                    <td>{assignment.term}</td>
                    <td>
                      <button className="btn btn-danger btn-sm" onClick={() => deleteAssignment(assignment)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!filteredAssignments.length && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted py-4">No assignments found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Assignment"
          description={`Delete assignment for ${deleteDialog.assignment?.teacher_name || 'this teacher'}?`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={deleteDialog.loading}
          danger
          onClose={() => setDeleteDialog({ open: false, assignment: null, loading: false })}
          onConfirm={confirmDeleteAssignment}
        />
      </div>
    </AppLayout>
  )
}
