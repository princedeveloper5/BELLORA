// Shared formatting / utility helpers for the Super Admin platform.

export const uid = (prefix = 'id') =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`

export const fmtDate = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d)
}

export const fmtDateTime = (value) => {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  return `${fmtDate(d)}, ${new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' }).format(d)}`
}

export const timeAgo = (value) => {
  if (!value) return '—'
  const then = new Date(value).getTime()
  const diff = Date.now() - then
  const abs = Math.abs(diff)
  const mins = Math.round(abs / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.round(hours / 24)
  if (days < 30) return `${days} day${days === 1 ? '' : 's'} ago`
  const months = Math.round(days / 30)
  if (months < 12) return `${months} mo ago`
  return fmtDate(value)
}

export const initials = (name = '') =>
  name.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('') || '?'

export const fmtNumber = (n) => new Intl.NumberFormat('en-US').format(Number(n || 0))

export const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

export const SLOTS = [
  ['08:00', '08:45'], ['08:50', '09:35'], ['09:50', '10:35'], ['10:40', '11:25'],
  ['11:30', '12:15'], ['13:30', '14:15'], ['14:20', '15:05'], ['15:10', '15:55']
]

// Deterministic PRNG so mock data is stable between reloads.
export function mulberry32(seed) {
  let a = seed >>> 0
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function downloadCsv(filename, columns, rows) {
  const escape = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = columns.map((c) => escape(c.label)).join(',')
  const body = rows.map((r) => columns.map((c) => escape(typeof c.value === 'function' ? c.value(r) : r[c.value])).join(','))
  const blob = new Blob([[head, ...body].join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd

// Download a weekly timetable as an iCalendar (.ics) file — importable into
// Google Calendar / Outlook. Entries may use day names or day indexes (0=Mon).
export function downloadIcs(filename, entries, title = 'Timetable') {
  const dayIndex = (d) => (typeof d === 'number' ? d : DAYS.indexOf(d))
  const nextDate = (targetDay) => {
    const now = new Date()
    const todayIdx = (now.getDay() + 6) % 7 // Monday = 0
    const delta = (targetDay - todayIdx + 7) % 7
    const d = new Date(now)
    d.setDate(d.getDate() + delta)
    return d
  }
  const stamp = (d, time) => {
    const [h, m] = String(time).split(':')
    const dt = new Date(d)
    dt.setHours(Number(h), Number(m), 0, 0)
    return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, '0')}${String(dt.getDate()).padStart(2, '0')}T${String(dt.getHours()).padStart(2, '0')}${String(dt.getMinutes()).padStart(2, '0')}00`
  }
  const esc = (s) => String(s || '').replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n')
  const DAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']

  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//BELLORA//Timetable//EN', 'CALSCALE:GREGORIAN', `X-WR-CALNAME:${esc(title)}`]
  entries.forEach((e, i) => {
    const di = dayIndex(e.day_of_week ?? e.day)
    if (di < 0 || di > 6) return
    const d = nextDate(di)
    lines.push(
      'BEGIN:VEVENT',
      `UID:panta-${e.timetable_id || e.id || i}@panta.school`,
      `SUMMARY:${esc(e.module_name || e.subjectName || 'Lesson')} — ${esc(e.class_name || e.className || '')}`,
      `DESCRIPTION:${esc(e.teacher_name || e.teacherName || '')}`,
      `LOCATION:${esc(e.room_name || e.roomName || '')}`,
      `DTSTART:${stamp(d, e.start_time || e.start)}`,
      `DTEND:${stamp(d, e.end_time || e.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${DAY_CODES[di]}`,
      'END:VEVENT'
    )
  })
  lines.push('END:VCALENDAR')
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
