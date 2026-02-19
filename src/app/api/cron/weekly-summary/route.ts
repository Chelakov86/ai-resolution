import { createClient } from '@supabase/supabase-js'
import { generateWeeklySummary } from '@/lib/ai'
import { buildSummaryEmail, sendEmail } from '@/lib/email'
import { startOfWeek } from 'date-fns'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://yourapp.vercel.app'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }).toISOString()

  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, name, email_summary_enabled')
    .eq('email_summary_enabled', true)

  if (!profiles) return Response.json({ processed: 0 })

  let processed = 0

  for (const profile of profiles) {
    const { data: logs } = await supabase
      .from('progress_logs')
      .select('note, ai_sentiment, created_at, resolutions(title)')
      .eq('user_id', profile.id)
      .gte('created_at', weekStart)
      .order('created_at', { ascending: true })

    if (!logs?.length) continue

    const formattedLogs = logs.map((l: any) => ({
      resolution_title: l.resolutions?.title ?? 'Unknown',
      note: l.note,
      ai_sentiment: l.ai_sentiment,
      created_at: l.created_at,
    }))

    try {
      const summary = await generateWeeklySummary({ userName: profile.name, logs: formattedLogs })
      if (!summary) continue

      // Save to DB for dashboard display
      await supabase.from('weekly_summaries').insert({ user_id: profile.id, summary })

      // Send email
      const { data: authUser } = await supabase.auth.admin.getUserById(profile.id)
      if (authUser.user?.email) {
        const { subject, text } = buildSummaryEmail({ userName: profile.name, summary, appUrl: APP_URL })
        await sendEmail({ to: authUser.user.email, subject, text })
      }

      processed++
    } catch (e) {
      console.error(`Failed to generate summary for ${profile.id}:`, e)
    }
  }

  return Response.json({ processed })
}
