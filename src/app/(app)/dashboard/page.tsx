import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResolutionCard } from '@/components/resolution-card'
import { ReminderBanners } from '@/components/reminder-banner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Resolution } from '@/types/database'

type ResolutionWithMeta = Resolution & { last_log_at: string | null; log_count: number }

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Fetch profile + resolutions with log metadata in one query
  const [{ data: profile }, { data: rawResolutions }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.rpc('get_resolutions_with_log_meta', { p_user_id: user.id }),
  ])

  // Fetch weekly summary if exists
  const { data: weeklySummary } = await supabase
    .from('weekly_summaries')
    .select('summary, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const typedResolutions = (rawResolutions ?? []) as ResolutionWithMeta[]
  const active = typedResolutions.filter((r) => r.status === 'active')
  const archived = typedResolutions.filter((r) => r.status !== 'active')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Your Resolutions</h1>
        <Button asChild>
          <Link href="/resolutions/new">+ Add Resolution</Link>
        </Button>
      </div>

      {profile && (
        <ReminderBanners
          activeResolutions={active}
          frequency={profile.check_in_frequency}
        />
      )}

      {weeklySummary && (
        <Card className="mb-6 bg-blue-50 border-blue-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-blue-700">
              Weekly Summary — {new Date(weeklySummary.created_at).toLocaleDateString()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-blue-800 whitespace-pre-line">{weeklySummary.summary}</p>
          </CardContent>
        </Card>
      )}

      {active.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="mb-4">No active resolutions yet.</p>
          <Button asChild variant="outline">
            <Link href="/resolutions/new">Create your first resolution</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {active.map((r) => <ResolutionCard key={r.id} resolution={r} />)}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-10">
          <h2 className="text-sm font-medium text-gray-400 mb-3">Archived</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {archived.map((r) => <ResolutionCard key={r.id} resolution={r} />)}
          </div>
        </div>
      )}
    </div>
  )
}
