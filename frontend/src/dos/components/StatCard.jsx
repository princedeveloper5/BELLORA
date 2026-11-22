export default function StatCard({ label, value = '—', trend = '', icon: Icon, accent = '#18B981', onClick }) {
  const tint = `${accent}1F`

  return (
    <button
      type="button"
      className="bg-white rounded-2xl border border-[var(--panta-border)] p-4 flex items-center gap-3.5 text-left shadow-[0_1px_3px_rgba(15,37,73,0.05)] hover:shadow-[0_8px_24px_rgba(8,191,165,0.12)] hover:border-[#a7e5cd] hover:-translate-y-[1px] transition-all focus:outline-none focus:ring-2 focus:ring-[#0F9D8A]/40"
      onClick={onClick}
    >
      <span className="w-12 h-12 rounded-xl grid place-items-center shrink-0" style={{ background: tint, color: accent }}>
        {Icon ? <Icon size={22} /> : null}
      </span>
      <span className="min-w-0">
        <span className="block text-[12px] font-semibold" style={{ color: 'var(--panta-muted)' }}>
          {label}
        </span>
        <span className="block text-[24px] leading-7 font-extrabold tabular-nums" style={{ color: 'var(--panta-text)' }}>
          {value}
        </span>
        <span className="block text-[11.5px] font-semibold text-[#0B7F70]">{trend}</span>
      </span>
    </button>
  )
}
