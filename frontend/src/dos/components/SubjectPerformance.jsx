import { BookOpen } from 'lucide-react'
import EmptyState from '@/sa/components/EmptyState'
import { theme } from '../theme'

export default function SubjectPerformance({ dist = [], perf = [] }) {
  let series
  if (perf.length) {
    series = perf.slice(0, 5).map((d, i) => ({ name: d.name, pct: d.avgScore, color: theme.perf[i % theme.perf.length] }))
  } else {
    const max = Math.max(1, ...dist.map((d) => d.periods))
    series = dist
      .slice(0, 5)
      .map((d, i) => ({ name: d.name, pct: Math.round((d.periods / max) * 100), color: theme.perf[i % theme.perf.length] }))
  }

  return (
    <div className="bg-white rounded-2xl border border-[var(--panta-border)] shadow-[0_1px_3px_rgba(15,37,73,0.05)]">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#eef2f9]">
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--panta-text)' }}>
          Subject Performance
        </h3>
        <div className="flex items-center gap-3 text-[10.5px] font-semibold" style={{ color: 'var(--panta-muted)' }}>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--panta-teal)' }} /> Average Score
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F9D8A]" /> Pass Rate
          </span>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-[12.5px] font-semibold text-[#102A43] truncate">{s.name}</span>
            <div className="grow h-2.5 rounded-full bg-[#eef2f9] overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${s.pct}%`, background: s.color }} />
            </div>
            <span className="w-10 shrink-0 text-right text-[12.5px] font-bold tabular-nums" style={{ color: 'var(--panta-text)' }}>
              {s.pct}%
            </span>
          </div>
        ))}
        {!series.length ? (
          <EmptyState icon={BookOpen} title="No data yet" message="Subject performance appears once results are recorded." />
        ) : null}
        {series.length ? (
          <p className="text-[10.5px] pt-1" style={{ color: 'var(--panta-muted)' }}>
            {perf.length
              ? 'Average score from recorded results.'
              : 'Based on weekly scheduled periods until exam results are recorded.'}
          </p>
        ) : null}
      </div>
    </div>
  )
}
