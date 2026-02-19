'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { enrichProgressLog } from '@/lib/ai'

export async function createProgressLog(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const resolution_id = formData.get('resolution_id') as string
  const note = formData.get('note') as string

  // Fetch resolution for context
  const { data: resolution } = await supabase
    .from('resolutions')
    .select('title, description')
    .eq('id', resolution_id)
    .single()

  // Fetch recent logs for context
  const { data: recentLogs } = await supabase
    .from('progress_logs')
    .select('note, created_at')
    .eq('resolution_id', resolution_id)
    .order('created_at', { ascending: false })
    .limit(5)

  // AI enrichment (best-effort)
  let enrichment = { sentiment: null, progress_estimate: null, feedback: null } as {
    sentiment: 'positive' | 'neutral' | 'negative' | null
    progress_estimate: number | null
    feedback: string | null
  }

  if (resolution) {
    try {
      const result = await enrichProgressLog({
        resolutionTitle: resolution.title,
        resolutionDescription: resolution.description,
        recentLogs: recentLogs ?? [],
        newNote: note,
      })
      enrichment = result
    } catch {
      // AI enrichment is best-effort
    }
  }

  const { error } = await supabase.from('progress_logs').insert({
    resolution_id,
    user_id: user.id,
    note,
    ai_sentiment: enrichment.sentiment,
    ai_progress_estimate: enrichment.progress_estimate,
    ai_feedback: enrichment.feedback,
  })

  if (error) return { error: error.message }
  revalidatePath(`/resolutions/${resolution_id}`)
  revalidatePath('/dashboard')
}
