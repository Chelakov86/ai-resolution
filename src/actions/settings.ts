'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function updateSettings(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  await supabase.from('profiles').update({
    check_in_frequency: formData.get('check_in_frequency') as string,
    email_checkins_enabled: formData.get('email_checkins_enabled') === 'on',
    email_summary_enabled: formData.get('email_summary_enabled') === 'on',
  }).eq('id', user.id)

  revalidatePath('/settings')
}
