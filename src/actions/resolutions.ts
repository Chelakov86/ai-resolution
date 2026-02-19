'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { suggestCategory } from '@/lib/ai'
import type { ResolutionCategory, ResolutionStatus } from '@/types/database'

export async function createResolution(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const title = formData.get('title') as string
  const description = formData.get('description') as string
  const target_date = formData.get('target_date') as string | null

  // Get AI category suggestion
  let category: ResolutionCategory | null = null
  let ai_framing: string | null = null
  try {
    const suggestion = await suggestCategory({ title, description: description || title })
    category = suggestion.category
    ai_framing = suggestion.framing || null
  } catch {
    // AI enrichment is best-effort
  }

  const { data, error } = await supabase
    .from('resolutions')
    .insert({
      user_id: user.id,
      title,
      description: description || null,
      category,
      ai_framing,
      target_date: target_date || null,
    })
    .select('id')
    .single()

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  redirect(`/resolutions/${data.id}`)
}

export async function updateResolutionStatus(id: string, status: ResolutionStatus) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { error } = await supabase
    .from('resolutions')
    .update({ status })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  revalidatePath(`/resolutions/${id}`)
}
