import { describe, it, expect } from 'vitest'
import { parseEnrichmentResponse, parseCategoryResponse } from '@/lib/ai'

describe('parseEnrichmentResponse', () => {
  it('parses a valid positive response', () => {
    const json = JSON.stringify({
      sentiment: 'positive',
      progress_estimate: 75,
      feedback: 'Great consistency this week! Keep building that momentum.',
    })
    const result = parseEnrichmentResponse(json)
    expect(result.sentiment).toBe('positive')
    expect(result.progress_estimate).toBe(75)
    expect(result.feedback).toBe('Great consistency this week! Keep building that momentum.')
  })

  it('clamps progress_estimate to 0-100 range', () => {
    const json = JSON.stringify({ sentiment: 'neutral', progress_estimate: 150, feedback: 'ok' })
    const result = parseEnrichmentResponse(json)
    expect(result.progress_estimate).toBe(100)
  })

  it('defaults to neutral on invalid sentiment', () => {
    const json = JSON.stringify({ sentiment: 'amazing', progress_estimate: 50, feedback: 'ok' })
    const result = parseEnrichmentResponse(json)
    expect(result.sentiment).toBe('neutral')
  })

  it('throws on malformed JSON', () => {
    expect(() => parseEnrichmentResponse('not json')).toThrow()
  })
})

describe('parseCategoryResponse', () => {
  it('parses a valid category response', () => {
    const json = JSON.stringify({
      category: 'Health',
      framing: 'Your body is your longest investment.',
    })
    const result = parseCategoryResponse(json)
    expect(result.category).toBe('Health')
    expect(result.framing).toBe('Your body is your longest investment.')
  })

  it('returns null category if not in allowed list', () => {
    const json = JSON.stringify({ category: 'Hobbies', framing: 'Fun stuff.' })
    const result = parseCategoryResponse(json)
    expect(result.category).toBeNull()
  })
})
