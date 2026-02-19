'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import type { CheckInFrequency } from '@/types/database'

const VALID_FREQUENCIES: CheckInFrequency[] = ['daily', 'every_3_days', 'weekly']

export async function updateSettings(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const check_in_frequency = formData.get('check_in_frequency') as string
  if (!VALID_FREQUENCIES.includes(check_in_frequency as CheckInFrequency)) {
    throw new Error('Invalid check-in frequency')
  }

  const { error } = await supabase.from('profiles').update({
    check_in_frequency: check_in_frequency as CheckInFrequency,
    email_checkins_enabled: formData.get('email_checkins_enabled') === 'on',
    email_summary_enabled: formData.get('email_summary_enabled') === 'on',
  }).eq('id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/settings')
}
