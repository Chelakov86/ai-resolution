export type CheckInFrequency = 'daily' | 'every_3_days' | 'weekly'
export type ResolutionCategory = 'Health' | 'Finance' | 'Learning' | 'Relationships' | 'Career' | 'Personal'
export type ResolutionStatus = 'active' | 'paused' | 'completed' | 'archived'
export type Sentiment = 'positive' | 'neutral' | 'negative'

export interface Profile {
  id: string
  name: string | null
  check_in_frequency: CheckInFrequency
  email_checkins_enabled: boolean
  email_summary_enabled: boolean
  created_at: string
}

export interface Resolution {
  id: string
  user_id: string
  title: string
  description: string | null
  category: ResolutionCategory | null
  ai_framing: string | null
  target_date: string | null
  status: ResolutionStatus
  created_at: string
}

export interface ProgressLog {
  id: string
  resolution_id: string
  user_id: string
  note: string
  ai_sentiment: Sentiment | null
  ai_progress_estimate: number | null
  ai_feedback: string | null
  created_at: string
}

export interface CheckInRecord {
  id: string
  resolution_id: string
  user_id: string
  last_prompted_at: string
}
