import StLayout from './StLayout'
import StatusBadge from '@/sa/components/StatusBadge'
import { useStore } from '@/stores/useStore'
import { stStore } from './stStore'
import { initials } from '@/sa/format'

export default function StProfile() {
  const store = useStore(stStore)
  const o = store.overview

  return (
    <StLayout>
      <div className="max-w-2xl">
        <div className="mb-5">
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">My Profile</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>Your student account details.</p>
        </div>
        <div className="sa-card p-5 sm:p-6">
          <div className="flex items-center gap-4 pb-5 border-b border-[#eef2f9] mb-5">
            <span className="w-16 h-16 rounded-2xl grid place-items-center text-[22px] font-extrabold text-white" style={{ background: 'linear-gradient(135deg, #1769E0, #0B2A4A)' }}>{initials(o?.student?.name || 'S')}</span>
            <div>
              <h3 className="text-[17px] font-bold">{o?.student?.name}</h3>
              <p className="text-[13px]" style={{ color: 'var(--panta-muted)' }}>{o?.student?.email}</p>
              <StatusBadge status={o?.student?.status || 'active'} />
            </div>
          </div>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-[13.5px]">
            <div><dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>Student ID</dt><dd className="mt-1 font-semibold">{o?.student?.studentNumber || '—'}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>Class</dt><dd className="mt-1 font-semibold">{o?.class?.class_name || 'Unassigned'}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>Level</dt><dd className="mt-1 font-semibold">{o?.class?.level || '—'}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>Class Teacher</dt><dd className="mt-1 font-semibold">{o?.class?.class_teacher || '—'}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>Academic Year</dt><dd className="mt-1 font-semibold">{o?.class?.academic_year || '—'}</dd></div>
            <div><dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>Gender</dt><dd className="mt-1 font-semibold">{o?.student?.sex || '—'}</dd></div>
          </dl>
        </div>
      </div>
    </StLayout>
  )
}
