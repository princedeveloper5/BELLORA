import './ui.css'

export default function LoadingState({ rows = 4 }) {
  return (
    <section className="loading-state" aria-live="polite" aria-busy="true">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="skeleton-row" />
      ))}
    </section>
  )
}
