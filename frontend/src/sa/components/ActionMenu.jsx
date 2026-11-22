import { useRef, useState } from 'react'
import { EllipsisVertical } from 'lucide-react'
import { useClickOutside } from '@/hooks/useClickOutside'

export default function ActionMenu({ items = [], label = 'Row actions' }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)

  useClickOutside(rootRef, () => setOpen(false), open)

  const pick = (item) => {
    setOpen(false)
    item.handler?.()
  }

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        type="button"
        className="p-1.5 rounded-lg text-[#627D98] hover:text-[#102A43] hover:bg-[#eef3fa] transition"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation()
          setOpen((value) => !value)
        }}
      >
        <EllipsisVertical size={17} />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 mt-1.5 w-48 rounded-xl border border-[#DCE5F0] bg-white shadow-[0_12px_32px_rgba(15,37,73,0.14)] py-1.5 z-40 sa-menu-enter">
          {items.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                className={`w-full flex items-center gap-2.5 px-3.5 py-2 text-[13px] font-medium transition text-left ${
                  item.danger ? 'text-[#EF4444] hover:bg-[#fef2f2]' : 'text-[#102A43] hover:bg-[#f4f8fd]'
                }`}
                onClick={(event) => {
                  event.stopPropagation()
                  pick(item)
                }}
              >
                {Icon ? <Icon size={15} className="shrink-0" /> : null}
                {item.label}
              </button>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
