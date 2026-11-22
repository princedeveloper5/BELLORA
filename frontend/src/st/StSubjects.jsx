import { BookOpen } from 'lucide-react'
import StLayout from './StLayout'
import EmptyState from '@/sa/components/EmptyState'
import { useStore } from '@/stores/useStore'
import { stStore } from './stStore'

const code = (name = '') => name.split(/\s+/).map((w) => w[0]).join('').slice(0, 4).toUpperCase() || '—'

export default function StSubjects() {
  const store = useStore(stStore)
  const o = store.overview

  return (
    <StLayout>
      <div className="mb-5">
        <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">My Subjects</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>{o?.subjects?.length || 0} subjects this year</p>
      </div>
      {o?.subjects?.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {o.subjects.map((s, index) => (
            <div key={`${s.module_id}-${s.teacher_name || ''}-${index}`} className="sa-card p-4 flex items-center gap-3.5">
              <span className="w-11 h-11 rounded-xl grid place-items-center text-[12px] font-extrabold shrink-0 bg-[#E7F5F2] text-[#0B7F70]">{code(s.module_name)}</span>
              <div className="min-w-0">
                <p className="text-[14px] font-bold text-[#102A43] truncate">{s.module_name}</p>
                <p className="text-[12px]" style={{ color: 'var(--panta-muted)' }}>
                  {s.teacher_name || 'Teacher not assigned'}
                  {s.department ? ` · ${s.department}` : ''}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="sa-card"><EmptyState icon={BookOpen} title="No subjects yet" message="Subjects appear once teachers are assigned to your class." /></div>
      )}
    </StLayout>
  )
}
