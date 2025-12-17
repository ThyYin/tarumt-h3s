// claimed-issues/page.tsx

'use client'

export const dynamic = 'force-dynamic'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { openChatWithUser } from '@/lib/openChat'
import { useSearchParams } from 'next/navigation'

import {
  CheckCircle,
  Clock,
  AlertCircle,
  MessageCircle,
  Megaphone,
  FileText,
  RotateCcw,
  Flag,
  Undo,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Search,
  Ban,
  CircleStar,
  Send
} from 'lucide-react'

export default function ClaimedIssuesPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [reports, setReports] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [action, setAction] = useState<'resolve' | 'revert' | 'flag' | 'unflag' | 'cancel_lostfound' | null>(null)
  const [reason, setReason] = useState('')
  const [zoomImage, setZoomImage] = useState<string | null>(null)

  // Filters + Pagination
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('All')
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5

  const [revertReason, setRevertReason] = useState('')
  const [unflagReason, setUnflagReason] = useState('')

  const [confirmRelease, setConfirmRelease] = useState(false)
  const [releaseReason, setReleaseReason] = useState('')

  const [foundBy, setFoundBy] = useState<string | null>(null)
  const [userOptions, setUserOptions] = useState<any[]>([])
  const [userSearch, setUserSearch] = useState('')
  const filteredUsers = userOptions.filter(u => {
    const q = userSearch.toLowerCase()
    return (
      u.full_name.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q)
    )
  })

  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const isCampusFoundItem =
    selected?.type === 'lostfound' &&
    selected?.owner_name === 'Unknown, item is found by fellow TARCians on campus grounds'

  const [showContributions, setShowContributions] = useState(false)
  const [contributions, setContributions] = useState<any[]>([])
  const [loadingContributions, setLoadingContributions] = useState(false)

  useEffect(() => {
    loadClaimedReports()
    loadAllUsers()

    const statusFromUrl = searchParams.get('status')
    if (statusFromUrl) {
      setStatusFilter(statusFromUrl)
    }

    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadAllUsers() {
    const { data: users } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .order('full_name')

    const emailRes = await fetch('/api/admin/list-user-emails')
    const emailMap = await emailRes.json()

    const enriched = (users || []).map(u => ({
      ...u,
      email: emailMap[u.id] || ''
    }))

    setUserOptions(enriched)
  }

  function handleFiles(files: FileList) {
    const arr = Array.from(files)

    if (images.length + arr.length > 5) {
      alert('You can upload up to 5 images only.')
      return
    }

    const valid = arr.filter((file) => file.type.startsWith('image/'))

    setImages((prev) => [...prev, ...valid])
    setPreviews((prev) => [...prev, ...valid.map((f) => URL.createObjectURL(f))])
  }
  
  function removeImage(i: number) {
    setImages((prev) => prev.filter((_, idx) => idx !== i))
    setPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  async function loadClaimedReports() {

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const { data: general } = await supabase
        .from('reports')
        .select('*')
        .eq('claimed_by', user.id)

      const { data: lostfound } = await supabase
        .from('lost_found')
        .select('*')
        .eq('approved_by', user.id)

      const userIds = [
        ...(general || []).map(r => r.user_id),
        ...(lostfound || []).map(l => l.user_id),
        ...(lostfound || []).map(l => l.found_by)
      ].filter(Boolean)

      // fetch users' names
      const { data: users } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', userIds)

      // fetch emails from API route
      const emailRes = await fetch('/api/admin/list-user-emails')
      const emailMap = await emailRes.json()

      // combine name + email
      const userMap = new Map(
        (users || []).map(u => [
          u.id,
          {
            name: u.full_name,
            email: emailMap[u.id] || 'unknown'
          }
        ])
      )

      const enrichedReports = (general || []).map(r => ({
        ...r,
        requested_by: userMap.get(r.user_id)?.name || 'Unknown',
        requested_by_email: userMap.get(r.user_id)?.email || 'Unknown',
      }))

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

      const combined = [
        ...(enrichedReports?.map(r => ({
          ...r,
          type: 'report',
          images: reportImages?.filter(img => img.report_id === r.id) || [],
          false_images: falseImgs?.filter(img => img.report_id === r.id) || [],
          resolved_images: resolvedImgs?.filter(img => img.report_id === r.id) || []
        })) ?? []),

        ...(lostfound?.map(l => ({
          ...l,
          type: 'lostfound',
          category: 'Lost & Found',

          owner_name: l.owner_name ?? null,

          requested_by: l.user_id
            ? userMap.get(l.user_id)?.name || 'Unknown'
            : null,
          requested_by_email: l.user_id
            ? userMap.get(l.user_id)?.email || 'Unknown'
            : null,

          found_by_name: l.found_by
            ? userMap.get(l.found_by)?.name || 'Unknown'
            : null,

          images: lfImages?.filter(img => img.lf_id === l.id) || [],
          false_images: falseImgs?.filter(img => img.lf_id === l.id) || [],
          resolved_images: resolvedImgs?.filter(img => img.lf_id === l.id) || [],
        })) ?? [])
      ]

      // if (error) throw error
      setReports(combined || [])
    } catch (err) {
      console.error('Error loading claimed reports:', err)
    } finally {
      setLoading(false)
    }
  }

  function statusBadge(status: string) {
    if (status === 'Resolved') {
      return <span className="text-green-600 flex items-center gap-1"><CheckCircle size={16}/> Resolved</span>
    }
    if (status === 'In Progress') {
      return <span className="text-orange-500 flex items-center gap-1"><Clock size={16}/> In Progress</span>
    }
    if (status === 'Published') {
      return <span className="text-orange-500 flex items-center gap-1"><Megaphone size={16}/> Published</span>
    }
    if (status === 'Flagged') {
      return <span className="text-red-500 flex items-center gap-1"><Flag size={16}/> Flagged</span>
    }
    if (status === 'Cancelled') {
      return <span className="text-gray-500 flex items-center gap-1"><Ban size={16}/> Cancelled</span>
    }
    return <span className="text-blue-500 flex items-center gap-1"><AlertCircle size={16}/> Pending</span>
  }

  async function handleLostFoundRevert(id: string) {
    if (!revertReason.trim()) {
      alert("Please provide a reason before reverting.")
      return
    }

    try {
      const { error } = await supabase
        .from('lost_found')
        .update({
          status: 'Published',
          revert_reason: revertReason,
          resolved_at: null,
          found_by: null
        })
        .eq('id', id)

        await fetch(
          'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/revert-lost-found-notification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              lfId: id,
              itemName: selected.item_name,
              ownerId: selected.user_id,
              staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
              reason: revertReason,
            }),
          }
        )

      if (error) throw error

      await supabase.from('resolved_report_images').delete().eq('lf_id', id)

      alert('Lost & Found report reverted successfully.')
      setRevertReason('')
      setSelected(null)
      setAction(null)
      loadClaimedReports()

    } catch (err) {
      console.error(err)
      alert('Failed to revert Lost & Found status.')
    }
  }

  async function handleReleaseClaim(id: string) {
    try {
      if (!selected) return

      if (!releaseReason.trim()) {
        alert("Please provide a reason before releasing this claim.")
        return
      }

      if (selected.type === 'report') {
        // general report release
        await supabase.from('reports')
          .update({
            status: 'Pending',
            claimed_by: null,
            claimed_at: null,
            release_reason: releaseReason
          })
          .eq('id', id)

        await fetch(
          'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/release-general-report-notification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              reportId: id,
              category: selected.category,
              ownerId: selected.user_id,
              staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
              reason: releaseReason,
            }),
          }
        )

      } else {
        // lost & found release
        await supabase.from('lost_found')
          .update({
            status: 'Pending',
            approved_by: null,
            approved_at: null,
            release_reason: releaseReason
          })
          .eq('id', id)
      }

      alert("Report released successfully.")
      setReleaseReason('')
      setConfirmRelease(false)
      setSelected(null)
      setAction(null)
      loadClaimedReports()

    } catch (err) {
      console.error("Error releasing claim:", err)
      alert("Failed to release claim.")
    }
  }

  async function handleCancelLostFound(id: string) {
    if (!reason.trim()) {
      alert("Please provide a cancellation reason.")
      return
    }

    try {
      await supabase
        .from('lost_found')
        .update({
          status: 'Cancelled',
          cancel_reason: reason,
        })
        .eq('id', id)

        await fetch(
          'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/cancel-lost-found-notification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              lfId: id,
              itemName: selected.item_name,
              ownerId: selected.user_id,
              staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
              reason,
            }),
          }
        )

      alert("Lost & Found report cancelled.")
      setSelected(null)
      setAction(null)
      setReason('')
      loadClaimedReports()
    } catch (err) {
      console.error(err)
      alert("Failed to cancel report.")
    }
  }

  async function loadContributions(lfId: string) {
    setLoadingContributions(true)

    // 1️⃣ get contributions
    const { data: founders } = await supabase
      .from('lost_found_founders')
      .select('*')
      .eq('lf_id', lfId)

    if (!founders || founders.length === 0) {
      setContributions([])
      setLoadingContributions(false)
      return
    }

    // 2️⃣ get profile data
    const founderIds = founders.map(f => f.founder_id)

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', founderIds)

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    )

    // 3️⃣ merge
    const merged = founders.map(f => ({
      ...f,
      profiles: profileMap.get(f.founder_id) || null
    }))

    setContributions(merged)
    setLoadingContributions(false)
  }

  // Filters
  const filteredReports = reports.filter((r) => {
    const catMatch =
      categoryFilter === 'All' || r.category === categoryFilter

    const statMatch =
      statusFilter === 'All' ||
      (statusFilter === 'In Progress & Published'
        ? r.status === 'In Progress' || r.status === 'Published'
        : r.status === statusFilter)

    return catMatch && statMatch
  })

  const categories = Array.from(new Set(reports.map((r) => r.category)))

  const rawStatuses = Array.from(
    new Set(reports.map(r => r.status))
  )

  const hasInProgressOrPublished =
    rawStatuses.includes('In Progress') ||
    rawStatuses.includes('Published')

  const statuses = [
    ...(hasInProgressOrPublished ? ['In Progress & Published'] : []),
    ...rawStatuses.filter(
      s => s !== 'In Progress' && s !== 'Published'
    )
  ]

  // Pagination
  const totalPages = Math.ceil(filteredReports.length / itemsPerPage)
  const paginatedReports = filteredReports.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  // ✅ handle status updates (now includes resolved_at timestamp)
  async function handleStatusChange(id: string, newStatus: string) {
    try {
      const updateData: any = { status: newStatus }
      if (newStatus === 'In Progress') {
        if (!revertReason.trim()) {
          alert("Please provide a reason before reverting.")
          return
        }

        updateData.revert_reason = revertReason

        await supabase.from('resolved_report_images').delete().eq('report_id', id)
      }

      setRevertReason('')

      if (newStatus === 'Resolved') updateData.resolved_at = new Date().toISOString()
      else if (newStatus === 'In Progress') updateData.resolved_at = null

      const { error } = await supabase.from('reports').update(updateData).eq('id', id)
      if (error) throw error

      alert(`✅ Report marked as ${newStatus}`)
      setSelected(null)
      setAction(null)
      loadClaimedReports()
    } catch (err) {
      console.error(err)
      alert('Failed to update report status.')
    }
  }

  async function handleFlagReport(id: string) {
    if (!reason || images.length === 0) {
      alert('Please provide a reason and at least one image.')
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // insert reason into parent row
      if (selected.type === 'report') {
        await supabase.from('reports').update({
          status: 'Flagged',
          false_reason: reason
        }).eq('id', id)

        await fetch(
          'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/flag-general-report-notification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              reportId: id,
              category: selected.category,
              ownerId: selected.user_id,
              staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
              reason,
            }),
          }
        )
      } else {
        await supabase.from('lost_found').update({
          status: 'Flagged',
          false_reason: reason
        }).eq('id', id)
      }

      // upload each image
      for (const img of images) {
        const fileName = `${user.id}-${Date.now()}-${img.name}`

        const { error: uploadErr } = await supabase.storage
          .from('false_reports')
          .upload(fileName, img)
        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('false_reports')
          .getPublicUrl(fileName)

        if (selected.type === 'report') {
          await supabase.from('false_report_images').insert({
            report_id: id,
            image_url: publicUrl,
          })
        } else {
          await supabase.from('false_report_images').insert({
            lf_id: id,
            image_url: publicUrl,
          })
        }
      }

      alert('🚩 Report flagged successfully!')
      setSelected(null)
      setAction(null)
      setReason('')
      setImages([])
      setPreviews([])
      loadClaimedReports()

    } catch (err) {
      console.error(err)
      alert('Failed to flag report.')
    }
  }

  async function handleUnflagReport(id: string) {
    if (!unflagReason.trim()) {
      alert("Please provide a reason before unflagging.")
      return
    }

    try {
      if (selected.type === 'report') {
        await supabase.from('reports')
          .update({
            status: 'In Progress',
            false_reason: null,
            unflag_reason: unflagReason
          })
          .eq('id', id)

          await fetch(
            'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/unflag-general-report-notification',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              },
              body: JSON.stringify({
                reportId: id,
                category: selected.category,
                ownerId: selected.user_id,
                staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
                reason: unflagReason,
              }),
            }
          )

        await supabase.from('false_report_images').delete().eq('report_id', id)

      } else {
        await supabase.from('lost_found')
          .update({
            status: 'In Progress',
            false_reason: null,
            unflag_reason: unflagReason
          })
          .eq('id', id)

        await supabase.from('false_report_images').delete().eq('lf_id', id)
      }

      alert("Report unflagged successfully.")
      setUnflagReason('')
      setSelected(null)
      setAction(null)
      loadClaimedReports()

    } catch (err) {
      console.error(err)
      alert("Failed to unflag report.")
    }
  }

  async function handleResolve(id: string) {

    if (selected.type === 'lostfound' && !foundBy) {
      alert('Please identify the user that helped found the lost item!')
      return
    }

    if (images.length === 0) {
      alert("Please upload at least one proof image.")
      return
    }

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // mark parent as resolved
      if (selected.type === 'report') {
        await supabase.from('reports').update({
          status: 'Resolved',
          resolved_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
        }).eq('id', id)

        await fetch(
          'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/resolve-general-report-notification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              reportId: id,
              category: selected.category,
              ownerId: selected.user_id,
              staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
            }),
          }
        )
      } else {
        await supabase.from('lost_found').update({
          status: 'Resolved',
          resolved_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
          found_by: foundBy
        }).eq('id', id)

        await fetch(
          'https://lcbwiranwqjkqwrnlycz.supabase.co/functions/v1/resolve-lost-found-notification',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
            },
            body: JSON.stringify({
              lfId: id,
              itemName: selected.item_name,
              ownerId: selected.user_id,
              foundBy,
              staffName: (await supabase.auth.getUser()).data.user?.user_metadata?.full_name,
            }),
          }
        )
      }

      for (const img of images) {
        const filename = `${user.id}-${Date.now()}-${img.name}`

        const { error: uploadErr } = await supabase.storage
          .from('resolve_proofs')
          .upload(filename, img)
        if (uploadErr) throw uploadErr

        const { data: { publicUrl } } = supabase.storage
          .from('resolve_proofs')
          .getPublicUrl(filename)

        if (selected.type === 'report') {
          await supabase.from('resolved_report_images').insert({
            report_id: id,
            image_url: publicUrl,
          })
        } else {
          await supabase.from('resolved_report_images').insert({
            lf_id: id,
            image_url: publicUrl,
          })
        }
      }

      alert("Issue resolved successfully.")
      setSelected(null)
      setAction(null)
      setImages([])
      setPreviews([])
      loadClaimedReports()
      setFoundBy(null)
      setUserSearch('')

    } catch (err) {
      console.error(err)
      alert("Failed to resolve issue.")
    }
  }


  async function handleChat(userId: string, reportId: string, reportType: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      const roomId = await openChatWithUser(user.id, userId, reportId)

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

  return (
    <div className="p-5">
      {/* 🔍 HEADER + BUTTON */}
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Claimed Issues</h1>
          <p className="text-gray-500">These reports are under your care until resolution</p>
        </div>
        <div className="flex items-center gap-7">
          <button
            onClick={() => router.push('/staff/dashboard/pending')}
            className="cursor-pointer bg-purple-600 hover:bg-purple-500 transition text-white px-5 py-3 rounded-xl flex items-center gap-2"
          >
            <Search size={18} /> Browse Unclaimed Issues
          </button>
        </div>
      </div>

      {/* 🧾 TABLE */}
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
        ) : filteredReports.length === 0 ? (
        <p className="text-center text-gray-500 mt-15 text-lg">You have not claimed any issues yet. Click <a className='text-blue-400 underline' href="/staff/dashboard/pending">here</a> to browse unclaimed issues!</p>
      ) : (
        <>
          {/* 🔽 FILTERS */}
          <div className="flex flex-wrap gap-3 mb-5">
            <select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value)
                setCurrentPage(1)
              }}
              className={`cursor-pointer border border-gray-300 rounded-md p-2
                ${theme === 'dark' ? 'bg-black' : 'bg-white'}`
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
              className={`cursor-pointer border border-gray-300 rounded-md p-2
                ${theme === 'dark' ? 'bg-black' : 'bg-white'}`
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

          <div className="overflow-x-auto">
            <table
              className={`min-w-full border-collapse rounded-xl overflow-hidden
                ${theme === 'dark' ? 'bg-black' : 'bg-white' }`
              }
            >
              <thead
                className={`text-left
                  ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100' }`
                }
              >
                <tr>
                  <th className="p-3">No.</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Requested on</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((r, i) => (
                  <tr key={r.id} className="border-t">
                    <td className="p-3">{(currentPage - 1) * itemsPerPage + i + 1}</td>
                    <td className="p-3">{r.category}</td>
                    <td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      {r.status === 'In Progress' ? (
                        <span className="text-orange-500 font-medium flex items-center gap-1">
                          <RotateCcw size={16} /> In Progress
                        </span>
                      ) : r.status === 'Resolved' ? (
                        <span className="text-green-600 font-medium flex items-center gap-1">
                          <CheckCircle size={16} /> Resolved
                        </span>
                      ) : r.status === 'Flagged' ? (
                        <span className="text-red-500 font-medium flex items-center gap-1">
                          <Flag size={16} /> Flagged
                        </span>
                      ) : r.status === 'Published' ? (
                        <span className="text-orange-500 font-medium flex items-center gap-1">
                          <Megaphone size={16} /> Published
                        </span>
                      ) : r.status === 'Cancelled' ? (
                        <span className="text-gray-500 font-medium flex items-center gap-1">
                          <Ban size={16} /> Cancelled
                        </span>
                      ) : (
                        r.status
                      )}
                    </td>
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
          </div>

          {/* 🔢 PAGINATION */}
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

      {/* ✅ FULL MODAL RESTORED */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => {
            setSelected(null)
            setAction(null)
          }}
        >
          <div
            className={`rounded-2xl shadow-lg w-full max-w-3xl p-6 relative max-h-[95vh] overflow-y-auto
              ${theme === 'dark' ? 'bg-gray-800' : 'bg-white' }`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => {
                setSelected(null)
                setAction(null)
              }}
              className="cursor-pointer absolute top-3 right-3 text-gray-500 hover:text-black"
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
                      <td>Owner</td>
                      <td>
                        {selected.owner_name?.startsWith('Unknown') ? (
                          selected.owner_name
                        ) : selected.requested_by ? (
                          <>
                            <div>{selected.requested_by}</div>
                            <div className="text-sm text-gray-500">
                              {selected.requested_by_email}
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
                    {selected.owner_name !== 'Unknown, item is found by fellow TARCians on campus grounds' && (
                      <tr>
                        <td>Lost since</td>
                        <td>{selected.lost_date ? new Date(selected.lost_date).toLocaleDateString('en-GB') : '-'}</td>
                      </tr>
                    )}
                    <tr>
                      <td>Last seen</td>
                      <td>{selected.location ?? '-'}</td>
                    </tr>
                    <tr>
                      <td>Resolved on</td>
                      <td>{selected.resolved_at ? new Date(selected.resolved_at).toLocaleString('en-GB') : '-'}</td>
                    </tr>
                    <tr>
                      <td>Found by</td>
                      <td>
                        {selected.found_by ? (
                          <>
                            <div>{selected.found_by_name}</div>
                            <div className="text-sm text-gray-500">
                              {userOptions.find(u => u.id === selected.found_by)?.email || 'Unknown'}
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
                      <td>Requested on</td>
                      <td>{new Date(selected.created_at).toLocaleString('en-GB')}</td>
                    </tr>
                    <tr>
                      <td>Resolved on</td>
                      <td>{selected.resolved_at ? new Date(selected.resolved_at).toLocaleString('en-GB') : '-'}</td>
                    </tr>
                    <tr>
                      <td>Status</td>
                      <td>{statusBadge(selected.status)}</td>
                    </tr>
                    <tr>
                      <td>Requested by</td>
                      <td>
                        {selected.requested_by}<br /><span className="text-sm text-gray-500">{selected.requested_by_email}</span>
                      </td>
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

            {selected.images && selected.images.length > 0 && (
              <div className="mt-4">
                <p className="font-semibold mb-1">Attachment(s):</p>

                <div className="grid grid-cols-4 gap-3">
                  {selected.images.map((img: any) => (
                    <img
                      key={img.id}
                      src={img.image_url || img.media_url}
                      className="w-24 h-24 object-cover rounded-md border cursor-pointer hover:opacity-80"
                      onClick={() => setZoomImage(img.image_url || img.media_url)}
                    />
                  ))}
                </div>
              </div>
            )}

            {selected.false_images?.length > 0 && (
              <div className="mt-5">
                <p className="font-semibold mb-1">False Report Attachments:</p>
                <div className="grid grid-cols-4 gap-3">
                  {selected.false_images.map((img:any) => (
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
                  {selected.resolved_images.map((img:any) => (
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
                <p><strong>Reason:</strong> {selected.false_reason || 'No reason provided'}</p>
              </div>
            )}

            <br />

            {/* 🔘 BUTTONS RESTORED */}
            <div className="flex gap-6 mt-6 flex-wrap">
              {selected.type === 'lostfound' && selected.status === 'Published' ? (
                <>
                  <button
                    onClick={() => {
                      loadContributions(selected.id)
                      setShowContributions(true)
                    }}
                    className="cursor-pointer bg-purple-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-purple-500"
                  >
                    <CircleStar size={18} /> View Contributions
                  </button>

                  {/* ✅ Resolve is ALWAYS allowed */}
                  <button
                    onClick={() => setAction('resolve')}
                    className="cursor-pointer bg-green-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-green-500"
                  >
                    <CheckCircle size={18} /> Resolve Issue
                  </button>

                  {isCampusFoundItem && (
                    <>
                      <button
                        onClick={() =>
                          router.push(`/staff/claimed-issues/edit-lostfound/${selected.id}`)
                        }
                        className="cursor-pointer bg-blue-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-500"
                      >
                        <FileText size={18} /> Edit Report
                      </button>

                      <button
                        onClick={() => setAction('cancel_lostfound')}
                        className="cursor-pointer bg-red-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-red-500"
                      >
                        <X size={18} /> Cancel Report
                      </button>
                    </>
                  )}
                </>
              ) : (
                <>
                  {(selected.status === 'In Progress' || selected.status === 'Published') && (
                    <>
                      <button
                        onClick={() => setAction('resolve')}
                        className="cursor-pointer bg-green-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-green-500"
                      >
                        <CheckCircle size={18} /> Resolve Issue
                      </button>

                      <button
                        onClick={() => handleChat(selected.user_id, selected.id, selected.type)}
                        className="cursor-pointer bg-blue-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-blue-500"
                      >
                        <MessageCircle size={18} /> Chat User
                      </button>

                      <button
                        onClick={() => setAction('flag')}
                        className="cursor-pointer bg-red-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-red-500"
                      >
                        <Flag size={18} /> Flag as False Report
                      </button>

                      <button
                        onClick={() => setConfirmRelease(true)}
                        className="cursor-pointer bg-purple-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-purple-500"
                      >
                        <Undo size={18} /> Undo Claim
                      </button>
                    </>
                  )}
                </>
              )}

              {selected.status === 'Flagged' && (
                <button onClick={() => setAction('unflag')} className="cursor-pointer bg-yellow-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-yellow-500">
                  <Undo size={18} /> Unflag Report
                </button>
              )}

              {selected.status === 'Resolved' && (
                <button onClick={() => setAction('revert')} className="cursor-pointer bg-gray-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-500">
                  <Undo size={18} /> Revert Status
                </button>
              )}
            </div>

            {/* 🧩 FLAG FORM */}
            {action === 'flag' && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-2">Flag as False Report</h3>
                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Describe briefly why this report is false..."
                  className="w-full border rounded-md p-2 mb-3"
                />

                {/* DRAG + DROP UPLOADER */}
                <div className='mt-5'>
                  <span className="font-bold">Provide attachment(s) as proof of false report:</span>

                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleFiles(e.dataTransfer.files)
                    }}
                    onClick={() => document.getElementById('flagInput')?.click()}
                    className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer mt-3"
                  >
                    <p className="text-blue-400">Drag & drop images here, or click to upload</p>
                    <p className="text-sm text-gray-400">max. FIVE (5) medias, accepted formats: PNG, JPG, GIF, PDF, MP4, MOV</p>

                    <input
                      type="file"
                      id="flagInput"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    />
                  </div>

                  {/* PREVIEW IMAGES */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {previews.map((src, i) => (
                      <div key={i} className="relative">
                        <img
                          src={src}
                          className="w-full h-28 object-cover rounded-xl border"
                        />

                        {/* X button */}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end mt-3 gap-5">
                  <button
                    onClick={() => handleFlagReport(selected.id)}
                    className="cursor-pointer bg-red-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-red-500"
                  >
                    <Flag size={18} /> Submit Flag
                  </button>
                  <button
                    onClick={() => setAction(null)}
                    className="cursor-pointer bg-gray-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {action === 'resolve' && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold text-lg underline mb-2 mt-3">Resolve Issue</h3>

                {selected.type === 'lostfound' && (
                  <div className="mb-4">

                    <label className="mt-10 font-semibold block mb-1">
                      Found by <span className="text-red-500">*</span>
                    </label>

                    <input
                      type="text"
                      placeholder="Search username or email..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                    
                    {userSearch.trim() !== '' && (
                      <div className="mt-2 border rounded-lg max-h-52 overflow-y-auto bg-white shadow-sm">
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map(u => (
                            <div
                              key={u.id}
                              onClick={() => {
                                setFoundBy(u.id)
                                setUserSearch(u.full_name)
                              }}

                              className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition
                                ${
                                  foundBy 
                                    ? theme === 'dark'
                                      ? 'bg-blue-200 bg-gray-800 hover:bg-blue-900 text-white' 
                                      : 'bg-blue-200 hover:bg-blue-10'
                                    : theme === 'dark'
                                      ? 'text-gray-300 bg-gray-800 hover:bg-blue-900 text-white'
                                      : 'text-gray-500 hover:bg-blue-100'
                                }
                              `}
                            >
                              {/* PFP */}
                              <img
                                src={u.avatar_url || '/default-avatar.png'}
                                alt={u.full_name}
                                className="w-8 h-8 rounded-full object-cover border"
                              />

                              {/* NAME + EMAIL */}
                              <div className="flex flex-col">
                                <span 
                                  className={`font-medium
                                    ${theme === 'dark' ? 'text-white' : 'text-black'}`
                                  }
                                >
                                  {u.full_name}
                                </span>
                                <span
                                  className={`text-sm
                                    ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`
                                  }
                                >
                                  {u.email}
                                </span>
                              </div>
                            </div>
                          ))) : (
                          <div
                            className={`px-4 py-3 text-sm italic
                              ${theme === 'dark' ? 'bg-gray-800 text-gray-400' : 'bg-white text-gray-500'}`
                            }
                          >
                            Search result doesn&apos;t match with any user.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {selected.type === 'lostfound' ? (
                  <p className="mt-10 text-sm text-gray-500 mb-2">
                    Please provide attachment(s) of <u>owner holding their found lost item</u> to prove that the lost item has been reclaimed
                  </p>
                  ) : (
                  <p className="text-sm text-gray-500 mb-2">
                    Please provide attachment(s) proving the issue has been resolved
                  </p>
                )}

                {/* DRAG + DROP UPLOADER */}
                <div className='mt-5'>
                  <div
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault()
                      handleFiles(e.dataTransfer.files)
                    }}
                    onClick={() => document.getElementById('resolveInput')?.click()}
                    className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer mt-3"
                  >
                    <p className="text-blue-400">Drag & drop images here, or click to upload</p>
                    <p className="text-sm text-gray-400">max. FIVE (5) medias, accepted formats: PNG, JPG, GIF, PDF, MP4, MOV</p>

                    <input
                      type="file"
                      id="resolveInput"
                      multiple
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files && handleFiles(e.target.files)}
                    />
                  </div>

                  {/* PREVIEW IMAGES */}
                  <div className="grid grid-cols-3 gap-4 mt-4">
                    {previews.map((src, i) => (
                      <div key={i} className="relative">
                        <img
                          src={src}
                          className="w-full h-28 object-cover rounded-xl border"
                        />

                        {/* X button */}
                        <button
                          type="button"
                          onClick={() => removeImage(i)}
                          className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow cursor-pointer"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-end mt-3 gap-2">
                  <button
                    onClick={() => handleResolve(selected.id)}
                    className="cursor-pointer bg-green-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-green-500"
                  >
                    <CheckCircle size={18} /> Resolve Issue
                  </button>
                  <button
                    onClick={() => { setAction(null); }}
                    className="cursor-pointer bg-gray-600 transition text-white px-5 py-3 rounded-xl flex items-center gap-2 hover:bg-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* 🟨 REVERT */}
            {action === 'revert' && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-2">Reason for Reverting</h3>

                <textarea
                  value={revertReason}
                  onChange={(e) => setRevertReason(e.target.value)}
                  className="w-full border rounded-md p-2 mb-3"
                  placeholder="Explain why you're reverting this resolution..."
                />

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => {
                      if (selected.type === 'lostfound') handleLostFoundRevert(selected.id)
                      else handleStatusChange(selected.id, 'In Progress')
                    }}
                    className="flex items-center gap-2 cursor-pointer bg-gray-600 hover:bg-gray-500 text-white px-5 py-3 rounded-xl"
                  >
                    <Undo size={18} /> Confirm Revert
                  </button>

                  <button
                    onClick={() => setAction(null)}
                    className="cursor-pointer text-white bg-gray-500 hover:bg-gray-600 px-5 py-3 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* 🟨 UNFLAG */}
            {action === 'unflag' && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-2">Reason for Unflagging</h3>

                <textarea
                  value={unflagReason}
                  onChange={(e) => setUnflagReason(e.target.value)}
                  className="w-full border rounded-md p-2 mb-3"
                  placeholder="Explain why you're reversing this false report flag..."
                />

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => handleUnflagReport(selected.id)}
                    className="cursor-pointer bg-yellow-600 hover:bg-yellow-500 text-white px-5 py-3 rounded-xl gap-2 flex items-center"
                  >
                    <Undo size={18} /> Confirm Unflag
                  </button>

                  <button
                    onClick={() => setAction(null)}
                    className="cursor-pointer bg-gray-400 hover:bg-gray-300 px-5 py-3 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {action === 'cancel_lostfound' && (
              <div className="mt-6 border-t pt-4">
                <h3 className="font-semibold mb-2">Reason for Cancelling</h3>

                <textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  className="w-full border rounded-md p-2 mb-3"
                  placeholder="Explain why this lost & found report is being cancelled..."
                />

                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => handleCancelLostFound(selected.id)}
                    className="cursor-pointer bg-red-600 text-white px-5 py-3 rounded-xl"
                  >
                    Confirm Cancel
                  </button>

                  <button
                    onClick={() => setAction(null)}
                    className="cursor-pointer bg-gray-400 px-5 py-3 rounded-xl"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {confirmRelease && (
              <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[70]">
                <div
                  className={`rounded-xl shadow-lg p-6 w-[380px]
                    ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`
                  }
                >
                  <h3 className="font-semibold mb-3 text-center">Reason for Releasing Claim</h3>

                  <textarea
                    value={releaseReason}
                    onChange={(e) => setReleaseReason(e.target.value)}
                    className="w-full border rounded-md p-2 mb-4"
                    placeholder="Explain why you are releasing this claim..."
                  />

                  <div className="flex justify-center gap-3">
                    <button
                      onClick={() => handleReleaseClaim(selected.id)}
                      className="cursor-pointer bg-purple-600 text-white px-5 py-3 rounded-xl hover:bg-purple-500 flex items-center gap-2"
                    >
                      <Undo size={18} /> Confirm Release
                    </button>

                    <button
                      onClick={() => {
                        setConfirmRelease(false)
                        setReleaseReason('')
                      }}
                      className="flex items-center gap-3 text-white cursor-pointer bg-gray-600 px-5 py-3 rounded-xl hover:bg-gray-500"
                    >
                      <Ban size={18} /> Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}

          </div>
        </div>
      )}

      {showContributions && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60]"
          onClick={() => setShowContributions(false)}
        >
          <div
            className={`rounded-2xl shadow-lg w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto
              ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`
            }

            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h2
                className={`text-2xl font-bold
                  ${theme === 'dark' ? 'text-white' : 'text-black'}`
                }
              >
                User Contributions
              </h2>
              <button onClick={() => setShowContributions(false)} className="cursor-pointer">
                <X size={26} />
              </button>
            </div>

            {loadingContributions ? (
              <p className="text-gray-500">Loading contributions...</p>
            ) : contributions.length === 0 ? (
              <p className="text-gray-500 italic">No contributions yet.</p>
            ) : (
              <div className="space-y-4">
                {contributions.map(c => (
                  <div
                    key={c.id}
                    className="border rounded-xl p-4 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <img
                        src={c.profiles?.avatar_url || '/default-avatar.png'}
                        className="w-12 h-12 rounded-full object-cover border"
                      />

                      <div>
                        <p className="font-semibold">{c.profiles?.full_name}</p>
                        <p className="text-sm text-gray-500">
                          Submitted on {new Date(c.created_at).toLocaleDateString('en-GB')}
                        </p>

                        {c.proof_url && (
                          <a
                            href={c.proof_url}
                            target="_blank"
                            className="text-blue-500 underline text-sm"
                          >
                            View proof
                          </a>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        handleChat(c.founder_id, selected.id, 'lostfound')
                      }
                      className="cursor-pointer bg-green-600 hover:bg-green-500 text-white px-4 py-2 rounded-lg flex items-center gap-2"
                    >
                      <MessageCircle size={16} /> Chat
                    </button>
                  </div>
                ))}
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