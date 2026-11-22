import { useNavigate } from 'react-router-dom'
import { CalendarClock, BookOpen, ClipboardCheck, Layers, ArrowRight, Megaphone, TriangleAlert } from 'lucide-react'
import StLayout from './StLayout'
import StatCard from '@/dos/components/StatCard'
import EmptyState from '@/sa/components/EmptyState'
import { useStore } from '@/stores/useStore'
import { stStore } from './stStore'
import { theme, chipFor } from '@/dos/theme'

export default function StDashboard() {
  const navigate = useNavigate()
  const store = useStore(stStore)
  const o = store.overview

  const todayName = new Intl.DateTimeFormat('en-GB', { weekday: 'long' }).format(new Date())

  return (
    <StLayout>
      <div className="mb-5">
        <h2 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight">Welcome, {o?.student?.name?.split(' ')[0] || 'Student'}</h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
          {o?.class ? `${o.class.class_name} · ${todayName}` : 'Your class and timetable will appear here once assigned.'}
        </p>
      </div>

      {!store.ready ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-[84px] rounded-2xl bg-white border border-[var(--panta-border)] animate-pulse"></div>
          ))}
        </div>
      ) : store.error ? (
        <div className="sa-card"><EmptyState icon={TriangleAlert} title="Could not load your data" message={store.error} /></div>
      ) : o ? (
        <>
          {/* Summary cards (§46) */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
            <StatCard label="Today's Classes" value={o.today?.length ?? 0} trend={todayName} icon={CalendarClock} accent={theme.colors.accentBlue} onClick={() => navigate('/student/timetable')} />
            <StatCard label="Total Subjects" value={o.subjects?.length ?? 0} trend="this year" icon={BookOpen} accent={theme.colors.accentPurple} onClick={() => navigate('/student/subjects')} />
            <StatCard label="Attendance" value={o.attendance?.rate != null ? o.attendance.rate + '%' : '—'} trend="this year" icon={ClipboardCheck} accent={theme.colors.accentGreen} onClick={() => navigate('/student/attendance')} />
            <StatCard label="Current Class" value={o.class?.class_name || '—'} trend={o.class?.level || 'unassigned'} icon={Layers} accent={theme.colors.accentAmber} onClick={() => navigate('/student/timetable')} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            {/* Today's timetable */}
            <div className="sa-card xl:col-span-2">
              <div className="sa-card-head">
                <div>
                  <h3 className="sa-card-title"><CalendarClock size={16} className="text-[#1769E0]" /> Today's Timetable</h3>
                  <p className="sa-card-sub">{todayName} · {o.today?.length || 0} lessons</p>
                </div>
                <button type="button" className="sa-btn ghost sm" onClick={() => navigate('/student/timetable')}>Full week <ArrowRight size={14} /></button>
              </div>
              {o.today?.length ? (
                <ul className="divide-y divide-[#f0f4fa]">
                  {o.today.map((l) => (
                    <li key={l.timetable_id} className="flex items-center gap-4 px-5 py-3.5">
                      <span className="text-[12px] font-bold text-[#1769E0] tabular-nums w-[104px] shrink-0">{l.start_time} – {l.end_time}</span>
                      <span className="w-1.5 h-8 rounded-full shrink-0" style={{ background: chipFor(l.module_name).bg }}></span>
                      <div className="min-w-0 grow">
                        <p className="text-[13.5px] font-bold text-[#102A43]">{l.module_name || '—'}</p>
                        <p className="text-[12px] text-[#627D98]">{l.teacher_name || '—'}</p>
                      </div>
                      <span className="text-[11.5px] font-semibold text-[#627D98] bg-[#f1f5fb] rounded-md px-2 py-1 shrink-0">{l.room_name || '—'}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState icon={CalendarClock} title="No lessons today" message={o.class ? 'Enjoy your free day! Your next lessons are shown in the weekly timetable.' : 'You are not assigned to a class yet — your Director of Studies will assign you soon.'} />
              )}
            </div>

            <div className="space-y-4">
              {/* Next lesson */}
              {o.nextLesson ? (
                <div className="rounded-2xl p-5 text-white shadow-lg" style={{ background: 'linear-gradient(135deg, #1769E0, #0B2A4A)' }}>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#B9D2F5]">Up next</p>
                  <p className="text-[19px] font-extrabold mt-1">{o.nextLesson.module_name}</p>
                  <p className="text-[12.5px] text-[#B9D2F5] mt-0.5">{o.nextLesson.start_time} – {o.nextLesson.end_time} · {o.nextLesson.room_name || ''}</p>
                </div>
              ) : null}

              {/* Attendance summary */}
              <div className="sa-card">
                <div className="sa-card-head"><h3 className="sa-card-title"><ClipboardCheck size={16} className="text-[#18B981]" /> Attendance Summary</h3></div>
                <div className="p-5">
                  <div className="flex items-center justify-center mb-4">
                    <div className="relative w-28 h-28">
                      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#eef2f9" strokeWidth="12" />
                        <circle cx="50" cy="50" r="40" fill="none" stroke="#18B981" strokeWidth="12" strokeLinecap="round"
                          strokeDasharray={`${(o.attendance?.rate || 0) * 2.513} 251.3`} />
                      </svg>
                      <div className="absolute inset-0 grid place-items-center">
                        <span className="text-[20px] font-extrabold tabular-nums">{o.attendance?.rate != null ? o.attendance.rate + '%' : '—'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-center text-[11px] font-bold">
                    <div className="rounded-lg bg-[#E8F8F2] text-[#0E9F70] py-1.5">{o.attendance?.present || 0}<br /><span className="font-medium">Present</span></div>
                    <div className="rounded-lg bg-[#FEECEC] text-[#B91C1C] py-1.5">{o.attendance?.absent || 0}<br /><span className="font-medium">Absent</span></div>
                    <div className="rounded-lg bg-[#FFF7E6] text-[#b45309] py-1.5">{o.attendance?.late || 0}<br /><span className="font-medium">Late</span></div>
                    <div className="rounded-lg bg-[#EAF3FF] text-[#1769E0] py-1.5">{o.attendance?.excused || 0}<br /><span className="font-medium">Excused</span></div>
                  </div>
                </div>
              </div>

              {/* Announcements */}
              <div className="sa-card">
                <div className="sa-card-head"><h3 className="sa-card-title"><Megaphone size={16} className="text-[#F59E0B]" /> Announcements</h3></div>
                {o.announcements?.length ? (
                  <ul className="divide-y divide-[#f0f4fa]">
                    {o.announcements.map((a) => (
                      <li key={a.announcement_id} className="px-5 py-3">
                        <p className="text-[13px] font-semibold text-[#102A43]">{a.title}</p>
                        <p className="text-[12px] text-[#627D98] line-clamp-2">{a.content}</p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-5 py-5 text-[12.5px]" style={{ color: 'var(--panta-muted)' }}>No announcements right now.</p>
                )}
              </div>
            </div>
          </section>
        </>
      ) : null}
    </StLayout>
  )
}
