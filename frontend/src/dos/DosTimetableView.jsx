import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Send, Printer, CalendarClock, Trash2, LoaderCircle, FileDown, CalendarPlus } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import StatusBadge from '@/sa/components/StatusBadge'
import EmptyState from '@/sa/components/EmptyState'
import Modal from '@/sa/components/Modal'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { DAYS, SLOTS, downloadIcs } from '@/sa/format'
import './DosTimetableView.css'

export default function DosTimetableView() {
  const params = useParams()
  const navigate = useNavigate()
  const store = useStore(dosStore)

  const [classFilter, setClassFilter] = useState('')
  const [teacherFilter, setTeacherFilter] = useState('')
  const [roomFilter, setRoomFilter] = useState('')

  const [year, term] = decodeURIComponent(String(params.id || '')).split('|')
  const group =
    store.groups.find((g) => g.academic_year === year && g.term === term) || (year ? { academic_year: year, term, status: 'draft' } : null)

  useEffect(() => {
    if (!group) return
    ;(async () => {
      try {
        await dosActions.loadEntries(group)
      } catch (e) {
        dosActions.apiError(e)
      }
    })()
  }, [group?.academic_year, group?.term])

  const visibleEntries = store.entries.filter(
    (e) =>
      (!classFilter || e.class_name === classFilter) && (!teacherFilter || e.teacher_name === teacherFilter) && (!roomFilter || e.room_name === roomFilter)
  )

  const classOptions = [...new Set(store.entries.map((e) => e.class_name).filter(Boolean))].sort()
  const teacherOptions = [...new Set(store.entries.map((e) => e.teacher_name).filter(Boolean))].sort()
  const roomOptions = [...new Set(store.entries.map((e) => e.room_name).filter(Boolean))].sort()

  const cellEntries = (slotIdx, dayName) => {
    const slot = SLOTS[slotIdx]
    return visibleEntries.filter((e) => e.day_of_week === dayName && e.start_time === slot[0])
  }

  const conflictedIds = new Set(store.conflicts.flatMap((c) => c.entryIds))
  const isConflicted = (e) => conflictedIds.has(e.timetable_id)

  async function publish() {
    try {
      await dosActions.setGroupStatus(group, 'published')
      dosActions.success('Timetable published.', 'Published')
    } catch (e) {
      dosActions.apiError(e)
    }
  }
  function printGrid() {
    window.print()
  }

  function exportIcs() {
    if (!visibleEntries.length) {
      dosActions.error('Nothing to export in the current view.', 'Empty timetable')
      return
    }
    downloadIcs(`timetable-${group?.term}.ics`.replace(/\s+/g, '-').toLowerCase(), visibleEntries, `Timetable ${group?.term} ${group?.academic_year}`)
    dosActions.success('Calendar file downloaded — import it into Google Calendar or Outlook.', 'iCal export')
  }

  // Clean PDF export of the weekly grid (jsPDF + autotable).
  async function exportPdf() {
    try {
      const { jsPDF } = await import('jspdf')
      const { default: autoTable } = await import('jspdf-autotable')
      const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const logoUrl = store.overview?.schoolLogo
      if (logoUrl) {
        try {
          const resolved = logoUrl.startsWith('http') || logoUrl.startsWith('data:') ? logoUrl : `${(import.meta.env.VITE_API_URL || '').replace(/\/api\/?$/, '')}${logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`}`
          const res = await fetch(resolved)
          const blob = await res.blob()
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result || ''))
            reader.onerror = reject
            reader.readAsDataURL(blob)
          })
          const fmt = String(dataUrl).includes('image/jpeg') ? 'JPEG' : 'PNG'
          doc.addImage(dataUrl, fmt, 40, 24, 36, 36)
        } catch { /* ignore logo */ }
      }
      doc.setFontSize(16)
      doc.text(`BELLORA — Weekly Timetable`, logoUrl ? 84 : 40, 40)
      doc.setFontSize(11)
      doc.setTextColor(98, 125, 152)
      doc.text(`${group?.term} · ${group?.academic_year} · ${group?.status?.toUpperCase()} · ${visibleEntries.length} periods`, logoUrl ? 84 : 40, 58)

      const body = SLOTS.map((slot, si) => [
        `P${si + 1}  ${slot[0]}–${slot[1]}`,
        ...DAYS.map((day) =>
          cellEntries(si, day)
            .map((e) => `${e.module_name || ''}\n${e.class_name || ''} · ${e.teacher_name || ''}\n${e.room_name || ''}`)
            .join('\n\n')
        )
      ])
      autoTable(doc, {
        startY: 72,
        head: [['Period', ...DAYS]],
        body,
        styles: { fontSize: 8, cellPadding: 6, valign: 'top' },
        headStyles: { fillColor: [11, 42, 74], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 248, 252] },
        columnStyles: { 0: { cellWidth: 90, fontStyle: 'bold' } }
      })
      doc.save(`timetable-${group?.term}-${group?.academic_year}.pdf`.replace(/[\s/]+/g, '-').toLowerCase())
      dosActions.success('Timetable exported as PDF.', 'Export complete')
    } catch (e) {
      dosActions.error('PDF export failed. Please try Print instead.', 'Export failed')
    }
  }

  // ---- Manual override (draft entries only, validated server-side) -------------
  const [moveTarget, setMoveTarget] = useState(null)
  const [moveForm, setMoveForm] = useState({ day: 'Monday', slot: 0 })
  const [moveError, setMoveError] = useState('')
  const [moving, setMoving] = useState(false)

  function openMove(e) {
    setMoveTarget(e)
    setMoveForm({ day: e.day_of_week, slot: Math.max(0, SLOTS.findIndex((s) => s[0] === e.start_time)) })
    setMoveError('')
  }

  async function doMove() {
    setMoving(true)
    setMoveError('')
    try {
      const [start, end] = SLOTS[moveForm.slot]
      await dosActions.moveEntry(moveTarget.timetable_id, {
        day_of_week: moveForm.day,
        start_time: start,
        end_time: end
      })
      dosActions.success('Lesson moved.', 'Moved')
      setMoveTarget(null)
      await dosActions.loadEntries(group)
      await dosActions.refreshConflicts()
    } catch (e) {
      setMoveError(e?.response?.data?.message || 'Could not move this lesson.')
    } finally {
      setMoving(false)
    }
  }

  async function deleteEntry() {
    setMoving(true)
    try {
      await dosActions.deleteEntry(moveTarget.timetable_id)
      dosActions.success('Lesson deleted.', 'Deleted')
      setMoveTarget(null)
      await dosActions.loadEntries(group)
      await dosActions.refreshConflicts()
    } catch (e) {
      setMoveError(e?.response?.data?.message || 'Could not delete this lesson.')
    } finally {
      setMoving(false)
    }
  }

  // ---- Drag & drop editing (client pre-validation + server validation) ---------
  const [draggingId, setDraggingId] = useState(null)
  const [draggingEntry, setDraggingEntry] = useState(null)
  const [dropTarget, setDropTarget] = useState(null)
  const [dropValid, setDropValid] = useState(true)

  function onDragStart(e, ev) {
    setDraggingId(e.timetable_id)
    setDraggingEntry(e)
    ev.dataTransfer.effectAllowed = 'move'
    ev.dataTransfer.setData('text/plain', String(e.timetable_id))
  }

  // Busy sets excluding the dragged lesson — same rules as the server.
  const busySets = (() => {
    const t = new Set(),
      c = new Set(),
      r = new Set()
    const dragged = draggingEntry
    store.entries.forEach((e) => {
      if (dragged && e.timetable_id === dragged.timetable_id) return
      const key = `${e.day_of_week}|${e.start_time}`
      if (dragged) {
        if (e.teacher_id === dragged.teacher_id) t.add(key)
        if (e.class_id === dragged.class_id) c.add(key)
        if (e.room_id === dragged.room_id) r.add(key)
      }
    })
    return { teacher: t, cls: c, room: r }
  })()

  function slotValid(day, si) {
    if (!draggingEntry) return false
    const key = `${day}|${SLOTS[si][0]}`
    return !busySets.teacher.has(key) && !busySets.cls.has(key) && !busySets.room.has(key)
  }

  function onDragOver(day, si) {
    setDropTarget(`${day}|${si}`)
    setDropValid(slotValid(day, si))
  }

  async function onDrop(day, si) {
    const entry = draggingEntry
    setDropTarget(null)
    setDraggingId(null)
    if (!entry) return
    const [start, end] = SLOTS[si]
    if (entry.day_of_week === day && entry.start_time === start) {
      setDraggingEntry(null)
      return
    }
    if (!slotValid(day, si)) {
      dosActions.error('Cannot move there — the teacher, class or room is already occupied in that slot.', 'Invalid move')
      setDraggingEntry(null)
      return
    }
    setDraggingEntry(null)
    try {
      await dosActions.moveEntry(entry.timetable_id, { day_of_week: day, start_time: start, end_time: end })
      dosActions.success(`${entry.module_name} moved to ${day} ${start}.`, 'Lesson moved')
      await dosActions.loadEntries(group)
      await dosActions.refreshConflicts()
    } catch (e) {
      dosActions.apiError(e, 'Move rejected by the server')
      await dosActions.loadEntries(group)
    }
  }

  return (
    <DashboardLayout>
      <div className="sa-card p-5 mb-4 flex flex-col lg:flex-row lg:items-center gap-4">
        <button
          type="button"
          className="sa-icon-btn !w-9 !h-9 border border-[#DCE5F0] shrink-0"
          aria-label="Back"
          onClick={() => navigate('/dos/timetables')}
        >
          <ArrowLeft size={17} />
        </button>
        <div className="min-w-0 grow">
          <h2 className="text-[18px] sm:text-[20px] font-extrabold tracking-tight">
            {group?.term || 'Timetable'} · {group?.academic_year}
          </h2>
          <p className="text-[12.5px] text-[#627D98] mt-0.5">
            {group ? <StatusBadge status={group.status} /> : null} · {store.entries.length} periods
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {group?.status === 'draft' ? (
            <button type="button" className="sa-btn primary sm !bg-[#18B981]" onClick={publish}>
              <Send size={14} /> Publish
            </button>
          ) : null}
          <button type="button" className="sa-btn ghost sm" onClick={exportPdf}>
            <FileDown size={14} /> PDF
          </button>
          <button type="button" className="sa-btn ghost sm" onClick={exportIcs}>
            <CalendarPlus size={14} /> iCal
          </button>
          <button type="button" className="sa-btn ghost sm" onClick={printGrid}>
            <Printer size={14} /> Print
          </button>
        </div>
      </div>

      <div className="sa-card p-4 mb-4 flex flex-col sm:flex-row gap-3">
        <select
          value={classFilter}
          onChange={(event) => setClassFilter(event.target.value)}
          className="sa-select sm:w-52"
          aria-label="Filter by class"
        >
          <option value="">All classes</option>
          {classOptions.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={teacherFilter}
          onChange={(event) => setTeacherFilter(event.target.value)}
          className="sa-select sm:w-56"
          aria-label="Filter by teacher"
        >
          <option value="">All teachers</option>
          {teacherOptions.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={roomFilter}
          onChange={(event) => setRoomFilter(event.target.value)}
          className="sa-select sm:w-48"
          aria-label="Filter by room"
        >
          <option value="">All rooms</option>
          {roomOptions.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="sa-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[860px]" role="grid" aria-label="Timetable grid">
            <thead>
              <tr>
                <th className="tt-th w-[110px]">Period</th>
                {DAYS.map((d) => (
                  <th key={d} className="tt-th">
                    {d}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {SLOTS.map((slot, si) => (
                <tr key={si}>
                  <td className="tt-time">
                    <span className="font-bold text-[#102A43]">P{si + 1}</span>
                    <span className="text-[10.5px] text-[#829AB1] tabular-nums">
                      {slot[0]}–{slot[1]}
                    </span>
                  </td>
                  {DAYS.map((d) => (
                    <td
                      key={d}
                      className={`tt-cell ${
                        dropTarget === d + '|' + si
                          ? dropValid
                            ? 'bg-[#E7F5F2] ring-2 ring-inset ring-[#18B981]'
                            : 'bg-[#FEECEC] ring-2 ring-inset ring-[#EF4444]'
                          : ''
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault()
                        if (group?.status !== 'published') onDragOver(d, si)
                      }}
                      onDragLeave={() => {
                        if (dropTarget === d + '|' + si) setDropTarget(null)
                      }}
                      onDrop={(event) => {
                        event.preventDefault()
                        onDrop(d, si)
                      }}
                    >
                      {cellEntries(si, d).map((e) => (
                        <div
                          key={e.timetable_id}
                          className={`rounded-lg border-l-[3px] px-2.5 py-2 mb-1 last:mb-0 group/cell relative ${
                            isConflicted(e) ? 'bg-[#FEECEC] border-[#ef4444]' : 'bg-[#E7F5F2] border-[#18B981]'
                          } ${group?.status !== 'published' ? 'cursor-grab hover:ring-2 hover:ring-[#0F9D8A]/40' : ''} ${
                            draggingId === e.timetable_id ? 'opacity-40' : ''
                          }`}
                          title={group?.status !== 'published' ? 'Drag to move, or click to edit' : ''}
                          draggable={group?.status !== 'published'}
                          onDragStart={(event) => onDragStart(e, event)}
                          onDragEnd={() => {
                            setDraggingId(null)
                            setDropTarget(null)
                          }}
                          onClick={() => {
                            if (group?.status !== 'published') openMove(e)
                          }}
                        >
                          <p className="text-[12px] font-bold text-[#102A43] leading-tight">{e.module_name || '—'}</p>
                          <p className="text-[11px] text-[#627D98] leading-tight mt-0.5">
                            {e.class_name} · {e.teacher_name}
                          </p>
                          <p className="text-[10.5px] text-[#829AB1] leading-tight mt-0.5">{e.room_name}</p>
                        </div>
                      ))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {store.ready && !visibleEntries.length ? (
          <EmptyState icon={CalendarClock} title="Nothing scheduled" message="No periods match the selected filters." />
        ) : null}
      </div>

      {/* Move / delete lesson (manual override, conflict-validated server-side) */}
      <Modal
        open={!!moveTarget}
        title="Move Lesson"
        subtitle={`${moveTarget?.module_name} · ${moveTarget?.class_name} · ${moveTarget?.teacher_name}`}
        onClose={() => setMoveTarget(null)}
        footer={
          <>
            <button
              type="button"
              className="sa-btn ghost !text-[#EF4444] !border-[#f3caca] mr-auto"
              onClick={deleteEntry}
            >
              <Trash2 size={14} /> Delete lesson
            </button>
            <button type="button" className="sa-btn ghost" onClick={() => setMoveTarget(null)}>
              Cancel
            </button>
            <button type="button" className="sa-btn primary panta-primary-btn" disabled={moving} onClick={doMove}>
              {moving ? <LoaderCircle size={15} className="animate-spin" /> : null} Move lesson
            </button>
          </>
        }
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="sa-label" htmlFor="mv-day">
              Day
            </label>
            <select
              id="mv-day"
              value={moveForm.day}
              onChange={(event) => setMoveForm((prev) => ({ ...prev, day: event.target.value }))}
              className="sa-select"
            >
              {DAYS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="sa-label" htmlFor="mv-slot">
              Period
            </label>
            <select
              id="mv-slot"
              value={moveForm.slot}
              onChange={(event) => setMoveForm((prev) => ({ ...prev, slot: Number(event.target.value) }))}
              className="sa-select"
            >
              {SLOTS.map((s, i) => (
                <option key={i} value={i}>
                  P{i + 1} · {s[0]}–{s[1]}
                </option>
              ))}
            </select>
          </div>
        </div>
        {moveError ? <p className="sa-err mt-3">{moveError}</p> : null}
      </Modal>
    </DashboardLayout>
  )
}
