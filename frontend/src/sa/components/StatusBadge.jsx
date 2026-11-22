import {
  CircleCheck,
  Clock3,
  CircleX,
  CirclePause,
  PencilLine,
  Archive,
  TrendingUp,
  Info,
  TriangleAlert,
  CalendarCheck
} from 'lucide-react'

// [classes, icon] — strong-contrast variants for quick scanning
const MAP = {
  active: ['bg-[#18B981] text-white border-[#12A171]', CircleCheck],
  published: ['bg-[#18B981] text-white border-[#12A171]', CircleCheck],
  success: ['bg-[#18B981] text-white border-[#12A171]', CircleCheck],
  approved: ['bg-[#18B981] text-white border-[#12A171]', CircleCheck],
  completed: ['bg-[#18B981] text-white border-[#12A171]', CircleCheck],
  pending: ['bg-[#F59E0B] text-white border-[#D97706]', Clock3],
  upcoming: ['bg-[#1769E0] text-white border-[#0F55B8]', TrendingUp],
  info: ['bg-[#1769E0] text-white border-[#0F55B8]', Info],
  'in progress': ['bg-[#1769E0] text-white border-[#0F55B8]', TrendingUp],
  scheduled: ['bg-[#6D5CE7] text-white border-[#5A4BD1]', CalendarCheck],
  draft: ['bg-[#627D98] text-white border-[#4A6572]', PencilLine],
  suspended: ['bg-[#EF4444] text-white border-[#B91C1C]', CirclePause],
  rejected: ['bg-[#EF4444] text-white border-[#B91C1C]', CircleX],
  danger: ['bg-[#EF4444] text-white border-[#B91C1C]', TriangleAlert],
  archived: ['bg-[#6D5CE7] text-white border-[#5A4BD1]', Archive],
  warning: ['bg-[#F59E0B] text-white border-[#D97706]', TriangleAlert]
}

export default function StatusBadge({ status = '', label = '' }) {
  const [cls, Icon] = MAP[status] || MAP.draft
  const text = label || (status ? status.charAt(0).toUpperCase() + status.slice(1) : '—')

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[11.5px] font-bold whitespace-nowrap border ${cls}`}>
      <Icon size={11} className="shrink-0" aria-hidden="true" />
      {text}
    </span>
  )
}
