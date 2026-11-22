import { CalendarClock, Printer } from 'lucide-react'
import StLayout from './StLayout'
import EmptyState from '@/sa/components/EmptyState'
import { useStore } from '@/stores/useStore'
import { stStore } from './stStore'
import { DAYS, SLOTS } from '@/sa/format'
import './StTimetable.css'

export default function StTimetable() {
  const store = useStore(stStore)
  const o = store.overview
  const rows = o?.week?.length ? SLOTS : []
  const cell = (si, dayName) => {
    const slot = SLOTS[si]
    return (o?.week || []).filter((e) => e.day_of_week === dayName && e.start_time === slot[0])
  }
  const printPage = () => window.print()

  return (
    <StLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">My Timetable</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>{o?.class?.class_name || 'No class assigned'} · {o?.weeklyPeriods || 0} periods per week</p>
        </div>
        <button type="button" className="sa-btn ghost" onClick={printPage}><Printer size={15} /> Print</button>
      </div>

      <div className="sa-card overflow-hidden">
        <div className="overflow-x-auto">
          {rows.length ? (
            <table className="w-full border-collapse min-w-[860px]" aria-label="My weekly timetable">
              <thead>
                <tr>
                  <th className="tt-th w-[110px]">Period</th>
                  {DAYS.map((d) => (
                    <th key={d} className="tt-th">{d}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SLOTS.map((slot, si) => (
                  <tr key={si}>
                    <td className="tt-time"><span className="font-bold text-[#102A43]">P{si + 1}</span><span className="text-[10.5px] text-[#829AB1] tabular-nums">{slot[0]}–{slot[1]}</span></td>
                    {DAYS.map((d) => (
                      <td key={d} className="tt-cell">
                        {cell(si, d).map((e) => (
                          <div key={e.timetable_id} className="rounded-lg border-l-[3px] px-2.5 py-2 mb-1 last:mb-0 bg-[#EAF3FF] border-[#1769E0]">
                            <p className="text-[12px] font-bold text-[#102A43] leading-tight">{e.module_name || '—'}</p>
                            <p className="text-[11px] text-[#627D98] leading-tight mt-0.5">{e.teacher_name}</p>
                            <p className="text-[10.5px] text-[#829AB1] leading-tight mt-0.5">{e.room_name}</p>
                          </div>
                        ))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
        {store.ready && !rows.length ? (
          <EmptyState icon={CalendarClock} title="No timetable yet"
            message="Your class timetable will appear here once the Director of Studies publishes it." />
        ) : null}
      </div>
    </StLayout>
  )
}
