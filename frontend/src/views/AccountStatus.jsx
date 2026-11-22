import { Link, useLocation } from 'react-router-dom'
import './AccountStatus.css'

const messages = {
  suspended: 'Your school account has been suspended.',
  deactivated: 'School access disabled by Super Admin.',
  pending_approval: 'Your school account is waiting for system administrator approval.',
  subscription: 'Subscription inactive.',
  account: 'Your account is not active.'
}

export default function AccountStatus() {
  const location = useLocation()
  const searchParams = new URLSearchParams(location.search)

  const message = messages[searchParams.get('reason')] || 'Your account cannot access the system right now.'
  const detail = searchParams.get('message') || 'Please contact system administration for support.'

  return (
    <main className="status-page">
      <section className="status-card">
        <div className="status-mark"></div>
        <h1>Account Access Disabled</h1>
        <p>{message}</p>
        <small>{detail}</small>
        <Link to="/login">Return to Login</Link>
      </section>
    </main>
  )
}
