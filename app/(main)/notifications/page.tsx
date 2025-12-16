'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { useTheme } from 'next-themes'
import { 
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'

const PAGE_SIZE = 4

export default function NotificationsPage() {
  const supabase = createClient()

  const [notifications, setNotifications] = useState<any[]>([])
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const totalPages = Math.ceil(total / PAGE_SIZE)

  useEffect(() => {
    fetchNotifications()
    setMounted(true)
  }, [page])

  if (!mounted) return null

  async function fetchNotifications() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const from = (page - 1) * PAGE_SIZE
    const to = from + PAGE_SIZE - 1

    const { data, count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    setNotifications(data || [])
    setTotal(count || 0)
    setLoading(false)
  }

  return (
    <div className="p-5">
      <div>
        <h1 className="text-3xl font-extrabold mb-1">My Notifications</h1>
        <p className="text-gray-500">
          View and track your latest notices
        </p>
      </div>
      {loading ? (
        <div className="flex items-center text-gray-600 text-m mt-7">
          <div
            className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"
            aria-label="Loading"
          ></div>
          <span>&nbsp;Fetching notifications...</span>
        </div>
      ) : notifications.length === 0 ? (
        <p className="text-gray-500 mt-10">No notifications yet.</p>
      ) : (
        <div className="space-y-3 mt-7">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-xl border shadow-sm
                ${n.is_read ? 'opacity-70' : 'bg-yellow-200'}
              `}
            >
              <p className={`font-semibold
                ${theme === 'dark' ? 'text-black' : 'text-black'}`
              }>
                {n.title}
              </p>

              <p className="text-sm text-gray-600">{n.message}</p>
              <p className="text-xs text-gray-500 mt-1">
                {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 0 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            disabled={page === 1}
            onClick={() => setPage(1)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronsLeft size={18} />
          </button>

          <button
            disabled={page === 1}
            onClick={() => setPage(page - 1)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronLeft size={18} />
          </button>

          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
            (p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`cursor-pointer px-3 py-1 rounded ${
                  p === page
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-black hover:bg-gray-300'
                }`}
              >
                {p}
              </button>
            )
          )}

          <button
            disabled={page === totalPages}
            onClick={() => setPage(page + 1)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronRight size={18} />
          </button>

          <button
            disabled={page === totalPages}
            onClick={() => setPage(totalPages)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ChevronsRight size={18} />
          </button>
        </div>
      )}
    </div>
  )
}
