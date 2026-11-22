import './ui.css'

export default function EmptyState({
  title = 'Nothing here yet',
  description = 'Data will appear here once it is available.',
  children
}) {
  return (
    <section className="app-state app-state-empty" aria-live="polite">
      <div className="state-mark" aria-hidden="true" />
      <div className="state-copy">
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {children}
    </section>
  )
}
