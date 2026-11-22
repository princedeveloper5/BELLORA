import { createPortal } from 'react-dom'
import { notificationStore, notificationActions } from '@/stores/notificationStore'
import { useStore } from '@/stores/useStore'
import './TopFeedback.css'

const progressTitle = (item) => {
  if (item.type === 'error') return 'Checking failed action...'
  if (item.type === 'success') return 'Saving changes...'
  if (item.type === 'warning') return 'Checking action...'
  return 'Processing...'
}

export default function TopFeedback({ loading = false }) {
  const { items } = useStore(notificationStore)

  return createPortal(
    <div className="top-feedback" aria-live="polite" aria-atomic="true">
      {loading ? (
        <div className="top-progress" aria-hidden="true">
          <span />
        </div>
      ) : null}

      <div className="panta-notification-stack">
        {items.map((item) => (
          <article key={item.id} className={`panta-notification ${item.type}`}>
            <div>
              <strong>{item.complete ? item.title : progressTitle(item)}</strong>
              <p>{item.complete ? item.message : `Progress ${item.progress}%`}</p>
            </div>
            <button type="button" aria-label="Dismiss notification" onClick={() => notificationActions.remove(item.id)}>
              x
            </button>
            <span className="panta-notification-progress" aria-hidden="true">
              <span style={{ width: `${item.progress}%` }} />
            </span>
          </article>
        ))}
      </div>
    </div>,
    document.body
  )
}
