import { saStore } from '../store'
import { useStore } from '@/stores/useStore'
import ToastViewport from '@/components/ToastViewport'
import './sa-components.css'

export default function ToastHost() {
  const { toasts } = useStore(saStore)
  const dismiss = (id) => saStore.setState((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
  return <ToastViewport toasts={toasts} onDismiss={dismiss} />
}
