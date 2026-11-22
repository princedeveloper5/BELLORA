import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  Layers, Users, BookOpen, ClipboardCheck, CalendarClock, Zap, ArrowRight, Activity, Quote,
  Timer, Eye, ArrowLeft, GraduationCap
} from 'lucide-react'
import TcLayout from './TcLayout'
import KpiCard from '@/sa/components/KpiCard'
import EmptyState from '@/sa/components/EmptyState'
import { useStore } from '@/stores/useStore'
import { tcStore } from './tcStore'
import { timeAgo } from '@/sa/format'

const COLORS = ['#1769E0', '#18B981', '#f59e0b', '#6D5CE7', '#ef4444', '#06b6d4']
const chipColor = (name = '') => COLORS[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]

const quickActions = [
  { label: 'View My Classes', to: '/teacher/dashboard?view=classes', icon: Eye, tone: 'bg-[#1769E0]' },
  { label: 'Current Counter', to: '/teacher/current-counter', icon: Timer, tone: 'bg-[#18B981]' },
  { label: 'Mark Attendance', to: '/teacher/attendance', icon: ClipboardCheck, tone: 'bg-[#f59e0b]' },
  { label: 'View Subjects', to: '/teacher/dashboard?view=subjects', icon: BookOpen, tone: 'bg-[#0F9D8A]' }
]

export default function TcDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const store = useStore(tcStore)
  const o = store.overview
  const view = searchParams.get('view')
  const backToOverview = () => navigate('/teacher/dashboard')

  const todayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date())

  return (
    <TcLayout>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="text-[22px] sm:text-[26px] font-extrabold tracking-tight">
            {view === 'classes' ? 'My Classes' : view === 'subjects' ? 'My Subjects' : 'Teacher Dashboard'}
          </h2>
          <p className="text-[13.5px] text-[#627D98] mt-0.5">
            {view === 'classes'
              ? 'Every class you are assigned to teach this year.'
              : view === 'subjects'
                ? 'Subjects assigned to you, with the classes you teach them in.'
                : 'View your classes, timetable and manage your subjects.'}
          </p>
        </div>
        {view ? (
          <button type="button" className="sa-btn ghost sm self-start sm:self-auto" onClick={backToOverview}>
            <ArrowLeft size={14} /> Back to overview
          </button>
        ) : null}
      </div>

      {view === 'classes' ? (
        <section className="sa-card mb-5">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><Layers size={17} className="text-[#1769E0]" /> Assigned Classes</h3>
              <p className="sa-card-sub">{o?.classList?.length || 0} classes</p>
            </div>
          </div>
          {o?.classList?.length ? (
            <ul className="divide-y divide-[#f0f4fa]">
              {o.classList.map((c) => (
                <li key={c.class_id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-[#EAF3FF] text-[#1769E0] shrink-0">
                    <GraduationCap size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-[#102A43] truncate">{c.class_name}</p>
                    <p className="text-[12px] text-[#627D98]">Class you teach</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={Layers} title="No classes assigned" message="Classes appear here once the director of studies assigns you." />
          )}
        </section>
      ) : null}

      {view === 'subjects' ? (
        <section className="sa-card mb-5">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><BookOpen size={17} className="text-[#0F9D8A]" /> Assigned Subjects</h3>
              <p className="sa-card-sub">{o?.subjectList?.length || 0} subjects</p>
            </div>
          </div>
          {o?.subjectList?.length ? (
            <ul className="divide-y divide-[#f0f4fa]">
              {o.subjectList.map((s) => (
                <li key={s.module_id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className="w-9 h-9 rounded-lg grid place-items-center bg-[#E7F5F2] text-[#0B7F70] shrink-0">
                    <BookOpen size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13.5px] font-bold text-[#102A43] truncate">{s.module_name}</p>
                    <p className="text-[12px] text-[#627D98]">Subject you teach</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={BookOpen} title="No subjects assigned" message="Subjects appear here once they are assigned to you." />
          )}
        </section>
      ) : null}

      {view === 'classes' || view === 'subjects' ? null : (
        <>

      {/* Stat cards (image: My Classes, Total Students, Subjects, Attendance) */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
        <KpiCard title="My Classes" value={o?.classes ?? '—'} trend="today" caption={`${o?.today?.length || 0} lessons today`} icon={Layers} tone="blue" onClick={() => navigate('/teacher/dashboard?view=classes')} />
        <KpiCard title="Total Students" value={o?.students ?? '—'} trend="in my" caption="classes" icon={Users} tone="green" onClick={() => navigate('/teacher/dashboard?view=classes')} />
        <KpiCard title="Subjects" value={o?.subjects ?? '—'} trend="assigned" caption="to me" icon={BookOpen} tone="purple" onClick={() => navigate('/teacher/dashboard?view=subjects')} />
        <KpiCard title="Attendance" value={o?.attendanceRate != null ? o.attendanceRate + '%' : '—'} trend="last 7" caption="days" icon={ClipboardCheck} tone="amber" onClick={() => navigate('/teacher/attendance')} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        {/* Today's timetable */}
        <div className="sa-card xl:col-span-2">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><CalendarClock size={17} className="text-[#1769E0]" /> Today's Timetable</h3>
              <p className="sa-card-sub">{todayName} · {o?.today?.length || 0} lessons</p>
            </div>
            <button type="button" className="sa-btn ghost sm" onClick={() => navigate('/teacher/timetable')}>View full timetable <ArrowRight size={14} /></button>
          </div>
          {o?.today?.length ? (
            <ul className="divide-y divide-[#f0f4fa]">
              {o.today.map((t) => (
                <li key={t.timetable_id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-[#f8fafd] transition">
                  <span className="text-[12px] font-bold text-[#1769E0] tabular-nums w-[104px] shrink-0">{t.start_time} – {t.end_time}</span>
                  <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: chipColor(t.module_name) }}></span>
                  <div className="min-w-0 grow">
                    <p className="text-[13.5px] font-bold text-[#102A43]">{t.module_name || '—'}</p>
                    <p className="text-[12px] text-[#627D98]">{t.class_name || '—'}</p>
                  </div>
                  <span className="text-[11.5px] font-semibold text-[#627D98] bg-[#f1f5fb] rounded-md px-2 py-1 shrink-0">{t.room_name || '—'}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={CalendarClock} title="No lessons today" message="Your published lessons for today will appear here." />
          )}
        </div>

        <div className="space-y-4">
          {/* Quick actions */}
          <div className="sa-card">
            <div className="sa-card-head"><h3 className="sa-card-title"><Zap size={17} className="text-[#f59e0b]" /> Quick Actions</h3></div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {quickActions.map((qa) => {
                const Icon = qa.icon
                return (
                  <button key={qa.label} type="button"
                    className="flex flex-col items-center gap-2 rounded-xl border border-[#DCE5F0] bg-[#f8fafd] hover:bg-[#EAF3FF] hover:border-[#bcd4f6] px-3 py-4 transition group"
                    onClick={() => navigate(qa.to)}>
                    <span className={`w-9 h-9 rounded-lg grid place-items-center text-white shadow-sm ${qa.tone}`}><Icon size={17} /></span>
                    <span className="text-[12px] font-semibold text-[#102A43] group-hover:text-[#1769E0] text-center leading-tight">{qa.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Recent activity */}
          <div className="sa-card">
            <div className="sa-card-head"><h3 className="sa-card-title"><Activity size={17} className="text-[#1769E0]" /> Recent Activities</h3></div>
            {o?.recentActivity?.length ? (
              <ul className="divide-y divide-[#f0f4fa]">
                {o.recentActivity.slice(0, 4).map((a, i) => (
                  <li key={i} className="px-5 py-3">
                    <p className="text-[12.5px] font-semibold text-[#102A43]">{a.action}</p>
                    <time className="text-[11px] text-[#829AB1]">{timeAgo(a.created_at)}</time>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-5 py-4 text-[12.5px] text-[#829AB1]">No recent activity.</p>
            )}
          </div>

          {/* Quote card (image) */}
          <div className="rounded-2xl bg-gradient-to-br from-[#1769E0] to-[#0B2A4A] p-5 text-white shadow-lg shadow-[#1769E0]/25">
            <Quote size={22} className="text-[#7db4ff] mb-2" />
            <p className="text-[15px] font-bold leading-snug">Great teachers inspire change.</p>
            <p className="text-[12px] text-[#b9cdec] mt-1">Every lesson you prepare shapes someone's future.</p>
          </div>
        </div>
      </section>
        </>
      )}
    </TcLayout>
  )
}
