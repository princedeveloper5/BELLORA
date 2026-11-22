import { GraduationCap } from 'lucide-react'
import StLayout from './StLayout'
import DataTable from '@/sa/components/DataTable'
import { useStore } from '@/stores/useStore'
import { stStore } from './stStore'

const gradeOf = (r) => {
  const p = (r.score / r.max_score) * 100
  return p >= 80 ? 'A' : p >= 65 ? 'B' : p >= 50 ? 'C' : p >= 35 ? 'D' : 'F'
}
const gradeClass = (g) => ({ A: 'bg-[#18B981] text-white', B: 'bg-[#1769E0] text-white', C: 'bg-[#F59E0B] text-white', D: 'bg-[#F59E0B] text-white', F: 'bg-[#EF4444] text-white' }[g] || 'bg-[#627D98] text-white')

const columns = [
  { key: 'module_name', label: 'Subject', sortable: true, render: (row) => <span className="font-semibold text-[#102A43]">{row.module_name}</span> },
  { key: 'assessment', label: 'Assessment', sortable: true },
  { key: 'score', label: 'Score', sortable: true, render: (row) => <span className="tabular-nums font-semibold">{row.score}/{row.max_score}</span> },
  { key: 'pct', label: '%', sortable: false, render: (row) => <span className="tabular-nums">{Math.round((row.score / row.max_score) * 100)}%</span> },
  {
    key: 'grade',
    label: 'Grade',
    sortable: true,
    render: (row) => (
      <span className={`inline-flex rounded-full px-2.5 py-[2px] text-[11px] font-extrabold ${gradeClass(gradeOf(row))}`}>{gradeOf(row)}</span>
    )
  },
  { key: 'term', label: 'Term', sortable: true }
]

const avgClass = 'text-[#1769E0]'

export default function StResults() {
  const store = useStore(stStore)
  const o = store.overview

  const overallAvg = (() => {
    const rs = o?.results || []
    if (!rs.length) return '—'
    const avg = rs.reduce((a, r) => a + (r.score / r.max_score) * 100, 0) / rs.length
    return `${Math.round(avg)}%`
  })()

  return (
    <StLayout>
      <div className="mb-5">
        <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Academic Results</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
          Overall average: <strong className={avgClass}>{overallAvg}</strong>
        </p>
      </div>

      <DataTable columns={columns} rows={o?.results || []} loading={!store.ready} itemLabel="results"
        defaultSort="updated_at" defaultSortDir={-1} rowKey="assessment"
        emptyIcon={GraduationCap} emptyTitle="No results yet" emptyMessage="Your grades will appear here once teachers publish assessment scores." />
    </StLayout>
  )
}
