import { notificationActions } from '@/stores/notificationStore'

export const notifySuccess = (message, title = 'Success') => {
  notificationActions.success(message, title)
}

export const notifyError = (message, title = 'Error') => {
  notificationActions.error(message, title)
}

export const notifyInfo = (message, title = 'Info') => {
  notificationActions.info(message, title)
}

export const notifyWarning = (message, title = 'Warning') => {
  notificationActions.warning(message, title)
}

export const notifyFromError = (error, fallback = 'Request failed') => {
  notifyError(error?.response?.data?.message || error?.response?.data?.error || error?.message || fallback)
}
