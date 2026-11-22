import './Preloader.css'

export default function Preloader({ loading }) {
  if (!loading) return null

  return (
    <div
      className="preloader-container preloader-fade-enter"
      role="status"
      aria-live="polite"
      aria-label="Loading PANTA"
    >
      <div className="preloader-brand" aria-hidden="true">
        <div className="preloader-calendar">
          <i />
          <b />
          <span />
        </div>
        <div>
          <strong>PANTA</strong>
          <small>Timetable Management System</small>
        </div>
      </div>
      <div className="preloader-progress" aria-label="Loading">
        <span className="loader-ring" aria-hidden="true" />
      </div>
    </div>
  )
}
