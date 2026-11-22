export default function PantaLogo({ collapsed = false, logoUrl, alt = 'School logo', label = 'PANTA', subtitle = 'Timetable Management System' }) {
  const fallback = `${import.meta.env.BASE_URL}panta-logo.png`
  const src = logoUrl || fallback

  return (
    <div className="flex items-center gap-3 min-w-0">
      <img className="panta-logo-mark" src={src} alt={alt} />
      {!collapsed ? (
        <div className="leading-tight min-w-0">
          <p className="text-white font-bold text-xl tracking-wide">{label}</p>
          <p className="text-slate-400 text-xs whitespace-nowrap">{subtitle}</p>
        </div>
      ) : null}
    </div>
  )
}
