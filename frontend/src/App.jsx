import { useEffect } from 'react'
import AppRouter from '@/router'
import api from '@/lib/api'
import TopLoadingBar from '@/components/TopLoadingBar'
import Preloader from '@/components/Preloader'
import TopFeedback from '@/components/TopFeedback'
import { loadingStore, loadingActions } from '@/stores/loadingStore'
import { authActions } from '@/stores/authStore'
import { useStore } from '@/stores/useStore'
import { watchAppLanguage } from '@/utils/language'

const minimumBootTime = 900
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export default function App() {
  const { bootLoading, pendingRequests, routeLoading } = useStore(loadingStore)

  useEffect(() => {
    loadingActions.startBoot()

    const languageObserver = watchAppLanguage()
    const bootStartedAt = performance.now()

    const finishBoot = async () => {
      const elapsed = performance.now() - bootStartedAt
      if (elapsed < minimumBootTime) {
        await wait(minimumBootTime - elapsed)
      }
      loadingActions.finishBoot()
    }

    authActions.checkAuth(api).finally(finishBoot)

    return () => languageObserver?.disconnect()
  }, [])

  return (
    <>
      <TopLoadingBar />
      <Preloader loading={bootLoading} />
      <TopFeedback loading={pendingRequests > 0 || routeLoading} />
      <AppRouter />
    </>
  )
}
