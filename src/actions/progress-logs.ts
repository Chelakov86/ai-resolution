'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { enrichProgressLog } from '@/lib/ai'
import type { Sentiment } from '@/types/database'

export async function createProgressLog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolution_id = (formData.get('resolution_id') as string | null)?.trim()
  const note = (formData.get('note') as string | null)?.trim()
  if (!resolution_id || !note) return { error: 'Missing required fields' }

  // Fetch resolution for context (ownership check via user_id)
  const { data: resolution } = await supabase
    .from('resolutions')
    .select('title, description')
    .eq('id', resolution_id)
    .eq('user_id', user.id)
    .single()

  // Fetch recent logs for context
  const { data: recentLogs } = await supabase
    .from('progress_logs')
    .select('note, created_at')
    .eq('resolution_id', resolution_id)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // AI enrichment (best-effort)
  let aiSentiment: Sentiment | null = null
  let aiProgressEstimate: number | null = null
  let aiFeedback: string | null = null

  if (resolution) {
    try {
      const result = await enrichProgressLog({
        resolutionTitle: resolution.title,
        resolutionDescription: resolution.description,
        recentLogs: recentLogs ?? [],
        newNote: note,
      })
      aiSentiment = result.sentiment
      aiProgressEstimate = result.progress_estimate
      aiFeedback = result.feedback
    } catch {
      // AI enrichment is best-effort
    }
  }

  const { error } = await supabase.from('progress_logs').insert({
    resolution_id,
    user_id: user.id,
    note,
    ai_sentiment: aiSentiment,
    ai_progress_estimate: aiProgressEstimate,
    ai_feedback: aiFeedback,
  })

  if (error) return { error: error.message }
  revalidatePath(`/resolutions/${resolution_id}`)
  revalidatePath('/dashboard')
}
