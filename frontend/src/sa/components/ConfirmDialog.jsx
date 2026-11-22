import { useEffect, useState } from 'react'
import { TriangleAlert, CircleHelp, LoaderCircle } from 'lucide-react'
import Modal from './Modal'

export default function ConfirmDialog({
  open = false,
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  danger = true,
  requireReason = false,
  reasonPlaceholder = 'Explain why…',
  busy = false,
  onCancel,
  onConfirm
}) {
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState('')

  useEffect(() => {
    if (open) {
      setReason('')
      setReasonError('')
    }
  }, [open])

  const confirm = () => {
    if (requireReason && reason.trim().length < 4) {
      setReasonError('Please provide a reason (at least 4 characters).')
      return
    }
    onConfirm?.(reason.trim())
  }

  return (
    <Modal
      open={open}
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <button type="button" className="sa-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`sa-btn ${danger ? 'danger' : 'primary'}`}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? <LoaderCircle size={15} className="animate-spin" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-3.5">
        <span
          className={`shrink-0 w-10 h-10 rounded-full grid place-items-center ${
            danger ? 'bg-[#FEECEC] text-[#EF4444]' : 'bg-[#EAF3FF] text-[#1769E0]'
          }`}
        >
          {danger ? <TriangleAlert size={19} /> : <CircleHelp size={19} />}
        </span>
        <div className="min-w-0">
          <p className="text-[14px] text-[#102A43] leading-relaxed">{message}</p>
          {requireReason ? (
            <div className="mt-3.5">
              <label className="block text-[12.5px] font-semibold text-[#102A43] mb-1.5" htmlFor="confirm-reason">
                Reason <span className="text-[#EF4444]">*</span>
              </label>
              <textarea
                id="confirm-reason"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
                placeholder={reasonPlaceholder}
                className="w-full rounded-lg border border-[#d5e0ef] px-3 py-2 text-[13.5px] text-[#102A43] focus:outline-none focus:ring-2 focus:ring-[#1769E0]/30 focus:border-[#1769E0] resize-none"
              />
              {reasonError ? <p className="mt-1.5 text-[12px] text-[#EF4444]">{reasonError}</p> : null}
            </div>
          ) : null}
        </div>
      </div>
    </Modal>
  )
}
