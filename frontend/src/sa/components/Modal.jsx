import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

const SIZES = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl'
}

export default function Modal({
  open = false,
  title = '',
  subtitle = '',
  size = 'md',
  closable = true,
  onClose,
  children,
  footer
}) {
  useEffect(() => {
    if (!open || !closable) return undefined

    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.()
    }

    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, closable, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4 sm:p-6 sa-modal-enter"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="absolute inset-0 bg-[#071D33]/50 backdrop-blur-[2px]" onClick={closable ? onClose : undefined} />
      <div
        className={`relative w-full bg-white rounded-2xl shadow-2xl border border-[#DCE5F0] flex flex-col max-h-[92vh] sa-modal-panel ${
          SIZES[size] || SIZES.md
        }`}
      >
        <header className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-[#eef2f9]">
          <div>
            <h2 className="text-[17px] font-bold text-[#102A43]">{title}</h2>
            {subtitle ? <p className="text-[13px] text-[#6b7f9e] mt-0.5">{subtitle}</p> : null}
          </div>
          {closable ? (
            <button
              type="button"
              className="p-1.5 -m-1 rounded-lg text-[#829AB1] hover:text-[#102A43] hover:bg-[#f1f5fb] transition"
              aria-label="Close dialog"
              onClick={onClose}
            >
              <X size={18} />
            </button>
          ) : null}
        </header>
        <div className="px-5 sm:px-6 py-5 overflow-y-auto grow">{children}</div>
        {footer ? (
          <footer className="px-5 sm:px-6 py-4 border-t border-[#eef2f9] flex flex-col-reverse sm:flex-row sm:justify-end gap-2.5">
            {footer}
          </footer>
        ) : null}
      </div>
    </div>,
    document.body
  )
}
