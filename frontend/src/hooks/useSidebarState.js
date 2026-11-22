import { useCallback, useState } from 'react'

const STORAGE_KEY = 'panta-sidebar-collapsed'

export default function useSidebarState() {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1')
  const [drawer, setDrawer] = useState(false)

  const toggleSidebar = useCallback(() => {
    if (window.innerWidth < 1024) setDrawer((open) => !open)
    else
      setCollapsed((value) => {
        localStorage.setItem(STORAGE_KEY, value ? '0' : '1')
        return !value
      })
  }, [])

  const closeDrawer = useCallback(() => setDrawer(false), [])

  return { collapsed, drawer, toggleSidebar, closeDrawer }
}
