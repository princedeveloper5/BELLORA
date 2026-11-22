import { useEffect, useState } from 'react'
import { ClipboardCheck, CalendarClock, Users, CheckCheck, Save, LoaderCircle, Check, X, Clock, FileText } from 'lucide-react'
import TcLayout from './TcLayout'
import EmptyState from '@/sa/components/EmptyState'
import { useStore } from '@/stores/useStore'
import { tcStore, tcActions } from './tcStore'
import { initials } from '@/sa/format'
import api from '@/stores/api'
import './TcAttendance.css'

const today = new Date().toISOString().slice(0, 10)

const statusOptions = [
  { value: 'present', label: 'Present', icon: Check, on: 'on-green' },
  { value: 'absent', label: 'Absent', icon: X, on: 'on-red' },
  { value: 'late', label: 'Late', icon: Clock, on: 'on-amber' },
  { value: 'excused', label: 'Excused', icon: FileText, on: 'on-blue' }
]

export default function TcAttendance() {
  const store = useStore(tcStore)

  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(today)
  const [periodKey, setPeriodKey] = useState('')
  const [students, setStudents] = useState([])
  const [records, setRecords] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const classes = store.overview?.classList || []

  const dayName = new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long' })
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })

  // Period options = this teacher's published lessons for the chosen class + weekday
  const periodOptions = (() => {
    if (!classId || !store.overview?.week) return []
    const cls = classes.find((c) => Number(c.class_id) === Number(classId))
    return store.overview.week
      .filter((w) => w.day_of_week === dayName && w.class_name === cls?.class_name)
      .map((w) => ({ key: `${w.timetable_id}|${w.start_time}-${w.end_time}`, label: `${w.start_time} – ${w.end_time} · ${w.module_name}`, timetable_id: w.timetable_id, period: `${w.start_time}-${w.end_time} · ${w.module_name}` }))
  })()
  const selectedPeriod = periodOptions.find((p) => p.key === periodKey)
  const periodLabel = selectedPeriod?.period || ''
  const className = classes.find((c) => Number(c.class_id) === Number(classId))?.class_name || ''

  const summary = (() => {
    if (!students.length) return null
    const s = { present: 0, absent: 0, late: 0, excused: 0 }
    students.forEach((st) => { const r = records[st.student_id]; if (r) s[r.status]++ })
    return s
  })()

  useEffect(() => {
    let cancelled = false
    setRecords({})
    setStudents([])
    if (!classId || !periodKey) return undefined
    setLoading(true)
    const load = async () => {
      try {
        const [stu, att] = await Promise.all([
          api.get(`/teacher-attendance/classes/${classId}/students`).then((r) => r.data.students || r.data.items || []),
          api.get('/teacher-attendance/attendance', { params: { class_id: classId, attendance_date: date, timetable_id: selectedPeriod?.timetable_id || null, period_label: periodLabel } }).then((r) => r.data.attendance || []).catch(() => [])
        ])
        if (cancelled) return
        setStudents(stu)
        const byStudent = new Map((Array.isArray(att) ? att : []).map((a) => [Number(a.student_id), a]))
        const next = {}
        stu.forEach((s) => {
          const existing = byStudent.get(Number(s.student_id))
          next[s.student_id] = { status: existing?.status || 'present', notes: existing?.notes || '' }
        })
        setRecords(next)
      } catch (e) {
        if (cancelled) return
        tcActions.error(e?.response?.data?.message || 'Could not load the class roster.', 'Error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, date, periodKey, reloadKey])

  const setStatus = (id, status) => {
    setRecords((current) => ({ ...current, [id]: { ...current[id], status } }))
  }
  const setNote = (id, notes) => {
    setRecords((current) => ({ ...current, [id]: { ...current[id], notes } }))
  }
  const markAll = (status) => {
    setRecords((current) => {
      const next = { ...current }
      students.forEach((s) => { next[s.student_id] = { ...next[s.student_id], status } })
      return next
    })
  }

  const save = async () => {
    setSaving(true)
    try {
      const result = await api.post('/teacher-attendance/attendance', {
        class_id: Number(classId),
        attendance_date: date,
        timetable_id: selectedPeriod?.timetable_id || null,
        period_label: periodLabel,
        report: true,
        records: students.map((s) => ({
          student_id: Number(s.student_id), status: records[s.student_id].status, notes: records[s.student_id].notes || null
        }))
      }).then((r) => r.data)
      tcActions.success(result.message || 'Attendance saved.', 'Attendance saved')
      await tcActions.bootstrap()
      setReloadKey((k) => k + 1)
    } catch (e) {
      tcActions.error(e?.response?.data?.message || 'Could not save attendance.', 'Error')
    } finally { setSaving(false) }
  }

  return (
    <TcLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight">Attendance</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">Mark student attendance per class, date and period.</p>
        </div>
        {summary ? (
          <div className="flex gap-2 text-[12px] font-bold">
            <span className="rounded-lg bg-[#E8F8F2] text-[#0E9F70] px-3 py-1.5">{summary.present} present</span>
            <span className="rounded-lg bg-[#FEECEC] text-[#B91C1C] px-3 py-1.5">{summary.absent} absent</span>
            <span className="rounded-lg bg-[#FFF7E6] text-[#b45309] px-3 py-1.5">{summary.late} late</span>
            <span className="rounded-lg bg-[#EAF3FF] text-[#1769E0] px-3 py-1.5">{summary.excused} excused</span>
          </div>
        ) : null}
      </div>

      {/* Selectors */}
      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="sa-label" htmlFor="at-class">Class <span className="req">*</span></label>
          <select id="at-class" value={classId} onChange={(e) => setClassId(e.target.value)} className="sa-select">
            <option value="" disabled>Select class…</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="sa-label" htmlFor="at-date">Date <span className="req">*</span></label>
          <input id="at-date" value={date} onChange={(e) => setDate(e.target.value)} type="date" className="sa-input" max={today} />
        </div>
        <div>
          <label className="sa-label" htmlFor="at-period">Period <span className="req">*</span></label>
          <select id="at-period" value={periodKey} onChange={(e) => setPeriodKey(e.target.value)} className="sa-select" disabled={!periodOptions.length}>
            <option value="" disabled>{periodOptions.length ? 'Select period…' : 'No lessons this day'}</option>
            {periodOptions.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      {!classId ? (
        <div className="sa-card"><EmptyState icon={ClipboardCheck} title="Choose a class" message="Select one of your classes above to mark attendance." /></div>
      ) : !periodKey ? (
        <div className="sa-card"><EmptyState icon={CalendarClock} title="Choose a period" message={periodOptions.length ? 'Select the lesson period for the chosen date.' : 'You have no scheduled lessons for this class on that day. Pick another date.'} /></div>
      ) : (
        <div className="sa-card overflow-hidden">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><Users size={16} className="text-[#1769E0]" /> {className} — {students.length} students</h3>
              <p className="sa-card-sub">{dateLabel} · {periodLabel}</p>
            </div>
            <div className="flex gap-2">
              <button type="button" className="sa-btn ghost sm" onClick={() => markAll('present')}><CheckCheck size={14} /> All present</button>
              <button type="button" className="sa-btn primary sm" disabled={saving || !students.length} onClick={save}>
                {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save attendance
              </button>
            </div>
          </div>

          {loading ? (
            <div className="p-6 space-y-2.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <div key={n} className="h-12 rounded-lg bg-[#f1f5fb] animate-pulse"></div>
              ))}
            </div>
          ) : students.length ? (
            <ul className="divide-y divide-[#f0f4fa]">
              {students.map((s) => (
                <li key={s.student_id} className="px-4 sm:px-5 py-3">
                  <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0 lg:w-72 shrink-0">
                      <span className="w-9 h-9 rounded-full bg-[#EAF3FF] text-[#1769E0] grid place-items-center text-[11px] font-bold shrink-0">{initials(s.name)}</span>
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-[#102A43] truncate">{s.name}</p>
                        <p className="text-[11px] text-[#829AB1]">{s.student_number || '—'}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={`Attendance for ${s.name}`}>
                      {statusOptions.map((opt) => {
                        const Icon = opt.icon
                        const active = records[s.student_id]?.status === opt.value
                        return (
                          <button key={opt.value} type="button" role="radio" aria-checked={active}
                            className={`att-btn ${active ? opt.on : ''}`} onClick={() => setStatus(s.student_id, opt.value)}>
                            <Icon size={13} /> {opt.label}
                          </button>
                        )
                      })}
                    </div>
                    <input value={records[s.student_id]?.notes ?? ''} onChange={(e) => setNote(s.student_id, e.target.value)} type="text" placeholder="Note (optional)"
                      className="lg:ml-auto w-full lg:w-52 rounded-lg border border-[#DCE5F0] px-3 py-1.5 text-[12.5px] focus:outline-none focus:ring-2 focus:ring-[#1769E0]/30 focus:border-[#1769E0]" />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Users} title="No students in this class" message="Ask your Director of Studies to enroll students into this class." />
          )}
        </div>
      )}
    </TcLayout>
  )
}
