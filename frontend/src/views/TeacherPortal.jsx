import { useEffect, useState } from 'react'
import AppLayout from '@/components/AppLayout'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import { exportToPDF, exportToWord, printTimetable } from '@/utils/exportTimetable'
import './TeacherPortal.css'

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

const formatTimeRange = (start, end) => {
  if (!start && !end) return '-'
  const s = start ? start.slice(0, 5) : ''
  const e = end ? end.slice(0, 5) : ''
  return `${s} - ${e}`
}

const buildScheduleGrid = (schedule) => {
  const timeSlots = new Map()

  schedule.forEach((entry) => {
    const key = `${entry.start_time}-${entry.end_time}`
    if (!timeSlots.has(key)) {
      timeSlots.set(key, {
        key,
        start_time: entry.start_time,
        end_time: entry.end_time,
        entriesByDay: {}
      })
    }
    timeSlots.get(key).entriesByDay[entry.day_of_week] = entry
  })

  const sortedSlots = Array.from(timeSlots.values()).sort((a, b) =>
    a.start_time.localeCompare(b.start_time)
  )

  return sortedSlots.map((slot, index) => ({
    ...slot,
    period: index + 1
  }))
}

export default function TeacherPortal() {
  const authStore = useAuthStore()
  const [loading, setLoading] = useState(false)
  const [loadingSubs, setLoadingSubs] = useState(false)
  const [teacher, setTeacher] = useState(null)
  const [schedule, setSchedule] = useState([])
  const [substitutions, setSubstitutions] = useState([])
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedTerm, setSelectedTerm] = useState('')
  const [academicYears] = useState(['2024-2025', '2025-2026'])
  const [showExportDropdown, setShowExportDropdown] = useState(false)

  const loadTeacherInfo = async () => {
    try {
      const teacherId = authStore.currentUser?.teacher_id || authStore.currentUser?.id
      if (!teacherId) return

      const response = await api.get('/teachers/' + teacherId)
      setTeacher(response.data.teacher || response.data)
    } catch (error) {
      console.error('Error loading teacher info:', error)
    }
  }

  const loadSchedule = async () => {
    if (!teacher?.teacher_id) return

    setLoading(true)
    try {
      const response = await api.get(`/timetable/teacher/${teacher.teacher_id}`, {
        params: {
          academic_year: selectedAcademicYear,
          term: selectedTerm
        }
      })
      setSchedule(response.data.timetables || response.data.schedule || response.data)
    } catch (error) {
      console.error('Error loading schedule:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadSubstitutions = async () => {
    if (!teacher?.teacher_id) return

    setLoadingSubs(true)
    try {
      const response = await api.get('/substitution', {
        params: {
          substitute_teacher_id: teacher.teacher_id,
          substitution_date: new Date().toISOString().split('T')[0]
        }
      })
      setSubstitutions(response.data)
    } catch (error) {
      console.error('Error loading substitutions:', error)
    } finally {
      setLoadingSubs(false)
    }
  }

  const toggleExportDropdown = () => {
    setShowExportDropdown((current) => !current)
  }

  const exportOptions = {
    logoUrl: authStore.currentUser?.school_logo_url || authStore.currentUser?.schoolLogo || undefined
  }

  const handleExportPDF = () => {
    exportToPDF(schedule, teacher?.name || 'My_Schedule', exportOptions)
    setShowExportDropdown(false)
  }

  const handleExportWord = () => {
    exportToWord(schedule, teacher?.name || 'My_Schedule', exportOptions)
    setShowExportDropdown(false)
  }

  const handlePrint = () => {
    printTimetable(schedule, teacher?.name || 'My_Schedule', exportOptions)
    setShowExportDropdown(false)
  }

  useEffect(() => {
    loadTeacherInfo()
    loadSubstitutions()
  }, [])

  return (
    <AppLayout>
      <div className="teacher-portal">
        <header className="portal-header">
          <div>
            <h1>Teacher Portal</h1>
            <p>Welcome, {teacher?.name || 'Teacher'}</p>
          </div>
          <div className="portal-info">
            <span className="info-badge">{teacher?.department || 'No department'}</span>
            <span className={`info-badge ${teacher?.status === 'active' ? 'status-active' : 'status-inactive'}`}>
              {teacher?.status || 'Unknown'}
            </span>
          </div>
        </header>

        <section className="timetable-section">
          <div className="section-header">
            <h2>My Schedule</h2>
            <div className="timetable-controls">
              <select value={selectedAcademicYear} onChange={(event) => setSelectedAcademicYear(event.target.value)} className="form-select">
                <option value="">Select Academic Year</option>
                {academicYears.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <select value={selectedTerm} onChange={(event) => setSelectedTerm(event.target.value)} className="form-select">
                <option value="">Select Term</option>
                <option value="Term 1">Term 1</option>
                <option value="Term 2">Term 2</option>
                <option value="Term 3">Term 3</option>
              </select>
              <button className="btn-primary" onClick={loadSchedule} disabled={loading}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13a8 8 0 0 1 14-5M20 11a8 8 0 0 1-14 5M18 3v5h-5M6 21v-5h5" /></svg>
                Refresh
              </button>
              <div className="export-dropdown">
                <button className="btn-secondary" onClick={toggleExportDropdown}>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3m0 12l-4-4m4 4 4-4M2 17l.621 2.485A2 2 0 0 0 4.561 21h14.878a2 2 0 0 0 1.94-1.515L22 17" /></svg>
                  Export
                </button>
                {showExportDropdown ? (
                  <div className="export-menu">
                    <button onClick={handleExportPDF}>PDF</button>
                    <button onClick={handleExportWord}>Word</button>
                    <button onClick={handlePrint}>Print</button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading schedule...</p>
            </div>
          ) : schedule.length > 0 ? (
            <div className="timetable-container">
              <table className="timetable-grid">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Time</th>
                    <th>Monday</th>
                    <th>Tuesday</th>
                    <th>Wednesday</th>
                    <th>Thursday</th>
                    <th>Friday</th>
                  </tr>
                </thead>
                <tbody>
                  {buildScheduleGrid(schedule).map((row) => (
                    <tr key={row.key} className={row.type === 'break' ? 'break-row' : undefined}>
                      <td className="period-col">
                        {row.type === 'break' ? <span className="break-label">{row.label}</span> : <span>{row.period}</span>}
                      </td>
                      <td className="time-col">{formatTimeRange(row.start_time, row.end_time)}</td>
                      {row.type === 'break' ? (
                        <td colSpan={5} className="break-fill"></td>
                      ) : (
                        days.map((day) => (
                          <td key={day}>
                            {row.entriesByDay[day] ? (
                              <div className="module-cell">
                                <strong>{row.entriesByDay[day].module_name}</strong>
                                <small>{row.entriesByDay[day].class_name}</small>
                                <span className="room-badge">{row.entriesByDay[day].room_name || 'TBA'}</span>
                              </div>
                            ) : (
                              <span className="empty-slot"></span>
                            )}
                          </td>
                        ))
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v4M17 3v4M4 9h16M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm3 8h3v3H9z" /></svg>
              <h2>No schedule available</h2>
              <p>Select an academic year and term to view your schedule.</p>
            </div>
          )}
        </section>

        <section className="substitutions-section">
          <div className="section-header">
            <h2>Substitution Assignments</h2>
            <button className="btn-secondary" onClick={loadSubstitutions} disabled={loadingSubs}>
              Refresh
            </button>
          </div>

          {loadingSubs ? (
            <div className="loading-state">
              <div className="spinner"></div>
              <p>Loading substitutions...</p>
            </div>
          ) : substitutions.length > 0 ? (
            <div className="substitutions-list">
              {substitutions.map((sub) => (
                <div key={sub.substitution_id} className="substitution-card">
                  <div className="substitution-header">
                    <strong>{sub.class_name}</strong>
                    <span className="badge">{sub.substitution_date}</span>
                  </div>
                  <div className="substitution-details">
                    <p><strong>Module:</strong> {sub.module_name}</p>
                    <p><strong>Original Teacher:</strong> {sub.original_teacher_name}</p>
                    <p><strong>Time:</strong> {sub.start_time} - {sub.end_time}</p>
                    <p><strong>Room:</strong> {sub.room_name || 'TBA'}</p>
                    {sub.notes ? <p><strong>Notes:</strong> {sub.notes}</p> : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm6-1 2 2 3-4" /></svg>
              <h2>No substitution assignments</h2>
              <p>You have no upcoming substitution assignments.</p>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  )
}
