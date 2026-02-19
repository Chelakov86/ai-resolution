import Link from 'next/link'
import { needsReminder } from '@/lib/reminders'
import type { Resolution, CheckInFrequency } from '@/types/database'

interface Props {
  resolutions: Array<Resolution & { last_log_at: string | null }>
  frequency: CheckInFrequency
}

export function ReminderBanners({ resolutions, frequency }: Props) {
  const overdue = resolutions.filter(
    (r) =>
      r.status === 'active' &&
      needsReminder(r.last_log_at ? new Date(r.last_log_at) : null, frequency)
  )

  if (overdue.length === 0) return null

  return (
    <div className="space-y-2 mb-6">
      {overdue.map((r) => (
        <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-amber-800">
            No recent update for <strong>{r.title}</strong>
            {r.last_log_at
              ? ` — last logged ${Math.floor((Date.now() - new Date(r.last_log_at).getTime()) / 86400000)} days ago`
              : ' — never logged'}
          </p>
          <Link
            href={`/resolutions/${r.id}`}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 whitespace-nowrap ml-4"
          >
            Log now →
          </Link>
        </div>
      ))}
    </div>
  )
}
