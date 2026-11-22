import { createPortal } from 'react-dom'
import { CircleCheck, CircleX, X } from 'lucide-react'

export default function ToastViewport({ toasts = [], onDismiss }) {
  return createPortal(
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2.5 w-[calc(100vw-2rem)] max-w-sm"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 shadow-[0_12px_32px_rgba(15,37,73,0.18)] bg-white sa-toast-enter ${
            t.type === 'error' ? 'border-[#fecaca]' : 'border-[#bbe7d3]'
          }`}
        >
          <span
            className={`shrink-0 w-7 h-7 rounded-full grid place-items-center mt-0.5 ${
              t.type === 'error' ? 'bg-[#FEECEC] text-[#EF4444]' : 'bg-[#E8F8F2] text-[#0E9F70]'
            }`}
          >
            {t.type === 'error' ? <CircleX size={15} /> : <CircleCheck size={15} />}
          </span>
          <div className="min-w-0 grow">
            {t.title ? <p className="text-[13px] font-bold text-[#102A43]">{t.title}</p> : null}
            <p className="text-[12.5px] text-[#627D98] leading-snug">{t.message}</p>
          </div>
          <button
            type="button"
            className="text-[#829AB1] hover:text-[#102A43] transition"
            aria-label="Dismiss notification"
            onClick={() => onDismiss?.(t.id)}
          >
            <X size={15} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
