import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronDown, LogOut } from 'lucide-react'
import BelloraLogo from './BelloraLogo'
import { initials } from '../format'
import './sa-components.css'

export default function AppSidebar({
  sections = [],
  footerItems = [],
  profileTo = '/login',
  userName = 'User',
  roleLabel = '',
  collapsed = false,
  drawer = false,
  onNavigate,
  onLogout,
  logoUrl,
  logoAlt,
  logoLabel,
  logoSubtitle
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const [openGroup, setOpenGroup] = useState('')

  const groupOfPath = (path) => {
    for (const section of sections) {
      for (const item of section.items) {
        if (item.children?.some((child) => path.startsWith(child.to.split('?')[0]))) return item.label
      }
    }
    return ''
  }

  useEffect(() => {
    const group = groupOfPath(location.pathname)
    if (group) setOpenGroup(group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  const toggleGroup = (label) => setOpenGroup((current) => (current === label ? '' : label))
  const groupActive = (item) => item.children?.some((child) => location.pathname.startsWith(child.to.split('?')[0]))
  const exactActive = (child) => `${location.pathname}${location.search}` === child.to

  const go = (to) => {
    navigate(to)
    onNavigate?.()
  }

  const isActive = (item) => location.pathname === item.to || (item.active ? item.active() : false)

  return (
    <aside
      className={`fixed left-3 top-3 bottom-3 w-60 z-40 bg-[#102B42] rounded-2xl border border-slate-800/70 flex flex-col overflow-hidden transition-all duration-200 lg:translate-x-0 ${
        drawer ? 'translate-x-0 shadow-2xl' : '-translate-x-[calc(100%+16px)]'
      } ${collapsed ? 'lg:w-[84px]' : 'lg:w-60'}`}
      aria-label="Primary navigation"
    >
      <div className={`shrink-0 px-5 py-5 ${collapsed ? 'px-0 flex justify-center' : ''}`}>
        <BelloraLogo collapsed={collapsed} logoUrl={logoUrl} alt={logoAlt} label={logoLabel} subtitle={logoSubtitle} />
      </div>

      <nav className="grow overflow-y-auto app-side-scroll px-3 pb-3" role="navigation" aria-label="Main">
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && section.label ? (
              <p className="px-4 pt-4 pb-1.5 text-[10px] font-extrabold uppercase tracking-[0.16em] text-slate-500 select-none">
                {section.label}
              </p>
            ) : null}
            {collapsed && section.label ? <div className="mx-4 my-3 border-t border-slate-800" role="separator" /> : null}

            <div className="space-y-1">
              {section.items.map((item) => {
                const Icon = item.icon

                if (item.children) {
                  const active = groupActive(item)
                  return (
                    <div key={item.label}>
                      <button
                        type="button"
                        className={`side-item ${active ? 'on-parent' : ''} ${collapsed ? 'collapsed' : ''}`}
                        aria-expanded={openGroup === item.label}
                        data-tip={collapsed ? item.label : undefined}
                        onClick={() => toggleGroup(item.label)}
                      >
                        <span className="side-icon">{Icon ? <Icon size={21} /> : null}</span>
                        {!collapsed ? <span className="grow truncate text-left">{item.label}</span> : null}
                        {!collapsed && item.badge ? <span className="side-badge">{item.badge}</span> : null}
                        {!collapsed ? (
                          <ChevronDown
                            size={15}
                            className={`shrink-0 text-slate-500 transition-transform duration-200 ${
                              openGroup === item.label ? 'rotate-180' : ''
                            }`}
                          />
                        ) : null}
                      </button>
                      {!collapsed && openGroup === item.label ? (
                        <div className="mt-1 ml-[22px] pl-3 border-l border-slate-800 space-y-1">
                          {item.children.map((child) => (
                            <button
                              key={child.label}
                              type="button"
                              className={`side-sub ${exactActive(child) || location.pathname === child.to ? 'on' : ''}`}
                              onClick={() => go(child.to)}
                            >
                              <span className="grow truncate text-left">{child.label}</span>
                              {child.badge ? <span className="side-badge">{child.badge}</span> : null}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )
                }

                const active = isActive(item)
                return (
                  <button
                    key={item.label}
                    type="button"
                    className={`side-item ${active ? 'on' : ''} ${collapsed ? 'collapsed' : ''}`}
                    aria-current={active ? 'page' : undefined}
                    data-tip={collapsed ? item.label : undefined}
                    onClick={() => go(item.to)}
                  >
                    <span className="side-icon">{Icon ? <Icon size={21} /> : null}</span>
                    {!collapsed ? <span className="grow truncate text-left">{item.label}</span> : null}
                    {!collapsed && item.badge ? <span className="side-badge">{item.badge}</span> : null}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="shrink-0 border-t border-slate-800 px-3 py-3 space-y-1">
        <button
          type="button"
          className={`side-item !py-2.5 ${collapsed ? 'collapsed' : ''}`}
          data-tip={collapsed ? userName : undefined}
          onClick={() => go(profileTo)}
        >
          <span className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0F9D8A] to-[#12304A] border border-slate-700 grid place-items-center text-[12px] font-bold text-white shrink-0">
            {initials(userName)}
          </span>
          {!collapsed ? (
            <span className="min-w-0 text-left leading-tight">
              <span className="block text-[13px] font-semibold text-white truncate">{userName}</span>
              <span className="block text-[10.5px] text-slate-400 truncate">{roleLabel}</span>
            </span>
          ) : null}
        </button>

        {footerItems.map((item) => {
          const Icon = item.icon
          const active = location.pathname === item.to
          return (
            <button
              key={item.label}
              type="button"
              className={`side-item !py-2.5 ${active ? 'on' : ''} ${collapsed ? 'collapsed' : ''}`}
              data-tip={collapsed ? item.label : undefined}
              onClick={() => go(item.to)}
            >
              <span className="side-icon">{Icon ? <Icon size={20} /> : null}</span>
              {!collapsed ? <span className="grow truncate text-left">{item.label}</span> : null}
            </button>
          )
        })}

        <button
          type="button"
          className={`side-item !py-2.5 !text-red-400 hover:!bg-red-500/10 hover:!text-red-300 ${collapsed ? 'collapsed' : ''}`}
          data-tip={collapsed ? 'Logout' : undefined}
          onClick={onLogout}
        >
          <span className="side-icon">
            <LogOut size={20} />
          </span>
          {!collapsed ? <span className="grow truncate text-left">Logout</span> : null}
        </button>
      </div>
    </aside>
  )
}
