import type { CheckInFrequency } from '@/types/database'

const THRESHOLD_HOURS: Record<CheckInFrequency, number> = {
  daily: 24,
  every_3_days: 72,
  weekly: 168,
}

export function needsReminder(
  lastLogDate: Date | null,
  frequency: CheckInFrequency,
  now: Date = new Date()
): boolean {
  if (!lastLogDate) return true
  const hoursSince = (now.getTime() - lastLogDate.getTime()) / (1000 * 60 * 60)
  return hoursSince >= THRESHOLD_HOURS[frequency]
}
