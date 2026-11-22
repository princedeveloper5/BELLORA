import { CalendarClock } from 'lucide-react'
import EmptyState from '@/sa/components/EmptyState'
import { DAYS } from '@/sa/format'
import { chipFor as chip } from '../theme'

export default function TimetableOverview({ entries = [], onViewAll, onGenerate, onEntryClick }) {
  const published = entries.filter((w) => w.status === 'published')
  const rows = [...new Set(published.map((w) => w.start_time))].sort().slice(0, 5)
  const map = {}
  published.forEach((w) => {
    if (rows.includes(w.start_time)) map[`${w.day_of_week}|${w.start_time}`] = w
  })

  return (
    <div className="bg-white rounded-2xl border border-[var(--panta-border)] shadow-[0_1px_3px_rgba(15,37,73,0.05)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef2f9]">
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--panta-text)' }}>
          Timetable Overview
        </h3>
        <button
          type="button"
          className="text-[12px] font-semibold hover:underline"
          style={{ color: 'var(--panta-teal)' }}
          onClick={onViewAll}
        >
          View Full Timetable →
        </button>
      </div>
      <div className="p-4 overflow-x-auto">
        {rows.length ? (
          <table className="w-full border-collapse min-w-[480px]" aria-label="Weekly timetable overview">
            <thead>
              <tr>
                <th className="w-[86px] pb-2"></th>
                {DAYS.map((d) => (
                  <th key={d} className="pb-2 text-center text-[11px] font-bold" style={{ color: 'var(--panta-muted)' }}>
                    {d.slice(0, 3)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row}>
                  <td className="py-1 pr-2 text-[10.5px] tabular-nums whitespace-nowrap" style={{ color: 'var(--panta-muted)' }}>
                    {row}
                  </td>
                  {DAYS.map((d) => {
                    const entry = map[`${d}|${row}`]
                    return (
                      <td key={d} className="py-1 px-0.5 text-center">
                        {entry ? (
                          <button
                            type="button"
                            className="inline-block rounded-md px-2.5 py-1.5 text-[11px] font-bold w-full truncate hover:ring-2 hover:ring-[#0F9D8A]/40 transition"
                            style={{ background: chip(entry.module_name).bg, color: chip(entry.module_name).text }}
                            title={`${entry.module_name} · ${entry.class_name} · ${entry.teacher_name}`}
                            onClick={() => onEntryClick?.(entry)}
                          >
                            {entry.module_name}
                          </button>
                        ) : null}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={CalendarClock} title="No timetable yet" message="Generate your first timetable to see the weekly overview.">
            <button type="button" className="sa-btn primary sm panta-primary-btn" onClick={onGenerate}>
              Generate Timetable
            </button>
          </EmptyState>
        )}
      </div>
    </div>
  )
}
