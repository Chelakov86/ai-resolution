import Link from 'next/link'
import { logout } from '@/actions/auth'
import { Button } from '@/components/ui/button'

export function Nav() {
  return (
    <nav className="border-b bg-white">
      <div className="max-w-4xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/dashboard" className="font-semibold text-gray-900">
          Resolutions
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/resolutions/new" className="text-sm text-gray-600 hover:text-gray-900">
            + New
          </Link>
          <Link href="/settings" className="text-sm text-gray-600 hover:text-gray-900">
            Settings
          </Link>
          <form action={logout}>
            <Button variant="ghost" size="sm" type="submit">Sign out</Button>
          </form>
        </div>
      </div>
    </nav>
  )
}
