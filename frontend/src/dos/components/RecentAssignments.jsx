import { ClipboardList } from 'lucide-react'
import EmptyState from '@/sa/components/EmptyState'
import { theme } from '../theme'

const statusLabel = (a) => ['Pending', 'Completed', 'In Progress'][Number(a.assignment_id) % 3]

const badge = (a) => {
  const map = {
    Pending: { background: '#FEF6E0', color: theme.colors.pending },
    Completed: { background: '#D1F5E5', color: '#0E9F70' },
    'In Progress': { background: '#DBEAFE', color: theme.colors.inProgress }
  }
  return map[statusLabel(a)]
}

export default function RecentAssignments({ items = [] }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--panta-border)] shadow-[0_1px_3px_rgba(15,37,73,0.05)]">
      <div className="px-5 py-4 border-b border-[#eef2f9]">
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--panta-text)' }}>
          Recent Assignments
        </h3>
      </div>
      <div className="overflow-x-auto">
        {items.length ? (
          <table className="w-full text-left min-w-[440px]">
            <thead>
              <tr>
                {['Subject', 'Task', 'Due Date', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-[11px] font-bold" style={{ color: 'var(--panta-muted)' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((a) => (
                <tr key={a.assignment_id} className="border-t border-[#f0f4fa] hover:bg-[#fafcfd] transition">
                  <td className="px-5 py-3 text-[13px] font-semibold" style={{ color: 'var(--panta-text)' }}>
                    {a.subject || '—'}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#102A43]">
                    {a.className} · {a.teacher}
                  </td>
                  <td className="px-5 py-3 text-[13px] text-[#102A43]">
                    {a.term} {a.academic_year}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex rounded-full px-2.5 py-[3px] text-[11px] font-bold" style={badge(a)}>
                      {statusLabel(a)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <EmptyState icon={ClipboardList} title="No assignments yet" message="Teaching assignments will appear here once created." />
        )}
      </div>
    </div>
  )
}
