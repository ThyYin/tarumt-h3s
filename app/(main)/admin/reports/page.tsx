// app/admin/reports/page.tsx  (or wherever your route is)

// 'Reports Overview' – Admin

'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { openChatWithUser } from '@/lib/openChat'

import {
  Check,
  CheckCircle,
  Clock,
  AlertCircle,
  Megaphone,
  Flag,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  UserSearch,
  MessageCircle,
} from 'lucide-react'

const ITEMS_PER_PAGE = 5

export default function AdminReportsOverviewPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const [categoryFilter, setCategoryFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)

  const [statusFilter, setStatusFilter] = useState('All')

  const [selected, setSelected] = useState<any | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // staff list for assigning
  const [staffList, setStaffList] = useState<any[]>([])
  const [assignModalOpen, setAssignModalOpen] = useState(false)
  const [assignMode, setAssignMode] = useState<'assign' | 'reassign' | null>(
    null
  )
  const [assignTarget, setAssignTarget] = useState<any | null>(null)
  const [staffSearch, setStaffSearch] = useState('')

  const [confirmAssignOpen, setConfirmAssignOpen] = useState(false)
  const [pendingStaff, setPendingStaff] = useState<any | null>(null)

  useEffect(() => {
    loadReports()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadReports() {
    setLoading(true)
    try {
      // auth + admin guard
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: myProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (myProfile?.role !== 'admin') {
        alert('Access denied. Admins only.')
        return router.push('/')
      }

      // fetch base rows
      const { data: general } = await supabase.from('reports').select('*')
      const { data: lostfound } = await supabase.from('lost_found').select('*')

      // collect profile ids to resolve names (requester + assigned staff)
      const requesterIds = [
        ...(general || []).map((r) => r.user_id),
        ...(lostfound || []).map((l) => l.user_id),
      ].filter(Boolean)

      const assignedIds = [
        ...(general || []).map((r) => r.claimed_by),
        ...(lostfound || []).map((l) => l.approved_by),
        ...(lostfound || []).map((l) => l.found_by),
      ].filter(Boolean)

      const allProfileIds = Array.from(
        new Set<string>([...requesterIds, ...assignedIds] as string[])
      )

      let profileMap = new Map<
        string,
        { name: string; email: string }
      >()
      if (allProfileIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', allProfileIds)

        const emailRes = await fetch('/api/admin/list-user-emails')
        const emailMap = await emailRes.json()

        profileMap = new Map(
          (profiles || []).map((p) => [
            p.id,
            {
              name: p.full_name || 'Unknown',
              email: emailMap[p.id] || 'Unknown',
            },
          ])
        )
      }

      // fetch images
      const { data: reportImages } = await supabase
        .from('report_images')
        .select('*')
      const { data: lfImages } = await supabase
        .from('lost_found_images')
        .select('*')
      const { data: falseImgs } = await supabase
        .from('false_report_images')
        .select('*')
      const { data: resolvedImgs } = await supabase
        .from('resolved_report_images')
        .select('*')

      const combined: any[] = [
        // GENERAL REPORTS
        ...(general || []).map((r) => ({
          ...r,
          type: 'report' as const,
          category: r.category,
          requested_by: r.user_id
            ? profileMap.get(r.user_id) || null
            : null,
          assignedStaff: r.claimed_by
            ? {
                id: r.claimed_by,
                ...profileMap.get(r.claimed_by),
              }
            : null,
          images: reportImages?.filter((img) => img.report_id === r.id) || [],
          false_images: falseImgs?.filter((img) => img.report_id === r.id) || [],
          resolved_images:
            resolvedImgs?.filter((img) => img.report_id === r.id) || [],
        })),

        // LOST & FOUND
        ...(lostfound || []).map((l) => ({
          ...l,
          type: 'lostfound' as const,
          category: 'Lost & Found',
          requested_by: l.user_id
            ? profileMap.get(l.user_id) || null
            : null,
          assignedStaff: l.approved_by
            ? {
                id: l.approved_by,
                ...profileMap.get(l.approved_by),
              }
            : null,
          foundBy: l.found_by
            ? profileMap.get(l.found_by) || null
            : null,
          images: lfImages?.filter((img) => img.lf_id === l.id) || [],
          false_images: falseImgs?.filter((img) => img.lf_id === l.id) || [],
          resolved_images:
            resolvedImgs?.filter((img) => img.lf_id === l.id) || [],
        })),
      ]

      combined.sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at)
      )

      setReports(combined || [])

      // staff list (role = 'staff')
      const { data: staffs } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, active')
        .eq('role', 'staff')

      // fetch emails
      const emailRes = await fetch('/api/admin/list-user-emails')
      const emailMap = await emailRes.json()

      const enrichedStaffs = (staffs || []).map(s => ({
        ...s,
        email: emailMap[s.id] || ''
      }))

      setStaffList(enrichedStaffs)
    } catch (err) {
      console.error('Error loading admin reports:', err)
      alert('Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }

  function statusBadge(status: string, falseReason?: string | null) {
    if (status === 'Resolved') {
      return (
        <span className="text-green-600 flex items-center gap-1">
          <CheckCircle size={16} /> Resolved
        </span>
      )
    }
    if (status === 'In Progress') {
      return (
        <span className="text-orange-500 flex items-center gap-1">
          <Clock size={16} /> In Progress
        </span>
      )
    }
    if (status === 'Published') {
      return (
        <span className="text-orange-500 flex items-center gap-1">
          <Megaphone size={16} /> Published
        </span>
      )
    }
    if (status === 'Flagged') {
      return (
        <span className="text-red-500 flex items-center gap-1">
          <Flag size={16} />
          Flagged
          {falseReason && (
            <span className="text-sm text-red-400">
              ({falseReason})
            </span>
          )}
        </span>
      )
    }
    return (
      <span className="text-blue-500 flex items-center gap-1">
        <AlertCircle size={16} /> Pending
      </span>
    )
  }

  function isEscalatable(r: any) {
    if (r.type !== 'report') return false
    if (r.status !== 'In Progress') return false
    if (!r.claimed_at || r.resolved_at) return false

    const claimedAt = new Date(r.claimed_at).getTime()
    const diffMs = Date.now() - claimedAt
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000

    return diffMs >= threeDaysMs
  }

  function formatDate(ts: string) {
    if (!ts) return '-'
    return new Date(ts).toLocaleString('en-GB')
  }

  // filters + pagination
  const filteredReports = reports.filter((r) => {
    if (r.status === 'Cancelled') return false

    const catMatch = categoryFilter === 'All' || r.category === categoryFilter
    const statusMatch = statusFilter === 'All' || r.status === statusFilter

    return catMatch && statusMatch
  })

  const categories = Array.from(new Set(reports.map((r) => r.category)))
  const statuses = Array.from(
    new Set(reports.map((r) => r.status))
  ).filter((s) => s !== 'Cancelled')

  const totalPages = Math.ceil(filteredReports.length / ITEMS_PER_PAGE) || 1

  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // assignment handlers
  function openAssignModal(report: any, mode: 'assign' | 'reassign') {
    setAssignTarget(report)
    setAssignMode(mode)
    setStaffSearch('')
    setAssignModalOpen(true)
  }

  function closeAssignModal() {
    setAssignModalOpen(false)
    setAssignMode(null)
    setAssignTarget(null)
    setStaffSearch('')
  }

  async function handleAssignToStaff(staff: any) {
    if (!assignTarget || !assignMode) return

    try {
      const nowIso = new Date().toISOString()

      if (assignTarget.type === 'report') {
        const updateData: any = {
          claimed_by: staff.id,
          claimed_at: nowIso,
        }
        if (assignTarget.status === 'Pending' || assignTarget.status === 'Published') {
          updateData.status = 'In Progress'
        }

        const { error } = await supabase
          .from('reports')
          .update(updateData)
          .eq('id', assignTarget.id)

        if (error) throw error
      } else {
        const updateData: any = {
          approved_by: staff.id,
          approved_at: nowIso,
        }
        if (assignTarget.status === 'Pending' || assignTarget.status === 'Published') {
          updateData.status = 'In Progress'
        }

        const { error } = await supabase
          .from('lost_found')
          .update(updateData)
          .eq('id', assignTarget.id)

        if (error) throw error
      }

      // local state update
      setReports((prev) =>
        prev.map((r) =>
          r.id === assignTarget.id
            ? {
                ...r,
                assignedStaffId: staff.id,
                assignedStaffName: staff.full_name,
                status:
                  r.status === 'Pending' || r.status === 'Published'
                    ? 'In Progress'
                    : r.status,
                // keep claimed_at / approved_at in memory as well
                ...(r.type === 'report'
                  ? { claimed_at: nowIso }
                  : { approved_at: nowIso }),
              }
            : r
        )
      )

      closeAssignModal()
      window.location.reload()
    } catch (err) {
      console.error('Assign staff error:', err)
      alert('Failed to assign staff.')
    }
  }

  const assignCurrentStaff =
    assignTarget &&
    staffList.find((s) => s.id === assignTarget.assignedStaffId) || null

  const filteredStaff = staffList.filter((s) => {
    const q = staffSearch.toLowerCase()

    const nameMatch = s.full_name?.toLowerCase().includes(q)
    const emailMatch = s.email?.toLowerCase().includes(q)

    if (!nameMatch && !emailMatch) return false

    // hide currently assigned staff (assign + reassign)
    if (assignTarget?.assignedStaff?.id === s.id) return false

    return true
  })

  async function handleChat(userId: string, reportId: string, type: string) {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const roomId = await openChatWithUser(user.id, userId, reportId)

      if (!roomId) {
        alert('Failed to open chat.')
        return
      }

      router.push(`/chat/${roomId}?attach=1`)
    } catch (err: any) {
      console.error('Chat redirect error:', err)
      alert(err.message || 'Unable to open chat.')
    }
  }

  return (
    <div className="p-5">
      {/* HEADER */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Reports Overview</h1>
          <p className="text-gray-500">
            View, track, and manage all reported issues across the campus
          </p>
        </div>

        {/* top-right controls: category + export */}
        <div className="flex items-center gap-4">
          <select
            value={categoryFilter}
            onChange={(e) => {
              setCategoryFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={`cursor-pointer border border-gray-300 rounded-md px-3 py-2
              ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
            }
          >
            <option value="All">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setCurrentPage(1)
            }}
            className={`cursor-pointer border border-gray-300 rounded-md px-3 py-2
              ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
            }
          >
            <option value="All">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="flex items-center text-gray-600 text-m">
          <div
            className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"
            aria-label="Loading"
          ></div>
          <span>&nbsp;Loading reports...</span>
        </div>
      ) : filteredReports.length === 0 ? (
        <p className="mt-20 text-gray-500 text-xl text-center">
          No reports found.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table
              className={`min-w-full border-collapse rounded-xl overflow-hidden
                ${theme === 'dark' ? 'bg-black' : 'bg-white'}`
              }
            >
              <thead
                className={`text-left
                  ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`
                }
              >
                <tr>
                  <th className="p-3">No.</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Submitted on</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Assigned</th>
                  <th className="p-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((r, i) => {
                  const rowIndex = (currentPage - 1) * ITEMS_PER_PAGE + i + 1
                  const canEsc = isEscalatable(r)

                  const hasAssignedStaff = !!r.assignedStaff

                  const canAssign =
                    !hasAssignedStaff &&
                    (r.status === 'Pending' || r.status === 'Published')

                  const canReassign =
                    hasAssignedStaff &&
                    (r.status === 'In Progress' || r.status === 'Published')

                  return (
                    <tr key={r.id} className="border-t">
                      <td className="p-3">{rowIndex}</td>
                      <td className="p-3">{r.category}</td>
                      <td className="p-3">{formatDate(r.created_at)}</td>
                      <td className="p-3">{statusBadge(r.status)}</td>
                      <td className="p-3">
                        {r.assignedStaff ? (
                          <div>
                            <div>{r.assignedStaff.name}</div>
                            <div className="text-sm text-gray-500">
                              {r.assignedStaff.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-3 text-sm">
                          {/* VIEW */}
                          <button
                            onClick={() => setSelected(r)}
                            className="cursor-pointer bg-cyan-500 hover:bg-cyan-400 text-white px-4 py-2 rounded-xl flex items-center gap-1"
                          >
                            View
                          </button>

                          {/* ASSIGN / REASSIGN */}
                          {canAssign && (
                            <button
                              onClick={() => openAssignModal(r, 'assign')}
                              className="cursor-pointer bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-xl"
                            >
                              Assign
                            </button>
                          )}

                          {canReassign && (
                            <button
                              onClick={() => openAssignModal(r, 'reassign')}
                              className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-xl"
                            >
                              Reassign
                            </button>
                          )}

                          {/* ESCALATE – only for general reports */}
                          {canEsc && (
                            <button
                              disabled
                              className="cursor-pointer bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-xl opacity-80"
                            >
                              Escalate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* PAGINATION */}
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(1)}
              className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronsLeft size={18} />
            </button>
            <button
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
              className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronLeft size={18} />
            </button>
            {Array.from({ length: totalPages }, (_, idx) => idx + 1).map(
              (page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`cursor-pointer px-3 py-1 rounded ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-black hover:bg-gray-300'
                  }`}
                >
                  {page}
                </button>
              )
            )}
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
              className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronRight size={18} />
            </button>
            <button
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
            >
              <ChevronsRight size={18} />
            </button>
          </div>
        </>
      )}

      {/* VIEW MODAL */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className={`rounded-2xl shadow-lg w-full max-w-3xl p-6 relative max-h-[95vh] overflow-y-auto
              ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="cursor-pointer absolute top-3 right-3 text-gray-500 hover:text-black"
            >
              <X size={30} />
            </button>

            {selected.type === 'lostfound' ? (
              <table className="details-table">
                <tbody>
                  <tr>
                    <td>Item Name</td>
                    <td>{selected.item_name}</td>
                  </tr>
                  <tr>
                    <td>Owner</td>
                    <td>
                      {selected.owner_name?.startsWith('Unknown') ? (
                        selected.owner_name
                      ) : selected.requested_by ? (
                        <>
                          <div>{selected.requested_by.name}</div>
                          <div className="text-sm text-gray-500">
                            {selected.requested_by.email}
                          </div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                  <tr>
                    <td>Description</td>
                    <td>{selected.description}</td>
                  </tr>
                  <tr>
                    <td>Lost since</td>
                    <td>
                      {selected.lost_date
                        ? formatDate(selected.lost_date)
                        : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td>Last seen</td>
                    <td>{selected.location ?? '-'}</td>
                  </tr>
                  <tr>
                    <td>Submitted on</td>
                    <td>{formatDate(selected.created_at)}</td>
                  </tr>
                  <tr>
                    <td>Resolved on</td>
                    <td>
                      {selected.resolved_at
                        ? formatDate(selected.resolved_at)
                        : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td>Status</td>
                    <td>{statusBadge(selected.status, selected.false_reason)}</td>
                  </tr>
                  <tr>
                    <td>Found by</td>
                    <td>
                      {selected.foundBy ? (
                        <>
                          <div>{selected.foundBy.name}</div>
                          <div className="text-sm text-gray-500">
                            {selected.foundBy.email}
                          </div>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td>Assigned staff</td>
                    <td>
                      {selected.assignedStaff ? (
                        <>
                          <div>{selected.assignedStaff.name}</div>
                          <div className="text-sm text-gray-500">
                            {selected.assignedStaff.email}
                          </div>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <table className="details-table">
                <tbody>
                  <tr>
                    <td>Category</td>
                    <td>{selected.category}</td>
                  </tr>
                  <tr>
                    <td>Description</td>
                    <td>{selected.description}</td>
                  </tr>
                  <tr>
                    <td>Submitted on</td>
                    <td>{formatDate(selected.created_at)}</td>
                  </tr>
                  <tr>
                    <td>Resolved on</td>
                    <td>
                      {selected.resolved_at
                        ? formatDate(selected.resolved_at)
                        : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td>Status</td>
                    <td>{statusBadge(selected.status, selected.false_reason)}</td>
                  </tr>
                  <tr>
                    <td>Requested by</td>
                    <td>
                      {selected.requested_by ? (
                        <>
                          <div>{selected.requested_by.name}</div>
                          <div className="text-sm text-gray-500">
                            {selected.requested_by.email}
                          </div>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                  <tr>
                    <td>Assigned staff</td>
                    <td>
                      {selected.assignedStaff ? (
                        <>
                          <div>{selected.assignedStaff.name}</div>
                          <div className="text-sm text-gray-500">
                            {selected.assignedStaff.email}
                          </div>
                        </>
                      ) : '-'}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}

            <style jsx>{`
              .details-table td:first-child {
                font-weight: bold;
                padding-right: 7vh;
                vertical-align: top;
              }
              .details-table td {
                padding-bottom: 1.2rem;
              }
            `}</style>

            {selected.images && selected.images.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold mb-1">Attachment(s):</p>
                <div className="grid grid-cols-4 gap-3">
                  {selected.images.map((img: any) => (
                    <img
                      key={img.id}
                      src={img.image_url || img.media_url}
                      className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:opacity-80"
                      onClick={() =>
                        setZoomImage(img.image_url || img.media_url)
                      }
                    />
                  ))}
                </div>
              </div>
            )}

            {selected.false_images?.length > 0 && (
              <div className="mt-5">
                <p className="font-semibold mb-1">False Report Attachments:</p>
                <div className="grid grid-cols-4 gap-3">
                  {selected.false_images.map((img: any) => (
                    <img
                      key={img.id}
                      src={img.image_url}
                      className="w-24 h-24 object-cover rounded-md border cursor-pointer"
                      onClick={() => setZoomImage(img.image_url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selected.resolved_images?.length > 0 && (
              <div className="mt-5">
                <p className="font-semibold mb-1">Resolution Proof:</p>
                <div className="grid grid-cols-4 gap-3">
                  {selected.resolved_images.map((img: any) => (
                    <img
                      key={img.id}
                      src={img.image_url}
                      className="w-24 h-24 object-cover rounded-md border cursor-pointer"
                      onClick={() => setZoomImage(img.image_url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selected.status === 'Flagged' && (
              <div className="mt-4 border-t pt-3">
                <p className="font-semibold text-red-600">🚩 Flag Details</p>
                <p>
                  <strong>Reason:</strong>{' '}
                  {selected.false_reason || 'No reason provided'}
                </p>
              </div>
            )}

            {/* CHAT USER ONLY */}
            <div className="flex justify-end mt-8">
              <button
                onClick={() =>
                  handleChat(selected.user_id, selected.id, selected.type)
                }
                className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-5 py-3 rounded-xl flex items-center gap-2"
              >
                <MessageCircle size={18} /> Chat User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* IMAGE ZOOM */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            alt="Zoomed"
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
          />
        </div>
      )}

      {/* ASSIGN / REASSIGN MODAL */}
      {assignModalOpen && assignTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-[70]"
          onClick={closeAssignModal}
        >
          <div
            className={`rounded-2xl shadow-lg w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto
              ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={closeAssignModal}
              className="cursor-pointer absolute right-6 top-6 text-gray-500 hover:text-black"
            >
              <X size={24} />
            </button>

            <h2 className="text-2xl font-extrabold mb-4 flex items-center gap-2">
              <UserSearch size={22} />
              {assignMode === 'assign' ? 'Assign Staff' : 'Reassign Staff'}
            </h2>

            <p className="text-sm text-gray-500 mb-4">
              {assignTarget.category} &middot;{' '}
              {assignTarget.item_name?.slice(0, 80)}
              {assignTarget.item_name?.length > 80 && '...'}
            </p>

            <div className="mb-3">
              <label className="text-sm font-semibold block mb-1">
                Search staff
              </label>
              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  value={staffSearch}
                  onChange={(e) => setStaffSearch(e.target.value)}
                  placeholder="Search by staff name…"
                  className="w-full pl-9 pr-3 py-2 border rounded-lg"
                />
              </div>
            </div>

            <div className="mt-3 border rounded-lg max-h-60 overflow-y-auto">
              {filteredStaff.length > 0 ? (
                filteredStaff.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      setPendingStaff(s)
                      setConfirmAssignOpen(true)
                    }}
                    className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition
                      ${
                        theme === 'dark'
                          ? 'bg-gray-800 hover:bg-blue-900 text-white'
                          : 'bg-white hover:bg-blue-100'
                      }
                    `}
                  >
                    {/* Avatar */}
                    <img
                      src={s.avatar_url || '/default-avatar.png'}
                      alt={s.full_name}
                      className="w-8 h-8 rounded-full object-cover border"
                    />

                    {/* Name + Email */}
                    <div className="flex flex-col flex-1">
                      <span
                        className={`font-medium ${
                          theme === 'dark' ? 'text-white' : 'text-black'
                        }`}
                      >
                        {s.full_name || 'Unnamed Staff'}
                      </span>
                      <span
                        className={`text-sm ${
                          theme === 'dark' ? 'text-gray-400' : 'text-gray-500'
                        }`}
                      >
                        {s.email || '—'}
                      </span>
                    </div>

                    {!s.active && (
                      <span className="text-xs text-red-500 font-semibold">
                        Inactive
                      </span>
                    )}
                  </div>
                ))
              ) : (
                <div
                  className={`px-4 py-3 text-sm italic
                    ${theme === 'dark'
                      ? 'bg-gray-800 text-gray-400'
                      : 'bg-white text-gray-500'
                    }`}
                >
                  No matching staff found.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmAssignOpen && pendingStaff && assignTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[80]">
          <div
            className={`rounded-xl shadow-lg p-6 w-[420px]
              ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black'}`}
          >
            <h3 className="text-lg font-bold mb-2">Confirm Assignment</h3>

            <p className="text-sm text-gray-500 mb-4">
              Are you sure you want to {assignMode === 'assign' ? 'assign' : 'reassign'} this report to:
            </p>

            {/* Staff preview */}
            <div className="flex items-center gap-3 p-3 border rounded-lg mb-4">
              <img
                src={pendingStaff.avatar_url || '/default-avatar.png'}
                className="w-10 h-10 rounded-full object-cover border"
              />
              <div>
                <p className="font-semibold">{pendingStaff.full_name}</p>
                <p className="text-sm text-gray-500">{pendingStaff.email}</p>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3">
              
              <button
                onClick={() => {
                  handleAssignToStaff(pendingStaff)
                  setConfirmAssignOpen(false)
                  setPendingStaff(null)
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
              >
                <Check size={16} /> Confirm
              </button>

              <button
                onClick={() => {
                  setConfirmAssignOpen(false)
                  setPendingStaff(null)
                }}
                className="px-4 py-2 rounded-lg bg-gray-500 hover:bg-gray-400 text-white cursor-pointer"
              >
                Cancel
              </button>

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
