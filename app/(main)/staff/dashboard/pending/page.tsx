// staff/dashboard/pending/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { Download, Megaphone } from 'lucide-react'
import { userAgent } from 'next/server'

type GeneralReport = {
  id: string
  user_id: string
  category: string
  description: string
  image_url: string | null
  created_at: string

  requested_by?: string
}

type LostFoundReport = {
  id: string
  user_id: string
  item_name: string
  description: string
  location: string
  lost_date: string
  image_url: string | null
  owner_name: string | null
  status: string
  created_at: string
}

export default function PendingIssuesPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const [reports, setReports] = useState<GeneralReport[]>([])
  const [lostFound, setLostFound] = useState<LostFoundReport[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [confirmClaim, setConfirmClaim] = useState(false)
  const [confirmPublish, setConfirmPublish] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  useEffect(() => {
    loadReports()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadReports() {
    setLoading(true)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) {
        alert('Please log in first.')
        router.push('/login')
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      if (profileError) throw profileError

      if (profile?.role !== 'staff') {
        alert('Access denied.')
        router.push('/')
        return
      }

      // 🟡 Fetch general reports
      const { data: generalReports, error: reportsError } = await supabase
        .from('reports')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })
      if (reportsError) throw reportsError

      // 🟣 Fetch lost & found reports
      const { data: lostReports, error: lostError } = await supabase
        .from('lost_found')
        .select('*')
        .eq('status', 'Pending')
        .order('created_at', { ascending: false })
      if (lostError) throw lostError

      const { data: reportImages } = await supabase
        .from('report_images')
        .select('*')

      const { data: lfImages } = await supabase
        .from('lost_found_images')
        .select('*')

      const userIds = [
        ...(generalReports || []).map(r => r.user_id),
        ...(lostReports || []).map(l => l.user_id),
      ].filter(Boolean)

      // fetch users' names
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      // fetch emails via API route
      const emailRes = await fetch('/api/admin/list-user-emails')
      const emailMap = await emailRes.json()

      // combine into one map
      const userMap = new Map(
        (users || []).map(u => [
          u.id,
          {
            name: u.full_name,
            email: emailMap[u.id] || 'unknown'
          }
        ])
      )

      const enrichedReports = (generalReports || []).map(r => ({
        ...r,
        requested_by: userMap.get(r.user_id)?.name || 'Unknown',
        requested_by_email: userMap.get(r.user_id)?.email || 'Unknown',
      }))

      const enrichedWithImages = enrichedReports.map(r => ({
        ...r,
        images: reportImages?.filter(img => img.report_id === r.id) || []
      }))

      setReports(enrichedWithImages)

      const lostWithImages = (lostReports || []).map(l => ({
        ...l,

        requested_by: userMap.get(l.user_id)?.name || 'Unknown',
        requested_by_email: userMap.get(l.user_id)?.email || 'Unknown',

        images: lfImages?.filter(img => img.lf_id === l.id) || []
      }))

      setLostFound(lostWithImages)

    } catch (err) {
      console.error('Error loading reports:', err)
      alert('Failed to load reports.')
    } finally {
      setLoading(false)
    }
  }

  async function handleClaim(reportId: string) {
    setConfirmClaim(false)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('reports')
        .update({
          claimed_by: user.id,
          claimed_at: new Date().toISOString(),
          status: 'In Progress',
        })
        .eq('id', reportId)
      if (error) throw error

      const { data: staffProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      await fetch(
        'https://lcbwiranwqjkqwrnlycz.functions.supabase.co/claim-general-report-notification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            reportId,
            category: selected.category,
            userId: selected.user_id,
            staffName: staffProfile?.full_name || 'Staff',
          }),
        }
      )

      alert('✅ Issue claimed successfully!')
      router.push('/staff/claimed-issues')
      setSelected(null)
      loadReports()
    } catch (err) {
      console.error('Claim failed:', err)
      alert('Failed to claim this issue.')
    }
  }

  async function handlePublish(reportId: string) {
    setConfirmPublish(false)
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase
        .from('lost_found')
        .update({ 
          status: 'Published',
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', reportId)
      if (error) throw error
      
      await fetch(
        'https://lcbwiranwqjkqwrnlycz.functions.supabase.co/publish-lost-found-notification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            lfId: selected.id,
            itemName: selected.item_name,
            ownerId: selected.user_id,
            ownerName: selected.owner_name || selected.requested_by,
          }),
        }
      )

      alert('✅ Lost & Found report published successfully!')
      setSelected(null)
      loadReports()
      router.push('/staff/claimed-issues')
    } catch (err) {
      console.error('Publish failed:', err)
      alert('Failed to publish this report.')
    }
  }

  function truncate(text: string, max: number) {
    return text.length > max ? text.slice(0, max) + '…' : text
  }

  return (
    <div className="p-5">
      <h1 className="text-3xl font-extrabold mb-2">Pending Issues</h1>
      <p className="text-gray-500 mb-8">
        These general and lost & found reports are awaiting action
      </p>

      {loading ? (
        <div className="flex items-center text-gray-600 text-m">
          {/* Spinning Loader */}
          <div
            className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"
            aria-label="Loading"
          ></div>

          {/* Text */}
          <span>&nbsp;Loading claimed issues...</span>
        </div> 
      ) : reports.length === 0 && lostFound.length === 0 ? (
        <p className="text-center text-gray-500 mt-20 text-xl">
          No pending reports are available at the moment
        </p>
      ) : (
        <>
          {/* 🧾 General Reports */}
          {reports.length > 0 && (
            <>
              <h2 className="text-xl font-bold mb-3">General Reports</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-10">
                {reports.map((r) => (
                  <div
                    key={r.id}
                    onClick={() => setSelected({ ...r, type: 'general' })}
                    className={`p-6 rounded-2xl shadow-md hover:shadow-lg cursor-pointer transition
                      ${theme === 'dark' ? 'bg-gray-900 hover:bg-gray-800' : 'bg-white hover:bg-gray-100' }`
                    }
                  >
                    <h2 className="text-lg font-bold mb-2">{r.category}</h2>
                    <p
                      className={`text-sm italic mb-3
                        ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`
                      }
                    >
                      “{truncate(r.description, 90)}”
                    </p>
                    <p
                      className={`font-medium text-sm hover:underline
                        ${theme === 'dark' ? 'text-blue-500' : 'text-blue-600' }`
                      }
                    >
                      Read more →
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* 🧳 Lost & Found Reports */}
          {lostFound.length > 0 && (
            <>
              <h2 className="text-xl font-bold mb-3">Lost & Found Reports</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {lostFound.map((lf) => (
                  <div
                    key={lf.id}
                    onClick={() => setSelected({ ...lf, type: 'lost_found' })}
                    className={`p-6 rounded-2xl shadow-md hover:shadow-lg cursor-pointer transition
                      ${theme === 'dark' ? 'bg-gray-900 hover:bg-gray-800' : 'bg-white hover:bg-gray-100' }`
                    }
                  >
                    <h2 className="text-lg font-bold mb-2">{lf.item_name}</h2>
                    <p
                      className={`text-sm italic mb-3
                        ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`
                      }
                    >
                      “{truncate(lf.description || '', 90)}”
                    </p>
                    <p
                      className={`font-medium text-sm hover:underline
                        ${theme === 'dark' ? 'text-blue-500' : 'text-blue-600' }`
                      }
                    >
                      Read more →
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {/* 🔹 MODAL */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            className={`rounded-2xl shadow-lg w-full max-w-lg p-6 relative
              ${theme === 'dark' ? 'bg-gray-800' : 'bg-white ' }`
            }
            onClick={(e) => e.stopPropagation()}
          >
            {selected.type === 'general' ? (
              <>
                <div className="space-y-3">
                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Category</span>
                    <span>{selected.category}</span>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Description</span>
                    <span>{selected.description}</span>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Requested on</span>
                    <span>
                      {new Date(selected.created_at).toLocaleString('en-GB')}
                    </span>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Requested by</span>
                    <span>
                      {selected.requested_by}<br />
                        <span className="text-sm text-gray-500">
                          {selected.requested_by_email}
                        </span>
                    </span>
                  </div>
                </div>
                <p className="font-semibold mt-10 mb-2">
                  Attachment(s)
                </p>
                {selected.images && selected.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    {selected.images.map((img: any) => (
                      <img
                        key={img.id}
                        src={img.image_url || img.media_url}
                        className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:opacity-80"
                        onClick={() => setZoomImage(img.image_url || img.media_url)}
                      />
                    ))}
                  </div>
                )}
                <div className="flex gap-4 mt-10">
                  <button
                    onClick={() => setConfirmClaim(true)}
                    className="cursor-pointer bg-blue-600 hover:bg-blue-500 transition text-white px-6 py-3 rounded-md flex items-center gap-2"
                  >
                    <Download size={18} /> Claim Issue
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-3">

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Item Name</span>
                    <span>{selected.item_name}</span>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Description</span>
                    <span>{selected.description || '—'}</span>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Lost since</span>
                    <span>
                      {selected.lost_date
                        ? new Date(selected.lost_date).toLocaleString('en-GB')
                        : 'Unknown'}
                    </span>
                  </div>

                  <div className="grid grid-cols-[130px_1fr] gap-y-1">
                    <span className="font-semibold w-32">Owner</span>
                    <span>
                      {selected.owner_name || selected.requested_by}
                      <br />
                      <span className="text-sm text-gray-500">
                        {selected.requested_by_email}
                      </span>
                    </span>
                  </div>
                </div>

                <p className="font-semibold mt-10 mb-2">
                  Attachment(s)
                </p>

                {selected.images && selected.images.length > 0 && (
                  <div className="grid grid-cols-4 gap-3 mt-2">
                    {selected.images.map((img: any) => (
                      <img
                        key={img.id}
                        src={img.image_url || img.media_url}
                        className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:opacity-80"
                        onClick={() => setZoomImage(img.image_url || img.media_url)}
                      />
                    ))}
                  </div>
                )}

                <div className="flex gap-4 mt-10">
                  <button
                    onClick={() => setConfirmPublish(true)}
                    className="cursor-pointer bg-blue-600 hover:bg-blue-500 text-white px-6 py-3 rounded-md flex items-center gap-2"
                  >
                    <Megaphone size={18} /> Publish
                  </button>
                </div>
              </>
            )}

            {/* 🟦 Claim Confirmation */}
            {confirmClaim && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div
                  className={`rounded-lg shadow-lg py-10 w-120 text-center
                    ${theme === 'dark' ? 'bg-gray-800' : 'bg-white' }`
                  }
                >
                  <p className="mb-10 font-semibold">
                    Are you sure you want to claim this issue?
                  </p>
                  <div className="flex justify-center gap-10">
                    <button
                      onClick={() => handleClaim(selected.id)}
                      className="cursor-pointer bg-blue-600 hover:bg-blue-500 transition text-white px-5 py-3 rounded-xl flex items-center gap-2"
                    >
                      <Download size={18} /> Yes, Claim
                    </button>
                    <button
                      onClick={() => setConfirmClaim(false)}
                      className="cursor-pointer bg-gray-500 hover:bg-gray-400 transition px-5 py-3 rounded-xl text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 🟩 Publish Confirmation */}
            {confirmPublish && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div
                  className={`rounded-lg shadow-lg py-10 px-5 w-120 text-center
                    ${theme === 'dark' ? 'bg-gray-800' : 'bg-white' }`
                  }
                >
                  <p className="mb-4 font-semibold">
                    Are you sure you want to publish this lost & found report to its public page?
                  </p>
                  <p className="mb-10 font-semibold">
                    Make sure its contents are <u>APPROPRIATE</u> before publishing this lost & found report, otherwise <span className='text-red-600'>report</span> it to the administration.
                  </p>
                  <div className="flex justify-center gap-10">
                    <button
                      onClick={() => handlePublish(selected.id)}
                      className="cursor-pointer bg-blue-600 hover:bg-blue-500 transition text-white px-5 py-3 rounded-xl flex items-center gap-2"
                    >
                      <Megaphone size={18} /> Yes, Publish
                    </button>
                    <button
                      onClick={() => setConfirmPublish(false)}
                      className="cursor-pointer bg-gray-500 hover:bg-gray-400 transition px-5 py-3 rounded-xl text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

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
    </div>
  )
}
