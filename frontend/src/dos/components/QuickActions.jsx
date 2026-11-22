import { CalendarClock, FileBarChart, Layers, Users } from 'lucide-react'
import { theme } from '../theme'

const actions = [
  { label: 'Manage Timetable', to: '/dos/timetables', icon: CalendarClock, accent: theme.colors.teal },
  { label: 'Assign Teachers', to: '/dos/teachers', icon: Users, accent: theme.colors.accentBlue },
  { label: 'Manage Classes', to: '/dos/classes', icon: Layers, accent: theme.colors.accentPurple },
  { label: 'Academic Reports', to: '/dos/reports', icon: FileBarChart, accent: theme.colors.accentAmber }
]

export default function QuickActions({ onAction }) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--panta-border)] shadow-[0_1px_3px_rgba(15,37,73,0.05)] h-fit">
      <div className="px-5 py-4 border-b border-[#eef2f9]">
        <h3 className="text-[15px] font-bold" style={{ color: 'var(--panta-text)' }}>
          Quick Actions
        </h3>
      </div>
      <div className="p-4 grid grid-cols-2 gap-3">
        {actions.map((a) => {
          const Icon = a.icon
          return (
            <button
              key={a.label}
              type="button"
              className="flex flex-col items-center gap-2.5 rounded-xl border border-[#eef2f9] px-3 py-4 hover:border-[#a7e5cd] hover:bg-[#f4fdf9] transition group"
              onClick={() => onAction?.(a)}
            >
              <span
                className="w-10 h-10 rounded-xl grid place-items-center transition-transform group-hover:scale-105"
                style={{ background: `${a.accent}1F`, color: a.accent }}
              >
                <Icon size={19} />
              </span>
              <span className="text-[11.5px] font-semibold text-[#627D98] group-hover:text-[#18B981] text-center leading-tight">
                {a.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
