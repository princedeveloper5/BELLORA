import TeacherLayout from '@/components/TeacherLayout'
import TeacherPeriodTimer from '@/components/TeacherPeriodTimer'
import './TeacherCurrentCounter.css'

export default function TeacherCurrentCounter() {
  return (
    <TeacherLayout>
      <div className="current-counter-page">
        <section className="counter-hero">
          <div>
            <span className="eyebrow">Current Counter</span>
            <h1>Live Period Counter</h1>
            <p>Track the current lesson, next class, room, and remaining time.</p>
          </div>
        </section>

        <section id="current-counter" className="counter-stage" aria-label="Current period counter">
          <TeacherPeriodTimer />
        </section>
      </div>
    </TeacherLayout>
  )
}
