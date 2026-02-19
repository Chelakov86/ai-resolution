import { describe, it, expect } from 'vitest'
import { buildCheckinEmail, buildSummaryEmail } from '@/lib/email'

describe('buildCheckinEmail', () => {
  it('includes all overdue resolution titles', () => {
    const result = buildCheckinEmail({
      userName: 'Alice',
      overdueResolutions: [
        { id: 'abc', title: 'Run a 5K', daysSinceLog: 5 },
        { id: 'def', title: 'Read 12 books', daysSinceLog: 10 },
      ],
      appUrl: 'https://example.com',
    })
    expect(result.text).toContain('Run a 5K')
    expect(result.text).toContain('Read 12 books')
    expect(result.text).toContain('5 days')
    expect(result.subject).toContain('check in')
  })

  it('returns empty subject and text when no overdue resolutions', () => {
    const result = buildCheckinEmail({
      userName: 'Alice',
      overdueResolutions: [],
      appUrl: 'https://example.com',
    })
    expect(result.text).toBe('')
  })
})

describe('buildSummaryEmail', () => {
  it('includes the summary text and user name', () => {
    const result = buildSummaryEmail({
      userName: 'Bob',
      summary: 'Great week overall.',
      appUrl: 'https://example.com',
    })
    expect(result.text).toContain('Great week overall.')
    expect(result.subject).toBeTruthy()
  })
})
