import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UserRound, DoorOpen, Users, Eye, CircleCheck, TriangleAlert, Wand2, LoaderCircle } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import EmptyState from '@/sa/components/EmptyState'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { DAYS } from '@/sa/format'

const TONES = {
  teacher: { bg: 'bg-[#FEECEC] text-[#B91C1C]', icon: UserRound },
  room: { bg: 'bg-[#FFF7E6] text-[#b45309]', icon: DoorOpen },
  class: { bg: 'bg-[#E7F5F2] text-[#0F9D8A]', icon: Users }
}

export default function DosConflicts() {
  const navigate = useNavigate()
  const store = useStore(dosStore)
  const [resolving, setResolving] = useState('')
  const [resolvingAll, setResolvingAll] = useState(false)
  const [resolved, setResolved] = useState({})

  const tone = (t) => TONES[t] || { bg: 'bg-[#eef2f9]', icon: TriangleAlert }

  function view(c) {
    const published = store.groups.find((g) => g.status === 'published') || store.groups[0]
    if (published) navigate(`/dos/timetables/${encodeURIComponent(`${published.academic_year}|${published.term}`)}`)
  }

  async function autoResolve(c) {
    setResolving(c.key)
    try {
      const result = await dosActions.autoResolveConflict(c)
      if (result.resolved) {
        setResolved((prev) => ({ ...prev, [c.key]: `${result.slot.day_of_week} ${result.slot.start_time}` }))
        dosActions.success(`Conflict resolved — lesson moved to ${result.slot.day_of_week} ${result.slot.start_time}.`, 'Resolved')
      } else {
        dosActions.error(result.reason || 'No free slot found for this lesson.', 'Cannot auto-resolve')
      }
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setResolving('')
    }
  }

  async function resolveAll() {
    setResolvingAll(true)
    let done = 0,
      failed = 0
    for (const c of [...store.conflicts]) {
      try {
        const result = await dosActions.autoResolveConflict(c)
        result.resolved ? done++ : failed++
      } catch {
        failed++
      }
    }
    setResolvingAll(false)
    if (done)
      dosActions.success(
        `${done} conflict${done === 1 ? '' : 's'} resolved automatically.${failed ? ` ${failed} need manual attention.` : ''}`,
        'Auto-resolve complete'
      )
    else dosActions.error('No conflicts could be resolved automatically. Try regenerating the timetable.', 'Auto-resolve')
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Timetable Conflicts</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            Scheduling clashes detected in your school's published timetable.
          </p>
        </div>
        {store.conflicts.length ? (
          <button type="button" className="sa-btn primary panta-primary-btn" disabled={resolvingAll} onClick={resolveAll}>
            {resolvingAll ? <LoaderCircle size={15} className="animate-spin" /> : <Wand2 size={15} />}
            Auto-resolve all
          </button>
        ) : null}
      </div>

      {store.conflicts.length ? (
        <div className="space-y-3">
          {store.conflicts.map((c) => {
            const t = tone(c.type)
            const ToneIcon = t.icon
            return (
              <article key={c.key} className="sa-card p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center gap-4">
                <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 ${t.bg}`}>
                  <ToneIcon size={20} />
                </span>
                <div className="min-w-0 grow">
                  <h3 className="text-[15px] font-bold text-[#0f2549]">{c.title}</h3>
                  <p className="text-[13px] text-[#52657f] mt-1">{c.detail}</p>
                  <p className="text-[12px] text-[#8aa0bf] mt-1.5">
                    {DAYS[c.day]} · {c.start}–{c.end}
                  </p>
                  {resolved[c.key] ? (
                    <p className="text-[12px] font-semibold text-[#0B7F70] mt-1.5 inline-flex items-center gap-1.5">
                      <CircleCheck size={13} /> Moved to {resolved[c.key]}
                    </p>
                  ) : null}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button type="button" className="sa-btn ghost sm" onClick={() => view(c)}>
                    <Eye size={14} /> View in grid
                  </button>
                  <button
                    type="button"
                    className="sa-btn primary sm panta-primary-btn"
                    disabled={resolving === c.key}
                    onClick={() => autoResolve(c)}
                  >
                    {resolving === c.key ? <LoaderCircle size={14} className="animate-spin" /> : <Wand2 size={14} />} Auto-resolve
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="sa-card">
          <EmptyState icon={CircleCheck} title="No conflicts" message="Your published timetable is conflict-free. Great job!" />
        </div>
      )}
    </DashboardLayout>
  )
}
