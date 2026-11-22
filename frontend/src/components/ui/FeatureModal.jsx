import ConfirmModal from './ConfirmModal'

export default function FeatureModal({
  open = false,
  title = 'Feature in Development',
  description = 'This feature is currently under active development and will be available soon.',
  onClose
}) {
  return (
    <ConfirmModal
      open={open}
      title={title}
      description={description}
      confirmLabel="Got it"
      cancelLabel="Close"
      onClose={onClose}
      onConfirm={onClose}
    />
  )
}
