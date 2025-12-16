// staff/dashboard/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { CircleAlert, RotateCcw, CheckCircle } from 'lucide-react'

export default function StaffDashboard() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const [counts, setCounts] = useState({
    pending: 0,
    progress: 0,
    resolved: 0,
  })
  const [loading, setLoading] = useState(true)

  // 🔹 Load counts
  useEffect(() => {
    loadCounts()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadCounts() {
    setLoading(true)
    try {
      const { count: pendingGeneral } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending')

      const { count: pendingLF } = await supabase
        .from('lost_found')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Pending')

      const pendingTotal = (pendingGeneral || 0) + (pendingLF || 0) 

      const { count: progressGeneral } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'In Progress')
        
      const { count: progressLF } = await supabase
        .from('lost_found')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Published')

      const progressTotal = (progressGeneral || 0) + (progressLF || 0) 

      const { count: resolvedGeneral } = await supabase
        .from('reports')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved')

      const { count: resolvedLF } = await supabase
        .from('lost_found')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'Resolved')

      const resolvedTotal = (resolvedGeneral || 0) + (resolvedLF || 0) 

      setCounts({
        pending: pendingTotal || 0,
        progress: progressTotal || 0,
        resolved: resolvedTotal || 0,
      })
    } catch (err) {
      console.error('Error loading dashboard counts:', err)
    } finally {
      setLoading(false)
    }
  }

  function Card({ color, icon: Icon, count, label, onClick }: any) {
    const { theme } = useTheme()

    const isDark = theme === 'dark'

    return (
      <div
        onClick={onClick}
        className="flex flex-col items-center justify-center rounded-2xl shadow-md w-60 h-70 cursor-pointer transform hover:scale-105 transition duration-300"
        style={{
          background: isDark
            ? `linear-gradient(to bottom, #0f172a, ${color}25)`
            : `linear-gradient(to bottom, white, ${color}40)`,
          border: `1px solid ${color}`,
        }}
      >
        <Icon size={65} color={color} />

        <p
          className="text-5xl font-extrabold mt-7"
          style={{ color }}
        >
          {loading ? '...' : count}
        </p>
        <br />
        <p
          className="font-semibold mt-1 text-lg"
          style={{ color }}
        >
          {label}
        </p>
      </div>
    )
  }

  return (
    <div className="p-5">
      <h1 className="text-3xl font-extrabold mb-2">My Dashboard</h1>
      <p className="text-gray-500 mb-10">
        Here’s your overview of campus issues awaiting for attention
      </p>

      <div className="flex justify-center gap-12 flex-wrap">
        <Card
          color="#E63946"
          icon={CircleAlert}
          count={counts.pending}
          label="Pending Issues"
          onClick={() => router.push('/staff/dashboard/pending')}
        />
        <Card
          color="#F4A261"
          icon={RotateCcw}
          count={counts.progress}
          label="Issues in Progress"
          onClick={() =>
            router.push('/staff/claimed-issues?status=In%20Progress%20%26%20Published')
          }
        />

        <Card
          color="#2A9D8F"
          icon={CheckCircle}
          count={counts.resolved}
          label="Resolved Issues"
          onClick={() =>
            router.push('/staff/claimed-issues?status=Resolved')
          }
        />
      </div>
    </div>
  )
}
