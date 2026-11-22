import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { TriangleAlert, Wand2, CalendarClock, Eye, Send, Archive, LoaderCircle } from 'lucide-react'
import DashboardLayout from './components/DashboardLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import ActionMenu from '@/sa/components/ActionMenu'
import Modal from '@/sa/components/Modal'
import ConfirmDialog from '@/sa/components/ConfirmDialog'
import { dosStore, dosActions } from './dosStore'
import { useStore } from '@/stores/useStore'
import { fmtDate } from '@/sa/format'

export default function DosTimetables() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const store = useStore(dosStore)

  const [generateOpen, setGenerateOpen] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState('')
  const [genForm, setGenForm] = useState({ year: '2026/2027', term: 'Term 1', periods: 24 })
  const [publishTarget, setPublishTarget] = useState(null)

  useEffect(() => {
    if (searchParams.get('generate') === '1') setGenerateOpen(true)
  }, [])

  const columns = [
    { key: 'term', label: 'Timetable', sortable: true, render: (row) => <span className="font-semibold text-[#102A43]">{row.term} · {row.academic_year}</span> },
    { key: 'periods', label: 'Periods', sortable: true },
    { key: 'classes', label: 'Classes', sortable: true },
    { key: 'status', label: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'created_at', label: 'Created', sortable: true, render: (row) => fmtDate(row.created_at) }
  ]

  const groupId = (g) => `${g.academic_year}|${g.term}`
  const openGroup = (g) => navigate(`/dos/timetables/${encodeURIComponent(groupId(g))}`)

  const actions = (row) => {
    const items = [{ label: 'Open grid view', icon: Eye, handler: () => openGroup(row) }]
    if (row.status === 'draft')
      items.push({
        label: 'Publish',
        icon: Send,
        handler: () => {
          setPublishTarget(row)
        }
      })
    if (row.status === 'published')
      items.push({
        label: 'Archive',
        icon: Archive,
        handler: async () => {
          try {
            await dosActions.setGroupStatus(row, 'archived')
            dosActions.success('Timetable archived.')
          } catch (e) {
            dosActions.apiError(e)
          }
        }
      })
    if (row.status === 'archived')
      items.push({
        label: 'Restore to draft',
        icon: Wand2,
        handler: async () => {
          try {
            await dosActions.setGroupStatus(row, 'draft')
            dosActions.success('Restored to draft.')
          } catch (e) {
            dosActions.apiError(e)
          }
        }
      })
    return items
  }

  async function generate() {
    setGenError('')
    if (!genForm.year) {
      setGenError('Academic year is required.')
      return
    }
    setGenerating(true)
    try {
      const result = await dosActions.generate({ academic_year: genForm.year, term: genForm.term, periods_per_class: genForm.periods })
      dosActions.success(result.message, 'Timetable ready')
      setGenerateOpen(false)
    } catch (e) {
      setGenError(e?.response?.data?.message || 'Generation failed.')
    } finally {
      setGenerating(false)
    }
  }

  async function doPublish() {
    try {
      await dosActions.setGroupStatus(publishTarget, 'published')
      dosActions.success('Timetable published.', 'Published')
    } catch (e) {
      dosActions.apiError(e)
    }
    setPublishTarget(null)
  }

  const setGenField = (key, value) => setGenForm((prev) => ({ ...prev, [key]: value }))

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Timetable Management</h2>
          <p className="text-[13px] text-[#627D98] mt-0.5">
            {store.groups.length} timetables · {store.conflicts.length} open conflicts
          </p>
        </div>
        <div className="flex gap-2.5">
          <button type="button" className="sa-btn ghost" onClick={() => navigate('/dos/timetables/conflicts')}>
            <TriangleAlert size={15} className="text-[#ef4444]" /> Conflicts
            {store.conflicts.length ? (
              <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[#ef4444] text-white text-[10px] font-bold grid place-items-center">
                {store.conflicts.length}
              </span>
            ) : null}
          </button>
          <button type="button" className="sa-btn primary !bg-[#18B981] hover:!bg-[#18B981]" onClick={() => setGenerateOpen(true)}>
            <Wand2 size={16} /> Generate Timetable
          </button>
        </div>
      </div>

      <DataTable
        columns={columns}
        rows={store.groups}
        rowKey={(row) => `${row.academic_year}|${row.term}`}
        loading={!store.ready}
        itemLabel="timetables"
        rowClickable
        emptyIcon={CalendarClock}
        emptyTitle="No timetables yet"
        emptyMessage="Generate your first timetable for this school."
        onRowClick={openGroup}
        actions={(row) => <ActionMenu items={actions(row)} label={`Actions for ${row.term}`} />}
        emptyAction={
          <button type="button" className="sa-btn primary sm !bg-[#18B981]" onClick={() => setGenerateOpen(true)}>
            <Wand2 size={15} /> Generate timetable
          </button>
        }
      />

      {/* Generate modal */}
      <Modal
        open={generateOpen}
        title="Generate Timetable"
        subtitle="Creates a conflict-free draft — nothing goes live until you publish"
        onClose={() => setGenerateOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setGenerateOpen(false)}>
              Cancel
            </button>
            <button type="button" className="sa-btn primary !bg-[#18B981]" disabled={generating} onClick={generate}>
              {generating ? <LoaderCircle size={15} className="animate-spin" /> : null}
              {generating ? 'Generating…' : 'Generate draft'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="sa-label" htmlFor="g-year">
                Academic year <span className="req">*</span>
              </label>
              <input
                id="g-year"
                value={genForm.year}
                onChange={(event) => setGenField('year', event.target.value.trim())}
                className="sa-input"
                placeholder="e.g. 2026/2027"
              />
            </div>
            <div>
              <label className="sa-label" htmlFor="g-term">
                Term <span className="req">*</span>
              </label>
              <select id="g-term" value={genForm.term} onChange={(event) => setGenField('term', event.target.value)} className="sa-select">
                <option>Term 1</option>
                <option>Term 2</option>
                <option>Term 3</option>
              </select>
            </div>
          </div>
          <div>
            <label className="sa-label">
              Periods per class per week: <span className="font-bold">{genForm.periods}</span>
            </label>
            <input
              value={genForm.periods}
              onChange={(event) => setGenField('periods', Number(event.target.value))}
              type="range"
              min="10"
              max="40"
              step="2"
              className="w-full accent-[#18B981]"
            />
          </div>
          {genError ? <p className="sa-err">{genError}</p> : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={!!publishTarget}
        danger={false}
        title="Publish timetable?"
        confirmLabel="Publish"
        message={`${publishTarget?.term} · ${publishTarget?.academic_year} will become visible to teachers and students.`}
        onCancel={() => setPublishTarget(null)}
        onConfirm={doPublish}
      />
    </DashboardLayout>
  )
}
