import { useEffect, useState } from 'react'
import { Search, RefreshCw, ScrollText } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import DataTable from '@/sa/components/DataTable'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { fmtDateTime, timeAgo } from '@/sa/format'

const columns = [
  { key: 'actor', label: 'Performed By', sortable: true },
  { key: 'action', label: 'Action', sortable: true },
  { key: 'message', label: 'Details', sortable: false },
  { key: 'created_at', label: 'When', sortable: true }
]

const roleLabel = (r) => ({ super_admin: 'Super Admin', admin: 'School Admin', dos: 'Director of Studies', system: 'System' }[r] || r)

export default function DosActivity() {
  const store = useStore(dosStore)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const filtered = (() => {
    const q = search.toLowerCase()
    return items.filter(
      (a) => !q || a.action?.toLowerCase().includes(q) || a.message?.toLowerCase().includes(q) || a.actor?.toLowerCase().includes(q)
    )
  })()

  async function load(showToast = false) {
    setLoading(true)
    try {
      setItems(await dosActions.getActivity())
      if (showToast === true) dosActions.success('Activity refreshed.')
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
  }, [])

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Activity Log</h2>
          <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
            Who changed what in your school — schedules, teachers, classes.
          </p>
        </div>
        <button type="button" className="sa-btn ghost" onClick={() => load(true)}>
          <RefreshCw size={15} /> Refresh
        </button>
      </div>

      <div className="sa-card p-4 mb-4">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#829AB1]" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value.trim())}
            type="search"
            className="sa-input !pl-9"
            placeholder="Search actions…"
            aria-label="Search activity"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={filtered}
        rowKey="activity_id"
        loading={loading}
        itemLabel="events"
        defaultSort="created_at"
        defaultSortDir={-1}
        emptyIcon={ScrollText}
        emptyTitle="No activity yet"
        emptyMessage="Actions performed in your school will be recorded here."
      />
    </DashboardLayout>
  )
}
