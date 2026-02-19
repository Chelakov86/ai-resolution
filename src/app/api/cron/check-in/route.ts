import { createClient } from '@supabase/supabase-js'
import { needsReminder } from '@/lib/reminders'
import { buildCheckinEmail, sendEmail } from '@/lib/email'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.vercel.app'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Use service role for cron jobs (bypass RLS to read all users)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, check_in_frequency, email_checkins_enabled')
    .eq('email_checkins_enabled', true)

  if (!profiles) return Response.json({ sent: 0 })

  let sent = 0

  for (const profile of profiles) {
    const { data: resolutions } = await supabase
      .from('resolutions')
      .select('id, title')
      .eq('user_id', profile.id)
      .eq('status', 'active')

    if (!resolutions?.length) continue

    // Batch query: fetch all logs for all active resolutions in one round-trip
    const resolutionIds = resolutions.map((r) => r.id)
    const { data: allLogs } = await supabase
      .from('progress_logs')
      .select('resolution_id, created_at')
      .in('resolution_id', resolutionIds)
      .order('created_at', { ascending: false })

    // Build map of resolution_id → latest log date (first occurrence = newest due to desc order)
    const lastLogMap = new Map<string, Date>()
    for (const log of allLogs ?? []) {
      if (!lastLogMap.has(log.resolution_id)) {
        lastLogMap.set(log.resolution_id, new Date(log.created_at))
      }
    }

    // Get last log date per resolution
    const overdueResolutions: Array<{ id: string; title: string; daysSinceLog: number | null }> = []

    for (const resolution of resolutions) {
      const lastLogDate = lastLogMap.get(resolution.id) ?? null
      if (needsReminder(lastLogDate, profile.check_in_frequency)) {
        const daysSinceLog = lastLogDate
          ? Math.floor((Date.now() - lastLogDate.getTime()) / 86400000)
          : null
        overdueResolutions.push({ id: resolution.id, title: resolution.title, daysSinceLog })
      }
    }

    if (overdueResolutions.length === 0) continue

    try {
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
      if (!authUser?.user?.email) continue

      const { subject, text } = buildCheckinEmail({
        userName: profile.name,
        overdueResolutions,
        appUrl: APP_URL,
      })

      await sendEmail({ to: authUser.user.email, subject, text })
      sent++
    } catch (e) {
      console.error(`Failed to send check-in for profile ${profile.id}:`, e)
    }
  }

  return Response.json({ sent })
}
