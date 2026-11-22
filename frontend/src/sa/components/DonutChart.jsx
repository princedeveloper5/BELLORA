export default function DonutChart({
  data = [],
  size = 168,
  thickness = 22,
  centerLabel = 'Total',
  ariaLabel = 'Distribution chart'
}) {
  const c = size / 2
  const r = size / 2 - thickness
  const circ = 2 * Math.PI * r
  const total = data.reduce((a, b) => a + b.value, 0)

  let acc = 0
  const segments = data
    .filter((d) => d.value > 0)
    .map((d) => {
      const frac = total ? d.value / total : 0
      const segment = {
        ...d,
        len: Math.max(0.5, frac * circ - 2),
        offset: acc * circ,
        pct: Math.round(frac * 100)
      }
      acc += frac
      return segment
    })

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: `${size}px`, height: `${size}px` }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90" role="img" aria-label={ariaLabel}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#eef2f9" strokeWidth={thickness} />
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={c}
              cy={c}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={thickness}
              strokeDasharray={`${seg.len} ${circ - seg.len}`}
              strokeDashoffset={-seg.offset}
              strokeLinecap="butt"
              className="transition-all duration-500"
            >
              <title>{`${seg.label}: ${seg.value}`}</title>
            </circle>
          ))}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-extrabold text-[#102A43] tabular-nums leading-7">{total}</span>
          <span className="text-[11px] font-semibold text-[#829AB1] uppercase tracking-wide">{centerLabel}</span>
        </div>
      </div>
      <ul className="space-y-2.5 w-full min-w-0">
        {segments.map((seg) => (
          <li key={seg.label} className="flex items-center gap-2.5 text-[13px]">
            <span className="w-3 h-3 rounded-[4px] shrink-0" style={{ background: seg.color }} />
            <span className="text-[#627D98] grow truncate">{seg.label}</span>
            <span className="font-bold text-[#102A43] tabular-nums">{seg.value}</span>
            <span className="text-[#829AB1] text-[12px] w-11 text-right tabular-nums">{seg.pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
