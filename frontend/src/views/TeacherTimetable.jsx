import { useEffect, useState } from 'react'
import TeacherLayout from '@/components/TeacherLayout'
import api from '@/stores/api'
import { useAuthStore } from '@/stores/authStore'
import { exportToPDF, exportToWord } from '@/utils/exportTimetable'
import { buildFixedTimetableRows } from '@/utils/fixedTimetableStructure'
import { SCHOOL_DAYS, getSchoolDayName, getSchoolWeekDate, getMondayOfWeek, isAcademicWeekend } from '@/utils/dayHelpers'
import {
  BookOpen,
  CalendarCheck,
  CalendarDays,
  Columns3,
  DoorClosed,
  Download,
  Filter,
  Printer,
  Users,
  X
} from 'lucide-react'
import './TeacherTimetable.css'

const days = SCHOOL_DAYS
const moduleColors = ['#1769E0', '#0F9D8A', '#f59e0b', '#6D5CE7', '#ef4444', '#06b6d4', '#18B981', '#12304A']

const normalizeTime = (time) => String(time || '').slice(0, 5)

const formatTimeRange = (start, end) => `${normalizeTime(start)} - ${normalizeTime(end)}`

const isBreakEntry = (entry) => entry?.entry_type === 'break' || String(entry?.module_name || '').toLowerCase().includes('break')

const isActivityEntry = (entry) => entry?.entry_type === 'activity'

const getSubjectColor = (subject) => {
  const key = String(subject || 'Lesson')
  const total = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return moduleColors[total % moduleColors.length]
}

const abbreviateClassName = (className) => {
  const text = String(className || '').trim()
  if (!text || text === 'General') return text || 'General'

  const levelMatch = text.match(/\blevel\s*(\d+)\b/i)
  const levelLabel = levelMatch ? `L${levelMatch[1]}` : ''
  const tradeText = text
    .replace(/\blevel\s*\d+\b/ig, '')
    .replace(/\b(class|section|year|group)\b/ig, '')
    .replace(/\b[A-Z]\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  const knownTrades = {
    'software development': 'SWD',
    networking: 'NET',
    'computer science': 'CS',
    'information technology': 'IT',
    electronics: 'ELEC',
    electrical: 'ELEC'
  }
  const tradeKey = tradeText.toLowerCase()
  const tradeLabel = knownTrades[tradeKey] || tradeText
    .split(/\s+/)
    .filter(Boolean)
    .map(word => word[0])
    .join('')
    .toUpperCase()

  return [levelLabel, tradeLabel].filter(Boolean).join(' ') || text
}

const toLesson = (entry) => {
  const isSharedActivity = isActivityEntry(entry)
  const className = entry.class_name || 'General'
  return {
    id: entry.timetable_id,
    subject: entry.module_name || (isSharedActivity ? 'Shared Activity' : 'Lesson'),
    class: className,
    classShort: abbreviateClassName(className),
    room: entry.room_name || entry.room || 'TBA',
    type: isSharedActivity ? 'activity' : 'lesson',
    color: isSharedActivity ? '#18B981' : getSubjectColor(entry.module_name),
    duration: formatTimeRange(entry.start_time, entry.end_time),
    time: formatTimeRange(entry.start_time, entry.end_time),
    start_time: entry.start_time,
    end_time: entry.end_time,
    day: entry.day_of_week
  }
}

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;')

const areSameLessonBlock = (first, second) => {
  if (!first || !second) return false
  if ((first.entry_type || 'lesson') !== (second.entry_type || 'lesson')) return false
  if (String(first.assignment_id || '') && String(second.assignment_id || '')) {
    return String(first.assignment_id) === String(second.assignment_id)
  }

  return String(first.module_name || '') === String(second.module_name || '')
    && String(first.class_name || '') === String(second.class_name || '')
    && String(first.room_id || first.room_name || first.room || '') === String(second.room_id || second.room_name || second.room || '')
}

const buildMergedTimetableRows = (sourceRows) => sourceRows.map((row, rowIndex) => {
  if (row.type !== 'period') return row

  const cellsByDay = {}
  days.forEach((day) => {
    const entry = row.entriesByDay?.[day]
    if (!entry) {
      cellsByDay[day] = { entry: null, rowspan: 1, skip: false }
      return
    }

    const previousRow = sourceRows[rowIndex - 1]
    const previousEntry = previousRow?.type === 'period' ? previousRow.entriesByDay?.[day] : null
    if (areSameLessonBlock(previousEntry, entry)) {
      cellsByDay[day] = { entry, rowspan: 1, skip: true }
      return
    }

    let rowspan = 1
    for (let nextIndex = rowIndex + 1; nextIndex < sourceRows.length; nextIndex += 1) {
      const nextRow = sourceRows[nextIndex]
      if (nextRow.type !== 'period' || !areSameLessonBlock(entry, nextRow.entriesByDay?.[day])) break
      rowspan += 1
    }

    cellsByDay[day] = { entry, rowspan, skip: false }
  })

  return { ...row, cellsByDay }
})

const exportMergedRows = (exportTimetableRows) => exportTimetableRows.map((row) => {
  if (row.type !== 'period') return row

  const cellsByDay = {}
  days.forEach((day) => {
    cellsByDay[day] = {
      entry: row.entriesByDay?.[day] || null,
      rowspan: 1,
      skip: false
    }
  })

  return { ...row, cellsByDay }
})

const formatExportLesson = (lesson, span = 1) => {
  const lines = [
    lesson.subject,
    `Class: ${lesson.classShort || lesson.class}`,
    `Room: ${lesson.room}`
  ]
  if (span > 1) lines.push(`${span} slots`)
  return lines.join('\n')
}

const downloadFile = (content, filename, type) => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export default function TeacherTimetable() {
  const authStore = useAuthStore()

  const [viewMode, setViewModeState] = useState('week')
  const [selectedDay, setSelectedDay] = useState('')
  const [selectedClass, setSelectedClass] = useState('')
  const [showBreaks, setShowBreaks] = useState(true)
  const [showFreeSlots, setShowFreeSlots] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [selectedDayView, setSelectedDayView] = useState('Monday')
  const [showDetailsModal, setShowDetailsModal] = useState(false)
  const [selectedLesson, setSelectedLesson] = useState(null)
  const [showAssignedModulesModal, setShowAssignedModulesModal] = useState(false)
  const [showModuleDetailsModal, setShowModuleDetailsModal] = useState(false)
  const [selectedModule, setSelectedModule] = useState(null)
  const [exportFormat, setExportFormat] = useState('pdf')
  const [timetableEntries, setTimetableEntries] = useState([])
  const [teacherAssignments, setTeacherAssignments] = useState([])
  const [timetableSettings, setTimetableSettings] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')

  const currentTeacherId = authStore.currentUser?.teacher_id || authStore.currentUser?.teacherId || null
  const teacherName = (() => {
    const user = authStore.currentUser || {}
    return user.name || user.full_name || user.teacher_name || user.email || 'Teacher'
  })()

  const teacherWorkingDays = (() => {
    const rawDays = authStore.currentUser?.available_days || authStore.currentUser?.availableDays || ''
    const parsedDays = Array.isArray(rawDays)
      ? rawDays
      : String(rawDays || '').split(',').map(day => day.trim()).filter(Boolean)

    const validDays = parsedDays.filter(day => days.includes(day))
    return validDays.length ? validDays : days
  })()

  const classes = (() => {
    const names = new Set()
    timetableEntries.forEach((entry) => {
      if (entry.class_name) names.add(entry.class_name)
    })
    teacherAssignments.forEach((assignment) => {
      if (assignment.class_name) names.add(assignment.class_name)
    })
    return Array.from(names).sort()
  })()

  const classSummary = (() => {
    if (!classes.length) return 'No classes'
    if (classes.length <= 2) return classes.join(', ')
    return `${classes.slice(0, 2).join(', ')} +${classes.length - 2}`
  })()

  const formattedWeek = (() => {
    const today = new Date()
    const start = getMondayOfWeek(today)
    const end = new Date(start)
    end.setDate(start.getDate() + 4)

    return `${start.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
  })()

  const processedTimetable = (() => {
    const visibleEntries = timetableEntries.filter((entry) => {
      const isOwnLesson = String(entry.teacher_id || '') === String(currentTeacherId || '')
      const isSharedActivity = isActivityEntry(entry)
      const isBreak = isBreakEntry(entry)
      if (!isOwnLesson && !isSharedActivity && !isBreak) return false
      if (!isBreak && selectedDay && selectedDay !== entry.day_of_week) return false
      if (!isBreak && selectedClass && selectedClass !== entry.class_name) return false
      return true
    })
    const rows = buildFixedTimetableRows(visibleEntries, days, timetableSettings)

    return rows.filter((row) => {
      if (row.type !== 'period') return showBreaks
      return showFreeSlots || Object.keys(row.entriesByDay).length > 0
    })
  })()

  const exportTimetableRows = (() => {
    const exportEntries = timetableEntries.filter((entry) => {
      const isOwnLesson = String(entry.teacher_id || '') === String(currentTeacherId || '')
      return isOwnLesson || isActivityEntry(entry) || isBreakEntry(entry)
    })
    return buildFixedTimetableRows(exportEntries, days, timetableSettings)
  })()

  const allLessons = (() => {
    const lessons = []
    processedTimetable.forEach((row) => {
      if (row.type !== 'break') {
        Object.values(row.entriesByDay).forEach((entry) => lessons.push(toLesson(entry)))
      }
    })
    return lessons
  })()

  const todayName = getSchoolDayName(new Date()) || ''

  const isTodayTeacherWorkingDay = Boolean(todayName && teacherWorkingDays.includes(todayName))

  const canShowDayView = !isAcademicWeekend(new Date()) && isTodayTeacherWorkingDay

  const todayStatusLabel = (() => {
    if (isAcademicWeekend(new Date())) return 'Weekend'
    if (!todayName) return 'No school day'
    if (!isTodayTeacherWorkingDay) return `${todayName} off`
    return todayName
  })()

  const dayViewDisabledReason = (() => {
    if (canShowDayView) return ''
    if (isAcademicWeekend(new Date())) return 'Day view is hidden during the weekend.'
    if (todayName && !isTodayTeacherWorkingDay) return `Day view is hidden because ${todayName} is not your working day.`
    return 'Day view is hidden today.'
  })()

  const totalLessons = allLessons.length

  const todayLessons = allLessons.filter((lesson) => lesson.day === todayName)

  const nextLesson = (() => {
    const nowDay = todayName
    const nowTime = normalizeTime(new Date().toTimeString())
    return allLessons.find((lesson) => {
      if (lesson.day !== nowDay) return true
      return normalizeTime(lesson.start_time) >= nowTime
    }) || null
  })()

  const getDayDate = (day) => {
    const date = getSchoolWeekDate(day, new Date())
    return date ? date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
  }

  const isTodayColumn = (day) => {
    return day === getSchoolDayName(new Date())
  }

  const getDayLessons = (day) => {
    return processedTimetable
      .filter(row => row.type !== 'break' && row.entriesByDay[day])
      .map(row => toLesson(row.entriesByDay[day]))
  }

  const setViewMode = (mode) => {
    if (mode === 'day' && !canShowDayView) {
      setViewModeState('week')
      return
    }

    setViewModeState(mode)
    if (mode === 'day' && todayName) {
      setSelectedDayView(todayName)
    }
  }

  const resetFilters = () => {
    setSelectedDay('')
    setSelectedClass('')
    setShowBreaks(true)
    setShowFreeSlots(true)
  }

  const printTimetable = () => {
    window.print()
  }

  const exportLessons = (() => {
    const lessons = []
    exportTimetableRows.forEach((row) => {
      if (row.type !== 'break') {
        Object.values(row.entriesByDay || {}).forEach((entry) => {
          if (entry && !isBreakEntry(entry)) lessons.push(toLesson(entry))
        })
      }
    })
    return lessons
  })()

  const moduleProgressCards = (() => {
    const modules = new Map()

    teacherAssignments.forEach((assignment) => {
      const name = assignment.module_name || 'Assigned module'
      const current = modules.get(name) || {
        name,
        department: assignment.teacher_department || 'Software Development',
        classes: new Set(),
        levels: new Set(),
        rooms: new Set(),
        hoursPerYear: Number(assignment.hours_per_year || 0),
        scheduledSlots: 0,
        targetSlots: Math.max(1, Math.ceil(Number(assignment.hours_per_year || 40) / 40)),
        lessons: []
      }

      if (assignment.class_name) current.classes.add(assignment.class_name)
      if (assignment.level) current.levels.add(assignment.level)
      if (assignment.room_name || assignment.room) current.rooms.add(assignment.room_name || assignment.room)
      current.hoursPerYear = Math.max(current.hoursPerYear, Number(assignment.hours_per_year || 0))
      current.targetSlots = Math.max(current.targetSlots, Math.ceil(Number(assignment.hours_per_year || 40) / 40))
      modules.set(name, current)
    })

    exportLessons.forEach((lesson) => {
      const name = lesson.subject || 'Lesson'
      const current = modules.get(name) || {
        name,
        department: 'Software Development',
        classes: new Set(),
        levels: new Set(),
        rooms: new Set(),
        hoursPerYear: 0,
        scheduledSlots: 0,
        targetSlots: 1,
        lessons: []
      }

      current.scheduledSlots += 1
      if (lesson.class) current.classes.add(lesson.class)
      if (lesson.room) current.rooms.add(lesson.room)
      current.lessons.push(lesson)
      modules.set(name, current)
    })

    return Array.from(modules.values())
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((module) => {
        const percent = Math.min(100, Math.round((module.scheduledSlots / Math.max(module.targetSlots, 1)) * 100))
        return {
          ...module,
          classes: Array.from(module.classes).sort().join(', '),
          levels: Array.from(module.levels).sort().join(', '),
          rooms: Array.from(module.rooms).sort().join(', '),
          percent,
          status: percent >= 100 ? 'Fully covered this week' : module.scheduledSlots ? 'In progress' : 'Assigned, not scheduled'
        }
      })
  })()

  const getExportFileBaseName = () => {
    const safeName = String(teacherName || 'teacher')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    return `${safeName || 'teacher'}-timetable`
  }

  const buildTimetableHtml = () => {
    const mergedRows = exportMergedRows(exportTimetableRows)
    const header = ['Slot', 'Time', ...days].map(cell => `<th>${escapeHtml(cell)}</th>`).join('')
    const body = mergedRows.map((row) => {
      if (row.type !== 'period') {
        return `<tr class="break-row ${row.breakType}"><td>${escapeHtml(row.label)}</td><td>${escapeHtml(formatTimeRange(row.start_time, row.end_time))}</td><td colspan="${days.length}"></td></tr>`
      }

      const cells = days.map((day) => {
        const cell = row.cellsByDay?.[day]
        if (cell?.skip) return ''
        const lesson = cell?.entry ? toLesson(cell.entry) : null
        if (!lesson) return '<td class="empty-cell"></td>'
        return `<td rowspan="${cell.rowspan || 1}"><div class="lesson-card ${escapeHtml(lesson.type)}" style="border-left-color:${lesson.color}">
        <strong>${escapeHtml(lesson.subject)}</strong>
        <span>Class: ${escapeHtml(lesson.classShort || lesson.class)}</span>
        <small>Room: ${escapeHtml(lesson.room)}</small>
        ${cell.rowspan > 1 ? `<em>${cell.rowspan} slots</em>` : ''}
      </div></td>`
      }).join('')
      return `<tr><td class="slot-cell">${escapeHtml(row.period)}</td><td class="time-cell">${escapeHtml(formatTimeRange(row.start_time, row.end_time))}</td>${cells}</tr>`
    }).join('')

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <title>${escapeHtml(teacherName)} Timetable</title>
  <style>
    @page { size: landscape; margin: 10mm; }
    body { font-family: Arial, sans-serif; color: #111827; }
    .export-header { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 2px solid #dbeafe; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
    h2 { font-size: 13px; margin: 14px 0 6px; color: #0f172a; }
    .subtitle { margin: 0; color: #475569; font-size: 12px; }
    .teacher-meta { margin: 0 0 4px; font-size: 12px; font-weight: 700; color: #111827; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th, td { border: 1px solid #cbd5e1; padding: 5px; font-size: 10px; vertical-align: top; height: 38px; }
    th { background: #2563eb; color: white; text-align: left; }
    .time-cell { background: #f8fafc; font-weight: 700; }
    .empty-cell { background: #ffffff; }
    .lesson-card { min-height: 14px; padding: 1px 2px; border-left: 3px solid #3b82f6; background: #eff6ff; border-radius: 3px; }
    .lesson-card.activity { background: #f0fdf4; }
    .lesson-card strong, .lesson-card span, .lesson-card small, .lesson-card em { display: block; }
    .lesson-card em { margin-top: 3px; color: #1d4ed8; font-style: normal; font-weight: 700; }
    .break-row td { background: #e8f7e9; font-weight: 700; text-align: center; }
    .break-row.lunch td { background: #fff4c7; }
    .break-row.assembly td { background: #e9f2ff; }
    @page { size: A4 landscape; margin: 3mm; mso-page-orientation: landscape; }
    @media print {
      html, body { width: 291mm; min-height: 204mm; }
    }
  </style>
</head>
<body>
  <header class="export-header">
    <div>
      <h1>${escapeHtml(teacherName)} Timetable</h1>
      <p class="teacher-meta">Teacher: ${escapeHtml(teacherName)}</p>
      <p class="subtitle">Weekly timetable - ${escapeHtml(formattedWeek)}</p>
    </div>
  </header>
  <h2>Weekly Schedule</h2>
  <table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>
</body>
</html>`
  }

  const buildPdfRows = () => exportMergedRows(exportTimetableRows).map((row) => {
    if (row.type !== 'period') {
      const fill = row.breakType === 'lunch' ? '#fff4c7' : row.breakType === 'assembly' ? '#e9f2ff' : '#e8f7e9'
      return {
        type: 'break',
        cells: [
          { text: row.label, fill, bold: true },
          { text: formatTimeRange(row.start_time, row.end_time), fill, bold: true },
          ...days.map(() => ({ text: row.label, fill, bold: true }))
        ]
      }
    }

    return {
      type: 'period',
      cells: [
        { text: String(row.period), fill: '#f8fafc', bold: true },
        { text: formatTimeRange(row.start_time, row.end_time), fill: '#f8fafc', bold: true },
        ...days.map((day) => {
          const cell = row.cellsByDay?.[day]
          if (cell?.skip) return { text: '', fill: '#eff6ff', color: '#1d4ed8', bold: false }
          const lesson = cell?.entry ? toLesson(cell.entry) : null
          if (!lesson) return { text: '', fill: '#ffffff' }
          return {
            text: formatExportLesson(lesson, cell.rowspan),
            fill: lesson.type === 'activity' ? '#f0fdf4' : '#eff6ff',
            color: '#111827',
            bold: true
          }
        })
      ]
    }
  })

  const downloadTimetable = async (format = 'csv') => {
    const selectedFormat = String(format || 'csv').toLowerCase()
    const baseName = getExportFileBaseName()
    const exportOptions = {
      logoUrl: authStore.currentUser?.school_logo_url || authStore.currentUser?.schoolLogo || timetableSettings?.school_logo_url || undefined,
      preparedBy: timetableSettings?.prepared_by || undefined,
      approvedBy: timetableSettings?.approved_by || undefined,
      headerPosition: timetableSettings?.header_position || undefined,
      customContent: timetableSettings?.custom_header_content || undefined,
      rows: exportTimetableRows
    }

    if (selectedFormat === 'pdf') {
      await exportToPDF(exportTimetableRows, `${teacherName} Timetable`, exportOptions)
    } else {
      await exportToWord(exportTimetableRows, `${teacherName} Timetable`, exportOptions)
    }
  }

  const showLessonDetails = (lesson) => {
    setSelectedLesson(lesson)
    setShowDetailsModal(true)
  }

  const showModuleDetails = (module) => {
    setSelectedModule(module)
    setShowAssignedModulesModal(false)
    setShowModuleDetailsModal(true)
  }

  const loadTimetable = async () => {
    setLoading(true)
    setLoadError('')
    try {
      await authStore.checkAuth()
      const teacherId = authStore.currentUser?.teacher_id || authStore.currentUser?.teacherId || null
      if (!teacherId) {
        throw new Error('Teacher profile was not loaded.')
      }

      const [settingsResponse, timetableResponse, assignmentsResponse] = await Promise.all([
        api.get('/settings/timetable').catch(() => ({ data: { settings: null } })),
        api.get(`/timetable/teacher/${teacherId}`),
        api.get('/teacher-auth/me/assignments').catch(() => ({ data: { assignments: [] } }))
      ])
      setTimetableSettings(settingsResponse.data.settings || null)
      setTimetableEntries(timetableResponse.data.timetables || [])
      setTeacherAssignments(assignmentsResponse.data.assignments || [])
    } catch (error) {
      setLoadError(error.response?.data?.message || error.message || 'Failed to load timetable.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (todayName) setSelectedDayView(todayName)
    if (!canShowDayView) setViewModeState('week')
    loadTimetable()
  }, [])

  const selectedDayLessons = getDayLessons(selectedDayView)

  return (
    <TeacherLayout>
      <div className="timetable-container">
        <section className="studio-header">
          <div className="header-content">
            <p className="eyebrow">Teacher schedule</p>
            <h1>My Timetable</h1>
            <p className="studio-subtitle">{formattedWeek} &middot; week view</p>
          </div>

          <div className="header-controls">
            <div className="view-controls">
              <button
                className={`view-btn${viewMode === 'week' ? ' active' : ''}`}
                onClick={() => setViewModeState('week')}
                title="Weekly View"
              >
                <Columns3 size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Week</span>
              </button>
              <button
                className={`view-btn${viewMode === 'day' ? ' active' : ''}`}
                disabled={!canShowDayView}
                onClick={() => setViewMode('day')}
                title={dayViewDisabledReason || 'Daily View'}
              >
                <CalendarDays size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Day</span>
              </button>
            </div>

            <div className="action-controls studio-actions">
              <button
                className="btn-secondary modules-btn"
                type="button"
                disabled={!moduleProgressCards.length}
                onClick={() => setShowAssignedModulesModal(true)}
                title="Assigned Modules"
              >
                <BookOpen size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Modules</span>
              </button>
              <button className="btn-secondary filter-btn" onClick={() => setShowFilters(!showFilters)} title="Filters">
                <Filter size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Filter</span>
              </button>
              <button className="btn-secondary print-btn" onClick={printTimetable} title="Print">
                <Printer size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Print</span>
              </button>
              <select
                value={exportFormat}
                onChange={(event) => setExportFormat(event.target.value)}
                className="export-select"
                aria-label="Download format"
              >
                <option value="doc">Word</option>
                <option value="pdf">PDF</option>
              </select>
              <button className="btn-primary download-btn" onClick={() => downloadTimetable(exportFormat)} title="Download">
                <Download size={17} strokeWidth={2.2} aria-hidden="true" />
                <span>Download</span>
              </button>
            </div>
          </div>
        </section>

        <section className="metrics-grid teacher-metrics" aria-label="Timetable summary">
          <article>
            <span>Slots</span>
            <strong>{totalLessons}</strong>
            <small>Week</small>
          </article>
          <article>
            <span>Classes</span>
            <strong>{classes.length}</strong>
            <small>{classSummary}</small>
          </article>
          <article>
            <span>Today</span>
            <strong>{todayLessons.length}</strong>
            <small>{todayStatusLabel}</small>
          </article>
          <article>
            <span>Next</span>
            <strong>{nextLesson ? nextLesson.time : 'Clear'}</strong>
            <small>{nextLesson ? `${nextLesson.subject} \u00b7 ${nextLesson.class}` : 'Free'}</small>
          </article>
        </section>

        {loading && <div className="state-panel">Loading timetable...</div>}
        {!loading && loadError && <div className="state-panel error">{loadError}</div>}
        {!loading && !loadError && viewMode === 'day' && !canShowDayView && (
          <div className="state-panel info">
            {dayViewDisabledReason} Weekly timetable is still available.
          </div>
        )}

        {showFilters && (
          <section className="filters-panel panel-card">
            <div className="filter-group">
              <label>Filter by Day</label>
              <select value={selectedDay} onChange={(event) => setSelectedDay(event.target.value)} className="filter-input">
                <option value="">All Days</option>
                <option value="Monday">Monday</option>
                <option value="Tuesday">Tuesday</option>
                <option value="Wednesday">Wednesday</option>
                <option value="Thursday">Thursday</option>
                <option value="Friday">Friday</option>
              </select>
            </div>

            <div className="filter-group">
              <label>Filter by Class</label>
              <select value={selectedClass} onChange={(event) => setSelectedClass(event.target.value)} className="filter-input">
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group checkbox-group">
              <label className="checkbox-label">
                <input type="checkbox" checked={showBreaks} onChange={(event) => setShowBreaks(event.target.checked)} />
                <span>Breaks</span>
              </label>
              <label className="checkbox-label">
                <input type="checkbox" checked={showFreeSlots} onChange={(event) => setShowFreeSlots(event.target.checked)} />
                <span>Free periods</span>
              </label>
            </div>

            <button className="reset-btn" onClick={resetFilters}>Reset</button>
          </section>
        )}

        {!loading && !loadError && viewMode === 'week' && (
          <section className="timetable-section timetable-output-card">
            <div className="output-toolbar">
              <div>
                <p className="eyebrow">Weekly view</p>
                <h2>{teacherName} Timetable</h2>
              </div>
              <span className="badge">{totalLessons} entries</span>
            </div>
            <div className="timetable-wrapper table-responsive">
              <table className="timetable-grid">
                <thead>
                  <tr className="header-row">
                    <th className="slot-column">Slot</th>
                    <th className="time-column">Time</th>
                    {days.map((day) => (
                      <th
                        key={day}
                        className={`day-column${isTodayColumn(day) ? ' today' : ''}`}
                      >
                        <div className="day-header">
                          <span className="day-name">{day}</span>
                          <span className="day-date">{getDayDate(day)}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {processedTimetable.map((row) => (
                    row.type !== 'period' ? (
                      <tr key={row.key} className={`break-row ${row.breakType}`}>
                        <td className={`period-col ${row.breakType}`}>
                          <span className="break-label">{row.label}</span>
                        </td>
                        <td className={`time-col ${row.breakType}`}>{formatTimeRange(row.start_time, row.end_time)}</td>
                        <td colSpan={days.length} className={`break-fill ${row.breakType}`}></td>
                      </tr>
                    ) : (
                      <tr key={row.key} className="period-row">
                        <td className="period-col">{row.period}</td>
                        <td className="time-col">{formatTimeRange(row.start_time, row.end_time)}</td>

                        {days.map((day) => (
                          <td
                            key={`${row.key}-${day}`}
                            className={`lesson-cell${isTodayColumn(day) ? ' today' : ''}`}
                          >
                            {row.entriesByDay[day] ? (
                              <div
                                className={`module-cell${row.entriesByDay[day].entry_type === 'activity' ? ' activity-cell' : ''}`}
                                data-module={row.entriesByDay[day].module_name}
                                title={`${row.entriesByDay[day].module_name || 'Lesson'} - ${row.entriesByDay[day].class_name || 'General'} - ${row.entriesByDay[day].room_name || row.entriesByDay[day].room || 'TBA'}`}
                                onClick={() => showLessonDetails(toLesson(row.entriesByDay[day]))}
                              >
                                <strong>{row.entriesByDay[day].module_name}</strong>
                                <small>{row.entriesByDay[day].class_name || 'General'}</small>
                                {row.entriesByDay[day].entry_type !== 'activity' && (
                                  <span className="room-badge">
                                    {row.entriesByDay[day].room_name || row.entriesByDay[day].room || 'TBA'}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="empty-slot"></span>
                            )}
                          </td>
                        ))}
                      </tr>
                    )
                  ))}
                </tbody>
              </table>
            </div>

            <div className="timetable-legend">
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#dbeafe' }}></div>
                <span>Lessons</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#fef3c7' }}></div>
                <span>Breaks</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#fecaca' }}></div>
                <span>Lunch</span>
              </div>
              <div className="legend-item">
                <div className="legend-color" style={{ backgroundColor: '#f5f5f5' }}></div>
                <span>Free Periods</span>
              </div>
            </div>
          </section>
        )}

        {!loading && !loadError && viewMode === 'day' && canShowDayView && (
          <section className="day-view-section timetable-output-card">
            <div className="day-selector">
              {days.map((day) => (
                <button
                  key={day}
                  className={`day-selector-btn${selectedDayView === day ? ' active' : ''}`}
                  onClick={() => setSelectedDayView(day)}
                >
                  {day}
                </button>
              ))}
            </div>

            <div className="day-schedule">
              {selectedDayLessons.length === 0 ? (
                <div className="empty-day">
                  <CalendarCheck size={36} strokeWidth={1.9} aria-hidden="true" />
                  <h3>No classes on {selectedDayView}</h3>
                  <p>Free day.</p>
                </div>
              ) : (
                <div className="day-lessons">
                  {selectedDayLessons.map((lesson) => (
                    <div
                      key={lesson.id}
                      className="day-lesson-card"
                    >
                      <div className="day-lesson-time">
                        <span className="day-lesson-start">{lesson.time}</span>
                        <span className="day-lesson-duration">{lesson.duration}</span>
                      </div>
                      <div className="day-lesson-content" style={{ borderLeftColor: lesson.color }}>
                        <h3>{lesson.subject}</h3>
                        <p>
                          <Users size={15} strokeWidth={2.2} aria-hidden="true" /> {lesson.class}
                        </p>
                        <p>
                          <DoorClosed size={15} strokeWidth={2.2} aria-hidden="true" /> {lesson.room}
                        </p>
                        <div className="day-lesson-actions">
                          <button onClick={() => showLessonDetails(lesson)}>Details</button>
                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      {showAssignedModulesModal && (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setShowAssignedModulesModal(false) }}>
          <div className="modal-content assigned-modules-modal">
            <button className="modal-close" onClick={() => setShowAssignedModulesModal(false)}>
              <X size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>

            <div className="module-progress-header">
              <div>
                <p className="eyebrow">Assigned</p>
                <h2>My Modules</h2>
              </div>
              <span>{moduleProgressCards.length} total</span>
            </div>

            <div className="module-progress-grid compact-module-grid">
              {moduleProgressCards.map((module) => (
                <button
                  key={module.name}
                  type="button"
                  className="module-progress-card"
                  onClick={() => showModuleDetails(module)}
                >
                  <div className="module-card-top">
                    <strong>{module.name}</strong>
                    <span>{module.percent}%</span>
                  </div>
                  <div className="progress-track-mini" aria-hidden="true">
                    <span style={{ width: `${module.percent}%` }}></span>
                  </div>
                  <div className="module-card-meta">
                    <small>{module.levels || 'Level'}</small>
                    <small>{module.scheduledSlots}/{module.targetSlots}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showModuleDetailsModal && (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setShowModuleDetailsModal(false) }}>
          <div className="modal-content module-detail-modal">
            <button className="modal-close" onClick={() => setShowModuleDetailsModal(false)}>
              <X size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>

            {selectedModule && (
              <div>
                <div className="module-detail-hero">
                  <div>
                    <p className="eyebrow">Module details</p>
                    <h2>{selectedModule.name}</h2>
                    <span>{selectedModule.department || 'Software Development'}</span>
                  </div>
                  <div className="module-percent-ring" style={{ background: `conic-gradient(#2563eb 0 ${selectedModule.percent}%, #e2e8f0 ${selectedModule.percent}% 100%)` }}>
                    <strong>{selectedModule.percent}%</strong>
                    <small>covered</small>
                  </div>
                </div>

                <div className="details-grid module-detail-grid">
                  <div className="detail-item">
                    <label>Classes</label>
                    <p>{selectedModule.classes || 'Not assigned'}</p>
                  </div>
                  <div className="detail-item">
                    <label>Level</label>
                    <p>{selectedModule.levels || 'Not set'}</p>
                  </div>
                  <div className="detail-item">
                    <label>Rooms</label>
                    <p>{selectedModule.rooms || 'TBA'}</p>
                  </div>
                  <div className="detail-item">
                    <label>Weekly slots</label>
                    <p>{selectedModule.scheduledSlots} of {selectedModule.targetSlots}</p>
                  </div>
                  <div className="detail-item">
                    <label>Hours per year</label>
                    <p>{selectedModule.hoursPerYear || 'Not set'}</p>
                  </div>
                  <div className="detail-item">
                    <label>Status</label>
                    <p>{selectedModule.status}</p>
                  </div>
                </div>

                <div className="module-schedule-list">
                  <h3>Scheduled lessons</h3>
                  {selectedModule.lessons.length ? (
                    <div className="module-schedule-items">
                      {selectedModule.lessons.map((lesson) => (
                        <div key={lesson.id || `${lesson.day}-${lesson.time}`}>
                          <strong>{lesson.day} &middot; {lesson.time}</strong>
                          <span>{lesson.class} &middot; {lesson.room}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="empty-copy">This module is assigned but has not been placed on the weekly timetable yet.</p>
                  )}
                </div>

                <div className="modal-actions">
                  <button onClick={() => setShowModuleDetailsModal(false)} className="btn-secondary">
                    <X size={16} strokeWidth={2.4} aria-hidden="true" /> Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {showDetailsModal && (
        <div className="modal-overlay" onClick={(event) => { if (event.target === event.currentTarget) setShowDetailsModal(false) }}>
          <div className="modal-content">
            <button className="modal-close" onClick={() => setShowDetailsModal(false)}>
              <X size={18} strokeWidth={2.4} aria-hidden="true" />
            </button>

            {selectedLesson && (
              <div className="lesson-details-modal">
                <h2>{selectedLesson.subject}</h2>
                <div className="details-grid">
                  <div className="detail-item">
                    <label>Class</label>
                    <p>{selectedLesson.class}</p>
                  </div>
                  <div className="detail-item">
                    <label>Room</label>
                    <p>{selectedLesson.room}</p>
                  </div>
                  <div className="detail-item">
                    <label>Time</label>
                    <p>{selectedLesson.time} ({selectedLesson.duration})</p>
                  </div>
                  <div className="detail-item">
                    <label>Day</label>
                    <p>{selectedLesson.day}</p>
                  </div>
                </div>

                <div className="modal-actions">
                  <button onClick={() => setShowDetailsModal(false)} className="btn-secondary">
                    <X size={16} strokeWidth={2.4} aria-hidden="true" /> Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </TeacherLayout>
  )
}
