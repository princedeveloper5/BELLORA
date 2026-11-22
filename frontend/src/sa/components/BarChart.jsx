export default function BarChart({ labels = [], series = [], ariaLabel = 'Bar chart' }) {
  const W = 720
  const H = 260
  const PAD = 40
  const BOT = 26

  const max = Math.max(1, ...series.flatMap((s) => s.data))
  const pow = Math.pow(10, Math.floor(Math.log10(max)))
  const niceMax = Math.ceil(max / pow) * pow || 1
  const ticks = [0, 1, 2, 3, 4].map((i) => Math.round((niceMax / 4) * i))
  const y = (v) => H - BOT - (v / niceMax) * (H - BOT - 14)
  const groupW = (W - PAD - 6) / Math.max(1, labels.length)
  const barW = Math.min(26, (groupW * 0.62) / Math.max(1, series.length))
  const groupX = (li) => PAD + li * groupW
  const barX = (li, si) => groupX(li) + (groupW - barW * series.length) / 2 + si * barW
  const hasData = series.some((s) => s.data.some((v) => v > 0))

  return (
    <div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={ariaLabel}>
          {ticks.map((tick, index) => (
            <g key={index}>
              <line x1={PAD} x2={W - 6} y1={y(tick)} y2={y(tick)} stroke="#eef2f9" strokeWidth="1" />
              <text x={PAD - 8} y={y(tick) + 3.5} textAnchor="end" className="sa-chart-tick">
                {tick}
              </text>
            </g>
          ))}
          {labels.map((label, li) => (
            <g key={label}>
              {series.map((s) => (
                <rect
                  key={s.name}
                  x={barX(li, series.indexOf(s))}
                  y={y(s.data[li] || 0)}
                  width={barW}
                  height={Math.max(0, H - BOT - y(s.data[li] || 0))}
                  fill={s.color}
                  rx="3"
                  className="transition-opacity hover:opacity-80"
                >
                  <title>{`${s.name} · ${label}: ${s.data[li]}`}</title>
                </rect>
              ))}
              <text x={groupX(li) + groupW / 2} y={H - 8} textAnchor="middle" className="sa-chart-tick">
                {label}
              </text>
            </g>
          ))}
        </svg>
        {!hasData ? (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-[#829AB1]">No data for this period</div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-4 mt-3">
        {series.map((s) => (
          <span key={s.name} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[#627D98]">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} />
            {s.name}
          </span>
        ))}
      </div>
    </div>
  )
}
