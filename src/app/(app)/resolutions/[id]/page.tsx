import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LogForm } from '@/components/log-form'
import { LogEntry } from '@/components/log-entry'
import { updateResolutionStatus } from '@/actions/resolutions'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ResolutionPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: resolution }, { data: logs }] = await Promise.all([
    supabase.from('resolutions').select('*').eq('id', id).eq('user_id', user.id).single(),
    supabase.from('progress_logs').select('*').eq('resolution_id', id)
      .order('created_at', { ascending: false }),
  ])

  if (!resolution) notFound()

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4 mb-2">
          <h1 className="text-2xl font-bold">{resolution.title}</h1>
          <Badge variant={resolution.status === 'active' ? 'default' : 'secondary'}>
            {resolution.status}
          </Badge>
        </div>
        {resolution.ai_framing && (
          <p className="text-gray-500 text-sm mb-2">{resolution.ai_framing}</p>
        )}
        {resolution.description && (
          <p className="text-gray-700 text-sm">{resolution.description}</p>
        )}
        <div className="flex gap-2 mt-3">
          {resolution.status === 'active' ? (
            <form action={async () => { 'use server'; await updateResolutionStatus(id, 'archived') }}>
              <Button variant="outline" size="sm" type="submit">Archive</Button>
            </form>
          ) : (
            <form action={async () => { 'use server'; await updateResolutionStatus(id, 'active') }}>
              <Button variant="outline" size="sm" type="submit">Restore</Button>
            </form>
          )}
        </div>
      </div>

      <Separator className="my-6" />

      {resolution.status === 'active' && (
        <div className="mb-8">
          <LogForm resolutionId={id} />
        </div>
      )}

      <div className="space-y-3">
        <h2 className="font-semibold text-sm text-gray-500">
          {logs?.length ?? 0} {logs?.length === 1 ? 'update' : 'updates'}
        </h2>
        {(logs ?? []).map((log) => <LogEntry key={log.id} log={log} />)}
      </div>
    </div>
  )
}
