import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import '@fontsource-variable/inter/wght.css'
import './styles/style.css'
import './styles/harmony.css'

class RootBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('BELLORA failed to render:', error)
  }

  render() {
    if (this.state.error) {
      return (
        <main style={{ fontFamily: 'system-ui', maxWidth: 680, margin: '12vh auto', padding: 32, color: '#172b45' }}>
          <h1>BELLORA could not load</h1>
          <p>The page hit a frontend error. Refresh once; if it continues, share this message with support.</p>
          <pre style={{ whiteSpace: 'pre-wrap', color: '#a33' }}>{this.state.error.message}</pre>
        </main>
      )
    }
    return this.props.children
  }
}

createRoot(document.getElementById('root')).render(
  <RootBoundary>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </RootBoundary>
)
