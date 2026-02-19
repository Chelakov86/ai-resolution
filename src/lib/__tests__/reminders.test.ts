import { describe, it, expect } from 'vitest'
import { needsReminder } from '@/lib/reminders'

describe('needsReminder', () => {
  const now = new Date('2026-02-18T10:00:00Z')

  it('returns true when no log ever', () => {
    expect(needsReminder(null, 'daily', now)).toBe(true)
  })

  it('returns true for daily when last log was 2 days ago', () => {
    const lastLog = new Date('2026-02-16T10:00:00Z')
    expect(needsReminder(lastLog, 'daily', now)).toBe(true)
  })

  it('returns false for daily when last log was 12 hours ago', () => {
    const lastLog = new Date('2026-02-17T22:00:00Z')
    expect(needsReminder(lastLog, 'daily', now)).toBe(false)
  })

  it('returns true for every_3_days when last log was 4 days ago', () => {
    const lastLog = new Date('2026-02-14T10:00:00Z')
    expect(needsReminder(lastLog, 'every_3_days', now)).toBe(true)
  })

  it('returns false for every_3_days when last log was 2 days ago', () => {
    const lastLog = new Date('2026-02-16T10:00:00Z')
    expect(needsReminder(lastLog, 'every_3_days', now)).toBe(false)
  })

  it('returns true for weekly when last log was 8 days ago', () => {
    const lastLog = new Date('2026-02-10T10:00:00Z')
    expect(needsReminder(lastLog, 'weekly', now)).toBe(true)
  })

  it('returns false for weekly when last log was 5 days ago', () => {
    const lastLog = new Date('2026-02-13T10:00:00Z')
    expect(needsReminder(lastLog, 'weekly', now)).toBe(false)
  })
})
