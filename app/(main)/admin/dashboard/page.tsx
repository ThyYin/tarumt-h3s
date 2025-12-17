// app/admin/dashboard/page.tsx (or wherever your admin dashboard lives)

'use client'

import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts'
import { Upload } from 'lucide-react'

type TimeFilter = 'ALL_TIME' | 'THIS_MONTH' | 'THIS_WEEK' | 'TODAY'

type DashboardStats = {
  totalReports: number
  overdueReports: number
  activeStaffs: number
  avgResolutionDays: number
  categoryData: { name: string; value: number }[]
  overTimeData: { label: string; count: number }[]
  recentReports: {
    id: string
    type: 'report' | 'lostfound'
    category: string
    created_at: string
    status: string
  }[]
}

const CATEGORY_LABELS = [
  'Electrical Issues',
  'Plumbing & Water Supply',
  'Building & Infrastructure',
  'Furniture & Equipment',
  'ICT & Network',
  'Safety & Security',
  'Cleanliness & Environment',
  'Others',
  'Lost & Found',
]

const CATEGORY_COLOURS = [
  '#dacb00ff',    // electrical issues
  '#3b82f6',      // plumbing & water supply
  '#f97316',      // building & infrastructure
  '#5f3600ff',    // furniture & equipment
  '#02d8feff',    // ict & network
  '#007007ff',    // safety & security
  '#2bff00ff',      // cleanliness & environment
  '#a0a0a0ff',      // others
  '#ff0000ff',      // lost & found
]

const monthLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AdminDashboard() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL_TIME')
  const currentYear = new Date().getFullYear()
  const [selectedYear, setSelectedYear] = useState<number>(currentYear)

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - i)

  useEffect(() => {
    loadDashboard()
    setMounted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter, selectedYear])

  if (!mounted) return null

  function getFilterRange(filter: TimeFilter, year: number) {
    const now = new Date()

    if (filter === 'ALL_TIME') {
      const from = new Date(year, 0, 1, 0, 0, 0)
      const to = new Date(year + 1, 0, 1, 0, 0, 0)
      return { from, to }
    }

    if (filter === 'THIS_MONTH') {
      const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0)
      const to = new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0)
      return { from, to }
    }

    if (filter === 'THIS_WEEK') {
      const d = new Date(now)
      const day = d.getDay() // 0 = Sun
      const diffToMonday = (day + 6) % 7
      d.setDate(d.getDate() - diffToMonday)
      d.setHours(0, 0, 0, 0)
      const from = d
      const to = new Date(from)
      to.setDate(to.getDate() + 7)
      return { from, to }
    }

    // TODAY
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const to = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0)
    return { from, to }
  }

  function buildOverTimeData(
    filter: TimeFilter,
    reports: { created_at: string }[],
    lostFound: { created_at: string }[]
  ) {
    const all = [...reports, ...lostFound]

    if (filter === 'ALL_TIME') {
      const buckets = monthLabels.map((label) => ({ label, count: 0 }))
      all.forEach((r) => {
        const d = new Date(r.created_at)
        const m = d.getMonth()
        buckets[m].count += 1
      })
      return buckets
    }

    if (filter === 'THIS_MONTH') {
      const now = new Date()
      const y = now.getFullYear()
      const m = now.getMonth()
      const start = new Date(y, m, 1)
      const daysInMonth = new Date(y, m + 1, 0).getDate()
      const numWeeks = Math.ceil(daysInMonth / 7)
      const buckets = Array.from({ length: numWeeks }, (_, i) => ({
        label: `Week ${i + 1}`,
        count: 0,
      }))

      all.forEach((r) => {
        const d = new Date(r.created_at)
        const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000)
        if (diffDays < 0 || diffDays >= daysInMonth) return
        const weekIndex = Math.floor(diffDays / 7)
        if (weekIndex >= 0 && weekIndex < numWeeks) {
          buckets[weekIndex].count += 1
        }
      })

      return buckets
    }

    if (filter === 'THIS_WEEK') {
      const now = new Date()
      const day = now.getDay()
      const diffToMonday = (day + 6) % 7
      const start = new Date(now)
      start.setDate(start.getDate() - diffToMonday)
      start.setHours(0, 0, 0, 0)

      const buckets = dayLabels.map((label) => ({ label, count: 0 }))

      all.forEach((r) => {
        const d = new Date(r.created_at)
        const diffDays = Math.floor((d.getTime() - start.getTime()) / 86400000)
        if (diffDays < 0 || diffDays >= 7) return
        buckets[diffDays].count += 1
      })

      return buckets
    }

    // TODAY
    const now = new Date()
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0)
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      label: `${h}:00`,
      count: 0,
    }))

    all.forEach((r) => {
      const d = new Date(r.created_at)
      const diffMs = d.getTime() - start.getTime()
      if (diffMs < 0 || diffMs >= 24 * 60 * 60 * 1000) return
      const hour = d.getHours()
      buckets[hour].count += 1
    })

    return buckets
  }

  async function loadDashboard() {
    setLoading(true)
    try {
      // 🔐 Auth + admin check
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        router.push('/login')
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        alert('Access denied. Admins only.')
        router.push('/')
        return
      }

      // 🎯 Time range for filter-based cards
      const { from, to } = getFilterRange(timeFilter, selectedYear)
      const fromIso = from.toISOString()
      const toIso = to.toISOString()

      // ⏱ three-day window for overdue
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      // 🔄 Parallel queries
      const [
        filteredReportsRes,
        filteredLostRes,
        overdueReportsRes,
        overdueLostRes,
        claimedReportsRes,
        approvedLostRes,
        staffProfilesRes,
        recentReportsRes,
        recentLostRes,
      ] = await Promise.all([
        // filtered reports
        supabase
          .from('reports')
          .select('id, category, status, created_at, resolved_at')
          .gte('created_at', fromIso)
          .lt('created_at', toIso),

        // filtered lost & found
        supabase
          .from('lost_found')
          .select('id, status, created_at, resolved_at')
          .gte('created_at', fromIso)
          .lt('created_at', toIso),

        // overdue general reports (claimed more than 3 days ago & not resolved)
        supabase
          .from('reports')
          .select('*', { count: 'exact', head: true })
          .lte('claimed_at', oneMonthAgo)
          .neq('status', 'Resolved'),

        // overdue lost & found (approved more than 3 days ago & not resolved)
        supabase
          .from('lost_found')
          .select('*', { count: 'exact', head: true })
          .lte('approved_at', oneMonthAgo)
          .neq('status', 'Resolved'),

        // claimed reports for active staffs
        supabase
          .from('reports')
          .select('claimed_by')
          .not('claimed_by', 'is', null),

        // approved lost & found for active staffs
        supabase
          .from('lost_found')
          .select('approved_by')
          .not('approved_by', 'is', null),

        // staff profiles (role = staff)
        supabase.from('profiles').select('id').eq('role', 'staff'),

        // recent general reports
        supabase
          .from('reports')
          .select('id, category, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),

        // recent lost & found
        supabase
          .from('lost_found')
          .select('id, status, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ])

      const filteredReports = (filteredReportsRes.data ?? []) as {
        id: string
        category: string
        status: string
        created_at: string
        resolved_at: string | null
      }[]

      const filteredLost = (filteredLostRes.data ?? []) as {
        id: string
        status: string
        created_at: string
        resolved_at: string | null
      }[]

      // 🧮 Total reports in selected period (reports + lost & found)
      const totalReports = filteredReports.length + filteredLost.length

      // ⏱ Overdue count (system-wide, NOT affected by time filter)
      const overdueReports = (overdueReportsRes.count ?? 0) + (overdueLostRes.count ?? 0)

      // 👥 Active staffs (staffs with at least 1 claimed/approved item)
      const claimed = claimedReportsRes.data ?? []
      const approved = approvedLostRes.data ?? []
      const staffProfiles = staffProfilesRes.data ?? []

      const assignedIds = new Set<string>()
      claimed.forEach((r: any) => {
        if (r.claimed_by) assignedIds.add(r.claimed_by)
      })
      approved.forEach((l: any) => {
        if (l.approved_by) assignedIds.add(l.approved_by)
      })

      const activeStaffs = staffProfiles.filter((s: any) => assignedIds.has(s.id)).length

      // 📏 Average resolution time (days) in selected period
      const resolutionDurations: number[] = []

      filteredReports.forEach((r) => {
        if (r.resolved_at) {
          const created = new Date(r.created_at).getTime()
          const resolved = new Date(r.resolved_at).getTime()
          if (resolved > created) {
            resolutionDurations.push((resolved - created) / (1000 * 60 * 60 * 24))
          }
        }
      })
      filteredLost.forEach((l) => {
        if (l.resolved_at) {
          const created = new Date(l.created_at).getTime()
          const resolved = new Date(l.resolved_at).getTime()
          if (resolved > created) {
            resolutionDurations.push((resolved - created) / (1000 * 60 * 60 * 24))
          }
        }
      })

      const avgResolutionDays =
        resolutionDurations.length === 0
          ? 0
          : Math.round(
              (resolutionDurations.reduce((a, b) => a + b, 0) / resolutionDurations.length) * 10
            ) / 10

      // 🥧 Reports by Category (selected period, general + L&F)
      const categoryData = CATEGORY_LABELS.map((name) => {
        if (name === 'Lost & Found') {
          return { name, value: filteredLost.length }
        }
        const count = filteredReports.filter((r) => r.category === name).length
        return { name, value: count }
      })

      // 📊 Reports over time (selected period, general + L&F)
      const overTimeData = buildOverTimeData(timeFilter, filteredReports, filteredLost)

      // 🕒 Recent reports (3 latest, system-wide)
      const recentGeneral = (recentReportsRes.data ?? []).map((r: any) => ({
        id: r.id,
        type: 'report' as const,
        category: r.category,
        created_at: r.created_at,
        status: r.status,
      }))

      const recentLost = (recentLostRes.data ?? []).map((l: any) => ({
        id: l.id,
        type: 'lostfound' as const,
        category: 'Lost & Found',
        created_at: l.created_at,
        status: l.status,
      }))

      const recentCombined = [...recentGeneral, ...recentLost].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      )

      const recentReports = recentCombined.slice(0, 3)

      setStats({
        totalReports,
        overdueReports,
        activeStaffs,
        avgResolutionDays,
        categoryData,
        overTimeData,
        recentReports,
      })
    } catch (err) {
      console.error('Error loading dashboard:', err)
      alert('Failed to load dashboard data.')
    } finally {
      setLoading(false)
    }
  }

  function getNumericCellValue(rowRaw: unknown, index: number): number | null {
    if (Array.isArray(rowRaw) && rowRaw[index] !== undefined) {
      return Number(rowRaw[index])
    }
    return null
  }

  function handleExportPDF() {
    if (!stats) return

    const doc = new jsPDF()
    let y = 15

    // 🧾 Title
    doc.setFontSize(16)
    doc.text('TARUMT Health & Support System Analytics Report', 14, y)
    y += 10

    doc.setFontSize(10)
    doc.text(
      `Generated on: ${new Date().toLocaleString('en-GB')}`,
      14,
      y
    )
    y += 10

    // 📏 Average Resolution
    doc.setFontSize(14)
    doc.text('Average Resolution Time', 14, y)
    y += 6

    doc.setFontSize(11)
    doc.text(`${stats.avgResolutionDays.toFixed(1)} days`, 14, y)
    y += 10

    // 🥧 Reports by Category
    doc.setFontSize(14)
    doc.text('Reports by Category', 14, y)
    y += 4

    const maxCategoryValue = Math.max(
      ...stats.categoryData.map(c => c.value)
    )

    const maxOverTimeValue = Math.max(
      ...stats.overTimeData.map(d => d.count)
    )

    autoTable(doc, {
      startY: y,
      head: [['Category', 'Count']],
      body: stats.categoryData.map(c => [c.name, c.value]),
      styles: { fontSize: 10 },
      didParseCell: function (data) {
        if (data.section !== 'body') return

        const value = getNumericCellValue(data.row.raw, 1)

        if (value === maxCategoryValue) {
          data.cell.styles.fillColor = [255, 241, 118]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    y = (doc as any).lastAutoTable.finalY + 10

    // 📊 Reports Over Time
    doc.setFontSize(14)
    doc.text('Reports Over Time', 14, y)
    y += 4

    autoTable(doc, {
      startY: y,
      head: [['Period', 'Number of Reports']],
      body: stats.overTimeData.map(d => [d.label, d.count]),
      styles: { fontSize: 10 },
      didParseCell: function (data) {
        if (data.section !== 'body') return

        const value = getNumericCellValue(data.row.raw, 1)

        if (value === maxOverTimeValue) {
          data.cell.styles.fillColor = [255, 241, 118]
          data.cell.styles.fontStyle = 'bold'
        }
      },
    })

    // 💾 Save
    doc.save(`analytics_${timeFilter}_${new Date().toISOString().slice(0, 10)}.pdf`)
  }

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Here’s a quick overview of reports, staff activity, and system performance
          </p>
        </div>
      </div>

      {loading || !stats ? (
        <div className="flex items-center text-gray-600 text">
          <div
            className="w-5 h-5 border-4 border-gray-300 border-t-blue-500 rounded-full animate-spin mr-2"
            aria-label="Loading"
          ></div>
          <span>Loading analytics...</span>
        </div>
      ) : (
        <>
          {/* Top summary cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-15">
            {/* Total reports */}
            <div
              className={`rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex flex-col justify-between
                ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`
              }
            >
              <div>
                <p className="text-lg font-extrabold mb-4">Total reports</p>
                <p className="mt-3 text-5xl font-extrabold">{stats.totalReports}</p>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                All submitted reports in the selected period
              </p>
            </div>

            {/* Overdue */}
            <div
              className={`rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex flex-col justify-between
                ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`
              }
            >
              <div>
                <p className="text-lg font-extrabold mb-4">Overdue</p>
                <p className="mt-3 text-5xl font-extrabold">{stats.overdueReports}</p>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Items needing admin attention to prevent unhandled reports
              </p>
            </div>

            {/* Recent reports */}
            <div 
              className={`lg:col-span-2 cursor-pointer rounded-2xl shadow-sm border border-gray-100 px-6 py-5
                ${theme === 'dark' ? 'bg-gray-900' : 'bg-white'}`
              }
              onClick={() => router.push('/admin/reports')}
            >
              <h2 className="text-lg font-extrabold mb-4">Recent reports</h2>
              {stats.recentReports.length === 0 ? (
                <p className="text-sm text-gray-400">No recent reports.</p>
              ) : (
                <table className="text-sm px-5 w-full rounded-xl overflow-hidden">
                  <thead>
                    <tr
                      className={`text-left border-b
                        ${theme === 'dark' ? 'text-white' : 'text-black'}`
                      }
                    >
                      <th className="py-2 pr-2">Category</th>
                      <th className="py-2 pr-2">Requested on</th>
                      <th className="py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {stats.recentReports.map((r) => (
                      <tr key={`${r.type}-${r.id}`} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          {r.category}
                          {r.type === 'lostfound' ? '' : ''}
                        </td>
                        <td className="py-2 pr-2">
                          {new Date(r.created_at).toLocaleDateString('en-GB')}
                        </td>
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              r.status === 'Resolved'
                                ? 'bg-green-100 text-green-700'
                                : r.status === 'In Progress'
                                ? 'bg-orange-100 text-orange-700'
                                : r.status === 'Flagged'
                                ? 'bg-red-100 text-red-700'
                                : 'bg-blue-100 text-blue-700'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
          {/* Time filter */}
          <select
            value={timeFilter}
            onChange={(e) => setTimeFilter(e.target.value as TimeFilter)}
            className={`border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer shadow-sm
              ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
            }
          >
            <option value="ALL_TIME">All time</option>
            <option value="THIS_MONTH">This month</option>
            <option value="THIS_WEEK">This week</option>
            <option value="TODAY">Today</option>
          </select>

          {/* Year filter (only relevant for All time) */}
          {timeFilter === 'ALL_TIME' && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className={`border border-gray-300 rounded-lg px-3 py-2 text-sm cursor-pointer shadow-sm
                ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
              }
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}

          {/* Export button (placeholder) */}
          <button
            type="button"
            onClick={handleExportPDF}
            className="flex items-center gap-2 bg-green-500 hover:bg-green-400 text-white text-sm font-medium px-4 py-2 rounded-xl shadow-sm cursor-pointer"
          >
            <Upload size={18} /> Export PDF
          </button>
        </div>

        {/* Average resolution */}
            <div
              className={`rounded-2xl shadow-sm border border-gray-100 px-6 py-5 flex flex-col justify-between
                ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'}`
              }
            >
              <div>
                <p className="text-sm text-gray-500 font-medium">Average resolution</p>
                <p className="mt-3 text-4xl font-extrabold">
                  {stats.avgResolutionDays.toFixed(1)} days
                </p>
              </div>
              <p className="mt-3 text-xs text-gray-500">
                Average time taken for staffs to resolve issues
              </p>
            </div>

          {/* Bottom row: pie, bar, recent */}
          <div className="grid gap-6">
            {/* Reports by category */}
            <div
              className={`rounded-2xl shadow-sm border border-gray-100 px-6 py-5
                ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'}`
              }
            >
              <h2 className="text-xl font-extrabold mb-5">Reports by Category</h2>
              <div className="w-full h-64">
                {stats.categoryData.every((c) => c.value === 0) ? (
                  <p className="text-sm text-gray-400 flex items-center justify-center h-full">
                    No data for this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={stats.categoryData}
                        dataKey="value"
                        nameKey="name"
                        outerRadius={90}
                        labelLine={false}
                        label={({ name, percent, value }) => {
                          const p = typeof percent === 'number' ? percent : 0

                          return p
                            ? `${name} ${(p * 100).toFixed(0)}% (${value})`
                            : ''
                        }}
                      >
                        {stats.categoryData.map((entry, index) => (
                          <Cell
                            key={`cell-${entry.name}`}
                            fill={CATEGORY_COLOURS[index % CATEGORY_COLOURS.length]}
                          />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Reports over time */}
            <div
              className={`rounded-2xl shadow-sm border border-gray-100 px-6 py-5 lg:col-span-1
                ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-white text-black'}`
              }
            >
              <h2 className="text-xl font-extrabold mb-10">Reports over time</h2>
              <div className="w-full h-64">
                {stats.overTimeData.every((d) => d.count === 0) ? (
                  <p className="text-sm text-gray-400 flex items-center justify-center h-full">
                    No data for this period.
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.overTimeData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis
                        dataKey="label"
                        tickLine={false}
                        tick={{ fill: theme === 'dark' ? '#ffffff' : '#374151' }} // gray-700
                      />

                      <YAxis
                        allowDecimals={false}
                        tickLine={false}
                        tick={{ fill: theme === 'dark' ? '#ffffff' : '#374151' }}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: theme === 'dark' ? '#111827' : '#ffffff',
                          border: 'none',
                          borderRadius: '8px',
                          color: theme === 'dark' ? '#ffffff' : '#000000',
                        }}
                        labelStyle={{
                          color: theme === 'dark' ? '#ffffff' : '#000000',
                          fontWeight: 600,
                        }}
                        itemStyle={{
                          color: theme === 'dark' ? '#2dd4bf' : '#14b8a6',
                        }}
                      />
                      <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#14b8a6" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
