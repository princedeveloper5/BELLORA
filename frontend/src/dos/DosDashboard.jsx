import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers,
  Briefcase,
  BookOpen,
  GraduationCap,
  TriangleAlert,
  Check,
  PencilLine,
  ArrowRight,
  Download,
  Megaphone,
  Trash2,
  LoaderCircle
} from 'lucide-react'
import api from '@/stores/api'
import Modal from '@/sa/components/Modal'
import StatusBadge from '@/sa/components/StatusBadge'
import DashboardLayout from './components/DashboardLayout'
import StatCard from './components/StatCard'
import TimetableOverview from './components/TimetableOverview'
import SubjectPerformance from './components/SubjectPerformance'
import RecentAssignments from './components/RecentAssignments'
import QuickActions from './components/QuickActions'
import { dosStore, dosActions, dosSelectors } from './dosStore'
import { useStore } from '@/stores/useStore'
import { theme } from './theme'

export default function DosDashboard() {
  const navigate = useNavigate()
  const store = useStore(dosStore)
  const o = store.overview
  const [selectedEntry, setSelectedEntry] = useState(null)

  const openEntry = (entry) => setSelectedEntry(entry)

  const [announcements, setAnnouncements] = useState([])
  const [composerOpen, setComposerOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [annForm, setAnnForm] = useState({ title: '', message: '', priority: 'Normal' })
  const [annErrors, setAnnErrors] = useState({})

  async function loadAnnouncements() {
    try {
      setAnnouncements(await api.get('/dos-console/announcements', { showGlobalNotification: false }).then((r) => r.data.items || []))
    } catch {
      /* silent */
    }
  }

  useEffect(() => {
    loadAnnouncements()
  }, [])

  const setAnnField = (key, value) => setAnnForm((prev) => ({ ...prev, [key]: value }))

  async function postAnnouncement() {
    setAnnErrors({})
    const nextErrors = {}
    if (annForm.title.length < 3) nextErrors.title = 'Title is required (3+ characters).'
    if (annForm.message.length < 5) nextErrors.message = 'Message is required (5+ characters).'
    if (Object.keys(nextErrors).length) {
      setAnnErrors(nextErrors)
      return
    }
    setPosting(true)
    try {
      await api.post('/dos-console/announcements', { ...annForm }, { showGlobalNotification: false })
      dosActions.success('Announcement posted to your school.', 'Posted')
      setAnnForm({ title: '', message: '', priority: 'Normal' })
      setComposerOpen(false)
      await loadAnnouncements()
    } catch (e) {
      dosActions.apiError(e)
    } finally {
      setPosting(false)
    }
  }

  async function deleteAnnouncement(a) {
    try {
      await api.delete(`/dos-console/announcements/${a.announcement_id}`, { showGlobalNotification: false })
      dosActions.success('Announcement deleted.')
      await loadAnnouncements()
    } catch (e) {
      dosActions.apiError(e)
    }
  }

  const publishedGroups = dosSelectors.publishedGroups(store)
  const draftGroups = dosSelectors.draftGroups(store)
  const published = publishedGroups.length > 0
  const draft = draftGroups[0] || null
  const quickStartSteps = [
    { label: 'Add teachers', hint: `${o?.teachers ?? 0} added`, done: (o?.teachers || 0) > 0, to: '/dos/teachers' },
    { label: 'Create classes', hint: `${o?.classes ?? 0} created`, done: (o?.classes || 0) > 0, to: '/dos/classes' },
    { label: 'Assign teachers', hint: `${o?.assignments ?? 0} assignments`, done: (o?.assignments || 0) > 0, to: '/dos/teachers' },
    {
      label: 'Generate & publish',
      hint: published ? 'Published' : draft ? 'Draft ready — review & publish' : 'Not generated yet',
      done: published,
      to: '/dos/timetables'
    }
  ]
  const quickStart = { steps: quickStartSteps, draft, visible: !published }

  async function exportSchedule() {
    try {
      const { downloadCsv } = await import('@/sa/format')
      const rows = store.week.filter((w) => w.status === 'published')
      if (!rows.length) {
        dosActions.error('No published periods to export yet.', 'Nothing to export')
        return
      }
      downloadCsv(
        'schedule.csv',
        [
          { label: 'Day', value: 'day_of_week' },
          { label: 'Start', value: 'start_time' },
          { label: 'End', value: 'end_time' },
          { label: 'Subject', value: 'module_name' },
          { label: 'Class', value: 'class_name' },
          { label: 'Teacher', value: 'teacher_name' },
          { label: 'Room', value: 'room_name' }
        ],
        rows
      )
      dosActions.success('Schedule exported to CSV.', 'Export complete')
    } catch (e) {
      dosActions.apiError(e)
    }
  }

  return (
    <DashboardLayout>
      {/* Page header */}
      <div className="mb-5">
        <h2 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight" style={{ color: 'var(--panta-text)' }}>
          Director of Studies Dashboard
        </h2>
        <p className="text-[13px] mt-0.5" style={{ color: 'var(--panta-muted)' }}>
          Manage timetables, monitor academics and assignments.
        </p>
      </div>

      {/* Loading skeleton */}
      {!store.ready && !store.error ? (
        <div className="space-y-4" aria-busy="true">
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="h-[84px] rounded-2xl bg-white border border-[var(--panta-border)] animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="h-[300px] rounded-2xl bg-white border border-[var(--panta-border)] animate-pulse" />
            <div className="h-[300px] rounded-2xl bg-white border border-[var(--panta-border)] animate-pulse" />
          </div>
        </div>
      ) : (
        <>
          {/* Stat cards */}
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5" aria-label="Key statistics">
            <StatCard
              label="Total Classes"
              value={o?.classes ?? '—'}
              trend="+2 this term"
              icon={Layers}
              accent={theme.colors.accentGreen}
              onClick={() => navigate('/dos/classes')}
            />
            <StatCard
              label="Total Teachers"
              value={o?.teachers ?? '—'}
              trend="+3 this term"
              icon={Briefcase}
              accent={theme.colors.accentBlue}
              onClick={() => navigate('/dos/teachers')}
            />
            <StatCard
              label="Total Subjects"
              value={o?.subjects ?? '—'}
              trend="+4 this term"
              icon={BookOpen}
              accent={theme.colors.accentPurple}
              onClick={() => navigate('/dos/subjects')}
            />
            <StatCard
              label="Total Students"
              value={o?.students ?? '—'}
              trend="+8 this term"
              icon={GraduationCap}
              accent={theme.colors.accentAmber}
              onClick={() => navigate('/dos/classes')}
            />
          </section>

          {/* Secondary metrics row */}
          <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
            <button
              type="button"
              className="sa-card px-4 py-3 text-left hover:border-[#a7e5cd] transition"
              onClick={() => navigate('/dos/timetables')}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Rooms
              </p>
              <p className="text-[18px] font-extrabold tabular-nums" style={{ color: 'var(--panta-text)' }}>
                {o?.rooms ?? '—'}{' '}
                <span className="text-[11px] font-semibold" style={{ color: 'var(--panta-muted)' }}>
                  available
                </span>
              </p>
            </button>
            <button
              type="button"
              className="sa-card px-4 py-3 text-left hover:border-[#a7e5cd] transition"
              onClick={() => navigate('/dos/timetables')}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Scheduled Periods
              </p>
              <p className="text-[18px] font-extrabold tabular-nums" style={{ color: 'var(--panta-text)' }}>
                {o?.periods ?? '—'}{' '}
                <span className="text-[11px] font-semibold" style={{ color: 'var(--panta-muted)' }}>
                  total
                </span>
              </p>
            </button>
            <button
              type="button"
              className="sa-card px-4 py-3 text-left hover:border-[#a7e5cd] transition"
              onClick={() => navigate('/dos/timetables')}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Draft Timetables
              </p>
              <p className="text-[18px] font-extrabold tabular-nums" style={{ color: 'var(--panta-text)' }}>
                {draftGroups.length}{' '}
                <span className="text-[11px] font-semibold" style={{ color: 'var(--panta-muted)' }}>
                  in review
                </span>
              </p>
            </button>
            <button
              type="button"
              className={`sa-card px-4 py-3 text-left transition ${o?.openConflicts ? 'hover:border-[#f5caca]' : 'hover:border-[#a7e5cd]'}`}
              onClick={() => navigate('/dos/timetables/conflicts')}
            >
              <p className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Active Conflicts
              </p>
              <p
                className={`text-[18px] font-extrabold tabular-nums ${o?.openConflicts ? 'text-[#c62525]' : ''}`}
                style={o?.openConflicts ? undefined : { color: 'var(--panta-text)' }}
              >
                {o?.openConflicts ?? 0}{' '}
                <span className="text-[11px] font-semibold" style={{ color: 'var(--panta-muted)' }}>
                  open
                </span>
              </p>
            </button>
          </section>

          {/* Quick Start checklist when the timetable is not published yet */}
          {quickStart.visible ? (
            <section className="sa-card p-5 mb-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-[15px] font-bold" style={{ color: 'var(--panta-text)' }}>
                    Get your timetable running
                  </h3>
                  <p className="text-[12.5px]" style={{ color: 'var(--panta-muted)' }}>
                    Complete these steps to publish your first conflict-free timetable.
                  </p>
                </div>
                {quickStart.draft ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[#E7F5F2] text-[#0F55B8] px-3 py-1 text-[11.5px] font-bold">
                    <PencilLine size={13} /> Draft in progress · {quickStart.draft.periods} periods
                  </span>
                ) : null}
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {quickStart.steps.map((s, i) => (
                  <li key={s.label}>
                    <button
                      type="button"
                      className={`w-full flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition ${
                        s.done ? 'border-[#a7e5cd] bg-[#f4fdf9]' : 'border-[var(--panta-border)] hover:border-[#a7e5cd]'
                      }`}
                      onClick={() => navigate(s.to)}
                    >
                      <span
                        className={`w-7 h-7 rounded-full grid place-items-center text-[12px] font-extrabold shrink-0 ${
                          s.done ? 'bg-[#18B981] text-white' : 'bg-[#eef2f9] text-[#627D98]'
                        }`}
                      >
                        {s.done ? <Check size={14} /> : i + 1}
                      </span>
                      <span>
                        <span className={`block text-[13px] font-bold ${s.done ? 'text-[#0B7F70]' : ''}`} style={s.done ? undefined : { color: 'var(--panta-text)' }}>
                          {s.label}
                        </span>
                        <span className="block text-[11px]" style={{ color: 'var(--panta-muted)' }}>
                          {s.hint}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          ) : null}

          <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 mb-5">
            <TimetableOverview
              entries={store.week}
              onViewAll={() => navigate('/dos/timetables')}
              onGenerate={() => navigate('/dos/timetables?generate=1')}
              onEntryClick={openEntry}
            />
            <SubjectPerformance dist={o?.subjectDist || []} perf={o?.subjectPerf || []} />
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
            <div className="xl:col-span-2">
              <RecentAssignments items={o?.recentAssignments || []} />
            </div>
            <div className="space-y-4">
              <QuickActions onAction={(a) => navigate(a.to)} />
              {/* Contextual shortcuts */}
              <div className="bg-white rounded-2xl border border-[var(--panta-border)] shadow-[0_1px_3px_rgba(15,37,73,0.05)] p-4 space-y-2.5">
                {o?.openConflicts ? (
                  <button
                    type="button"
                    className="w-full flex items-center gap-3 rounded-xl bg-[#fef2f2] border border-[#f5caca] px-4 py-3 text-left hover:bg-[#FEECEC] transition"
                    onClick={() => navigate('/dos/timetables/conflicts')}
                  >
                    <TriangleAlert size={17} className="text-[#c62525] shrink-0" />
                    <span className="grow text-[12.5px] font-semibold text-[#8a1f1f]">
                      Resolve {o.openConflicts} conflict{o.openConflicts === 1 ? '' : 's'}
                    </span>
                    <ArrowRight size={15} className="text-[#c62525]" />
                  </button>
                ) : null}
                <button
                  type="button"
                  className="w-full flex items-center gap-3 rounded-xl border border-[var(--panta-border)] px-4 py-3 text-left hover:bg-[#f6fbfa] transition"
                  onClick={exportSchedule}
                >
                  <Download size={17} style={{ color: 'var(--panta-teal)' }} className="shrink-0" />
                  <span className="grow text-[12.5px] font-semibold" style={{ color: 'var(--panta-text)' }}>
                    Export schedule (CSV)
                  </span>
                  <ArrowRight size={15} style={{ color: 'var(--panta-muted)' }} />
                </button>
              </div>

              {/* Announcements composer */}
              <div className="bg-white rounded-2xl border border-[var(--panta-border)] shadow-[0_1px_3px_rgba(15,37,73,0.05)]">
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#eef2f9]">
                  <h3 className="text-[15px] font-bold" style={{ color: 'var(--panta-text)' }}>
                    Announcements
                  </h3>
                  <button type="button" className="sa-btn primary sm panta-primary-btn" onClick={() => setComposerOpen(true)}>
                    <Megaphone size={14} /> New
                  </button>
                </div>
                {announcements.length ? (
                  <ul className="divide-y divide-[#f0f4fa] max-h-[220px] overflow-y-auto">
                    {announcements.map((a) => (
                      <li key={a.announcement_id} className="px-4 py-3 flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${
                            a.priority === 'Urgent' ? 'bg-[#EF4444]' : a.priority === 'Important' ? 'bg-[#F59E0B]' : 'bg-[#0F9D8A]'
                          }`}
                        />
                        <div className="min-w-0 grow">
                          <p className="text-[13px] font-semibold" style={{ color: 'var(--panta-text)' }}>
                            {a.title}
                          </p>
                          <p className="text-[11.5px] line-clamp-2" style={{ color: 'var(--panta-muted)' }}>
                            {a.message}
                          </p>
                        </div>
                        <button
                          type="button"
                          className="text-[#9fb0c7] hover:text-[#EF4444] transition shrink-0"
                          aria-label={`Delete announcement ${a.title}`}
                          onClick={() => deleteAnnouncement(a)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-5 text-[12.5px] text-center" style={{ color: 'var(--panta-muted)' }}>
                    No announcements yet — post one for your teachers and students.
                  </p>
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {/* Announcement composer modal */}
      <Modal
        open={composerOpen}
        title="New Announcement"
        subtitle="Posted to all teachers and students of your school"
        onClose={() => setComposerOpen(false)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setComposerOpen(false)}>
              Cancel
            </button>
            <button type="submit" form="ann-form" className="sa-btn primary panta-primary-btn" disabled={posting}>
              {posting ? <LoaderCircle size={15} className="animate-spin" /> : null} Post announcement
            </button>
          </>
        }
      >
        <form
          id="ann-form"
          className="space-y-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault()
            postAnnouncement()
          }}
        >
          <div>
            <label className="sa-label" htmlFor="an-title">
              Title <span className="req">*</span>
            </label>
            <input
              id="an-title"
              value={annForm.title}
              onChange={(event) => setAnnField('title', event.target.value.trim())}
              className={`sa-input ${annErrors.title ? 'err' : ''}`}
              placeholder="e.g. Midterm exams start next week"
            />
            {annErrors.title ? <p className="sa-err">{annErrors.title}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="an-msg">
              Message <span className="req">*</span>
            </label>
            <textarea
              id="an-msg"
              value={annForm.message}
              onChange={(event) => setAnnField('message', event.target.value.trim())}
              rows={4}
              className={`sa-input resize-none ${annErrors.message ? 'err' : ''}`}
              placeholder="Write the announcement…"
            />
            {annErrors.message ? <p className="sa-err">{annErrors.message}</p> : null}
          </div>
          <div>
            <label className="sa-label" htmlFor="an-prio">
              Priority
            </label>
            <select id="an-prio" value={annForm.priority} onChange={(event) => setAnnField('priority', event.target.value)} className="sa-select">
              <option>Normal</option>
              <option>Important</option>
              <option>Urgent</option>
            </select>
          </div>
        </form>
      </Modal>

      {/* Timetable entry details */}
      <Modal
        open={!!selectedEntry}
        title="Lesson Details"
        subtitle={selectedEntry?.day_of_week}
        onClose={() => setSelectedEntry(null)}
        footer={
          <>
            <button type="button" className="sa-btn ghost" onClick={() => setSelectedEntry(null)}>
              Close
            </button>
            <button
              type="button"
              className="sa-btn primary panta-primary-btn"
              onClick={() => {
                setSelectedEntry(null)
                navigate('/dos/timetables')
              }}
            >
              Open timetable
            </button>
          </>
        }
      >
        {selectedEntry ? (
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 text-[13.5px]">
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Subject
              </dt>
              <dd className="mt-1 font-semibold" style={{ color: 'var(--panta-text)' }}>
                {selectedEntry.module_name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Class
              </dt>
              <dd className="mt-1 font-semibold" style={{ color: 'var(--panta-text)' }}>
                {selectedEntry.class_name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Teacher
              </dt>
              <dd className="mt-1 font-semibold" style={{ color: 'var(--panta-text)' }}>
                {selectedEntry.teacher_name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Room
              </dt>
              <dd className="mt-1 font-semibold" style={{ color: 'var(--panta-text)' }}>
                {selectedEntry.room_name || '—'}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Time
              </dt>
              <dd className="mt-1 font-semibold" style={{ color: 'var(--panta-text)' }}>
                {selectedEntry.start_time} – {selectedEntry.end_time}
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--panta-muted)' }}>
                Status
              </dt>
              <dd className="mt-1">
                <StatusBadge status={selectedEntry.status} />
              </dd>
            </div>
          </dl>
        ) : null}
      </Modal>
    </DashboardLayout>
  )
}
