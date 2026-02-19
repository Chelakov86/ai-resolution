import { Resend } from 'resend'

interface CheckinEmailParams {
  userName: string | null
  overdueResolutions: Array<{ id: string; title: string; daysSinceLog: number }>
  appUrl: string
}

interface SummaryEmailParams {
  userName: string | null
  summary: string
  appUrl: string
}

export function buildCheckinEmail(params: CheckinEmailParams): { subject: string; text: string } {
  if (params.overdueResolutions.length === 0) return { subject: '', text: '' }

  const name = params.userName ?? 'there'
  const lines = params.overdueResolutions
    .map((r) => `• ${r.title} (${r.daysSinceLog} days since last log)\n  ${params.appUrl}/resolutions/${r.id}`)
    .join('\n\n')

  return {
    subject: `Time to check in on your resolutions`,
    text: `Hi ${name},\n\nYou haven't logged progress on these resolutions recently:\n\n${lines}\n\nKeep going — small consistent updates add up.\n\n${params.appUrl}/dashboard`,
  }
}

export function buildSummaryEmail(params: SummaryEmailParams): { subject: string; text: string } {
  const name = params.userName ?? 'there'
  return {
    subject: `Your weekly resolution summary`,
    text: `Hi ${name},\n\nHere's your week in review:\n\n${params.summary}\n\n${params.appUrl}/dashboard`,
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  text: string
}) {
  const resend = new Resend(process.env.RESEND_API_KEY)
  await resend.emails.send({
    from: 'Resolutions <noreply@yourdomain.com>',  // Update with your verified domain
    to: params.to,
    subject: params.subject,
    text: params.text,
  })
}
