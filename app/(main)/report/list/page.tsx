'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { openChatWithUser } from '@/lib/openChat'

import Link from 'next/link'
import {
  FileText,
  CheckCircle,
  Clock,
  Megaphone,
  AlertCircle,
  MessageSquare,
  Pencil,
  X,
  Ban,
  Plus,
  Flag,
  Image as ImageIcon,
  ChevronLeft, ChevronsLeft,
  ChevronRight, ChevronsRight
} from 'lucide-react'

type StaffInfo = {
  id: string
  name: string
  email: string
}

type Report = {
  id: string
  user_id: string
  category?: string
  description: string
  status: string
  created_at: string
  resolved_at?: string | null
  resolved_attachment?: string | null
  approved_by?: string | null
  type: 'report' | 'lostfound'
  item_name?: string
  images: { id: string; image_url: string }[]
  location?: string | null
  lost_date?: string | null
  owner_name?: string | null
  assigned_to?: StaffInfo | null
  staff_in_charge?: StaffInfo | null
  found_by_info?: {
    name: string
    email: string
  } | null
  false_reason?: string | null
}

export default function ReportListPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const [reports, setReports] = useState<Report[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Report | null>(null)
  const router = useRouter()
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // Filters + Pagination
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    loadReports()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadReports() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.push('/login');

      // main data
      const { data: general } = await supabase
        .from('reports')
        .select('*')
        .eq('user_id', user.id);

      const { data: lostfound } = await supabase
        .from('lost_found')
        .select('*')
        .eq('user_id', user.id);

        // collect staff IDs
        const staffIds = [
          ...(general || []).map(r => r.claimed_by),
          ...(lostfound || []).map(l => l.approved_by),
          ...(lostfound || []).map(l => l.found_by)
        ].filter(Boolean)

        // fetch staff names
        const { data: staffProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', staffIds)

        const emailRes = await fetch('/api/admin/list-user-emails')
        const emailMap = await emailRes.json()

        const staffMap = new Map(
          (staffProfiles || []).map(s => [
            s.id,
            {
              id: s.id,
              name: s.full_name,
              email: emailMap[s.id] || 'Unknown',
            }
          ])
        )

      // images
      const { data: reportImages } = await supabase
        .from('report_images')
        .select('*');

      const { data: lfImages } = await supabase
        .from('lost_found_images')
        .select('*');

      const combined: Report[] = [

        // GENERAL REPORTS
        ...(general?.map((r) => ({
          ...r,
          type: "report" as const,
          assigned_to: staffMap.get(r.claimed_by) || null,
          images:
            reportImages
              ?.filter((img) => img.report_id === r.id)
              .map((img) => ({
                id: img.id,
                image_url: img.image_url,
              })) || [],
        })) ?? []),

        // LOST & FOUND
        ...(lostfound?.map((l) => ({
          ...l,
          type: "lostfound" as const,
          category: "Lost & Found",
          staff_in_charge: staffMap.get(l.approved_by) || null,
          found_by_info: l.found_by ? staffMap.get(l.found_by) || null : null,
          images:
            lfImages
              ?.filter((img) => img.lf_id === l.id)
              .map((img) => ({
                id: img.id,
                image_url: img.media_url,  // IMPORTANT FIX
              })) || [],

          location: l.location ?? null,
          lost_date: l.lost_date ?? null,
          owner_name: l.owner_name ?? null,
        })) ?? []),

      ];

      combined.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
      setReports(combined);

    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status: string, falseReason?: string | null) {
    if (status === 'Resolved')
      return (
        <span className="text-green-600 flex items-center gap-1">
          <CheckCircle size={16} /> Resolved
        </span>
      )
    if (status === 'In Progress')
      return (
        <span className="text-orange-500 flex items-center gap-1">
          <Clock size={16} /> In Progress
        </span>
      )
    if (status === 'Published')
      return (
        <span className="text-orange-500 flex items-center gap-1">
          <Megaphone size={16} /> Published
        </span>
      )
    if (status === 'Cancelled')
      return (
        <span className="text-gray-400 flex items-center gap-1">
          <Ban size={16} /> Cancelled
        </span>
      )
    if (status === 'Flagged')
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
    return (
      <span className="text-blue-500 flex items-center gap-1">
        <AlertCircle size={16} /> Pending
      </span>
    )
  }

  async function handleCancel(id: string, type: 'report' | 'lostfound') {
    const confirmCancel = window.confirm(
      'Are you sure you want to cancel this report?'
    )
    if (!confirmCancel) return

    const tableName = type === 'lostfound' ? 'lost_found' : 'reports'

    const { error } = await supabase
      .from(tableName)
      .update({ status: 'Cancelled' })
      .eq('id', id)

    if (error) {
      alert('Failed to cancel the report.')
      return
    }

    setSelected(null)
    loadReports()
  }

  async function handleChat(staffId: string, reportId: string) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return router.push('/login')
  
        const roomId = await openChatWithUser(user.id, staffId, reportId)

        if (!roomId) {
          alert("Failed to open chat.")
          return
        }
  
        router.push(`/chat/${roomId}?attach=1`)
      } catch (err: any) {
        console.error('Chat redirect error:', err)
        alert(err.message || 'Unable to open chat.')
      }
    }

  // FILTER LOGIC
  const filteredReports = reports.filter((r) => {
    const catMatch = categoryFilter === "All" || r.category === categoryFilter;
    const statMatch = statusFilter === "All" || r.status === statusFilter;
    return catMatch && statMatch;
  });

  // Collect category list (avoid Lost & Found duplicate)
  const categories = Array.from(new Set(reports.map((r) => r.category)));

  const statuses = Array.from(new Set(reports.map((r) => r.status)));

  // PAGINATION LOGIC
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage);
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Submission History</h1>
          <p className="text-gray-500">View your submitted reports and track its progress</p>
        </div>
        <Link
          href="/report/new"
          className="bg-blue-600 hover:bg-blue-500 transition flex items-center gap-2 text-white px-4 py-2 rounded-lg"
        >
          <Plus size={18} /> Submit New Report
        </Link>
      </div>


      {/* Table */}
      {loading ? (
        <div className="flex items-center text-gray-600 text-m">
          <div className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"></div>
          <span>&nbsp;Loading submissions...</span>
        </div>
      ) : reports.length === 0 ? (
        <p className="mt-20 text-gray-500 text-xl text-center">Your submissions are empty. Click <span className="text-blue-500 underline cursor-pointer" onClick={() => (window.location.href = '/report/new')}>here</span> to submit a report.</p>
      ) : (
        <>
          {/* FILTERS */}
          <div className="flex flex-wrap gap-3 mb-5">

            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`cursor-pointer border border-gray-300 rounded-md p-2
                ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
              }
            >
              <option value="All">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setCurrentPage(1);
              }}
              className={`cursor-pointer border border-gray-300 rounded-md p-2
                ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
              }
            >
              <option value="All">All Statuses</option>
              {statuses.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

          </div>

          <table
            className={`w-full border-collapse rounded-xl overflow-hidden
              ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}
            `}
          >
            <thead className={`${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 textblack'}`}>
              <tr>
                <th className="p-3 text-left">No.</th>
                <th className="p-3 text-left">Category</th>
                <th className="p-3 text-left">Submitted on</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.map((r, i) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3">{r.category}</td>
                  <td className="p-3">
                    {new Date(r.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="p-3">{statusBadge(r.status)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelected(r)}
                      className={`cursor-pointer p-2 rounded 
                        ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`
                      }
                    >
                      <FileText size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

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

      {/* Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex justify-center items-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className={`rounded-2xl shadow-lg w-full max-w-3xl p-6 max-h-[95vh] overflow-y-auto relative
              ${theme === 'dark' ? 'bg-gray-800 text-white' : 'bg-white text-black' }`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="cursor-pointer absolute top-3 right-3 text-gray-500"
            >
              <X size={30} />
            </button>

            {/* Different table for lost & found vs general report */}
            {selected.type === 'lostfound' ? (
              <>
                <table className="details-table">
                  <tbody>
                    <tr>
                      <td>Item Name</td>
                      <td>{selected.item_name}</td>
                    </tr>
                    <tr>
                      <td>Description</td>
                      <td>{selected.description}</td>
                    </tr>
                    <tr>
                      <td>Lost since</td>
                      <td>{selected.lost_date ? new Date(selected.lost_date).toLocaleDateString('en-GB') : '-'}</td>
                    </tr>
                    <tr>
                      <td>Last seen</td>
                      <td>{selected.location ?? '-'}</td>
                    </tr>
                    <tr>
                      <td>Submitted on</td>
                      <td>{new Date(selected.created_at).toLocaleString('en-GB')}</td>
                    </tr>
                    <tr>
                      <td>Resolved on</td>
                      <td>
                        {selected.resolved_at ? new Date(selected.resolved_at).toLocaleString('en-GB'): '-'}
                      </td>
                    </tr>
                    <tr>
                      <td>Found by</td>
                      <td>
                        {selected.found_by_info ? (
                          <>
                            <div>{selected.found_by_info.name}</div>
                            <div className="text-sm text-gray-500">
                              {selected.found_by_info.email}
                            </div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>Staff in-charge</td>
                      <td>
                      {selected.staff_in_charge ? (
                        <>
                          <div>{selected.staff_in_charge.name}</div>
                          <div className="text-sm text-gray-500">
                            {selected.staff_in_charge.email}
                          </div>
                        </>
                      ) : (
                        '-'
                      )}
                    </td>
                    </tr>
                    <tr>
                      <td>Status</td>
                      <td>{statusBadge(selected.status, selected.false_reason)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            ) : (
              <>
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
                      <td>{new Date(selected.created_at).toLocaleString('en-GB')}</td>
                    </tr>
                    <tr>
                      <td>Resolved on</td>
                      <td>{selected.resolved_at ? new Date(selected.resolved_at).toLocaleString('en-GB') : '-'}</td>
                    </tr>
                    <tr>
                      <td>Assigned to</td>
                      <td>
                        {selected.assigned_to ? (
                          <>
                            <div>{selected.assigned_to.name}</div>
                            <div className="text-sm text-gray-500">
                              {selected.assigned_to.email}
                            </div>
                          </>
                        ) : (
                          '-'
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td>Status</td>
                      <td>{statusBadge(selected.status, selected.false_reason)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
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

            {/* Multi Images */}
            {selected.images.length > 0 && (
              <div className="mt-5">
                <p className="font-semibold mb-3">Attachment(s)</p>

                <div className="grid grid-cols-5 gap-3">
                  {selected.images.map((img) => (
                    <img
                      key={img.id}
                      src={img.image_url}
                      className="cursor-pointer w-30 h-30 object-cover rounded-xl border"
                      onClick={() => setZoomImage(img.image_url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ACTION BUTTONS */}
            <div className="flex gap-6 mt-12">
              {selected.status === 'Pending' && (
                <>
                  <button
                    onClick={() =>
                      selected.type === 'lostfound'
                        ? router.push(`/lostfound/edit/${selected.id}`)
                        : router.push(`/report/edit/${selected.id}`)
                    }
                    className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-xl flex items-center gap-2"
                  >
                    <Pencil size={18} /> Edit Report
                  </button>

                  <button
                    onClick={() => handleCancel(selected.id, selected.type)}
                    className="cursor-pointer bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl flex items-center gap-2"
                  >
                    <Ban size={18} /> Cancel
                  </button>
                </>
              )}

              {(selected.status === 'In Progress' || selected.status === 'Published') && (
                <button
                  onClick={() => {
                    const staff =
                      selected.type === 'lostfound'
                        ? selected.staff_in_charge
                        : selected.assigned_to

                    if (!staff) {
                      alert('No staff assigned to this report yet.')
                      return
                    }

                    handleChat(staff.id, selected.id)
                  }}
                  className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"
                >
                  <MessageSquare size={18} /> Chat Staff
                </button>
              )}

              {selected.status === 'Resolved' && (
                <>
                  {selected.resolved_attachment && (
                    <a
                      href={selected.resolved_attachment}
                      target="_blank"
                      className="cursor-pointer bg-purple-500 text-white px-4 py-2 rounded flex items-center gap-2"
                    >
                      <ImageIcon size={18} /> View Fix Proof
                    </a>
                  )}

                  <button
                    onClick={() => {
                      const staff =
                        selected.type === 'lostfound'
                          ? selected.staff_in_charge
                          : selected.assigned_to

                      if (!staff) {
                        alert('No staff assigned to this report yet.')
                        return
                      }

                      handleChat(staff.id, selected.id)
                    }}
                    className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded flex items-center gap-2"
                  >
                    <MessageSquare size={18} /> Chat Staff
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-zoom-out"
          onClick={() => setZoomImage(null)}
        >
          <img src={zoomImage} alt="Zoomed" className="max-w-[90vw] max-h-[90vh] rounded-lg" />
        </div>
      )}
    </div>
  )
}
