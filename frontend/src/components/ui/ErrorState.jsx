import './ui.css'

export default function ErrorState({
  title = 'Unable to Load Data',
  description = "We're having trouble retrieving this information right now. Please check your internet connection or try again.",
  actionLabel = 'Retry',
  onRetry
}) {
  return (
    <section className="app-state app-state-error" role="alert" aria-live="polite">
      <div className="state-mark" aria-hidden="true">
        !
      </div>
      <div className="state-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actionLabel ? (
        <button type="button" className="state-action" onClick={onRetry}>
          {actionLabel}
        </button>
      ) : null}
    </section>
  )
}
