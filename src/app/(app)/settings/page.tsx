import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { updateSettings } from '@/actions/settings'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  if (!profile) redirect('/login')

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      <Card>
        <CardHeader>
          <CardTitle>Check-in Preferences</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={updateSettings} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="check_in_frequency">Reminder frequency</Label>
              <select
                id="check_in_frequency"
                name="check_in_frequency"
                defaultValue={profile.check_in_frequency}
                className="w-full border rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="daily">Daily</option>
                <option value="every_3_days">Every 3 days</option>
                <option value="weekly">Weekly</option>
              </select>
              <p className="text-xs text-gray-500">
                How often to show in-app reminders for unlogged resolutions
              </p>
            </div>

            <div className="space-y-3">
              <Label>Email notifications</Label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="email_checkins_enabled"
                  defaultChecked={profile.email_checkins_enabled}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Check-in nudges</p>
                  <p className="text-xs text-gray-500">Mon & Thu emails for unlogged resolutions</p>
                </div>
              </label>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  name="email_summary_enabled"
                  defaultChecked={profile.email_summary_enabled}
                  className="mt-0.5"
                />
                <div>
                  <p className="text-sm font-medium">Weekly summary</p>
                  <p className="text-xs text-gray-500">Sunday evening AI-generated week in review</p>
                </div>
              </label>
            </div>

            <Button type="submit" className="w-full">Save settings</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
