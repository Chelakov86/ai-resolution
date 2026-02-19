import { GoogleGenAI } from '@google/genai'
import type { Sentiment, ResolutionCategory } from '@/types/database'

const MODEL = 'gemini-3-flash-preview'

const VALID_SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative']
const VALID_CATEGORIES: ResolutionCategory[] = [
  'Health', 'Finance', 'Learning', 'Relationships', 'Career', 'Personal',
]

export interface EnrichmentResult {
  sentiment: Sentiment
  progress_estimate: number
  feedback: string
}

export interface CategoryResult {
  category: ResolutionCategory | null
  framing: string
}

function getAI(): GoogleGenAI {
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! })
}

export function parseEnrichmentResponse(text: string): EnrichmentResult {
  const data = JSON.parse(text)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Expected a JSON object from AI response')
  }
  const sentiment = VALID_SENTIMENTS.includes(data.sentiment) ? data.sentiment : 'neutral'
  const progress_estimate = Math.min(100, Math.max(0, Number(data.progress_estimate) || 0))
  return { sentiment, progress_estimate, feedback: String(data.feedback || '') }
}

export function parseCategoryResponse(text: string): CategoryResult {
  const data = JSON.parse(text)
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Expected a JSON object from AI response')
  }
  const category = VALID_CATEGORIES.includes(data.category) ? data.category : null
  return { category, framing: String(data.framing || '') }
}

export async function enrichProgressLog(params: {
  resolutionTitle: string
  resolutionDescription: string | null
  recentLogs: Array<{ note: string; created_at: string }>
  newNote: string
}): Promise<EnrichmentResult> {
  const context = params.recentLogs
    .slice(-5)
    .map((l) => `- ${l.note} (${l.created_at.slice(0, 10)})`)
    .join('\n') || 'No previous logs.'

  const response = await getAI().models.generateContent({
    model: MODEL,
    contents: `You are analyzing a progress update for a personal resolution. Respond with valid JSON only — no markdown, no explanation.

Resolution: ${params.resolutionTitle}
${params.resolutionDescription ? `Description: ${params.resolutionDescription}` : ''}

Recent progress logs:
${context}

New update: ${params.newNote}

Respond with this exact JSON structure:
{"sentiment":"positive|neutral|negative","progress_estimate":0-100,"feedback":"1-2 sentences of specific encouraging coaching"}`,
  })

  return parseEnrichmentResponse(response.text ?? '{}')
}

export async function suggestCategory(params: {
  title: string
  description: string
}): Promise<CategoryResult> {
  const response = await getAI().models.generateContent({
    model: MODEL,
    contents: `Suggest a category and motivational framing for this resolution. Respond with valid JSON only.

Resolution title: ${params.title}
Description: ${params.description}

Categories (choose exactly one): Health, Finance, Learning, Relationships, Career, Personal

Respond with this exact JSON structure:
{"category":"one of the above","framing":"one sentence about why this matters"}`,
  })

  return parseCategoryResponse(response.text ?? '{}')
}

export async function generateWeeklySummary(params: {
  userName: string | null
  logs: Array<{ resolution_title: string; note: string; ai_sentiment: Sentiment | null; created_at: string }>
}): Promise<string> {
  if (params.logs.length === 0) return ''

  const logText = params.logs
    .map((l) => `[${l.resolution_title}] ${l.note} (${l.ai_sentiment ?? 'no sentiment'})`)
    .join('\n')

  const response = await getAI().models.generateContent({
    model: MODEL,
    contents: `Write a brief weekly summary for ${params.userName ?? 'this person'}'s resolution progress. Be warm, specific, and end with one concrete suggestion.

This week's logs:
${logText}

Write 2-3 short paragraphs. No bullet points. No markdown.`,
  })

  return response.text ?? ''
}
