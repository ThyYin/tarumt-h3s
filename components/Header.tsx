'use client'

import { useEffect, useState } from 'react'
import { Bell, Sun, Moon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { routerServerGlobal } from 'next/dist/server/lib/router-utils/router-server-context'

export function Header() {
  const supabase = createClient()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [userName, setUserName] = useState<string>('User')
  const [avatar, setAvatar] = useState<string | null>(null)

  // Wait until client has mounted before rendering theme-based elements
  useEffect(() => {
    setMounted(true)
    async function loadNotifications() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
    }

    loadNotifications()
  }, [])

  useEffect(() => {
    async function getUser() {
      const { data: { user }} = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .single()

      setUserName(data?.full_name || 'User')
      setAvatar(data?.avatar_url || null)
    }

    getUser()
  }, [])

  return (
    <header className="w-full border-b p-4 flex justify-between items-center shadow-sm">
      {/* Logo + Text */}
      <a href="/">
        <div className="flex items-center gap-3">
          <img src="/logo.png" className="h-13" alt="TARUMT Logo" />
          <h1 className="font-bold text-2xl">Health & Safety Support System</h1>
        </div>
      </a>

      {/* Icons + user profile */}
      <div className="flex items-center gap-4">

        {/* Theme toggle */}
        {mounted ? (
          <button
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            className="cursor-pointer p-2 rounded-full hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            aria-label="Toggle theme"
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>
        ) : (
          // Placeholder icon to keep layout stable before hydration
          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800" />
        )}

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => router.push('/notifications')}
            className="cursor-pointer p-2 rounded-full hover:text-white hover:bg-gray-200 dark:hover:bg-gray-700 transition"
          >
            <Bell size={23} />
          </button>
        </div>

        {/* Avatar + welcome text */}
        <div className="flex items-center gap-3">
          <img
            src={avatar || '/default-avatar.png'}
            alt="Profile"
            className="w-10 h-10 rounded-full object-cover"
          />
          <div className="leading-tight text-right">
            <p className="text-xs">Welcome back,</p>
            <p className="font-semibold">{userName}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
