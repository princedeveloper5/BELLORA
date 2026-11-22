import { useId } from 'react'

export default function LineChart({ labels = [], series = [], ariaLabel = 'Trend chart' }) {
  const uid = useId().replace(/:/g, '')
  const W = 720
  const H = 260
  const PAD = 40
  const BOT = 26

  const max = Math.max(1, ...series.flatMap((s) => s.data))
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const niceMax = Math.ceil(max / pow) * pow || 1
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((niceMax / 4) * i))
  const x = (i) => PAD + (i / Math.max(1, labels.length - 1)) * (W - PAD - 20)
  const y = (v) => H - BOT - (v / niceMax) * (H - BOT - 14)

  const linePath = (data) => data.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(v)}`).join(' ')
  const areaPath = (data) => `${linePath(data)} L${x(data.length - 1)},${H - BOT} L${x(0)},${H - BOT} Z`

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
        <defs>
          {series.map((s, i) => (
            <linearGradient key={s.name} id={`sa-lg-${uid}-${i}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.22" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {ticks.map((tick, index) => (
          <g key={index}>
            <line x1={PAD} x2={W - 10} y1={y(tick)} y2={y(tick)} stroke="#eef2f9" strokeWidth="1" />
            <text x={PAD - 8} y={y(tick) + 3.5} textAnchor="end" className="sa-chart-tick">
              {tick}
            </text>
          </g>
        ))}
        {series.map((s, i) => (
          <g key={s.name}>
            <path d={areaPath(s.data)} fill={`url(#sa-lg-${uid}-${i})`} />
            <path
              d={linePath(s.data)}
              fill="none"
              stroke={s.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {s.data.map((v, li) => (
              <circle key={li} cx={x(li)} cy={y(v)} r="3.2" fill="#fff" stroke={s.color} strokeWidth="2">
                <title>{`${s.name} · ${labels[li]}: ${v}`}</title>
              </circle>
            ))}
          </g>
        ))}
        {labels.map((label, li) => (
          <text key={label} x={x(li)} y={H - 8} textAnchor="middle" className="sa-chart-tick">
            {label}
          </text>
        ))}
      </svg>
      <div className="flex flex-wrap items-center gap-4 mt-3">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#627D98]">
            <span className="w-4 h-[3px] rounded-full" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
