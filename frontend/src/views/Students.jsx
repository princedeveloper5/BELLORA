import { Fragment, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import api from '@/stores/api'
import AppLayout from '@/components/AppLayout'
import ConfirmModal from '@/components/ui/ConfirmModal'
import './Students.css'

const normalizeDate = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
    return value.slice(0, 10)
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''

  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const formatDate = (value) => {
  if (!value) return '-'
  return new Date(value).toLocaleDateString()
}

const formatTime = (value) => String(value || '').slice(0, 5)

const formatTimeRange = (record) => {
  if (record.start_time && record.end_time) return `${formatTime(record.start_time)} - ${formatTime(record.end_time)}`
  return record.period_label || ''
}

const currentAcademicYear = () => {
  const now = new Date()
  const start = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1
  return `${start}/${start + 1}`
}

const emptyForm = () => ({
  student_number: '',
  name: '',
  sex: '',
  email: '',
  parent_name: '',
  parent_email: '',
  parent_phone: '',
  parent_password: '',
  class_id: '',
  academic_year: currentAcademicYear(),
  status: 'active'
})

const buildAttendanceCounts = (records) => {
  return records.reduce((counts, record) => {
    const status = record.status || 'present'
    counts[status] = (counts[status] || 0) + 1
    return counts
  }, {
    present: 0,
    absent: 0,
    late: 0,
    excused: 0
  })
}

const getWeekRange = (date = new Date()) => {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  const day = start.getDay() || 7
  start.setDate(start.getDate() - day + 1)
  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)
  return { start, end }
}

const getMonthRange = (date = new Date()) => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1)
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999)
  return { start, end }
}

const getTermRange = (date = new Date()) => {
  const month = date.getMonth()
  const termStartMonth = Math.floor(month / 3) * 3
  const start = new Date(date.getFullYear(), termStartMonth, 1)
  const end = new Date(date.getFullYear(), termStartMonth + 3, 0, 23, 59, 59, 999)
  return { start, end }
}

const buildModuleAttendanceRows = (records) => {
  const modules = new Map()
  records.forEach((record) => {
    const name = record.module_name || record.period_label || 'Study period'
    if (!modules.has(name)) {
      modules.set(name, {
        name,
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0
      })
    }

    const row = modules.get(name)
    const status = record.status || 'present'
    row.total += 1
    if (row[status] !== undefined) row[status] += 1
  })

  return Array.from(modules.values())
    .map((row) => {
      const attended = row.present + row.late + row.excused
      const percent = (count) => row.total ? Math.round((count / row.total) * 100) : 0

      return {
        ...row,
        attended,
        rate: row.total ? Math.round((attended / row.total) * 100) : 0,
        widths: {
          present: percent(row.present),
          late: percent(row.late),
          excused: percent(row.excused),
          absent: percent(row.absent)
        }
      }
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
}

const csvEscape = (value) => {
  const text = String(value ?? '')
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

const downloadCsv = (filename, headers, rows) => {
  const csv = [
    headers.map(csvEscape).join(','),
    ...rows.map(row => headers.map(header => csvEscape(row[header])).join(','))
  ].join('\n')

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function Students() {
  const [searchParams] = useSearchParams()
  const queryAction = searchParams.get('action')
  const queryCreate = searchParams.get('create')
  const queryView = searchParams.get('view')

  const [students, setStudents] = useState([])
  const [classes, setClasses] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editingStudentId, setEditingStudentId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState({ open: false, student: null, loading: false })
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState('success')
  const [showParentPassword, setShowParentPassword] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState(null)
  const [studentDetailTab, setStudentDetailTab] = useState('info')
  const [selectedAttendance, setSelectedAttendance] = useState([])
  const [loadingSelectedAttendance, setLoadingSelectedAttendance] = useState(false)
  const [reportPeriod, setReportPeriod] = useState('week')
  const [attendanceRecords, setAttendanceRecords] = useState([])
  const [loadingAttendanceRecords, setLoadingAttendanceRecords] = useState(false)
  const [attendanceFilters, setAttendanceFilters] = useState({
    date: new Date().toISOString().slice(0, 10)
  })
  const [attendanceReportPeriod, setAttendanceReportPeriod] = useState('week')
  const [showReportGraphic, setShowReportGraphic] = useState(false)
  const [form, setForm] = useState(emptyForm)

  const messageTimerRef = useRef(null)

  const pageMode = (() => {
    const view = String(queryView || '')
    if (view === 'attendance') return 'attendance'
    if (view === 'report') return 'reports'
    return 'students'
  })()

  const pageTitle = (() => {
    if (pageMode === 'attendance') return 'Attendance'
    if (pageMode === 'reports') return 'Reports'
    return 'Students'
  })()

  const pageDescription = (() => {
    if (pageMode === 'attendance') return 'Review recorded attendance by date and class.'
    if (pageMode === 'reports') return 'View attendance summaries and module-level report data.'
    return 'Add learners, assign them to classes, and keep parent login details on record.'
  })()

  const filteredStudents = students.filter((student) => {
    const query = searchQuery.trim().toLowerCase()
    const matchesClass = !classFilter || String(student.class_id) === classFilter
    const haystack = [
      student.name,
      student.student_number,
      student.sex,
      student.class_name,
      student.parent_name,
      student.parent_email
    ].filter(Boolean).join(' ').toLowerCase()
    return matchesClass && (!query || haystack.includes(query))
  })

  const selectedAttendanceCounts = buildAttendanceCounts(selectedAttendance)
  const attendanceRecordCounts = buildAttendanceCounts(attendanceRecords)

  const attendanceByDay = (() => {
    const groups = new Map()
    selectedAttendance.forEach((record) => {
      const date = normalizeDate(record.attendance_date)
      if (!groups.has(date)) groups.set(date, [])
      groups.get(date).push(record)
    })
    return Array.from(groups.entries()).map(([date, records]) => ({ date, records }))
  })()

  const reportDateRange = (() => {
    if (reportPeriod === 'month') return getMonthRange()
    if (reportPeriod === 'term') return getTermRange()
    return getWeekRange()
  })()

  const reportRangeLabel = (() => {
    const { start, end } = reportDateRange
    return `${formatDate(start)} - ${formatDate(end)}`
  })()

  const attendanceReportDateRange = (() => {
    const baseDate = attendanceFilters.date
      ? new Date(attendanceFilters.date)
      : new Date()

    if (attendanceReportPeriod === 'month') return getMonthRange(baseDate)
    if (attendanceReportPeriod === 'term') return getTermRange(baseDate)
    return getWeekRange(baseDate)
  })()

  const attendanceReportRangeLabel = (() => {
    const { start, end } = attendanceReportDateRange
    return `${formatDate(start)} - ${formatDate(end)}`
  })()

  const reportRecords = (() => {
    const { start, end } = reportDateRange
    return selectedAttendance.filter((record) => {
      const date = new Date(record.attendance_date)
      return date >= start && date <= end
    })
  })()

  const selectedReportSummary = (() => {
    const counts = buildAttendanceCounts(reportRecords)
    const total = reportRecords.length
    const attended = counts.present + counts.late + counts.excused
    return {
      ...counts,
      total,
      presentRate: total ? Math.round((attended / total) * 100) : 0
    }
  })()

  const reportPieStyle = (() => {
    const total = selectedReportSummary.total || 1
    const present = Math.round((selectedReportSummary.present / total) * 100)
    const absent = Math.round((selectedReportSummary.absent / total) * 100)
    const late = Math.round((selectedReportSummary.late / total) * 100)
    return {
      '--present': `${present}%`,
      '--absent': `${present + absent}%`,
      '--late': `${present + absent + late}%`
    }
  })()

  const moduleReportRows = buildModuleAttendanceRows(reportRecords)

  const attendanceReportSummary = (() => {
    const counts = buildAttendanceCounts(attendanceRecords)
    const total = attendanceRecords.length
    const attended = counts.present + counts.late + counts.excused
    return {
      ...counts,
      total,
      presentRate: total ? Math.round((attended / total) * 100) : 0
    }
  })()

  const attendanceReportPieStyle = (() => {
    const total = attendanceReportSummary.total || 1
    const present = Math.round((attendanceReportSummary.present / total) * 100)
    const absent = Math.round((attendanceReportSummary.absent / total) * 100)
    const late = Math.round((attendanceReportSummary.late / total) * 100)

    return {
      '--present': `${present}%`,
      '--absent': `${present + absent}%`,
      '--late': `${present + absent + late}%`
    }
  })()

  const attendanceReportRows = buildModuleAttendanceRows(attendanceRecords)

  const downloadStudentList = () => {
    const headers = [
      'Student ID',
      'Name',
      'Sex',
      'Class',
      'Section',
      'Academic Year',
      'Student Email',
      'Parent Name',
      'Parent Email',
      'Parent Phone',
      'Status'
    ]
    const rows = filteredStudents.map(student => ({
      'Student ID': student.student_number,
      Name: student.name,
      Sex: student.sex || '',
      Class: student.class_name || '',
      Section: student.section_name || '',
      'Academic Year': student.academic_year || '',
      'Student Email': student.email || '',
      'Parent Name': student.parent_name || '',
      'Parent Email': student.parent_email || '',
      'Parent Phone': student.parent_phone || '',
      Status: student.status || ''
    }))
    const className = classFilter
      ? classes.find(cls => String(cls.class_id) === classFilter)?.class_name || 'class'
      : 'all-students'
    downloadCsv(`student-list-${className}.csv`, headers, rows)
  }

  const showMessage = (text, type = 'success') => {
    setMessage(text)
    setMessageType(type)
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current)
    messageTimerRef.current = window.setTimeout(() => {
      setMessage((current) => (current === text ? '' : current))
    }, 3500)
  }

  const loadStudents = async () => {
    setLoading(true)
    try {
      const response = await api.get('/students')
      setStudents(response.data || [])
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not load students', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadClasses = async () => {
    const response = await api.get('/classes')
    setClasses(response.data.classes || [])
  }

  const loadAttendanceRecords = async () => {
    if (!attendanceFilters.date) {
      showMessage('Select attendance date first', 'error')
      return
    }

    setLoadingAttendanceRecords(true)
    try {
      const params = {
        class_id: classFilter || undefined
      }

      if (pageMode === 'reports') {
        const { start, end } = attendanceReportDateRange
        params.from_date = normalizeDate(start)
        params.to_date = normalizeDate(end)
      } else {
        params.attendance_date = attendanceFilters.date
      }

      const response = await api.get('/students/attendance/records', {
        params
      })
      setAttendanceRecords(response.data.attendance || [])
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not load attendance records', 'error')
    } finally {
      setLoadingAttendanceRecords(false)
    }
  }

  const openCreate = () => {
    setEditingStudentId(null)
    setForm(emptyForm())
    setShowModal(true)
  }

  const openEdit = (student) => {
    setEditingStudentId(student.student_id)
    setForm({
      student_number: student.student_number,
      name: student.name,
      sex: student.sex || '',
      email: student.email || '',
      parent_name: student.parent_name || '',
      parent_email: student.parent_email || '',
      parent_phone: student.parent_phone || '',
      parent_password: '',
      class_id: student.class_id || '',
      academic_year: student.academic_year || currentAcademicYear(),
      status: student.status || 'active'
    })
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
  }

  const normalizedPayload = () => ({
    ...form,
    class_id: form.class_id || null,
    section_id: classes.find(cls => String(cls.class_id) === String(form.class_id))?.section_id || null,
    email: form.email || null
  })

  const saveStudent = async () => {
    setSaving(true)
    try {
      if (editingStudentId) {
        const payload = normalizedPayload()
        delete payload.parent_password
        delete payload.student_number
        await api.put(`/students/${editingStudentId}`, payload)
        showMessage('Student updated')
      } else {
        await api.post('/students', normalizedPayload())
        showMessage('Student added')
      }
      closeModal()
      await loadStudents()
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not save student', 'error')
    } finally {
      setSaving(false)
    }
  }

  const deleteStudent = async (student) => {
    setDeleteDialog({ open: true, student, loading: false })
  }

  const confirmDeleteStudent = async () => {
    const student = deleteDialog.student
    if (!student) return

    setDeleteDialog(prev => ({ ...prev, loading: true }))
    try {
      await api.delete(`/students/${student.student_id}`)
      showMessage('Student deleted')
      setDeleteDialog({ open: false, student: null, loading: false })
      await loadStudents()
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not delete student', 'error')
    } finally {
      setDeleteDialog(prev => ({ ...prev, loading: false }))
    }
  }

  const loadSelectedAttendance = async () => {
    if (!selectedStudent) return
    setLoadingSelectedAttendance(true)
    try {
      const response = await api.get(`/students/${selectedStudent.student_id}/attendance-history`, {
        params: {}
      })
      setSelectedAttendance(response.data.attendance || [])
    } catch (error) {
      showMessage(error.response?.data?.message || 'Could not load student attendance', 'error')
    } finally {
      setLoadingSelectedAttendance(false)
    }
  }

  const openStudentDetail = async (student, tab = 'info') => {
    setSelectedStudent(student)
    setStudentDetailTab(tab)
    if (!selectedAttendance.length || String(selectedAttendance[0]?.student_id) !== String(student.student_id)) {
      setSelectedAttendance([])
      await loadSelectedAttendance()
    }
  }

  const clearSelectedStudent = () => {
    setSelectedStudent(null)
    setSelectedAttendance([])
    setStudentDetailTab('info')
  }

  const selectStudentTab = async (tab) => {
    setStudentDetailTab(tab)
    if ((tab === 'attendance' || tab === 'report') && selectedStudent && !selectedAttendance.length) {
      await loadSelectedAttendance()
    }
  }

  const openViewFromQuery = async () => {
    const view = String(queryView || '')
    if (view === 'attendance' || view === 'report') {
      clearSelectedStudent()
      await loadAttendanceRecords()
      return
    }

    if (view !== 'info') return
    if (selectedStudent && studentDetailTab === view) return

    const firstStudent = filteredStudents[0] || students[0]
    if (!firstStudent) return

    await openStudentDetail(firstStudent, view)
  }

  const handleRouteQuery = async () => {
    if (queryAction === 'add') openCreate()
    await openViewFromQuery()
  }

  useEffect(() => {
    let cancelled = false
    const bootstrap = async () => {
      await Promise.all([loadClasses(), loadStudents()])
      if (cancelled) return
      await handleRouteQuery()
    }
    bootstrap()
    return () => {
      cancelled = true
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current)
    }
  }, [])

  useEffect(() => {
    handleRouteQuery()
  }, [queryAction, queryCreate, queryView, filteredStudents.length])

  return (
    <AppLayout>
      <div className="students-page">
        <header className="page-header students-page-header">
          <div>
            <h1>{pageTitle}</h1>
            <p>{pageDescription}</p>
          </div>
          {pageMode === 'students' && (
            <div className="students-header-actions">
              <button className="students-secondary-btn" type="button" disabled={!filteredStudents.length} onClick={downloadStudentList}>
                Download List
              </button>
              <button className="students-primary-btn" type="button" onClick={openCreate}>Add Student</button>
            </div>
          )}
        </header>

        {message && <div className={`students-notice ${messageType}`}>{message}</div>}

        <section className="students-toolbar">
          <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} type="search" placeholder="Search by name, ID, parent, or class" />
          <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
            <option value="">All classes</option>
            {classes.map((cls) => (
              <option key={cls.class_id} value={String(cls.class_id)}>
                {cls.class_name}
              </option>
            ))}
          </select>
          <button type="button" className="students-secondary-btn" onClick={loadStudents}>Refresh</button>
        </section>

        {pageMode !== 'students' && (
          <section className="students-mode-panel">
            <div className="students-mode-filters">
              <label>
                <span>{pageMode === 'reports' ? 'Date in period' : 'Date'}</span>
                <input value={attendanceFilters.date} onChange={(event) => setAttendanceFilters({ date: event.target.value })} type="date" />
              </label>
              {pageMode === 'reports' && (
                <label>
                  <span>Period</span>
                  <select value={attendanceReportPeriod} onChange={(event) => setAttendanceReportPeriod(event.target.value)}>
                    <option value="week">This week</option>
                    <option value="month">This month</option>
                    <option value="term">This term</option>
                  </select>
                </label>
              )}
              <label>
                <span>Class</span>
                <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                  <option value="">All classes</option>
                  {classes.map((cls) => (
                    <option key={cls.class_id} value={String(cls.class_id)}>
                      {cls.class_name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="students-attendance-summary-row">
              <span><strong>{attendanceRecords.length}</strong> records</span>
              <span><strong>{attendanceRecordCounts.present}</strong> present</span>
              <span><strong>{attendanceRecordCounts.absent}</strong> absent</span>
              <span><strong>{attendanceRecordCounts.late}</strong> late</span>
              <span><strong>{attendanceRecordCounts.excused}</strong> excused</span>
            </div>

            {pageMode === 'attendance' ? (
              <div className="students-attendance-record-table">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Class</th>
                      <th>Period / Module</th>
                      <th>Status</th>
                      <th>Teacher</th>
                      <th>Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((record) => (
                      <tr key={record.attendance_id}>
                        <td>
                          <strong>{record.student_name || '-'}</strong>
                          <small>{record.student_number || ''}</small>
                        </td>
                        <td>{record.class_name || '-'}</td>
                        <td>
                          <strong>{record.module_name || record.period_label || 'Study period'}</strong>
                          <small>{formatTimeRange(record)}</small>
                        </td>
                        <td><span className={`students-attendance-status ${record.status}`}>{record.status}</span></td>
                        <td>{record.teacher_name || '-'}</td>
                        <td>{record.notes || '-'}</td>
                      </tr>
                    ))}
                    {!attendanceRecords.length && (
                      <tr>
                        <td colSpan="6" className="students-empty-row">
                          {loadingAttendanceRecords ? 'Loading attendance...' : 'No attendance recorded for this date.'}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="students-report-section">
                <div className="students-report-range-card">
                  <div>
                    <span>Showing module attendance</span>
                    <strong>{attendanceReportRangeLabel}</strong>
                  </div>
                  <button
                    type="button"
                    className="students-secondary-btn"
                    disabled={!attendanceRecords.length}
                    onClick={() => setShowReportGraphic(!showReportGraphic)}
                  >
                    {showReportGraphic ? 'Hide Graphic' : 'View Graphic Statistics'}
                  </button>
                </div>

                <div className="students-report-summary-grid">
                  <article>
                    <span>Present Rate</span>
                    <strong>{attendanceReportSummary.presentRate}%</strong>
                  </article>
                  <article>
                    <span>Students Present</span>
                    <strong>{attendanceReportSummary.present}</strong>
                  </article>
                  <article>
                    <span>Students Absent</span>
                    <strong>{attendanceReportSummary.absent}</strong>
                  </article>
                  <article>
                    <span>Late / Excused</span>
                    <strong>{attendanceReportSummary.late + attendanceReportSummary.excused}</strong>
                  </article>
                </div>

                {showReportGraphic && (
                  <div className="students-chart-row students-report-graphic">
                    <div className="students-pie-chart" style={attendanceReportPieStyle}>
                      <span>{attendanceReportSummary.presentRate}%</span>
                    </div>
                    <div className="students-chart-legend">
                      <span><i className="students-present-dot"></i> Present {attendanceReportSummary.present}</span>
                      <span><i className="students-absent-dot"></i> Absent {attendanceReportSummary.absent}</span>
                      <span><i className="students-late-dot"></i> Late {attendanceReportSummary.late}</span>
                      <span><i className="students-excused-dot"></i> Excused {attendanceReportSummary.excused}</span>
                    </div>
                  </div>
                )}

                <div className="students-module-chart">
                  {attendanceReportRows.map((module) => (
                    <div key={module.name} className="students-module-bar-row">
                      <div className="students-module-bar-label">
                        <strong>{module.name}</strong>
                        <span>{module.attended}/{module.total} attended</span>
                      </div>
                      <div className="students-module-bar-track stacked">
                        <span className="present-segment" style={{ width: `${module.widths.present}%` }}></span>
                        <span className="late-segment" style={{ width: `${module.widths.late}%` }}></span>
                        <span className="excused-segment" style={{ width: `${module.widths.excused}%` }}></span>
                        <span className="absent-segment" style={{ width: `${module.widths.absent}%` }}></span>
                      </div>
                      <strong>{module.rate}%</strong>
                      <small className="students-module-status-line">
                        Present {module.present} · Late {module.late} · Excused {module.excused} · Absent {module.absent}
                      </small>
                    </div>
                  ))}
                  {!attendanceReportRows.length && (
                    <p className="students-empty-row">
                      {loadingAttendanceRecords ? 'Loading report...' : 'No report data for this period.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {pageMode === 'students' && selectedStudent && (
          <section className="students-student-detail-panel">
            <div className="students-detail-header-row">
              <div>
                <h2>{selectedStudent.name}</h2>
                <p>{selectedStudent.student_number} - {selectedStudent.class_name || 'Unassigned'}</p>
              </div>
              <button type="button" className="students-secondary-btn" onClick={clearSelectedStudent}>
                Close
              </button>
            </div>

            <div className="students-detail-tabs" role="tablist" aria-label="Student detail sections">
              <button type="button" className={studentDetailTab === 'info' ? 'active' : undefined} onClick={() => selectStudentTab('info')}>
                Information
              </button>
              <button type="button" className={studentDetailTab === 'attendance' ? 'active' : undefined} onClick={() => selectStudentTab('attendance')}>
                Attendance
              </button>
              <button type="button" className={studentDetailTab === 'report' ? 'active' : undefined} onClick={() => selectStudentTab('report')}>
                Report
              </button>
            </div>

            {studentDetailTab === 'info' && (
              <div className="students-student-info-grid">
                <article>
                  <span>Student ID</span>
                  <strong>{selectedStudent.student_number || '-'}</strong>
                </article>
                <article>
                  <span>Name</span>
                  <strong>{selectedStudent.name || '-'}</strong>
                </article>
                <article>
                  <span>Sex</span>
                  <strong>{selectedStudent.sex || '-'}</strong>
                </article>
                <article>
                  <span>Class</span>
                  <strong>{selectedStudent.class_name || 'Unassigned'}</strong>
                </article>
                <article>
                  <span>Section</span>
                  <strong>{selectedStudent.section_name || '-'}</strong>
                </article>
                <article>
                  <span>Academic Year</span>
                  <strong>{selectedStudent.academic_year || '-'}</strong>
                </article>
                <article>
                  <span>Student Email</span>
                  <strong>{selectedStudent.email || '-'}</strong>
                </article>
                <article>
                  <span>Status</span>
                  <strong className="students-status-text">{selectedStudent.status || '-'}</strong>
                </article>
                <article>
                  <span>Parent Name</span>
                  <strong>{selectedStudent.parent_name || '-'}</strong>
                </article>
                <article>
                  <span>Parent Email</span>
                  <strong>{selectedStudent.parent_email || '-'}</strong>
                </article>
                <article>
                  <span>Parent Phone</span>
                  <strong>{selectedStudent.parent_phone || '-'}</strong>
                </article>
              </div>
            )}

            {studentDetailTab === 'attendance' && (
              <div className="students-attendance-history-section">
                <div className="students-attendance-summary-row">
                  <span><strong>{selectedAttendance.length}</strong> records</span>
                  <span><strong>{selectedAttendanceCounts.present}</strong> present</span>
                  <span><strong>{selectedAttendanceCounts.absent}</strong> absent</span>
                  <span><strong>{selectedAttendanceCounts.late}</strong> late</span>
                  <span><strong>{selectedAttendanceCounts.excused}</strong> excused</span>
                </div>

                <div className="students-attendance-record-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Period / Module</th>
                        <th>Status</th>
                        <th>Teacher</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendanceByDay.map((group) => (
                        <Fragment key={group.date}>
                          <tr className="students-day-row">
                            <td colSpan="5">{formatDate(group.date)}</td>
                          </tr>
                          {group.records.map((record) => (
                            <tr key={record.attendance_id}>
                              <td>{formatDate(record.attendance_date)}</td>
                              <td>
                                <strong>{record.module_name || record.period_label || 'Study period'}</strong>
                                <small>{formatTimeRange(record)}</small>
                              </td>
                              <td><span className={`students-attendance-status ${record.status}`}>{record.status}</span></td>
                              <td>{record.teacher_name || '-'}</td>
                              <td>{record.notes || '-'}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                      {!selectedAttendance.length && (
                        <tr>
                          <td colSpan="5" className="students-empty-row">
                            {loadingSelectedAttendance ? 'Loading attendance...' : 'No attendance recorded for this student.'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {studentDetailTab === 'report' && (
              <div className="students-report-section">
                <div className="students-report-toolbar">
                  <label>
                    <span>Period</span>
                    <select value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value)}>
                      <option value="week">This week</option>
                      <option value="month">This month</option>
                      <option value="term">This term</option>
                    </select>
                  </label>
                  <div>
                    <span>Showing</span>
                    <strong>{reportRangeLabel}</strong>
                  </div>
                </div>

                <div className="students-report-summary-grid">
                  <article>
                    <span>Present Rate</span>
                    <strong>{selectedReportSummary.presentRate}%</strong>
                  </article>
                  <article>
                    <span>Present</span>
                    <strong>{selectedReportSummary.present}</strong>
                  </article>
                  <article>
                    <span>Absent</span>
                    <strong>{selectedReportSummary.absent}</strong>
                  </article>
                  <article>
                    <span>Late / Excused</span>
                    <strong>{selectedReportSummary.late + selectedReportSummary.excused}</strong>
                  </article>
                </div>

                <div className="students-chart-row">
                  <div className="students-pie-chart" style={reportPieStyle}>
                    <span>{selectedReportSummary.presentRate}%</span>
                  </div>
                  <div className="students-chart-legend">
                    <span><i className="students-present-dot"></i> Present</span>
                    <span><i className="students-absent-dot"></i> Absent</span>
                    <span><i className="students-late-dot"></i> Late</span>
                    <span><i className="students-excused-dot"></i> Excused</span>
                  </div>
                </div>

                <div className="students-module-chart">
                  {moduleReportRows.map((module) => (
                    <div key={module.name} className="students-module-bar-row">
                      <div className="students-module-bar-label">
                        <strong>{module.name}</strong>
                        <span>{module.attended}/{module.total} attended</span>
                      </div>
                      <div className="students-module-bar-track stacked">
                        <span className="present-segment" style={{ width: `${module.widths.present}%` }}></span>
                        <span className="late-segment" style={{ width: `${module.widths.late}%` }}></span>
                        <span className="excused-segment" style={{ width: `${module.widths.excused}%` }}></span>
                        <span className="absent-segment" style={{ width: `${module.widths.absent}%` }}></span>
                      </div>
                      <strong>{module.rate}%</strong>
                      <small className="students-module-status-line">
                        Present {module.present} · Late {module.late} · Excused {module.excused} · Absent {module.absent}
                      </small>
                    </div>
                  ))}
                  {!moduleReportRows.length && (
                    <p className="students-empty-row">
                      {loadingSelectedAttendance ? 'Loading report...' : 'No module attendance for this period.'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>
        )}

        {pageMode === 'students' && (
          <section className="students-table-panel">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Sex</th>
                  <th>Class</th>
                  <th>Parent</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudents.map((student) => (
                  <tr key={student.student_id} className={selectedStudent?.student_id === student.student_id ? 'selected' : undefined}>
                    <td>
                      <strong>{student.name}</strong>
                      <small>{student.student_number}</small>
                    </td>
                    <td>{student.sex || '-'}</td>
                    <td>{student.class_name || 'Unassigned'}</td>
                    <td>
                      <strong>{student.parent_name || '-'}</strong>
                      <small>{student.parent_email || student.parent_phone || ''}</small>
                    </td>
                    <td><span className="students-status-pill">{student.status}</span></td>
                    <td className="students-actions">
                      <button type="button" onClick={() => openStudentDetail(student, 'info')}>Information</button>
                      <button type="button" onClick={() => openEdit(student)}>Edit</button>
                      <button type="button" className="danger" onClick={() => deleteStudent(student)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!filteredStudents.length && (
                  <tr>
                    <td colSpan="6" className="students-empty-row">{loading ? 'Loading students...' : 'No students found'}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>
        )}

        {showModal && (
          <div className="students-modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) closeModal() }}>
            <form className="students-student-form" onSubmit={(event) => { event.preventDefault(); saveStudent() }}>
              <div className="students-form-header">
                <h2>{editingStudentId ? 'Edit Student' : 'Add Student'}</h2>
                <button type="button" className="students-secondary-btn" onClick={closeModal}>Cancel</button>
              </div>

              <div className="students-form-grid">
                <label>
                  <span>Student ID *</span>
                  <input value={form.student_number} onChange={(event) => setForm(prev => ({ ...prev, student_number: event.target.value }))} required />
                </label>
                <label>
                  <span>Name *</span>
                  <input value={form.name} onChange={(event) => setForm(prev => ({ ...prev, name: event.target.value }))} required />
                </label>
                <label>
                  <span>Sex</span>
                  <select value={form.sex} onChange={(event) => setForm(prev => ({ ...prev, sex: event.target.value }))}>
                    <option value="">Select sex</option>
                    <option>Female</option>
                    <option>Male</option>
                  </select>
                </label>
                <label>
                  <span>Class</span>
                  <select value={form.class_id} onChange={(event) => setForm(prev => ({ ...prev, class_id: event.target.value }))}>
                    <option value="">Unassigned</option>
                    {classes.map((cls) => (
                      <option key={cls.class_id} value={cls.class_id}>
                        {cls.class_name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Academic Year *</span>
                  <input value={form.academic_year} onChange={(event) => setForm(prev => ({ ...prev, academic_year: event.target.value }))} required placeholder="2025/2026" />
                </label>
                <label>
                  <span>Student Email</span>
                  <input value={form.email} onChange={(event) => setForm(prev => ({ ...prev, email: event.target.value }))} type="email" />
                </label>
                <label>
                  <span>Parent Name</span>
                  <input value={form.parent_name} onChange={(event) => setForm(prev => ({ ...prev, parent_name: event.target.value }))} />
                </label>
                <label>
                  <span>Parent Phone</span>
                  <input value={form.parent_phone} onChange={(event) => setForm(prev => ({ ...prev, parent_phone: event.target.value }))} />
                </label>
                <label>
                  <span>Parent Login Email *</span>
                  <input value={form.parent_email} onChange={(event) => setForm(prev => ({ ...prev, parent_email: event.target.value }))} type="email" required />
                </label>
                {!editingStudentId && (
                  <label>
                    <span>Parent Password *</span>
                    <div className="students-password-wrap">
                      <input value={form.parent_password} onChange={(event) => setForm(prev => ({ ...prev, parent_password: event.target.value }))} type={showParentPassword ? 'text' : 'password'} required minLength="6" />
                      <button type="button" aria-label={showParentPassword ? 'Hide password' : 'Show password'} onClick={() => setShowParentPassword(!showParentPassword)}>
                        {showParentPassword ? <EyeOff size={17} strokeWidth={2.2} aria-hidden="true" /> : <Eye size={17} strokeWidth={2.2} aria-hidden="true" />}
                      </button>
                    </div>
                  </label>
                )}
                {editingStudentId && (
                  <label>
                    <span>Status</span>
                    <select value={form.status} onChange={(event) => setForm(prev => ({ ...prev, status: event.target.value }))}>
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                      <option value="graduated">Graduated</option>
                    </select>
                  </label>
                )}
              </div>

              <div className="students-form-actions">
                <button className="students-primary-btn" type="submit" disabled={saving}>
                  {saving ? 'Saving...' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        )}

        <ConfirmModal
          open={deleteDialog.open}
          title="Delete Student"
          description={`Delete ${deleteDialog.student?.name || 'this student'}? This action cannot be undone.`}
          confirmLabel="Delete"
          cancelLabel="Cancel"
          loadingLabel="Deleting..."
          loading={deleteDialog.loading}
          danger
          onClose={() => setDeleteDialog(prev => ({ ...prev, open: false }))}
          onConfirm={confirmDeleteStudent}
        />
      </div>
    </AppLayout>
  )
}
