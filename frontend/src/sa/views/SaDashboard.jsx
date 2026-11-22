import { useNavigate } from 'react-router-dom'
import {
  School, Users, Briefcase, GraduationCap, BarChart3, PieChart, Activity, Zap, ArrowRight,
  CalendarDays, CircleCheck, CircleAlert, Info, CircleX, Plus, UserPlus, FileBarChart, Crown, Hourglass
} from 'lucide-react'
import SaLayout from '@/sa/components/SaLayout'
import KpiCard from '@/sa/components/KpiCard'
import BarChart from '@/sa/components/BarChart'
import DonutChart from '@/sa/components/DonutChart'
import EmptyState from '@/sa/components/EmptyState'
import { saStore, saSelectors } from '@/sa/store'
import { useStore } from '@/stores/useStore'
import { fmtNumber, timeAgo } from '@/sa/format'

const actTone = (status) => ({
  success: { bg: 'bg-[#E8F8F2] text-[#0E9F70]', icon: CircleCheck },
  danger: { bg: 'bg-[#FEECEC] text-[#c62525]', icon: CircleX },
  warning: { bg: 'bg-[#FFF7E6] text-[#b07409]', icon: CircleAlert },
  info: { bg: 'bg-[#EAF3FF] text-[#1769E0]', icon: Info }
}[status] || { bg: 'bg-[#eef2f9] text-[#627D98]', icon: Info })

// Owner-scope quick actions (image: Add New School, Add User, Manage, View Reports)
const quickActions = [
  { label: 'Add New School', to: '/super-admin/schools?new=1', icon: Plus, tone: 'bg-[#1769E0]' },
  { label: 'Add User', to: '/super-admin/users?new=1', icon: UserPlus, tone: 'bg-[#6D5CE7]' },
  { label: 'Manage Subscriptions', to: '/super-admin/schools?view=subscriptions', icon: Crown, tone: 'bg-[#f59e0b]' },
  { label: 'View Reports', to: '/super-admin/reports', icon: FileBarChart, tone: 'bg-[#0d9488]' }
]

export default function SaDashboard() {
  const navigate = useNavigate()
  const store = useStore(saStore)
  const go = (to) => navigate(to)

  const k = saSelectors.kpis(store)
  const teachers = saSelectors.teachers(store)
  const students = saSelectors.students(store)
  const schoolAdmins = saSelectors.schoolAdmins(store)
  const dosUsers = saSelectors.dosUsers(store)
  const pendingCount = saSelectors.pendingCount(store)
  const today = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())

  const growth = (() => {
    const labels = []
    const schoolData = []
    const userData = []
    const now = new Date()
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1)
      labels.push(d.toLocaleString('en', { month: 'short' }))
      schoolData.push(store.schools.filter((s) => new Date(s.createdAt) < end).length)
      userData.push(store.users.filter((u) => new Date(u.createdAt) < end).length)
    }
    return {
      labels,
      series: [
        { name: 'Schools', color: '#18B981', data: schoolData },
        { name: 'Users', color: '#1769E0', data: userData }
      ]
    }
  })()

  const userDist = [
    { label: 'Teachers', value: teachers.length, color: '#18B981' },
    { label: 'Students', value: students.length, color: '#1769E0' },
    { label: 'Admins', value: schoolAdmins.length, color: '#f59e0b' },
    { label: 'Directors', value: dosUsers.length, color: '#6D5CE7' }
  ]

  const recentActivity = saSelectors.activitiesSorted(store).slice(0, 6)

  return (
    <SaLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight">Super Admin Dashboard</h2>
          <p className="text-[13.5px] text-[#627D98] mt-0.5">Complete control over your school system.</p>
        </div>
        <div className="flex items-center gap-2 text-[12.5px] text-[#627D98] bg-white border border-[#DCE5F0] rounded-full px-4 py-2 shadow-sm w-fit">
          <CalendarDays size={15} className="text-[#1769E0]" />
          <span className="font-semibold">{today}</span>
        </div>
      </div>

      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5" aria-label="Key statistics">
        <KpiCard title="Total Schools" value={fmtNumber(k.totalSchools)} trend={`+${k.newSchools} new`} caption="this month" icon={School} tone="purple" onClick={() => go('/super-admin/schools')} />
        <KpiCard title="Total Users" value={fmtNumber(k.totalUsers)} trend={`+${k.newUsers}`} caption="this month" icon={Users} tone="green" onClick={() => go('/super-admin/users')} />
        <KpiCard title="Total Teachers" value={fmtNumber(k.totalTeachers)} trend={`${k.totalTeachers}`} caption="registered" icon={Briefcase} tone="blue" onClick={() => go('/super-admin/users?role=teacher')} />
        <KpiCard title="Total Students" value={fmtNumber(k.totalStudents)} trend={`${k.totalStudents}`} caption="enrolled" icon={GraduationCap} tone="amber" onClick={() => go('/super-admin/users?role=student')} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4 mb-5">
        <div className="sa-card xl:col-span-2">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><BarChart3 size={17} className="text-[#1769E0]" /> School Overview</h3>
              <p className="sa-card-sub">Schools &amp; users growth</p>
            </div>
          </div>
          <div className="p-4 sm:p-5">
            <BarChart labels={growth.labels} series={growth.series} ariaLabel="Schools and users growth" />
          </div>
        </div>

        <div className="sa-card">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><PieChart size={17} className="text-[#1769E0]" /> User Distribution</h3>
              <p className="sa-card-sub">{fmtNumber(k.totalUsers)} total users</p>
            </div>
          </div>
          <div className="p-5">
            <DonutChart data={userDist} centerLabel="Total Users" />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="sa-card h-fit">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><Zap size={17} className="text-[#f59e0b]" /> Quick Actions</h3>
            </div>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            {quickActions.map((qa) => {
              const Icon = qa.icon
              return (
                <button key={qa.label} type="button"
                  className="flex flex-col items-center gap-2 rounded-xl border border-[#DCE5F0] bg-[#f8fafd] hover:bg-[#EAF3FF] hover:border-[#bcd4f6] px-3 py-4 transition group"
                  onClick={() => go(qa.to)}>
                  <span className={`w-9 h-9 rounded-lg grid place-items-center text-white shadow-sm ${qa.tone}`}>
                    <Icon size={17} />
                  </span>
                  <span className="text-[12px] font-semibold text-[#102A43] group-hover:text-[#1769E0] text-center leading-tight">{qa.label}</span>
                </button>
              )
            })}
          </div>
          {pendingCount ? (
            <div className="mx-4 mb-4 rounded-xl bg-[#FFF7E6] border border-[#f5dfa8] px-4 py-3 flex items-center gap-3">
              <Hourglass size={18} className="text-[#b07409] shrink-0" />
              <p className="text-[12.5px] text-[#8a6108] grow"><strong>{pendingCount}</strong> item{pendingCount === 1 ? '' : 's'} waiting for your approval</p>
              <button type="button" className="sa-btn soft sm !bg-[#b07409] !text-white" onClick={() => go('/super-admin/approvals')}>Review</button>
            </div>
          ) : null}
        </div>

        <div className="sa-card xl:col-span-2">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><Activity size={17} className="text-[#1769E0]" /> Recent Activities</h3>
            </div>
            <button type="button" className="sa-btn ghost sm" onClick={() => go('/super-admin/activity')}>
              View all <ArrowRight size={14} />
            </button>
          </div>
          <ul className="divide-y divide-[#f0f4fa]">
            {recentActivity.map((a) => {
              const tone = actTone(a.status)
              const Icon = tone.icon
              return (
                <li key={a.id} className="flex items-center gap-3.5 px-5 py-3.5 hover:bg-[#f8fafd] transition">
                  <span className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${tone.bg}`}>
                    <Icon size={14} />
                  </span>
                  <div className="min-w-0 grow">
                    <p className="text-[13.5px] text-[#102A43]"><span className="font-semibold text-[#102A43]">{a.action}</span>{a.entityName ? <span> — {a.entityName}</span> : null}</p>
                  </div>
                  <time className="text-[11.5px] text-[#829AB1] whitespace-nowrap">{timeAgo(a.createdAt)}</time>
                </li>
              )
            })}
          </ul>
          {!recentActivity.length ? <EmptyState title="No recent activity" message="Platform activity will appear here as actions are performed." /> : null}
        </div>
      </section>
    </SaLayout>
  )
}
