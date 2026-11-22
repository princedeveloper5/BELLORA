import { useEffect, useState } from 'react'

// Keeps an element mounted for `duration` ms after `visible` flips to false so
// CSS exit transitions can run before the node is removed.
export function usePresence(visible, duration = 260) {
  const [mounted, setMounted] = useState(visible)
  const [exiting, setExiting] = useState(false)

  useEffect(() => {
    if (visible) {
      setMounted(true)
      setExiting(false)
      return undefined
    }

    setExiting(true)
    const timer = setTimeout(() => {
      setMounted(false)
      setExiting(false)
    }, duration)
    return () => clearTimeout(timer)
  }, [visible, duration])

  return { mounted, exiting }
}
