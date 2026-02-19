import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Resolution } from '@/types/database'

const CATEGORY_COLORS: Record<string, string> = {
  Health: 'bg-green-100 text-green-800',
  Finance: 'bg-blue-100 text-blue-800',
  Learning: 'bg-purple-100 text-purple-800',
  Relationships: 'bg-pink-100 text-pink-800',
  Career: 'bg-orange-100 text-orange-800',
  Personal: 'bg-gray-100 text-gray-800',
}

interface Props {
  resolution: Resolution & { last_log_at: string | null; log_count: number }
}

export function ResolutionCard({ resolution: r }: Props) {
  return (
    <Link href={`/resolutions/${r.id}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">{r.title}</CardTitle>
            {r.category && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${CATEGORY_COLORS[r.category] ?? ''}`}>
                {r.category}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {r.ai_framing && (
            <p className="text-sm text-gray-500 mb-2">{r.ai_framing}</p>
          )}
          <div className="flex items-center gap-3 text-xs text-gray-400">
            <span>{r.log_count} {r.log_count === 1 ? 'update' : 'updates'}</span>
            {r.last_log_at && (
              <span>Last update {new Date(r.last_log_at).toLocaleDateString()}</span>
            )}
            <Badge variant={r.status === 'active' ? 'default' : 'secondary'} className="text-xs">
              {r.status}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
