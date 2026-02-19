import type { ProgressLog } from '@/types/database'

const SENTIMENT_STYLES = {
  positive: 'text-green-700 bg-green-50 border-green-200',
  neutral: 'text-gray-700 bg-gray-50 border-gray-200',
  negative: 'text-red-700 bg-red-50 border-red-200',
}

const SENTIMENT_ICONS = { positive: '↑', neutral: '→', negative: '↓' }

interface Props {
  log: ProgressLog
}

export function LogEntry({ log }: Props) {
  return (
    <div className="border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{new Date(log.created_at).toLocaleDateString()}</p>
        {log.ai_sentiment && (
          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${SENTIMENT_STYLES[log.ai_sentiment]}`}>
            {SENTIMENT_ICONS[log.ai_sentiment]} {log.ai_sentiment}
            {log.ai_progress_estimate !== null && ` · ${log.ai_progress_estimate}%`}
          </span>
        )}
      </div>
      <p className="text-sm">{log.note}</p>
      {log.ai_feedback && (
        <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded p-2">
          {log.ai_feedback}
        </p>
      )}
    </div>
  )
}
