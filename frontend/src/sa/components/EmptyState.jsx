import { Inbox } from 'lucide-react'

export default function EmptyState({
  title = 'Nothing here yet',
  message = '',
  icon: Icon = Inbox,
  children
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-6">
      <span className="w-14 h-14 rounded-2xl bg-[#eef4fd] text-[#1769E0] grid place-items-center mb-4">
        <Icon size={26} />
      </span>
      <h3 className="text-[15px] font-bold text-[#102A43]">{title}</h3>
      {message ? <p className="text-[13px] text-[#6b7f9e] mt-1 max-w-sm">{message}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  )
}
