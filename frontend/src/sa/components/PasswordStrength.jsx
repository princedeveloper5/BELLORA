import { Check } from 'lucide-react'

export default function PasswordStrength({ password = '' }) {
  if (!password) return null

  const rules = [
    { label: '8+ characters', ok: password.length >= 8 },
    { label: 'Uppercase letter', ok: /[A-Z]/.test(password) },
    { label: 'Number', ok: /\d/.test(password) },
    { label: 'Symbol', ok: /[^A-Za-z0-9]/.test(password) }
  ]

  const level = rules.filter((rule) => rule.ok).length
  const label = ['Weak', 'Weak', 'Fair', 'Good', 'Strong'][level]
  const barColor = ['bg-[#EF4444]', 'bg-[#EF4444]', 'bg-[#F59E0B]', 'bg-[#1769E0]', 'bg-[#18B981]'][level]
  const textColor = ['text-[#EF4444]', 'text-[#EF4444]', 'text-[#F59E0B]', 'text-[#1769E0]', 'text-[#18B981]'][level]

  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="flex gap-1 grow">
          {[1, 2, 3, 4].map((index) => (
            <span key={index} className={`h-1.5 grow rounded-full transition-all duration-200 ${index <= level ? barColor : 'bg-[#E5EDF5]'}`} />
          ))}
        </div>
        <span className={`text-[11px] font-bold w-14 text-right ${textColor}`}>{label}</span>
      </div>
      <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
        {rules.map((rule) => (
          <li key={rule.label} className={`flex items-center gap-1.5 text-[11px] ${rule.ok ? 'text-[#0E9F70] font-semibold' : 'text-[#829AB1]'}`}>
            {rule.ok ? <Check size={11} /> : <span className="w-[11px] h-[11px] rounded-full border border-[#C6D4E3] inline-block" />}
            {rule.label}
          </li>
        ))}
      </ul>
    </div>
  )
}
