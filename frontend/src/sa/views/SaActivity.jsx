import { useState } from 'react'
import { Search, Download, ScrollText } from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import { saStore, saActions } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtDateTime, timeAgo, initials, downloadCsv } from '@/sa/format'

const columns = [
  { key: 'actor', label: 'Performed By', sortable: true },
  { key: 'action', label: 'Action', sortable: true },
  { key: 'entityName', label: 'Entity Affected', sortable: true },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'createdAt', label: 'Date & Time', sortable: true }
]

const roleLabel = (r) => ({ super_admin: 'Super Admin', admin: 'School Admin', dos: 'Director of Studies', system: 'System' }[r] || r)
const roleTone = (r) => ({ super_admin: 'bg-[#0B2A4A] text-white', admin: 'bg-[#FFF7E6] text-[#b07409]', dos: 'bg-[#F0EEFF] text-[#6D5CE7]', system: 'bg-[#eef2f9] text-[#627D98]' }[r] || 'bg-[#eef2f9] text-[#627D98]')
const roleText = (r) => ({ super_admin: 'text-[#1769E0]', admin: 'text-[#b07409]', dos: 'text-[#6D5CE7]', system: 'text-[#829AB1]' }[r] || 'text-[#829AB1]')

export default function SaActivity() {
  const store = useStore(saStore)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')

  const filtered = (() => {
    const q = search.toLowerCase()
    return store.activities.filter((a) => {
      if (roleFilter && a.actorRole !== roleFilter) return false
      if (q && ![a.actor, a.action, a.entityName].some((v) => String(v).toLowerCase().includes(q))) return false
      return true
    })
  })()

  function exportLog() {
    downloadCsv('activity-log.csv',
      [
        { label: 'Actor', value: 'actor' }, { label: 'Role', value: (r) => roleLabel(r.actorRole) },
        { label: 'Action', value: 'action' }, { label: 'Entity', value: 'entityName' },
        { label: 'Status', value: 'status' }, { label: 'Date', value: (r) => fmtDateTime(r.createdAt) }
      ], filtered)
    saActions.success(`${filtered.length} events exported.`, 'Export complete')
  }

  return (
    <SaLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Activity Logs</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">Complete audit trail of every administrative action on the platform.</p>
        </div>
        <button type="button" className="sa-btn ghost" onClick={exportLog}><Download size={15} /> Export log</button>
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829AB1]" />
          <input value={search} onChange={(e) => setSearch(e.target.value.trim())} type="search" className="sa-input !pl-9" placeholder="Search actions, actors or entities…" aria-label="Search activity" />
        </div>
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="sa-select" aria-label="Filter by actor role">
          <option value="">All actors</option>
          <option value="super_admin">Super Admin</option>
          <option value="admin">School Admin</option>
          <option value="dos">Director of Studies</option>
          <option value="system">System</option>
        </select>
      </div>

      <DataTable columns={[
        { ...columns[0], render: (row) => (
          <div className="flex items-center gap-2.5">
            <span className={`w-8 h-8 rounded-full grid place-items-center text-[10.5px] font-bold shrink-0 ${roleTone(row.actorRole)}`}>{initials(row.actor)}</span>
            <div className="min-w-0">
              <p className="font-semibold text-[#102A43] truncate">{row.actor}</p>
              <p className={`text-[10.5px] font-bold uppercase tracking-wide ${roleText(row.actorRole)}`}>{roleLabel(row.actorRole)}</p>
            </div>
          </div>
        ) },
        { ...columns[1], render: (row) => <span className="font-medium text-[#102A43]">{row.action}</span> },
        { ...columns[2], render: (row) => <span className="text-[#627D98]">{row.entityName}</span> },
        { ...columns[3], render: (row) => <StatusBadge status={row.status} /> },
        { ...columns[4], render: (row) => (
          <>
            <span className="text-[#102A43] whitespace-nowrap">{fmtDateTime(row.createdAt)}</span>
            <span className="block text-[11px] text-[#829AB1]">{timeAgo(row.createdAt)}</span>
          </>
        ) }
      ]} rows={filtered} pageSize={15} itemLabel="events"
        defaultSort="createdAt" defaultSortDir={-1} emptyTitle="No activity found" emptyIcon={ScrollText}
        emptyMessage="Administrative actions performed on the platform will be recorded here." />
    </SaLayout>
  )
}
