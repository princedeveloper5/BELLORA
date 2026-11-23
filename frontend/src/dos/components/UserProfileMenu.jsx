import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronDown, LogOut, Settings } from 'lucide-react'
import { useAuthStore } from '@/stores/authStore'
import { initials } from '@/sa/format'
import { useClickOutside } from '@/hooks/useClickOutside'
import { resolveAssetUrl } from '@/utils/resolveAssetUrl'

const links = [{ label: 'Settings', to: '/dos/settings', icon: Settings }]

export default function UserProfileMenu({ onLogout }) {
  const auth = useAuthStore()
  const [open, setOpen] = useState(false)
  const root = useRef(null)
  useClickOutside(root, () => setOpen(false))

  const userName = auth.user?.name || auth.user?.full_name || 'Director'
  const userEmail = auth.user?.email || ''
  const profilePhoto = resolveAssetUrl(auth.user?.profile_photo)

  return (
    <div className="relative" ref={root}>
      <button
        type="button"
        className="flex items-center gap-2.5 rounded-full pl-1 pr-2 sm:pr-3 py-1 hover:bg-[#f1f5fb] transition"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="relative">
          <span
            className="w-9 h-9 rounded-full grid place-items-center text-[13px] font-bold text-white"
            style={{ background: 'linear-gradient(135deg, var(--panta-teal), var(--panta-sidebar))' }}
          >
            {profilePhoto ? <img className="h-full w-full rounded-full object-cover" src={profilePhoto} alt="" /> : initials(userName)}
          </span>
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[#18B981] border-2 border-white" title="Online" />
        </span>
        <span className="hidden lg:block text-left leading-tight">
          <span className="block text-[13px] font-bold text-[var(--panta-text)]">{userName}</span>
          <span className="block text-[10.5px] text-[var(--panta-muted)] font-medium">Director of Studies</span>
        </span>
        <ChevronDown size={14} className="hidden lg:block text-[#829AB1]" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-12 w-52 rounded-xl border border-[var(--panta-border)] bg-white shadow-[0_16px_40px_rgba(15,37,73,0.16)] py-1.5 z-50"
        >
          <div className="px-4 py-2.5 border-b border-[#eef2f9] mb-1">
            <p className="text-[13px] font-bold text-[var(--panta-text)]">{userName}</p>
            <p className="text-[11.5px] text-[var(--panta-muted)] truncate">{userEmail}</p>
          </div>
          {links.map((l) => {
            const Icon = l.icon
            return (
              <Link
                key={l.label}
                to={l.to}
                role="menuitem"
                className="flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-[#102A43] hover:bg-[#f6fbfa] transition"
                onClick={() => setOpen(false)}
              >
                <Icon size={15} />
                {l.label}
              </Link>
            )
          })}
          <button
            type="button"
            role="menuitem"
            className="w-full flex items-center gap-2.5 px-4 py-2 text-[13px] font-medium text-[#EF4444] hover:bg-[#fef2f2] transition"
            onClick={() => {
              setOpen(false)
              onLogout?.()
            }}
          >
            <LogOut size={15} />
            Logout
          </button>
        </div>
      ) : null}
    </div>
  )
}
