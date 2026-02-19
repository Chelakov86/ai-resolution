'use client'

import { useState } from 'react'
import { createResolution } from '@/actions/resolutions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewResolutionPage() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)
    const result = await createResolution(formData)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">New Resolution</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base text-gray-500 font-normal">
            AI will suggest a category and motivational framing automatically.
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form action={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Resolution</Label>
              <Input
                id="title"
                name="title"
                placeholder="e.g. Run a 5K by summer"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Why does this matter to you? <span className="text-gray-400">(optional)</span>
              </Label>
              <Textarea
                id="description"
                name="description"
                placeholder="More context helps AI give better feedback..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="target_date">
                Target date <span className="text-gray-400">(optional)</span>
              </Label>
              <Input id="target_date" name="target_date" type="date" />
            </div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Creating...' : 'Create Resolution'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
