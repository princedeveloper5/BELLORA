import { TrendingUp, TrendingDown } from 'lucide-react'

const TONES = {
  blue: 'bg-gradient-to-br from-[#2F80ED] to-[#0F55B8]',
  green: 'bg-gradient-to-br from-[#18B981] to-[#0E9F70]',
  amber: 'bg-gradient-to-br from-[#f59e0b] to-[#d97706]',
  purple: 'bg-gradient-to-br from-[#6D5CE7] to-[#6d28d9]',
  red: 'bg-gradient-to-br from-[#ef4444] to-[#b91c1c]',
  cyan: 'bg-gradient-to-br from-[#06b6d4] to-[#0e7490]'
}

export default function KpiCard({
  title,
  value,
  trend = '',
  caption = 'vs last month',
  icon: Icon,
  tone = 'blue',
  down = false,
  onClick
}) {
  const TrendIcon = down ? TrendingDown : TrendingUp

  return (
    <button
      type="button"
      className="group w-full text-left bg-white rounded-xl border border-[#DCE5F0] p-4 sm:p-5 shadow-[0_1px_3px_rgba(15,37,73,0.05)] hover:shadow-[0_8px_24px_rgba(23,105,224,0.12)] hover:border-[#c5d9f7] hover:-translate-y-[1px] transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#1769E0]/40"
      onClick={onClick}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11.5px] font-bold uppercase tracking-[0.05em] text-[#627D98]">{title}</p>
          <p className="text-[26px] leading-8 font-extrabold text-[#102A43] mt-1.5 tabular-nums">{value}</p>
        </div>
        <span className={`w-11 h-11 rounded-xl grid place-items-center shrink-0 text-white shadow-sm ${TONES[tone] || TONES.blue}`}>
          <Icon size={21} />
        </span>
      </div>
      <div className="mt-2.5 flex items-center gap-1.5 text-[12px]">
        <TrendIcon size={14} className={down ? 'text-[#ef4444]' : 'text-[#18B981]'} />
        <span className={`font-semibold ${down ? 'text-[#ef4444]' : 'text-[#0E9F70]'}`}>{trend}</span>
        <span className="text-[#829AB1]">{caption}</span>
      </div>
    </button>
  )
}
