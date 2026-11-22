import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { Modal } from 'bootstrap'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import api from '@/stores/api'
import './Teachers.css'

const commonDepartments = ['Business', 'Software Development', 'Electrical', 'Electronics', 'Computer Science', 'Information Technology', 'Networking', 'Accounting', 'Finance', 'Marketing', 'Management', 'Hospitality', 'Tourism', 'Construction', 'Mechanical', 'Automotive', 'Agriculture', 'General Studies']

const quickFilters = [
  { label: 'All', value: 'all' },
  { label: 'Active', value: 'active' },
  { label: 'Pending', value: 'pending' },
  { label: 'No Modules', value: 'unassigned' },
  { label: 'On Leave', value: 'on_leave' }
]

const blankTeacherForm = () => ({
  teacher_id: null,
  name: '',
  email: '',
  department: '',
  password: '',
  status: 'active',
  date_joined: '',
  employee_id: '',
  phone: '',
  module_name: '',
  qualification: '',
  years_experience: '',
  available_days: '',
  available_from: '',
  available_to: '',
  notes: ''
})

const initialNewTeacher = () => ({
  name: '',
  email: '',
  department: '',
  password: '',
  status: 'active',
  date_joined: new Date().toISOString().split('T')[0],
  employee_id: '',
  phone: '',
  module_name: '',
  qualification: '',
  years_experience: '',
  available_days: '',
  available_from: '',
  available_to: '',
  notes: ''
})

const splitList = (value) => String(value || '')
  .split(',')
  .map(item => item.trim())
  .filter(Boolean)

const getStatusClass = (status) => {
  switch (status) {
    case 'active': return 'status-active'
    case 'rejected': return 'status-inactive'
    case 'inactive': return 'status-inactive'
    case 'on_leave': return 'status-pending'
    default: return 'status-pending'
  }
}

const getStatusLabel = (status) => {
  if (status === 'active') return 'Approved'
  if (status === 'pending') return 'Pending'
  if (status === 'rejected') return 'Rejected'
  if (status === 'on_leave') return 'On Leave'
  return status || 'Not set'
}

const formatDate = (dateString) => {
  if (!dateString) return 'Not recorded'
  return new Date(dateString).toLocaleDateString()
}

const formatDateInput = (dateString) => {
  if (!dateString) return ''
  if (typeof dateString === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateString)) {
    return dateString.slice(0, 10)
  }
  const date = new Date(dateString)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

const formatTimeInput = (timeString) => {
  if (!timeString) return ''
  return String(timeString).slice(0, 5)
}

const csvEscape = (value) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const showSuccessMessage = () => {}

const showErrorMessage = () => {}

export default function Teachers() {
  const [searchParams] = useSearchParams()
  const [teachers, setTeachers] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('all')
  const [sortMode, setSortMode] = useState('newest')

  const [editingTeacher, setEditingTeacher] = useState(blankTeacherForm())
  const [editLoading, setEditLoading] = useState(false)
  const [editErrors, setEditErrors] = useState({})

  const [newTeacher, setNewTeacher] = useState(initialNewTeacher)

  const [loading, setLoading] = useState(false)
  const [approvalLoadingId, setApprovalLoadingId] = useState(null)
  const [teacherDialog, setTeacherDialog] = useState({ open: false, teacher: null, mode: 'delete', loading: false })
  const [selectedTeacher, setSelectedTeacher] = useState(null)
  const [errors, setErrors] = useState({})
  const [showNewTeacherPassword, setShowNewTeacherPassword] = useState(false)
  const [showEditTeacherPassword, setShowEditTeacherPassword] = useState(false)

  const addTeacherModalRef = useRef(null)
  const editTeacherModalRef = useRef(null)
  const teacherDetailsModalRef = useRef(null)

  const queryAction = searchParams.get('action')
  const queryCreate = searchParams.get('create')

  const teacherStats = useMemo(() => {
    const total = teachers.length
    const active = teachers.filter(teacher => teacher.status === 'active').length
    const pending = teachers.filter(teacher => teacher.status === 'pending').length
    const withModules = teachers.filter(teacher => splitList(teacher.assigned_modules).length > 0).length
    return {
      total,
      active,
      pending,
      withModules,
      unassigned: total - withModules
    }
  }, [teachers])

  const filteredTeachers = useMemo(() => {
    const filtered = teachers.filter(teacher => {
      const department = teacher.department || 'SSOD'
      const query = searchQuery.toLowerCase()
      const searchable = [
        teacher.name,
        teacher.email,
        department,
        teacher.teaching_classes,
        teacher.head_teacher_classes,
        teacher.assigned_modules,
        teacher.module_name
      ].filter(Boolean).join(' ').toLowerCase()
      const matchesSearch = searchable.includes(query)
      const matchesStatus = !statusFilter || teacher.status === statusFilter
      const matchesDepartment = !departmentFilter || department === departmentFilter
      const matchesQuickFilter =
        quickFilter === 'all'
        || teacher.status === quickFilter
        || (quickFilter === 'unassigned' && !splitList(teacher.assigned_modules).length)
      return matchesSearch && matchesStatus && matchesDepartment && matchesQuickFilter
    })

    return filtered.sort((a, b) => {
      if (sortMode === 'name') {
        return String(a.name || '').localeCompare(String(b.name || ''))
      }
      if (sortMode === 'status') {
        return String(a.status || '').localeCompare(String(b.status || ''))
      }
      if (sortMode === 'modules') {
        return splitList(b.assigned_modules).length - splitList(a.assigned_modules).length
      }
      if (sortMode === 'classes') {
        return splitList(b.teaching_classes || b.head_teacher_classes).length - splitList(a.teaching_classes || a.head_teacher_classes).length
      }
      return new Date(b.created_at || b.date_joined || 0) - new Date(a.created_at || a.date_joined || 0)
    })
  }, [teachers, searchQuery, statusFilter, departmentFilter, quickFilter, sortMode])

  const departmentOptions = useMemo(() => {
    const departments = teachers.map(teacher => teacher.department).filter(Boolean)
    return [...new Set([...commonDepartments, ...departments])].sort((a, b) => a.localeCompare(b))
  }, [teachers])

  const departmentSuggestions = useMemo(() => {
    return [...new Set([...commonDepartments, ...departmentOptions])]
  }, [departmentOptions])

  const loadTeachers = async () => {
    try {
      const response = await api.get('/teachers')
      setTeachers(response.data.teachers || [])
    } catch (error) {
      console.error('Error loading teachers:', error)
    }
  }

  const exportTeachers = () => {
    const headers = ['Name', 'Email', 'Department', 'Status', 'Classes', 'Modules', 'Date Joined']
    const rows = filteredTeachers.map((teacher) => ({
      Name: teacher.name,
      Email: teacher.email,
      Department: teacher.department || 'SSOD',
      Status: getStatusLabel(teacher.status),
      Classes: teacher.teaching_classes || teacher.head_teacher_classes || '',
      Modules: teacher.assigned_modules || '',
      'Date Joined': formatDate(teacher.date_joined)
    }))
    const csv = [
      headers.map(csvEscape).join(','),
      ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `teachers-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const validateForm = () => {
    const nextErrors = {}

    if (!newTeacher.name.trim()) {
      nextErrors.name = 'Name is required'
    }

    if (!newTeacher.email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newTeacher.email)) {
      nextErrors.email = 'Please enter a valid email address'
    }

    if (!newTeacher.department.trim()) {
      nextErrors.department = 'Department is required'
    }

    if (!newTeacher.password.trim()) {
      nextErrors.password = 'Password is required'
    } else if (newTeacher.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters'
    }

    setErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleAddTeacher = async () => {
    if (!validateForm()) return

    setLoading(true)
    setErrors({})

    try {
      const payload = {
        ...newTeacher,
        name: newTeacher.name.trim(),
        email: newTeacher.email.trim(),
        department: newTeacher.department.trim()
      }
      const response = await api.post('/teachers/register', payload)

      if (response.data.teacher) {
        await loadTeachers()
        setNewTeacher(initialNewTeacher())
        const modal = document.getElementById('addTeacherModal')
        const bootstrapModal = Modal.getInstance(modal)
        bootstrapModal.hide()
        showSuccessMessage('Teacher added successfully!')
      }
    } catch (error) {
      console.error('Error adding teacher:', error)
      if (error.response?.data?.message) {
        setErrors({ email: error.response.data.message })
      } else {
        showErrorMessage('Failed to add teacher. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const openAddModal = () => {
    setErrors({})
    const modal = document.getElementById('addTeacherModal')
    Modal.getOrCreateInstance(modal).show()
  }

  const openEditModal = (teacher) => {
    setEditingTeacher({
      teacher_id: teacher.teacher_id,
      name: teacher.name,
      email: teacher.email,
      department: teacher.department || 'SSOD',
      password: '',
      status: teacher.status,
      date_joined: formatDateInput(teacher.date_joined),
      employee_id: teacher.employee_id || '',
      phone: teacher.phone || '',
      module_name: teacher.module_name || '',
      qualification: teacher.qualification || '',
      years_experience: teacher.years_experience ?? '',
      available_days: teacher.available_days || '',
      available_from: formatTimeInput(teacher.available_from),
      available_to: formatTimeInput(teacher.available_to),
      notes: teacher.notes || ''
    })
    setEditErrors({})
    const modal = new Modal(document.getElementById('editTeacherModal'))
    modal.show()
  }

  const validateEditForm = () => {
    const nextErrors = {}

    if (!editingTeacher.name.trim()) {
      nextErrors.name = 'Name is required'
    }

    if (!editingTeacher.email.trim()) {
      nextErrors.email = 'Email is required'
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editingTeacher.email)) {
      nextErrors.email = 'Please enter a valid email address'
    }

    if (!editingTeacher.department.trim()) {
      nextErrors.department = 'Department is required'
    }

    if (editingTeacher.password && editingTeacher.password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters'
    }

    if (editingTeacher.years_experience !== '' && Number(editingTeacher.years_experience) < 0) {
      nextErrors.years_experience = 'Experience cannot be negative'
    }

    setEditErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleUpdateTeacher = async () => {
    if (!validateEditForm()) return

    setEditLoading(true)
    setEditErrors({})

    try {
      const updateData = {
        name: editingTeacher.name,
        email: editingTeacher.email,
        department: editingTeacher.department.trim(),
        status: editingTeacher.status,
        date_joined: editingTeacher.date_joined || undefined,
        employee_id: editingTeacher.employee_id.trim(),
        phone: editingTeacher.phone.trim(),
        module_name: editingTeacher.module_name.trim(),
        qualification: editingTeacher.qualification.trim(),
        years_experience: editingTeacher.years_experience === '' ? '' : Number(editingTeacher.years_experience),
        available_days: editingTeacher.available_days.trim(),
        available_from: editingTeacher.available_from || '',
        available_to: editingTeacher.available_to || '',
        notes: editingTeacher.notes.trim()
      }

      if (editingTeacher.password) {
        updateData.password = editingTeacher.password
      }

      const response = await api.put(`/teachers/${editingTeacher.teacher_id}`, updateData)

      if (response.data.teacher) {
        await loadTeachers()
        const modal = Modal.getInstance(document.getElementById('editTeacherModal'))
        modal.hide()
        setEditingTeacher(blankTeacherForm())
        showSuccessMessage('Teacher updated successfully!')
      }
    } catch (error) {
      console.error('Error updating teacher:', error)
      if (error.response?.data?.message) {
        setEditErrors({ email: error.response.data.message })
      } else {
        showErrorMessage('Failed to update teacher. Please try again.')
      }
    } finally {
      setEditLoading(false)
    }
  }

  const deleteTeacher = async (teacher) => {
    setTeacherDialog({ open: true, teacher, mode: 'delete', loading: false })
  }

  const openDetailsModal = (teacher) => {
    setSelectedTeacher(teacher)
    Modal.getOrCreateInstance(document.getElementById('teacherDetailsModal')).show()
  }

  const rejectTeacher = async (teacher) => {
    setTeacherDialog({ open: true, teacher, mode: 'reject', loading: false })
  }

  const confirmTeacherAction = async () => {
    const teacher = teacherDialog.teacher
    if (!teacher) return

    setTeacherDialog(prev => ({ ...prev, loading: true }))
    try {
      if (teacherDialog.mode === 'reject') {
        setApprovalLoadingId(teacher.teacher_id)
        await api.delete(`/teachers/${teacher.teacher_id}/reject`)
        showSuccessMessage('Teacher rejected successfully!')
      } else {
        await api.delete(`/teachers/${teacher.teacher_id}`)
        showSuccessMessage('Teacher deleted successfully!')
      }
      await loadTeachers()
      setTeacherDialog({ open: false, teacher: null, mode: 'delete', loading: false })
    } catch (error) {
      console.error('Error updating teacher action:', error)
      showErrorMessage(error.response?.data?.message || 'Failed to complete teacher action.')
    } finally {
      setTeacherDialog(prev => ({ ...prev, loading: false }))
      setApprovalLoadingId(null)
    }
  }

  const approveTeacher = async (teacher) => {
    setApprovalLoadingId(teacher.teacher_id)

    try {
      await api.put(`/teachers/${teacher.teacher_id}/approve`)
      await loadTeachers()
      showSuccessMessage('Teacher approved successfully!')
    } catch (error) {
      console.error('Error approving teacher:', error)
      showErrorMessage(error.response?.data?.message || 'Failed to approve teacher.')
    } finally {
      setApprovalLoadingId(null)
    }
  }

  const openCreateFromQuery = () => {
    if (queryAction === 'add') {
      openAddModal()
    }
  }

  useEffect(() => {
    let cancelled = false
    loadTeachers().then(() => {
      if (!cancelled) openCreateFromQuery()
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    openCreateFromQuery()
  }, [queryAction, queryCreate])

  return (
    <AppLayout>
      <div className="teachers-container">
        <div className="teacher-card-custom">
          <div className="d-flex justify-content-between align-items-center mb-4">
            <div>
              <h2 className="h3 fw-semibold text-dark mb-1">All Teachers</h2>
              <p className="teacher-page-subtitle">Review staff, approvals, classes, and assigned modules.</p>
            </div>
            <div className="teacher-toolbar">
              <button className="teacher-btn-secondary" type="button" disabled={!filteredTeachers.length} onClick={exportTeachers}>
                Export CSV
              </button>
              <button className="teacher-btn-primary" data-bs-toggle="modal" data-bs-target="#addTeacherModal">
                Add New Teacher
              </button>
            </div>
          </div>

          <section className="teacher-summary-grid">
            <article>
              <span>Total</span>
              <strong>{teacherStats.total}</strong>
              <small>teachers</small>
            </article>
            <article>
              <span>Active</span>
              <strong>{teacherStats.active}</strong>
              <small>approved</small>
            </article>
            <article>
              <span>Pending</span>
              <strong>{teacherStats.pending}</strong>
              <small>need review</small>
            </article>
            <article>
              <span>Assigned</span>
              <strong>{teacherStats.withModules}</strong>
              <small>with modules</small>
            </article>
            <article>
              <span>No Load</span>
              <strong>{teacherStats.unassigned}</strong>
              <small>no modules</small>
            </article>
          </section>

          <div className="quick-filter-row">
            {quickFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                className={quickFilter === filter.value ? 'active' : undefined}
                onClick={() => setQuickFilter(filter.value)}
              >
                {filter.label}
              </button>
            ))}
          </div>

          <div className="row g-3 mb-4">
            <div className="col-md-3">
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                type="text"
                placeholder="Search name, email, class, module..."
                className="teacher-form-control"
              />
            </div>
            <div className="col-md-3">
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="teacher-form-select">
                <option value="">All Departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="teacher-form-select">
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
                <option value="pending">Pending</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            <div className="col-md-3">
              <select value={sortMode} onChange={(event) => setSortMode(event.target.value)} className="teacher-form-select">
                <option value="newest">Newest first</option>
                <option value="name">Name A-Z</option>
                <option value="status">Status</option>
                <option value="modules">Most modules</option>
                <option value="classes">Most classes</option>
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="teacher-table-custom">
              <thead>
                <tr>
                  <th>Teacher</th>
                  <th>Department</th>
                  <th>Classes</th>
                  <th>Modules</th>
                  <th>Status</th>
                  <th>Load</th>
                  <th>Date Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredTeachers.map((teacher) => (
                  <tr key={teacher.teacher_id}>
                    <td>
                      <div className="teacher-cell">
                        <strong>{teacher.name}</strong>
                        <small>{teacher.email}</small>
                      </div>
                    </td>
                    <td>
                      <span className="teacher-badge">{teacher.department || 'SSOD'}</span>
                    </td>
                    <td>
                      <span className="muted-list">{teacher.teaching_classes || teacher.head_teacher_classes || 'Not assigned'}</span>
                    </td>
                    <td>
                      <span className="muted-list">{teacher.assigned_modules || teacher.module_name || 'Not assigned'}</span>
                    </td>
                    <td>
                      <span className={`${getStatusClass(teacher.status)} status-badge`}>
                        {getStatusLabel(teacher.status)}
                      </span>
                    </td>
                    <td>
                      <div className="load-cell">
                        <span>
                          <strong>{splitList(teacher.teaching_classes || teacher.head_teacher_classes).length}</strong>
                          classes
                        </span>
                        <span>
                          <strong>{splitList(teacher.assigned_modules).length}</strong>
                          modules
                        </span>
                      </div>
                    </td>
                    <td>{formatDate(teacher.date_joined)}</td>
                    <td>
                      {teacher.status === 'pending' ? (
                        <div className="action-buttons">
                          <button className="teacher-btn-details me-2" onClick={() => openDetailsModal(teacher)}>View</button>
                          <button className="teacher-btn-edit me-2" onClick={() => openEditModal(teacher)}>Edit</button>
                          <button
                            className="teacher-btn-approve me-2"
                            onClick={() => approveTeacher(teacher)}
                            disabled={approvalLoadingId === teacher.teacher_id}
                          >
                            {approvalLoadingId === teacher.teacher_id ? 'Saving...' : 'Approve'}
                          </button>
                          <button
                            className="teacher-btn-delete"
                            onClick={() => rejectTeacher(teacher)}
                            disabled={approvalLoadingId === teacher.teacher_id}
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="action-buttons">
                          <button className="teacher-btn-details me-2" onClick={() => openDetailsModal(teacher)}>View</button>
                          <button className="teacher-btn-edit me-2" onClick={() => openEditModal(teacher)}>Edit</button>
                          <button className="teacher-btn-delete" onClick={() => deleteTeacher(teacher)}>Del</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {!filteredTeachers.length && (
                  <tr>
                    <td colSpan="8" className="teacher-text-center teacher-py-4">No teachers found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="modal fade" id="addTeacherModal" ref={addTeacherModalRef} tabIndex="-1" aria-labelledby="addTeacherModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="teacher-modal-header">
                <h5 className="modal-title" id="addTeacherModalLabel">Add New Teacher</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="teacher-modal-body">
                <form onSubmit={(event) => { event.preventDefault(); handleAddTeacher() }}>
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="teacherName" className="teacher-form-label">Full Name *</label>
                      <input
                        type="text"
                        className="teacher-form-control"
                        id="teacherName"
                        value={newTeacher.name}
                        onChange={(event) => setNewTeacher(prev => ({ ...prev, name: event.target.value }))}
                        required
                        placeholder="Enter teacher's full name"
                      />
                      {errors.name && (
                        <div className="teacher-invalid-feedback">
                          {errors.name}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="teacherEmail" className="teacher-form-label">Email Address *</label>
                      <input
                        type="email"
                        className="teacher-form-control"
                        id="teacherEmail"
                        value={newTeacher.email}
                        onChange={(event) => setNewTeacher(prev => ({ ...prev, email: event.target.value }))}
                        required
                        placeholder="teacher@school.com"
                      />
                      {errors.email && (
                        <div className="teacher-invalid-feedback">
                          {errors.email}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="teacherPassword" className="teacher-form-label">Password *</label>
                      <div className="teacher-password-wrap">
                        <input
                          type={showNewTeacherPassword ? 'text' : 'password'}
                          className="teacher-form-control"
                          id="teacherPassword"
                          value={newTeacher.password}
                          onChange={(event) => setNewTeacher(prev => ({ ...prev, password: event.target.value }))}
                          required
                          autoComplete="new-password"
                          placeholder="Minimum 6 characters"
                        />
                        <button type="button" aria-label={showNewTeacherPassword ? 'Hide password' : 'Show password'} onClick={() => setShowNewTeacherPassword(!showNewTeacherPassword)}>
                          {showNewTeacherPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                        </button>
                      </div>
                      {errors.password && (
                        <div className="teacher-invalid-feedback">
                          {errors.password}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="teacherDepartment" className="teacher-form-label">Department *</label>
                      <input
                        type="text"
                        className={`teacher-form-control${errors.department ? ' teacher-is-invalid' : ''}`}
                        id="teacherDepartment"
                        value={newTeacher.department}
                        onChange={(event) => setNewTeacher(prev => ({ ...prev, department: event.target.value }))}
                        required
                        list="teacherDepartmentSuggestions"
                        placeholder="Enter department"
                      />
                      <datalist id="teacherDepartmentSuggestions">
                        {departmentSuggestions.map((department) => (
                          <option key={department} value={department} />
                        ))}
                      </datalist>
                      {errors.department && (
                        <div className="teacher-invalid-feedback">
                          {errors.department}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="teacherStatus" className="teacher-form-label">Status</label>
                      <select className="teacher-form-select" id="teacherStatus" value={newTeacher.status} onChange={(event) => setNewTeacher(prev => ({ ...prev, status: event.target.value }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on_leave">On Leave</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="col-12">
                      <label htmlFor="teacherDateJoined" className="teacher-form-label">Date Joined</label>
                      <input
                        type="date"
                        className="teacher-form-control"
                        id="teacherDateJoined"
                        value={newTeacher.date_joined}
                        onChange={(event) => setNewTeacher(prev => ({ ...prev, date_joined: event.target.value }))}
                      />
                    </div>
                  </div>
                </form>
              </div>
              <div className="teacher-modal-footer">
                <button type="button" className="teacher-btn-secondary" data-bs-dismiss="modal">Cancel</button>
                <button type="button" className="teacher-btn-primary" onClick={handleAddTeacher} disabled={loading}>
                  {loading ? <span>Adding...</span> : <span>Add Teacher</span>}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="modal fade" id="editTeacherModal" ref={editTeacherModalRef} tabIndex="-1" aria-labelledby="editTeacherModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="teacher-modal-header">
                <h5 className="modal-title" id="editTeacherModalLabel">Edit Teacher</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="teacher-modal-body">
                <form onSubmit={(event) => { event.preventDefault(); handleUpdateTeacher() }} id="editTeacherForm">
                  <div className="row g-3">
                    <div className="col-md-6">
                      <label htmlFor="editTeacherName" className="teacher-form-label">Full Name *</label>
                      <input
                        type="text"
                        className="teacher-form-control"
                        id="editTeacherName"
                        value={editingTeacher.name}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, name: event.target.value }))}
                        required
                        placeholder="Enter teacher's full name"
                      />
                      {editErrors.name && (
                        <div className="teacher-invalid-feedback">
                          {editErrors.name}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherEmail" className="teacher-form-label">Email Address *</label>
                      <input
                        type="email"
                        className="teacher-form-control"
                        id="editTeacherEmail"
                        value={editingTeacher.email}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, email: event.target.value }))}
                        required
                        placeholder="teacher@school.com"
                      />
                      {editErrors.email && (
                        <div className="teacher-invalid-feedback">
                          {editErrors.email}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherPassword" className="teacher-form-label">Reset Password (leave blank to keep current)</label>
                      <div className="teacher-password-wrap">
                        <input
                          type={showEditTeacherPassword ? 'text' : 'password'}
                          className="teacher-form-control"
                          id="editTeacherPassword"
                          value={editingTeacher.password}
                          onChange={(event) => setEditingTeacher(prev => ({ ...prev, password: event.target.value }))}
                          autoComplete="new-password"
                          placeholder="Enter new password or leave blank"
                        />
                        <button type="button" aria-label={showEditTeacherPassword ? 'Hide password' : 'Show password'} onClick={() => setShowEditTeacherPassword(!showEditTeacherPassword)}>
                          {showEditTeacherPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                        </button>
                      </div>
                      {editErrors.password && (
                        <div className="teacher-invalid-feedback">
                          {editErrors.password}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherDepartment" className="teacher-form-label">Department *</label>
                      <input
                        type="text"
                        className={`teacher-form-control${editErrors.department ? ' teacher-is-invalid' : ''}`}
                        id="editTeacherDepartment"
                        value={editingTeacher.department}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, department: event.target.value }))}
                        required
                        list="teacherDepartmentSuggestions"
                        placeholder="Enter department"
                      />
                      {editErrors.department && (
                        <div className="teacher-invalid-feedback">
                          {editErrors.department}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherStatus" className="teacher-form-label">Status</label>
                      <select className="teacher-form-select" id="editTeacherStatus" value={editingTeacher.status} onChange={(event) => setEditingTeacher(prev => ({ ...prev, status: event.target.value }))}>
                        <option value="active">Active</option>
                        <option value="inactive">Inactive</option>
                        <option value="on_leave">On Leave</option>
                        <option value="pending">Pending</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherDateJoined" className="teacher-form-label">Date Joined</label>
                      <input
                        type="date"
                        className="teacher-form-control"
                        id="editTeacherDateJoined"
                        value={editingTeacher.date_joined}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, date_joined: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherEmployeeId" className="teacher-form-label">Staff ID</label>
                      <input
                        type="text"
                        className="teacher-form-control"
                        id="editTeacherEmployeeId"
                        value={editingTeacher.employee_id}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, employee_id: event.target.value }))}
                        placeholder="Staff or national ID"
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherPhone" className="teacher-form-label">Phone</label>
                      <input
                        type="tel"
                        className="teacher-form-control"
                        id="editTeacherPhone"
                        value={editingTeacher.phone}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, phone: event.target.value }))}
                        placeholder="Phone number"
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherModule" className="teacher-form-label">Main Module</label>
                      <input
                        type="text"
                        className="teacher-form-control"
                        id="editTeacherModule"
                        value={editingTeacher.module_name}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, module_name: event.target.value }))}
                        placeholder="Main module or subject"
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherQualification" className="teacher-form-label">Qualification</label>
                      <input
                        type="text"
                        className="teacher-form-control"
                        id="editTeacherQualification"
                        value={editingTeacher.qualification}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, qualification: event.target.value }))}
                        placeholder="Highest qualification"
                      />
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherExperience" className="teacher-form-label">Years Experience</label>
                      <input
                        type="number"
                        min="0"
                        className="teacher-form-control"
                        id="editTeacherExperience"
                        value={editingTeacher.years_experience}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, years_experience: event.target.value }))}
                        placeholder="0"
                      />
                      {editErrors.years_experience && (
                        <div className="teacher-invalid-feedback">
                          {editErrors.years_experience}
                        </div>
                      )}
                    </div>
                    <div className="col-md-6">
                      <label htmlFor="editTeacherAvailableDays" className="teacher-form-label">Available Days</label>
                      <input
                        type="text"
                        className="teacher-form-control"
                        id="editTeacherAvailableDays"
                        value={editingTeacher.available_days}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, available_days: event.target.value }))}
                        placeholder="Monday, Tuesday..."
                      />
                    </div>
                    <div className="col-md-3">
                      <label htmlFor="editTeacherAvailableFrom" className="teacher-form-label">Available From</label>
                      <input
                        type="time"
                        className="teacher-form-control"
                        id="editTeacherAvailableFrom"
                        value={editingTeacher.available_from}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, available_from: event.target.value }))}
                      />
                    </div>
                    <div className="col-md-3">
                      <label htmlFor="editTeacherAvailableTo" className="teacher-form-label">Available To</label>
                      <input
                        type="time"
                        className="teacher-form-control"
                        id="editTeacherAvailableTo"
                        value={editingTeacher.available_to}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, available_to: event.target.value }))}
                      />
                    </div>
                    <div className="col-12">
                      <label htmlFor="editTeacherNotes" className="teacher-form-label">Notes</label>
                      <textarea
                        className="teacher-form-control"
                        id="editTeacherNotes"
                        rows="3"
                        value={editingTeacher.notes}
                        onChange={(event) => setEditingTeacher(prev => ({ ...prev, notes: event.target.value }))}
                        placeholder="Internal notes"
                      ></textarea>
                    </div>
                  </div>
                  <div className="teacher-modal-footer">
                    <button type="button" className="teacher-btn-secondary" data-bs-dismiss="modal">Cancel</button>
                    <button type="submit" className="teacher-btn-primary" disabled={editLoading} onClick={handleUpdateTeacher}>
                      {editLoading ? <span>Updating...</span> : <span>Update Teacher</span>}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>

        <div className="modal fade" id="teacherDetailsModal" ref={teacherDetailsModalRef} tabIndex="-1" aria-labelledby="teacherDetailsModalLabel" aria-hidden="true">
          <div className="modal-dialog modal-lg">
            <div className="modal-content">
              <div className="teacher-modal-header">
                <h5 className="modal-title" id="teacherDetailsModalLabel">Teacher Details</h5>
                <button type="button" className="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
              </div>
              <div className="teacher-modal-body">
                {selectedTeacher && (
                  <div className="details-grid">
                    <div><span>Name</span><strong>{selectedTeacher.name}</strong></div>
                    <div><span>Email</span><strong>{selectedTeacher.email}</strong></div>
                    <div><span>Phone</span><strong>{selectedTeacher.phone || 'Not set'}</strong></div>
                    <div><span>Department</span><strong>{selectedTeacher.department || 'SSOD'}</strong></div>
                    <div><span>Classes</span><strong>{selectedTeacher.teaching_classes || selectedTeacher.head_teacher_classes || 'Not assigned'}</strong></div>
                    <div><span>Modules</span><strong>{selectedTeacher.assigned_modules || selectedTeacher.module_name || 'Not assigned'}</strong></div>
                    <div><span>Qualification</span><strong>{selectedTeacher.qualification || 'Not set'}</strong></div>
                    <div><span>National/Staff ID</span><strong>{selectedTeacher.national_id || selectedTeacher.employee_id || 'Not set'}</strong></div>
                    <div><span>Experience</span><strong>{selectedTeacher.years_experience ?? 'Not set'}</strong></div>
                    <div><span>Available Days</span><strong>{selectedTeacher.available_days || 'Not set'}</strong></div>
                    <div><span>Available Time</span><strong>{selectedTeacher.available_from && selectedTeacher.available_to ? `${formatTimeInput(selectedTeacher.available_from)} - ${formatTimeInput(selectedTeacher.available_to)}` : 'Not set'}</strong></div>
                    <div><span>Status</span><strong>{getStatusLabel(selectedTeacher.status)}</strong></div>
                    <div><span>Date Joined</span><strong>{formatDate(selectedTeacher.date_joined)}</strong></div>
                    <div><span>Classes</span><strong>{selectedTeacher.teaching_classes || selectedTeacher.head_teacher_classes || 'No classes assigned'}</strong></div>
                    <div><span>Modules</span><strong>{selectedTeacher.assigned_modules || selectedTeacher.module_name || 'No modules assigned'}</strong></div>
                    <div className="details-wide"><span>Notes</span><strong>{selectedTeacher.notes || 'Not set'}</strong></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        <ConfirmModal
          open={teacherDialog.open}
          title={teacherDialog.mode === 'reject' ? 'Reject Registration' : 'Delete Teacher'}
          description={teacherDialog.mode === 'reject'
            ? `Reject ${teacherDialog.teacher?.name || 'this teacher'}'s registration request?`
            : `Delete ${teacherDialog.teacher?.name || 'this teacher'}? This action cannot be undone.`}
          confirmLabel={teacherDialog.mode === 'reject' ? 'Reject' : 'Delete'}
          cancelLabel="Cancel"
          loadingLabel={teacherDialog.mode === 'reject' ? 'Rejecting...' : 'Deleting...'}
          loading={teacherDialog.loading}
          danger
          onClose={() => setTeacherDialog(prev => ({ ...prev, open: false }))}
          onConfirm={confirmTeacherAction}
        />
      </div>
    </AppLayout>
  )
}
