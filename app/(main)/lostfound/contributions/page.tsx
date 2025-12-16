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
  X,
  Ban,
  Flag,
  ChevronLeft, ChevronsLeft,
  ChevronRight, ChevronsRight
} from 'lucide-react'

export default function ContributionsPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  useEffect(() => {
    loadData()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadData() {
    setLoading(true)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    // 1️⃣ Fetch founder submissions
    const { data: founders } = await supabase
      .from('lost_found_founders')
      .select('*')
      .eq('founder_id', user.id)

    if (!founders || founders.length === 0) {
      setItems([])
      setLoading(false)
      return
    }

    const lfIds = founders.map(f => f.lf_id)

    // 2️⃣ Fetch the actual lost_found items
    const { data: lostItems } = await supabase
      .from('lost_found')
      .select('*')
      .in('id', lfIds)

    // 3️⃣ Fetch images
    const { data: lfImages } = await supabase
      .from('lost_found_images')
      .select('*')

    // 4️⃣ Fetch staff profiles
    const staffIds = [
      ...lostItems.map(i => i.approved_by),
      ...lostItems.map(i => i.found_by),
      ...lostItems.map(i => i.user_id),
    ].filter(Boolean)
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
          name: s.full_name,
          email: emailMap[s.id] || 'Unknown',
        }
      ])
    )

    // 5️⃣ Combine everything
    const combined = lostItems.map(item => {
      const founderRow = founders.find(f => f.lf_id === item.id)

      return {
        ...item,
        proof_url: founderRow?.proof_url ?? null,
        status: item.status,
        owner_info: item.user_id
          ? staffMap.get(item.user_id) || null
          : null,
        staff_in_charge: item.approved_by
          ? staffMap.get(item.approved_by) || null
          : null,
        found_by_info: item.found_by
          ? staffMap.get(item.found_by) || null
          : null,
        images:
          lfImages
            ?.filter(img => img.lf_id === item.id)
            .map(img => ({
              id: img.id,
              image_url: img.media_url,
            })) || [],
      }
    })

    // newest first
    combined.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))

    setItems(combined)
    setLoading(false)
  }

  function statusBadge(status: string) {
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
          <Flag size={16} /> Flagged
        </span>
      )
    return (
      <span className="text-blue-500 flex items-center gap-1">
        <AlertCircle size={16} /> Pending
      </span>
    )
  }

  async function cancelContribution(lf_id: string) {
    const confirmCancel = window.confirm("Are you sure you want to cancel your submission?")
    if (!confirmCancel) return

    await supabase
      .from('lost_found_founders')
      .delete()
      .eq('lf_id', lf_id)

    loadData()
    setSelected(null)
  }

  async function openChat(ownerId: string, lfId: string) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    const roomId = await openChatWithUser(user.id, ownerId, lfId)
    if (!roomId) return alert("Failed to open chat.")

    router.push(`/chat/${roomId}?attach=1`)
  }

  const totalPages = Math.ceil(items.length / itemsPerPage)
  const paginated = items.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  return (
    <div className="p-8">

      {/* HEADER */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">My Contributions</h1>
          <p className="text-gray-500">View the items you helped return</p>
        </div>

        <button
          onClick={() => router.push('/lostfound/list')}
          className="cursor-pointer bg-gray-500 hover:bg-gray-400 text-white px-4 py-2 rounded-lg"
        >
          ← Back to Lost & Found
        </button>
      </div>

      {/* TABLE */}
      {loading ? (
        <div className="text-gray-600 flex items-center">
          <div className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"></div>
          Loading contributions...
        </div>
      ) : items.length === 0 ? (
        <p className="mt-20 text-gray-500 text-xl text-center">
          You have not contributed to any lost & found reports yet.
        </p>
      ) : (
        <>
          <table
            className={`w-full rounded-xl overflow-hidden border-collapse
              ${theme === 'dark' ? 'bg-black' : 'bg-white' }`
            }
          >
            <thead
              className={`
                ${theme === 'dark' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-black' }`
              }
            >
              <tr>
                <th className="p-3 text-left">No.</th>
                <th className="p-3 text-left">Item</th>
                <th className="p-3 text-left">Submitted</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Details</th>
              </tr>
            </thead>

            <tbody>
              {paginated.map((item, i) => (
                <tr key={item.id} className="border-t">
                  <td className="p-3">{i + 1}</td>
                  <td className="p-3">{item.item_name}</td>
                  <td className="p-3">
                    {new Date(item.created_at).toLocaleDateString('en-GB')}
                  </td>
                  <td className="p-3">{statusBadge(item.status)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => setSelected(item)}
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

          {/* Pagination */}
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

      {/* DETAILS MODAL */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex justify-center items-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className={`rounded-2xl shadow-lg max-w-3xl w-full p-6 relative max-h-[95vh] overflow-y-auto
              ${theme === 'dark' ? 'bg-gray-900' : 'bg-white' }`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelected(null)}
              className="cursor-pointer absolute top-3 right-3 text-gray-500"
            >
              <X size={30} />
            </button>
            
            <table className="details-table mb-6">
              <tbody>
                <tr>
                  <td>Item Name</td>
                  <td>
                    {selected.item_name}
                  </td>
                </tr>
                <tr>
                  <td>Owner</td>
                  <td>
                    {selected.owner_info ? (
                      <>
                        <div>{selected.owner_info.name}</div>
                        <div className="text-sm text-gray-500">
                          {selected.owner_info.email}
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
                  <td>{selected.lost_date ? new Date(selected.lost_date).toLocaleDateString('en-GB') : '-'}</td>
                </tr>
                <tr>
                  <td>Location</td>
                  <td>{selected.location ?? '-'}</td>
                </tr>
                <tr>
                  <td>Resolved on</td>
                  <td>
                    {selected.resolved_at
                      ? new Date(selected.resolved_at).toLocaleString('en-GB')
                      : '-'}
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
                  <td>{statusBadge(selected.status)}</td>
                </tr>
              </tbody>
            </table>

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

            {/* Images */}
            {selected.images.length > 0 && (
              <div>
                <p className="font-semibold mb-3">Image Proof</p>
                <div className="grid grid-cols-4 gap-3">
                  {selected.images.map(img => (
                    <img
                      key={img.id}
                      src={img.image_url}
                      className="cursor-pointer w-28 h-28 object-cover rounded-lg border"
                      onClick={() => setZoomImage(img.image_url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ACTIONS */}
            <div className="flex gap-5 mt-10">
              {(selected.status === 'Published' || selected.status === 'In Progress') && (
                <>
                  {/* Chat staff */}
                  <button
                    onClick={() => openChat(selected.user_id, selected.id)}
                    className="cursor-pointer bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl flex items-center gap-2"
                  >
                    <MessageSquare size={18} /> Chat Staff
                  </button>

                  {/* Cancel submission */}
                  <button
                    onClick={() => cancelContribution(selected.id)}
                    className="cursor-pointer bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-xl flex items-center gap-2"
                  >
                    <Ban size={18} /> Cancel
                  </button>
                </>
              )}

              {selected.status === 'Cancelled' && (
                <p className="text-gray-500 italic">This contribution has been cancelled.</p>
              )}
            </div>

          </div>
        </div>
      )}

      {/* ZOOM IMAGE MODAL */}
      {zoomImage && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60]"
          onClick={() => setZoomImage(null)}
        >
          <img
            src={zoomImage}
            className="max-w-[90vw] max-h-[90vh] rounded-lg"
          />
        </div>
      )}

    </div>
  )
}
