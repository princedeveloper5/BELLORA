import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Menu, School, Search } from 'lucide-react'
import NotificationMenu from './NotificationMenu'
import UserProfileMenu from './UserProfileMenu'
import { dosStore, dosSelectors } from '../dosStore'
import { useStore } from '@/stores/useStore'
import { useClickOutside } from '@/hooks/useClickOutside'

export default function TopHeader({ onToggleSidebar, navigationExpanded, onLogout }) {
  const store = useStore(dosStore)
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const searchBox = useRef(null)
  useClickOutside(searchBox, () => setOpen(false))

  const results = (() => {
    const q = query.toLowerCase()
    if (!q) return []
    return dosSelectors
      .searchIndex(store)
      .filter((r) => r.label.toLowerCase().includes(q) || r.sub.toLowerCase().includes(q))
      .slice(0, 8)
  })()

  const go = (r) => {
    setOpen(false)
    setQuery('')
    navigate(r.to)
  }

  return (
    <header
      className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[var(--panta-border)] flex items-center gap-2 sm:gap-3 px-3 sm:px-5"
      style={{ height: 'var(--panta-header-h)' }}
    >
      <button
        type="button"
        className="bg-slate-100 hover:bg-slate-200 text-slate-700 p-2 rounded-lg transition-colors shrink-0"
        aria-label={navigationExpanded ? 'Collapse navigation' : 'Open navigation'}
        aria-expanded={navigationExpanded}
        aria-controls="dos-primary-navigation"
        title={navigationExpanded ? 'Collapse navigation' : 'Open navigation'}
        onClick={onToggleSidebar}
      >
        <Menu size={19} />
      </button>

      <div className="min-w-0 hidden lg:block shrink-0">
        <p className="text-[12px] font-semibold truncate flex items-center gap-1" style={{ color: 'var(--panta-muted)' }}>
          <School size={10} className="shrink-0" />
          {store.overview?.schoolName || 'My School'}
          {store.overview?.activeYear ? (
            <span
              className="ml-1.5 inline-flex items-center rounded-full px-2 py-[1px] text-[9.5px] font-extrabold"
              style={{ background: 'var(--panta-light-blue)', color: 'var(--panta-teal)' }}
            >
              {store.overview.activeYear}
              {store.overview?.activeTerm ? ` · ${store.overview.activeTerm}` : ''}
            </span>
          ) : null}
        </p>
      </div>

      <div className="relative w-full max-w-md" ref={searchBox}>
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#829AB1] pointer-events-none" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value.trim())}
          type="search"
          role="combobox"
          aria-expanded={open}
          aria-label="Search teachers, classes, subjects"
          placeholder="Search..."
          className="w-full h-10 rounded-full bg-[var(--panta-bg)] border border-transparent pl-10 pr-4 text-[13.5px] placeholder:text-[#829AB1] focus:outline-none focus:bg-white focus:border-[var(--panta-teal)] focus:ring-4 focus:ring-[#0F9D8A]/10 transition"
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'Enter' && results.length) go(results[0])
          }}
        />
        {open && query ? (
          <div className="absolute left-0 right-0 top-12 rounded-xl border border-[var(--panta-border)] bg-white shadow-[0_16px_40px_rgba(15,37,73,0.16)] overflow-hidden z-50">
            {results.length ? (
              <div className="max-h-[300px] overflow-y-auto py-1.5">
                {results.map((r) => (
                  <button
                    key={r.kind + r.label}
                    type="button"
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#f6fbfa] text-left transition"
                    onClick={() => go(r)}
                  >
                    <span
                      className={`shrink-0 text-[9.5px] font-extrabold tracking-wide px-2 py-[3px] rounded-md uppercase ${
                        r.kind === 'Teacher'
                          ? 'bg-[#E7F5F2] text-[#0B7F70]'
                          : r.kind === 'Class'
                            ? 'bg-[#EAF3FF] text-[#0F55B8]'
                            : 'bg-[#FFF7E6] text-[#B07409]'
                      }`}
                    >
                      {r.kind}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold text-[var(--panta-text)] truncate">{r.label}</span>
                      <span className="block text-[11.5px] text-[var(--panta-muted)] truncate">{r.sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-[var(--panta-muted)]">No results for “{query}”.</p>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-center gap-1 ml-auto">
        <NotificationMenu />
        <UserProfileMenu onLogout={onLogout} />
      </div>
    </header>
  )
}
