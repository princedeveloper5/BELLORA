import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { School, Users, Briefcase, GraduationCap, CalendarClock, TriangleAlert, ScrollText, Crown, FileBarChart, Download, Printer } from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import DataTable from '@/sa/components/DataTable'
import StatusBadge from '@/sa/components/StatusBadge'
import EmptyState from '@/sa/components/EmptyState'
import { saStore, saActions, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtDate, downloadCsv } from '@/sa/format'

const reportTypes = [
  { key: 'school', label: 'School Report', desc: 'All schools with stats and status', icon: School, bg: 'bg-[#EAF3FF] text-[#1769E0]' },
  { key: 'user', label: 'User Report', desc: 'Accounts, roles and activity', icon: Users, bg: 'bg-[#E8F8F2] text-[#0E9F70]' },
  { key: 'teacher', label: 'Teacher Report', desc: 'Teaching staff per school', icon: Briefcase, bg: 'bg-[#FFF7E6] text-[#b07409]' },
  { key: 'student', label: 'Student Report', desc: 'Enrolment by school and class', icon: GraduationCap, bg: 'bg-[#F0EEFF] text-[#6D5CE7]' },
  { key: 'timetable', label: 'Timetable Report', desc: 'Coverage and publish status', icon: CalendarClock, bg: 'bg-[#e0f7fb] text-[#0e7490]' },
  { key: 'conflict', label: 'Conflict Report', desc: 'Detected scheduling clashes', icon: TriangleAlert, bg: 'bg-[#FEECEC] text-[#c62525]' },
  { key: 'activity', label: 'Activity Report', desc: 'Audit trail of admin actions', icon: ScrollText, bg: 'bg-[#eef2f9] text-[#475569]' },
  { key: 'subscription', label: 'Subscription Report', desc: 'Plans and billing status', icon: Crown, bg: 'bg-[#fdf3e0] text-[#b45309]' }
]

export default function SaReports() {
  const store = useStore(saStore)
  const [searchParams] = useSearchParams()
  const queryType = searchParams.get('type')

  const [type, setType] = useState(reportTypes.some((r) => r.key === queryType) ? String(queryType) : 'school')
  const from = new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10)
  const to = new Date().toISOString().slice(0, 10)
  const [schoolFilter, setSchoolFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [ran, setRan] = useState(false)
  const [rows, setRows] = useState([])
  const [columns, setColumns] = useState([])
  const [generatedAt, setGeneratedAt] = useState('')

  useEffect(() => {
    if (queryType && reportTypes.some((r) => r.key === queryType)) setType(String(queryType))
  }, [queryType])

  useEffect(() => {
    setRan(false)
  }, [type])

  const currentType = reportTypes.find((r) => r.key === type) || reportTypes[0]

  const inRange = (d) => {
    if (!d) return true
    const t = new Date(d).getTime()
    return (!from || t >= new Date(from).getTime()) && (!to || t <= new Date(to).getTime() + 86400000)
  }

  const schoolById = saSelectors.schoolById(store)
  const subjectById = saSelectors.subjectById(store)
  const classById = saSelectors.classById(store)
  const schoolStats = saSelectors.schoolStats(store)
  const teachers = saSelectors.teachers(store)
  const students = saSelectors.students(store)
  const conflicts = saSelectors.conflicts(store)

  const BUILDERS = {
    school: () => ({
      columns: [
        { key: 'name', label: 'School', sortable: true }, { key: 'code', label: 'Code', sortable: true },
        { key: 'location', label: 'Location', sortable: true }, { key: 'students', label: 'Students' },
        { key: 'teachers', label: 'Teachers' }, { key: 'plan', label: 'Plan', sortable: true },
        { key: 'status', label: 'Status', type: 'status', sortable: true }, { key: 'createdAt', label: 'Registered', type: 'date', sortable: true }
      ],
      rows: store.schools.filter((s) => inRange(s.createdAt) && (!schoolFilter || s.id === schoolFilter) && (!statusFilter || s.status === statusFilter))
        .map((s) => ({ ...s, students: schoolStats(s.id).students, teachers: schoolStats(s.id).teachers }))
    }),
    user: () => ({
      columns: [
        { key: 'name', label: 'Name', sortable: true }, { key: 'email', label: 'Email' },
        { key: 'role', label: 'Role', sortable: true }, { key: 'school', label: 'School' },
        { key: 'status', label: 'Status', type: 'status', sortable: true }, { key: 'createdAt', label: 'Created', type: 'date', sortable: true }
      ],
      rows: store.users.filter((u) => inRange(u.createdAt) && (!schoolFilter || u.schoolId === schoolFilter) && (!statusFilter || u.status === statusFilter))
        .map((u) => ({ ...u, school: schoolById(u.schoolId)?.name || '—' }))
    }),
    teacher: () => ({
      columns: [
        { key: 'name', label: 'Teacher', sortable: true }, { key: 'school', label: 'School', sortable: true },
        { key: 'subjects', label: 'Subjects' }, { key: 'periods', label: 'Periods / week' },
        { key: 'status', label: 'Status', type: 'status', sortable: true }
      ],
      rows: teachers.filter((u) => (!schoolFilter || u.schoolId === schoolFilter) && (!statusFilter || u.status === statusFilter))
        .map((t) => ({
          ...t,
          school: schoolById(t.schoolId)?.name || '—',
          subjects: (t.subjectIds || []).map((s) => subjectById(s)?.code).filter(Boolean).join(', ') || '—',
          periods: store.entries.filter((e) => e.teacherId === t.id && e.status === 'published').length
        }))
    }),
    student: () => ({
      columns: [
        { key: 'name', label: 'Student', sortable: true }, { key: 'school', label: 'School', sortable: true },
        { key: 'cls', label: 'Class', sortable: true }, { key: 'status', label: 'Status', type: 'status', sortable: true },
        { key: 'createdAt', label: 'Enrolled', type: 'date', sortable: true }
      ],
      rows: students.filter((u) => inRange(u.createdAt) && (!schoolFilter || u.schoolId === schoolFilter) && (!statusFilter || u.status === statusFilter))
        .map((s) => ({ ...s, school: schoolById(s.schoolId)?.name || '—', cls: classById(s.classId)?.name || '—' }))
    }),
    timetable: () => ({
      columns: [
        { key: 'school', label: 'School', sortable: true }, { key: 'name', label: 'Timetable', sortable: true },
        { key: 'periods', label: 'Periods' }, { key: 'classes', label: 'Classes' },
        { key: 'status', label: 'Status', type: 'status', sortable: true }, { key: 'createdAt', label: 'Created', type: 'date', sortable: true }
      ],
      rows: store.ttGroups.filter((g) => inRange(g.createdAt) && (!schoolFilter || g.schoolId === schoolFilter) && (!statusFilter || g.status === statusFilter))
        .map((g) => ({
          ...g, school: schoolById(g.schoolId)?.name || '—',
          periods: store.entries.filter((e) => e.groupId === g.id).length,
          classes: new Set(store.entries.filter((e) => e.groupId === g.id).map((e) => e.classId)).size
        }))
    }),
    conflict: () => ({
      columns: [
        { key: 'title', label: 'Conflict', sortable: true }, { key: 'schoolName', label: 'School', sortable: true },
        { key: 'detail', label: 'Details' }, { key: 'when', label: 'Slot', sortable: true },
        { key: 'state', label: 'State', type: 'status', sortable: true }
      ],
      rows: conflicts.filter((c) => !schoolFilter || c.schoolId === schoolFilter)
        .map((c) => ({ ...c, when: `${['Mon', 'Tue', 'Wed', 'Thu', 'Fri'][c.day]} ${c.start}`, state: c.state === 'open' ? 'pending' : c.state === 'resolved' ? 'active' : 'archived' }))
    }),
    activity: () => ({
      columns: [
        { key: 'actor', label: 'Actor', sortable: true }, { key: 'action', label: 'Action', sortable: true },
        { key: 'entityName', label: 'Entity' }, { key: 'status', label: 'Outcome', type: 'status', sortable: true },
        { key: 'createdAt', label: 'When', type: 'date', sortable: true }
      ],
      rows: store.activities.filter((a) => inRange(a.createdAt) && (!statusFilter || a.status === statusFilter))
    }),
    subscription: () => ({
      columns: [
        { key: 'name', label: 'School', sortable: true }, { key: 'plan', label: 'Plan', sortable: true },
        { key: 'price', label: 'Monthly Fee' }, { key: 'status', label: 'Status', type: 'status', sortable: true },
        { key: 'createdAt', label: 'Customer Since', type: 'date', sortable: true }
      ],
      rows: store.schools.filter((s) => (!schoolFilter || s.id === schoolFilter) && (!statusFilter || s.status === statusFilter))
        .map((s) => ({ ...s, price: { Premium: '$249', Standard: '$129', Basic: '$49' }[s.plan] || '—' }))
    })
  }

  function run() {
    const built = BUILDERS[type]()
    setColumns(built.columns)
    setRows(built.rows)
    setGeneratedAt(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }).format(new Date()))
    setRan(true)
    saActions.logActivity('Generated report', 'report', currentType.label, 'info')
  }

  function exportCsv() {
    downloadCsv(`${type}-report.csv`, columns.map((c) => ({ label: c.label, value: c.key })), rows)
    saActions.success(`${rows.length} records exported.`, 'Export complete')
  }
  function printReport() { window.print() }

  const tableColumns = columns.map((col) => ({
    ...col,
    render: (row) => {
      if (col.type === 'status') return <StatusBadge status={row[col.key]} />
      if (col.type === 'date') return <span>{fmtDate(row[col.key])}</span>
      if (col.key === columns[0].key) return <span className="font-semibold text-[#102A43]">{row[col.key]}</span>
      return <span>{row[col.key] ?? '—'}</span>
    }
  }))

  return (
    <SaLayout>
      <div className="mb-5">
        <h2 className="text-[20px] sm:text-[22px] font-extrabold tracking-tight">Reports</h2>
        <p className="text-[13px] text-[#627D98] mt-0.5">Build, preview and export platform reports.</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 mb-5">
        {reportTypes.map((r) => {
          const Icon = r.icon
          return (
            <button key={r.key} type="button"
              className={`sa-card p-4 text-left transition hover:border-[#bcd4f6] hover:shadow-[0_8px_24px_rgba(23,105,224,0.10)] ${type === r.key ? '!border-[#1769E0] ring-2 ring-[#1769E0]/20' : ''}`}
              onClick={() => setType(r.key)}>
              <span className={`w-9 h-9 rounded-lg grid place-items-center mb-2.5 ${r.bg}`}><Icon size={17} /></span>
              <p className="text-[13.5px] font-bold text-[#102A43]">{r.label}</p>
              <p className="text-[11.5px] text-[#829AB1] mt-0.5">{r.desc}</p>
            </button>
          )
        })}
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
        <div>
          <label className="sa-label" htmlFor="rp-from">From date</label>
          <input id="rp-from" value={from} readOnly type="date" className="sa-input" />
        </div>
        <div>
          <label className="sa-label" htmlFor="rp-to">To date</label>
          <input id="rp-to" value={to} readOnly type="date" className="sa-input" />
        </div>
        <div>
          <label className="sa-label" htmlFor="rp-school">School</label>
          <select id="rp-school" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)} className="sa-select">
            <option value="">All schools</option>
            {store.schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label className="sa-label" htmlFor="rp-status">Status</label>
          <select id="rp-status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sa-select">
            <option value="">All statuses</option>
            <option value="active">Active</option>
            <option value="pending">Pending</option>
            <option value="suspended">Suspended</option>
            <option value="archived">Archived</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </div>
        <button type="button" className="sa-btn primary" onClick={run}><FileBarChart size={15} /> Run report</button>
      </div>

      {ran ? (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="text-[13px] text-[#627D98]"><span className="font-bold text-[#102A43]">{rows.length}</span> records · generated {generatedAt}</p>
            <div className="flex gap-2">
              <button type="button" className="sa-btn ghost sm" disabled={!rows.length} onClick={exportCsv}><Download size={14} /> Export CSV</button>
              <button type="button" className="sa-btn ghost sm" disabled={!rows.length} onClick={printReport}><Printer size={14} /> Print</button>
            </div>
          </div>
          <DataTable columns={tableColumns} rows={rows} itemLabel={currentType.label.toLowerCase()} pageSize={12}
            emptyTitle={`No ${currentType.label.toLowerCase()} data`} emptyMessage="No records match the selected filters and date range." />
        </div>
      ) : (
        <div className="sa-card">
          <EmptyState icon={FileBarChart} title="Choose a report and run it"
            message="Pick a report type above, set your filters, then press “Run report” to preview the data before exporting." />
        </div>
      )}
    </SaLayout>
  )
}
