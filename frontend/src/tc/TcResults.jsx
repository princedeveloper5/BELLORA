import { useState } from 'react'
import { GraduationCap, Users, Save, LoaderCircle, ShieldAlert } from 'lucide-react'
import TcLayout from './TcLayout'
import EmptyState from '@/sa/components/EmptyState'
import { useStore } from '@/stores/useStore'
import { tcStore, tcActions } from './tcStore'
import api from '@/stores/api'

const assessments = ['Quiz 1', 'Quiz 2', 'Test 1', 'Test 2', 'Midterm Exam', 'Project', 'Final Exam']

const gradeClass = (g) => ({ A: 'bg-[#18B981] text-white', B: 'bg-[#1769E0] text-white', C: 'bg-[#F59E0B] text-white', D: 'bg-[#F59E0B] text-white', F: 'bg-[#EF4444] text-white' }[g] || 'bg-[#627D98] text-white')

export default function TcResults() {
  const store = useStore(tcStore)
  const classes = store.overview?.classList || []
  const subjects = store.overview?.subjectList || []

  const [form, setForm] = useState({ class_id: '', module_id: '', assessment: 'Test 1', term: 'Term 1', academic_year: '2026/2027', max_score: 100 })
  const [students, setStudents] = useState([])
  const [scores, setScores] = useState({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [ownershipError, setOwnershipError] = useState('')

  const ready = form.class_id && form.module_id && form.assessment
  const className = classes.find((c) => Number(c.class_id) === Number(form.class_id))?.class_name || ''
  const subjectName = subjects.find((s) => Number(s.module_id) === Number(form.module_id))?.module_name || ''

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const setScore = (id, value) => setScores((current) => ({ ...current, [id]: value }))

  const load = async () => {
    setLoading(true)
    setOwnershipError('')
    setLoaded(false)
    try {
      const data = await api.get('/teacher-console/results', {
        params: { class_id: form.class_id, module_id: form.module_id, assessment: form.assessment, term: form.term, academic_year: form.academic_year }
      }).then((r) => r.data)
      setStudents(data.students)
      const existing = new Map((data.results || []).map((r) => [Number(r.student_id), r]))
      const next = {}
      data.students.forEach((s) => { next[s.student_id] = existing.get(Number(s.student_id))?.score ?? null })
      setScores(next)
      setLoaded(true)
    } catch (e) {
      setOwnershipError(e?.response?.data?.message || 'Could not load students.')
      setStudents([])
    } finally { setLoading(false) }
  }

  const invalid = (id) => scores[id] != null && (scores[id] < 0 || scores[id] > form.max_score)
  const pct = (id) => scores[id] == null ? '—' : `${Math.round((scores[id] / form.max_score) * 100)}%`
  const grade = (id) => {
    if (scores[id] == null) return ''
    const p = (scores[id] / form.max_score) * 100
    return p >= 80 ? 'A' : p >= 65 ? 'B' : p >= 50 ? 'C' : p >= 35 ? 'D' : 'F'
  }

  const save = async () => {
    const invalidIds = students.filter((s) => invalid(s.student_id))
    if (invalidIds.length) { tcActions.error(`${invalidIds.length} score(s) are out of range (0–${form.max_score}).`, 'Validation'); return }
    setSaving(true)
    try {
      const records = students.filter((s) => scores[s.student_id] != null).map((s) => ({ student_id: Number(s.student_id), score: Number(scores[s.student_id]) }))
      if (!records.length) { tcActions.error('Enter at least one score before saving.', 'Nothing to save'); setSaving(false); return }
      const result = await api.post('/teacher-console/results', { ...form, records }).then((r) => r.data)
      tcActions.success(result.message || 'Results saved.', 'Results saved')
      await tcActions.bootstrap()
    } catch (e) { tcActions.error(e?.response?.data?.message || 'Could not save results.', 'Error') } finally { setSaving(false) }
  }

  return (
    <TcLayout>
      <div className="mb-5">
        <h2 className="text-[22px] sm:text-[24px] font-extrabold tracking-tight">Enter Results</h2>
        <p className="text-[13px] text-[#627D98] mt-0.5">Record assessment scores for your assigned subjects and classes.</p>
      </div>

      <div className="sa-card p-4 mb-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="col-span-2 sm:col-span-1">
          <label className="sa-label" htmlFor="rs-class">Class <span className="req">*</span></label>
          <select id="rs-class" value={form.class_id} onChange={(e) => setField('class_id', e.target.value)} className="sa-select">
            <option value="" disabled>Select…</option>
            {classes.map((c) => (
              <option key={c.class_id} value={c.class_id}>{c.class_name}</option>
            ))}
          </select>
        </div>
        <div className="col-span-2 sm:col-span-1">
          <label className="sa-label" htmlFor="rs-subject">Subject <span className="req">*</span></label>
          <select id="rs-subject" value={form.module_id} onChange={(e) => setField('module_id', e.target.value)} className="sa-select">
            <option value="" disabled>Select…</option>
            {subjects.map((s) => (
              <option key={s.module_id} value={s.module_id}>{s.module_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="sa-label" htmlFor="rs-assess">Assessment <span className="req">*</span></label>
          <select id="rs-assess" value={form.assessment} onChange={(e) => setField('assessment', e.target.value)} className="sa-select">
            {assessments.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="sa-label" htmlFor="rs-term">Term</label>
          <select id="rs-term" value={form.term} onChange={(e) => setField('term', e.target.value)} className="sa-select"><option>Term 1</option><option>Term 2</option><option>Term 3</option></select>
        </div>
        <div>
          <label className="sa-label" htmlFor="rs-max">Max score</label>
          <input id="rs-max" value={form.max_score} onChange={(e) => setField('max_score', Number(e.target.value))} type="number" min="1" max="1000" className="sa-input" />
        </div>
        <div className="flex items-end">
          <button type="button" className="sa-btn primary w-full" disabled={!ready || loading} onClick={load}>
            {loading ? <LoaderCircle size={15} className="animate-spin" /> : <Users size={15} />} Load students
          </button>
        </div>
      </div>

      {ownershipError ? (
        <div className="sa-card"><EmptyState icon={ShieldAlert} title="Not your assignment" message={ownershipError} /></div>
      ) : students.length ? (
        <div className="sa-card overflow-hidden">
          <div className="sa-card-head">
            <div>
              <h3 className="sa-card-title"><GraduationCap size={16} className="text-[#1769E0]" /> {className} · {subjectName} · {form.assessment}</h3>
              <p className="sa-card-sub">{form.term} · {form.academic_year} · out of {form.max_score}</p>
            </div>
            <button type="button" className="sa-btn primary sm" disabled={saving} onClick={save}>
              {saving ? <LoaderCircle size={14} className="animate-spin" /> : <Save size={14} />} Save results
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[560px]">
              <thead>
                <tr className="border-b border-[#e9eff8] bg-[#f8fafd]">
                  <th className="px-5 py-3 text-[11px] font-bold uppercase text-[#627D98]">Student</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase text-[#627D98] w-40">Score (0–{form.max_score})</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase text-[#627D98] w-24">%</th>
                  <th className="px-5 py-3 text-[11px] font-bold uppercase text-[#627D98] w-24">Grade</th>
                </tr>
              </thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.student_id} className="border-b border-[#f0f4fa] last:border-0">
                    <td className="px-5 py-2.5">
                      <p className="text-[13px] font-semibold text-[#102A43]">{s.name}</p>
                      <p className="text-[11px] text-[#829AB1]">{s.student_number || '—'}</p>
                    </td>
                    <td className="px-5 py-2.5">
                      <input value={scores[s.student_id] ?? ''} onChange={(e) => setScore(s.student_id, e.target.value === '' ? null : Number(e.target.value))} type="number" min="0" max={form.max_score} step="0.5"
                        className={`w-28 rounded-lg border px-3 py-1.5 text-[13px] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1769E0]/30 ${invalid(s.student_id) ? 'border-[#EF4444] bg-[#FEECEC]' : 'border-[#DCE5F0]'}`} />
                      {invalid(s.student_id) ? <p className="text-[10.5px] text-[#EF4444] mt-1">0–{form.max_score} only</p> : null}
                    </td>
                    <td className="px-5 py-2.5 text-[13px] font-semibold tabular-nums text-[#102A43]">{pct(s.student_id)}</td>
                    <td className="px-5 py-2.5">{scores[s.student_id] != null ? <span className={`inline-flex rounded-full px-2.5 py-[2px] text-[11px] font-extrabold ${gradeClass(grade(s.student_id))}`}>{grade(s.student_id)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : loaded ? (
        <div className="sa-card"><EmptyState icon={Users} title="No students in this class" message="Students must be enrolled before results can be recorded." /></div>
      ) : (
        <div className="sa-card"><EmptyState icon={GraduationCap} title="Choose class, subject and assessment" message="Then press “Load students” to enter scores. Only your own assignments are accepted." /></div>
      )}
    </TcLayout>
  )
}
