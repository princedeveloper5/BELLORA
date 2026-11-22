import { Briefcase, BookOpen, Download } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import EmptyState from '@/sa/components/EmptyState'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { downloadCsv } from '@/sa/format'

export default function DosReports() {
  const store = useStore(dosStore)
  const workload = store.overview?.workload || []
  const subjectDist = store.overview?.subjectDist || []
  const maxPeriods = Math.max(1, ...workload.map((w) => w.periods))
  const maxSubject = Math.max(1, ...subjectDist.map((s) => s.periods))

  function exportCsv() {
    downloadCsv('teacher-workload.csv', [{ label: 'Teacher', value: 'name' }, { label: 'Periods per week', value: 'periods' }], workload)
    dosActions.success('Workload exported to CSV.', 'Export complete')
  }

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Academic Reports</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">Workload and coverage reports for your school.</p>
        </div>
        <button type="button" className="sa-btn ghost" onClick={exportCsv}>
          <Download size={15} /> Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div className="sa-card">
          <div className="sa-card-head">
            <h3 className="sa-card-title">
              <Briefcase size={16} className="text-[#18B981]" /> Teacher Workload
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {workload.map((w) => (
              <div key={w.name}>
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span className="font-semibold text-[#102A43]">{w.name}</span>
                  <span className={`font-bold tabular-nums ${w.periods > 24 ? 'text-[#c62525]' : 'text-[#102A43]'}`}>{w.periods} / week</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#eef2f9] overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: Math.min(100, (w.periods / maxPeriods) * 100) + '%', background: w.periods > 24 ? '#ef4444' : '#18B981' }}
                  />
                </div>
              </div>
            ))}
            {!workload.length ? (
              <EmptyState icon={Briefcase} title="No workload data" message="Publish a timetable to compute teacher workload." />
            ) : null}
          </div>
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <h3 className="sa-card-title">
              <BookOpen size={16} className="text-[#18B981]" /> Subject Coverage
            </h3>
          </div>
          <div className="p-5 space-y-4">
            {subjectDist.map((s) => (
              <div key={s.name}>
                <div className="flex justify-between text-[12.5px] mb-1.5">
                  <span className="font-semibold text-[#102A43]">{s.name}</span>
                  <span className="font-bold text-[#102A43] tabular-nums">{s.periods} periods</span>
                </div>
                <div className="h-2.5 rounded-full bg-[#eef2f9] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#0F9D8A]"
                    style={{ width: Math.min(100, (s.periods / maxSubject) * 100) + '%' }}
                  />
                </div>
              </div>
            ))}
            {!subjectDist.length ? (
              <EmptyState icon={BookOpen} title="No coverage data" message="Publish a timetable to compute subject coverage." />
            ) : null}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
