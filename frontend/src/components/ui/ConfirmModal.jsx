import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ui.css'

export default function ConfirmModal({
  open = false,
  title = 'Confirm Action',
  description = 'Are you sure you want to continue?',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  loadingLabel = 'Working...',
  loading = false,
  danger = false,
  onClose,
  onConfirm
}) {
  const titleId = useId()
  const modalRef = useRef(null)
  const cancelRef = useRef(null)
  const confirmRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined

    const onKeydown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        if (!loading) onClose?.()
      }
    }

    document.addEventListener('keydown', onKeydown)
    modalRef.current?.focus()
    cancelRef.current?.focus()

    return () => document.removeEventListener('keydown', onKeydown)
  }, [open, loading, onClose])

  const cycleFocus = (event) => {
    const focusables = [cancelRef.current, confirmRef.current].filter(Boolean)
    if (!focusables.length) return
    const currentIndex = focusables.indexOf(document.activeElement)
    const nextIndex = event.shiftKey
      ? (currentIndex <= 0 ? focusables.length - 1 : currentIndex - 1)
      : (currentIndex === focusables.length - 1 ? 0 : currentIndex + 1)
    focusables[nextIndex]?.focus()
  }

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !loading && onClose?.()}>
      <section
        ref={modalRef}
        className="confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={cycleFocus}
      >
        <header>
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="icon-close" aria-label="Close dialog" onClick={onClose}>
            x
          </button>
        </header>
        <p>{description}</p>
        <footer>
          <button ref={cancelRef} type="button" className="cancel-btn" disabled={loading} onClick={onClose}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`confirm-btn${danger ? ' danger' : ''}`}
            disabled={loading}
            onClick={onConfirm}
          >
            {loading ? loadingLabel : confirmLabel}
          </button>
        </footer>
      </section>
    </div>,
    document.body
  )
}
