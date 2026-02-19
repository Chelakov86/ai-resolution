'use client'

import { useRef, useState } from 'react'
import { createProgressLog } from '@/actions/progress-logs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface Props {
  resolutionId: string
}

export function LogForm({ resolutionId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createProgressLog(formData)
    if (result?.error) {
      setError(result.error)
    } else {
      formRef.current?.reset()
    }
    setLoading(false)
  }

  return (
    <form ref={formRef} action={handleSubmit} className="space-y-3">
      <input type="hidden" name="resolution_id" value={resolutionId} />
      <div className="space-y-2">
        <Label htmlFor="note">Log an update</Label>
        <Textarea
          id="note"
          name="note"
          placeholder="What happened? How did it go?"
          rows={3}
          required
        />
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? 'Saving & analyzing...' : 'Save update'}
      </Button>
    </form>
  )
}
