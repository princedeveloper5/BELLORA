import { ClipboardCheck } from 'lucide-react'
import StLayout from './StLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import { useStore } from '@/stores/useStore'
import { stStore } from './stStore'
import { fmtDate } from '@/sa/format'

const columns = [
  { key: 'attendance_date', label: 'Date', sortable: true },
  { key: 'period_label', label: 'Period', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'notes', label: 'Notes' }
]

export default function StAttendance() {
  const store = useStore(stStore)
  const o = store.overview

  return (
    <StLayout>
      <div className="mb-5">
        <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">My Attendance</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
          Overall rate: <strong className={(o?.attendance?.rate ?? 100) >= 85 ? 'text-[#0E9F70]' : (o?.attendance?.rate ?? 0) >= 70 ? 'text-[#b45309]' : 'text-[#B91C1C]'}>{o?.attendance?.rate != null ? o.attendance.rate + '%' : '—'}</strong>
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <div className="sa-card px-4 py-3 text-center"><p className="text-[20px] font-extrabold text-[#0E9F70] tabular-nums">{o?.attendance?.present || 0}</p><p className="text-[11px] font-bold uppercase" style={{ color: 'var(--panta-muted)' }}>Present</p></div>
        <div className="sa-card px-4 py-3 text-center"><p className="text-[20px] font-extrabold text-[#B91C1C] tabular-nums">{o?.attendance?.absent || 0}</p><p className="text-[11px] font-bold uppercase" style={{ color: 'var(--panta-muted)' }}>Absent</p></div>
        <div className="sa-card px-4 py-3 text-center"><p className="text-[20px] font-extrabold text-[#b45309] tabular-nums">{o?.attendance?.late || 0}</p><p className="text-[11px] font-bold uppercase" style={{ color: 'var(--panta-muted)' }}>Late</p></div>
        <div className="sa-card px-4 py-3 text-center"><p className="text-[20px] font-extrabold text-[#1769E0] tabular-nums">{o?.attendance?.excused || 0}</p><p className="text-[11px] font-bold uppercase" style={{ color: 'var(--panta-muted)' }}>Excused</p></div>
      </div>

      <DataTable columns={[
        { ...columns[0], render: (row) => fmtDate(row.attendance_date) },
        columns[1],
        { ...columns[2], render: (row) => <StatusBadge status={row.status} /> },
        { ...columns[3], render: (row) => <span style={{ color: 'var(--panta-muted)' }}>{row.notes || '—'}</span> }
      ]} rows={o?.attendance?.recent || []} loading={!store.ready} itemLabel="records"
        defaultSort="attendance_date" defaultSortDir={-1} rowKey="attendance_date"
        emptyIcon={ClipboardCheck} emptyTitle="No attendance records yet" emptyMessage="Your attendance history will appear here after your teachers mark registers." />
    </StLayout>
  )
}
