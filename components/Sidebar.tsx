'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { 
  Folders, 
  FolderKanban,
  SearchSlash,
  Users, 
  FileCheck,
  MessageCircleMore, 
  LogOut
} from 'lucide-react'
import { useTheme } from 'next-themes'

export function Sidebar() {
  const supabase = createClient()
  const pathname = usePathname()
  const router = useRouter()
  const { theme } = useTheme()
  const [role, setRole] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true) // only true after hydration

    async function getRole() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      setRole(data?.role || 'user')
    }

    getRole()
  }, [])

  if (!mounted) {
    // prevent rendering mismatched HTML before client mounts
    return null
  }

  const adminMenu = [
    { label: 'Dashboard', icon: FolderKanban, path: '/admin/dashboard' },
    { label: 'Reports', icon: Folders, path: '/admin/reports' },
    { label: 'Staff & Users', icon: Users, path: '/admin/users' },
    { label: 'Live Chat', icon: MessageCircleMore, path: '/chat' },
  ]

  const staffMenu = [
    { label: 'Dashboard', icon: FolderKanban, path: '/staff/dashboard' },
    { label: 'My Claimed Issues', icon: FileCheck, path: '/staff/claimed-issues' },
    { label: 'Live Chat', icon: MessageCircleMore, path: '/chat' },
  ]

  const userMenu = [
    { label: 'My Submissions', icon: Folders, path: '/report/list' },
    { label: 'Lost & Found', icon: SearchSlash, path: '/lostfound/list' },
    { label: 'Live Chat', icon: MessageCircleMore, path: '/chat' },
  ]

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const selectedMenu = role === 'admin' ? adminMenu : role === 'staff' ? staffMenu : userMenu

  return (
    <aside className="w-64 border-r p-4 space-y-2">
      {selectedMenu.map((item) => {
        const isActive = pathname.startsWith(item.path)

        const activeClasses =
          theme === 'dark'
            ? 'bg-white text-black'
            : 'bg-black text-white'

        const inactiveClasses =
          theme === 'dark'
            ? 'text-white hover:bg-white hover:text-black'
            : 'text-black hover:bg-black hover:text-white'

        return (
          <button
            key={item.label}
            onClick={() => router.push(item.path)}
            className={`cursor-pointer flex items-center gap-3 w-full px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-200
              ${isActive ? activeClasses : inactiveClasses}
            `}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        )
      })}

      <button
        onClick={handleLogout}
        className="cursor-pointer flex items-center gap-3 w-full px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-100 rounded-lg"
      >
        <LogOut size={18} /> Log Out
      </button>
    </aside>
  )
}
