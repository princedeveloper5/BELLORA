export default function BelloraLogo({ collapsed = false, logoUrl, alt = 'School logo', label = 'BELLORA', subtitle = 'Smarter Scheduling, Better Learning' }) {
  const fallback = `${import.meta.env.BASE_URL}bellora-brand-mark.png`
  const src = logoUrl || fallback

  return (
    <div className="flex items-center gap-3 min-w-0">
      <img className="bellora-logo-mark" src={src} alt={alt} />
      {!collapsed ? (
        <div className="leading-tight min-w-0">
          <p className="text-white font-bold text-xl tracking-wide">{label}</p>
          {subtitle ? <p className="text-slate-400 text-xs whitespace-nowrap">{subtitle}</p> : null}
        </div>
      ) : null}
    </div>
  )
}
