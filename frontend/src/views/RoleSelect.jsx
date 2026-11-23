import { Link, useNavigate } from 'react-router-dom'
import { Building2, Crown, ClipboardList, UserRound, Users, ChevronRight } from 'lucide-react'
import './RoleSelect.css'

const roles = [
  {
    key: 'super_admin', name: 'Super Admin', icon: Crown,
    desc: 'Full control over the entire system, users, school settings and data.',
    iconBg: 'bg-gradient-to-br from-[#12304A] to-[#0B2235]', border: 'border-[#DCE5F0] hover:border-[#1769E0]',
    to: '/login?role=super_admin'
  },
  {
    key: 'dos', name: 'Director of Studies', icon: ClipboardList,
    desc: 'Manage timetables, monitor academics, assign teachers and classes.',
    iconBg: 'bg-gradient-to-br from-[#1769E0] to-[#0F55B8]', border: 'border-[#DCE5F0] hover:border-[#1769E0]',
    to: '/login?role=dos'
  },
  {
    key: 'teacher', name: 'Teacher', icon: UserRound,
    desc: 'View your classes, timetable and manage your subjects.',
    iconBg: 'bg-gradient-to-br from-[#0F9D8A] to-[#0B7F70]', border: 'border-[#DCE5F0] hover:border-[#0F9D8A]',
    to: '/login?role=teacher'
  },
  {
    key: 'student', name: 'Student', icon: Users,
    desc: 'View your timetable, subjects and academic details.',
    iconBg: 'bg-gradient-to-br from-[#0B7F70] to-[#075F54]', border: 'border-[#DCE5F0] hover:border-[#0F9D8A]',
    to: '/login?role=student'
  }
]

const registrationRoles = [
  {
    key: 'school', name: 'School', icon: Building2,
    desc: 'For a new school: create its workspace and first Director of Studies account.',
    iconBg: 'bg-gradient-to-br from-[#12304A] to-[#0B2235]', border: 'border-[#DCE5F0] hover:border-[#1769E0]',
    to: '/dos/register?for=school'
  },
  {
    key: 'teacher', name: 'Teacher', icon: UserRound,
    desc: 'Join an approved school. Your Director of Studies will review the request.',
    iconBg: 'bg-gradient-to-br from-[#0F9D8A] to-[#0B7F70]', border: 'border-[#DCE5F0] hover:border-[#0F9D8A]',
    to: '/register/teacher'
  },
  {
    key: 'dos', name: 'Director of Studies', icon: ClipboardList,
    desc: 'For a new school: submit its details with your Director of Studies account. Existing schools need a system administrator to add you.',
    iconBg: 'bg-gradient-to-br from-[#1769E0] to-[#0F55B8]', border: 'border-[#DCE5F0] hover:border-[#1769E0]',
    to: '/dos/register?for=dos'
  }
]

export default function RoleSelect({ registration = false }) {
  const navigate = useNavigate()
  const options = registration ? registrationRoles : roles

  const pick = (role) => {
    // Navigation convenience only — authorization is always enforced by the backend.
    navigate(role.to)
  }

  return (
    <div className={`role-select-page min-h-screen flex flex-col items-center justify-center p-4 sm:p-8${registration ? ' is-registration-choice' : ''}`}>
      <div className="role-select-shell w-full max-w-xl">
        {/* Header */}
        <div className="text-center mb-8">
          <Link to="/login" className="inline-flex items-center gap-2.5 mb-6 group">
            <span className="role-select-logo w-12 h-12 rounded-xl bg-white grid place-items-center overflow-hidden shadow-lg shadow-[#12304a]/15 group-hover:-translate-y-0.5 transition-transform">
              <img className="w-full h-full object-contain p-0.5" src={`${import.meta.env.BASE_URL}bellora-brand-mark.png`} alt="" />
            </span>
            <span className="text-left leading-tight">
              <span className="block text-[17px] font-extrabold text-[#102A43] tracking-wide">BELLORA</span>
              <span className="block text-[10.5px] font-medium text-[#627D98]">Smarter Scheduling, Better Learning</span>
            </span>
          </Link>
          <h1 className="role-select-title text-[24px] sm:text-[28px] font-extrabold text-[#102A43] tracking-tight">
            {registration ? 'Create your BELLORA account' : 'Choose Your Role'}
          </h1>
          <p className="role-select-subtitle text-[13.5px] text-[#627D98] mt-1.5">
            {registration ? 'First, tell us how you’ll use BELLORA.' : 'Log in based on your role in the school.'}
          </p>
        </div>

        {/* Role cards */}
        <div className="role-select-options space-y-3.5">
          {options.map((role) => {
            const RoleIcon = role.icon
            return (
              <button key={role.key} type="button"
                className={`role-choice-card w-full flex items-center gap-4 rounded-2xl border bg-white p-4 sm:p-5 text-left transition-all duration-150 hover:-translate-y-0.5 hover:shadow-[0_12px_32px_rgba(15,37,73,0.10)] focus:outline-none focus:ring-2 focus:ring-[#0f9d8a]/40 ${role.border}`}
                onClick={() => pick(role)}>
                <span className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl grid place-items-center text-white shrink-0 shadow-sm ${role.iconBg}`}>
                  <RoleIcon size={24} />
                </span>
                <span className="min-w-0 grow">
                  <span className="block text-[15.5px] sm:text-[16.5px] font-bold text-[#102A43]">{role.name}</span>
                  <span className="block text-[12.5px] sm:text-[13px] text-[#627D98] mt-0.5 leading-snug">{role.desc}</span>
                </span>
                <ChevronRight size={19} className="text-[#b6c5da] shrink-0" />
              </button>
            )
          })}
        </div>

        {/* Footer */}
        <p className="text-center text-[12.5px] text-[#9fb0c7] italic mt-10 flex items-center justify-center gap-3">
          <span className="w-8 h-px bg-[#d5e0ef]"></span>
          {registration ? (
            <><span>Already have an account?</span><Link className="role-select-login-link" to="/login">Sign in</Link></>
          ) : '“Better planning today, leads to brighter tomorrows.”'}
          <span className="w-8 h-px bg-[#d5e0ef]"></span>
        </p>
      </div>
    </div>
  )
}
