import { createPortal } from 'react-dom'
import { usePresence } from '@/hooks/usePresence'
import { loadingStore, loadingActions } from '@/stores/loadingStore'
import { useStore } from '@/stores/useStore'
import './TopLoadingBar.css'

export default function TopLoadingBar() {
  const { visible } = useStore(loadingStore)
  const { mounted } = usePresence(visible, 200)

  if (!mounted) return null

  return createPortal(
    <div className="top-loading-bar top-loading-enter" role="progressbar" aria-label="Loading">
      <span className="top-loading-bar__track">
        <span className="top-loading-bar__fill" />
      </span>
    </div>,
    document.body
  )
}

export { loadingActions }
