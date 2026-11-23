import './Preloader.css'

export default function Preloader({ loading }) {
  if (!loading) return null

  return (
    <div
      className="preloader-container preloader-fade-enter"
      role="status"
      aria-live="polite"
      aria-label="Loading BELLORA"
    >
      <div className="preloader-brand" aria-hidden="true">
        <img src={`${import.meta.env.BASE_URL}bellora-brand-lockup.png`} alt="" />
      </div>
      <div className="preloader-progress" aria-label="Loading">
        <span className="loader-ring" aria-hidden="true" />
      </div>
    </div>
  )
}
