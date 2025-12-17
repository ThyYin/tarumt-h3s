// lostfound/list/page.tsx

'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { ChevronLeft, ChevronsLeft, ChevronRight, ChevronsRight, File, Check, Trash, Send, CircleStar } from 'lucide-react'

export default function LostFoundPublicList() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const supabase = createClient()
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<any | null>(null)
  const [confirmStep, setConfirmStep] = useState(false)
  const [attachment, setAttachment] = useState<File | null>(null)
  const [confirm1, setConfirm1] = useState(false)
  const [confirm2, setConfirm2] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [zoomImage, setZoomImage] = useState<string | null>(null)
  const router = useRouter()
  const [imageIndex, setImageIndex] = useState(0);
  const [preview, setPreview] = useState<string | null>(null);

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 6
  const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1
  const paginatedItems = items.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  useEffect(() => {
    loadItems()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadItems() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    setLoading(true)

    try {
      // 1️⃣ Fetch all published lost & found items
      const { data: lfItems, error: lfErr } = await supabase
        .from('lost_found')
        .select('*')
        .eq('status', 'Published')
        .order('created_at', { ascending: false })

      if (lfErr) throw lfErr

      // 2️⃣ Fetch all images
      const { data: lfImages, error: imgErr } = await supabase
        .from('lost_found_images')
        .select('*')

      if (imgErr) throw imgErr

      // 3️⃣ Fetch founders list (to hide items user already submitted for)
      const { data: founderRows, error: founderErr } = await supabase
        .from('lost_found_founders')
        .select('lf_id, founder_id')

      if (founderErr) throw founderErr

      // 4️⃣ Filter out items already submitted by current user
      const filteredItems = (lfItems || []).filter(item =>
        !founderRows?.some(
          row => row.lf_id === item.id && row.founder_id === user.id
        )
      )

      // 5️⃣ Collect owner IDs
      const ownerIds = Array.from(
        new Set((filteredItems || []).map(item => item.user_id).filter(Boolean))
      )

      // 6️⃣ Fetch owner names
      const { data: ownerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', ownerIds)

      // 7️⃣ Fetch emails from API
      const emailRes = await fetch('/api/admin/list-user-emails')
      const emailMap = await emailRes.json()

      const ownerMap = new Map(
        (ownerProfiles || []).map(p => [
          p.id,
          {
            name: p.full_name,
            email: emailMap[p.id] || 'Unknown',
          },
        ])
      )

      // 8️⃣ Attach images + owner info
      const itemsWithImages = filteredItems.map(item => ({
        ...item,
        images: lfImages?.filter(img => img.lf_id === item.id) || [],
        owner_info: ownerMap.get(item.user_id) || null,
      }))

      setItems(itemsWithImages)
      setCurrentPage(1)

    } catch (err) {
      console.error('Error loading lost & found list:', err)
    } finally {
      setLoading(false)
    }
  }


  async function handleSubmitFoundProof() {
    if (!attachment) return alert('Please attach at least one file.')
    if (!confirm1 || !confirm2) return alert('Please check both confirmations.')

    try {
      setUploading(true)
      const fileName = `found-proof-${Date.now()}-${attachment.name}`
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(fileName, attachment)
      if (uploadError) throw uploadError

      const { data: { publicUrl } } = supabase.storage
        .from('uploads')
        .getPublicUrl(fileName)

      // Store founder submission record
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        alert('You must be logged in to submit proof.')
        setUploading(false)
        router.push('/login')
        return
      }

      await supabase.from('lost_found_founders').insert({
        lf_id: selected.id,
        founder_id: user.id,
        proof_url: publicUrl
      });

      alert('Submission sent to staff\'s inbox; we will get back with you shortly. Thank you for your contribution! 😊');

      // Close modal + reset
      setConfirmStep(false);
      setSelected(null);

      // Refresh list so the item disappears
      await loadItems();

    } catch (err) {
      console.error(err)
      alert('Failed to submit.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <div>
          <div>
            <h1 className="text-3xl font-extrabold mb-1">Lost & Found</h1>
            <p className="text-gray-500">Have you spotted these missing items? Click for detailed view</p>
          </div>
        </div>
        <div className="flex items-center gap-7">
          <button
            onClick={() => (window.location.href = '/lostfound/new')}
            className="cursor-pointer bg-red-600 hover:bg-red-500 text-white px-5 py-3 rounded-lg shadow flex items-center gap-2"
          >
            <Send size={18} /> Lost an item? Submit a report
          </button>
          <button
            onClick={() => router.push('/lostfound/contributions')}
            className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-5 py-3 rounded-lg shadow flex items-center gap-2"
          >
            <CircleStar size={18} /> Contributions
          </button>
        </div>
      </div>

      {loading ? (
        <div className="mt-10 flex items-center text-gray-600 text-m">
          {/* Spinning Loader */}
          <div
            className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"
            aria-label="Loading"
          ></div>

          {/* Text */} 
          <span>&nbsp;Fetching lost items...</span>
        </div>
      ) : items.length === 0 ? (
        <p className="mt-20 text-gray-500 text-xl text-center">No lost & found items to display. Keep up the good work!</p>
      ) : (
        <>
          <div className="mt-10 grid sm:grid-cols-2 md:grid-cols-3 gap-6">
            {paginatedItems.map((item) => (
              <div
                key={item.id}
                onClick={() => {
                  setSelected(item)
                  setImageIndex(0)
                  setConfirmStep(false)
                }}
                className={`cursor-pointer border rounded-lg overflow-hidden shadow hover:shadow-md transition
                  ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-900' : 'bg-white' }`
                }
              >
                <div className="h-56 bg-gray-100 flex items-center justify-center">
                  <img
                    src={
                      item.images &&
                      item.images.length > 0 &&
                      item.images[0]?.media_url
                        ? item.images[0].media_url
                        : '/no_image.jpg'
                    }
                    alt={item.item_name}
                    className="object-cover w-full h-full"
                  />
                </div>
                <div className="p-3 text-center font-semibold border-t">
                  {item.item_name}
                </div>
              </div>
            ))}
          </div>
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

      {/* 🔹 MODAL: Item Details */}
      {selected && !confirmStep && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setSelected(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rounded-2xl shadow-lg max-w-2xl w-full p-6 relative overflow-y-auto
              ${theme === 'dark' ? 'bg-gray-900' : 'bg-white' }`
            }
          >

            <h2 className="text-3xl font-extrabold mb-6">{selected.item_name}</h2>

            <div className="flex flex-col md:flex-row gap-8">

              {/* Image */}
              <div className="relative w-64 h-64 flex items-center justify-center">
                <img
                  src={
                    selected.images &&
                    selected.images.length > 0 &&
                    selected.images[imageIndex]?.media_url
                      ? selected.images[imageIndex].media_url
                      : '/no_image.jpg'
                  }
                  className="w-full h-full object-cover rounded-lg cursor-pointer"
                  onClick={() => {
                    const img =
                      selected.images &&
                      selected.images.length > 0 &&
                      selected.images[imageIndex]?.media_url
                        ? selected.images[imageIndex].media_url
                        : '/no_image.jpg'
                    setZoomImage(img)
                  }}
                />

                {/* LEFT BUTTON */}
                {selected.images && selected.images.length > 1 && (
                  <button
                    className="cursor-pointer absolute left-2 top-1/2 -translate-y-1/2 
                              bg-black/40 hover:bg-black/90 text-white rounded-full px-1 py-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageIndex(
                        (imageIndex - 1 + selected.images.length) %
                          selected.images.length
                      )
                    }}
                  >
                    <ChevronLeft size={35} />
                  </button>
                )}

                {/* RIGHT BUTTON */}
                {selected.images && selected.images.length > 1 && (
                  <button
                    className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 
                              bg-black/40 hover:bg-black/90 text-white rounded-full px-1 py-1"
                    onClick={(e) => {
                      e.stopPropagation()
                      setImageIndex(
                        (imageIndex + 1) % selected.images.length
                      )
                    }}
                  >
                    <ChevronRight size={35} />
                  </button>
                )}
              </div>

              {/* Right Side Info */}
              <div className="flex-1">
                <p className="font-semibold underline text-xl mb-1">Item Description</p>
                <p className="mb-6 leading-relaxed">{selected.description}</p>
              </div>
            </div>
            
            <table className='mt-5'>
              <tr>
                <td className='w-28 h-10'><b>Last seen</b></td>
                <td>{selected.location ?? '-'}</td>
              </tr>
              <tr>
                <td className='w-28 h-10'><b>Lost since</b></td>
                <td>
                  {new Date(selected.lost_date).toLocaleDateString('en-GB', {
                    weekday: 'long',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                  })}
                </td>
              </tr>
              <tr>
                <td className='w-28 h-10'><b>Owner</b></td>
                <td>
                  {selected.owner_info ? (
                    <>
                      <div>{selected.owner_info.name}</div>
                      <div className="text-sm text-gray-500">
                        {selected.owner_info.email}
                      </div>
                    </>
                  ) : (
                    'Unknown'
                  )}
                </td>
              </tr>
            </table>

            <div className="flex justify-end mt-6">
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user && user.id === selected.user_id) {
                    alert("⚠️ This is your own report!")
                    return
                  }
                  setConfirmStep(true)
                }}
                className="
                  bg-green-500 
                  hover:bg-green-400 
                  text-white 
                  px-6 py-3 
                  rounded-xl 
                  flex items-center gap-2 
                  text-m
                  font-medium
                  shadow-sm
                  disabled:opacity-60
                  cursor-pointer
                "
              >
                I found your item
              </button>
            </div>
          </div>
          
          {/* 🔍 IMAGE ZOOM MODAL */}
          {zoomImage && (
            <div
              className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] cursor-zoom-out"
              onClick={() => setZoomImage(null)}
            >
              <img
                src={zoomImage}
                alt="Zoomed"
                className="max-w-[90vw] max-h-[90vh] rounded-lg"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          )}

        </div>

      )}

      {/* 🔹 MODAL: Proof of Found Item */}
      {selected && confirmStep && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setConfirmStep(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={`rounded-2xl shadow-lg max-w-2xl w-full p-6 relative overflow-y-auto max-h-[95vh]
              ${theme === 'dark' ? 'bg-gray-900' : 'bg-white' }`
            }
          >
            <div className="flex items-center gap-3 mb-6">
              <button
                onClick={() => setConfirmStep(false)}
                className={`cursor-pointer
                  ${theme === 'dark' ? 'text-gray-500 hover:text-gray-200' : 'text-gray-800 hover:text-black' }`
                }
              >
                <ChevronLeft size={40} />
              </button>

              <h2 className="text-3xl font-extrabold">
                {selected.item_name}
              </h2>
            </div>

            
              <p className="mb-4">
                It seems that you have found the owner's lost item, good job!
              </p>
              <p className="mb-8">
                One last step before handing the item into the administration office; prove that the item is in your possession by providing at least one attachment of it.
              </p>

            {/* DRAG & DROP UPLOADER (single file) */}
            <div className="mb-6">
              <span className="font-bold">Attachment</span>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();

                  const file = e.dataTransfer.files?.[0];
                  if (!file) return;

                  if (file.size > 5 * 1024 * 1024) {
                    alert("File must be under 5MB.");
                    return;
                  }

                  setAttachment(file);
                  setPreview(URL.createObjectURL(file));
                }}
                onClick={() => document.getElementById('proofInput')?.click()}
                className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center 
                          hover:border-blue-500 transition cursor-pointer mt-3"
              >
                <p className="text-blue-400">Drag & drop your file here, or click to upload</p>
                <p className="text-sm text-gray-400">
                  ONE file only — PNG, JPG, GIF, PDF, MP4, MOV (max 5MB)
                </p>

                <input
                  type="file"
                  id="proofInput"
                  accept="image/*,video/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    if (file.size > 5 * 1024 * 1024) {
                      alert("File must be under 5MB.");
                      return;
                    }

                    setAttachment(file);
                    setPreview(URL.createObjectURL(file));
                  }}
                />
              </div>

              {/* PREVIEW */}
              {preview && (
                <div className="relative mt-4 inline-block">
                  {/* If image → show <img>. If video/PDF → Just show a box preview */}
                  {attachment?.type.startsWith("image/") ? (
                    <img
                      src={preview}
                      className="w-40 h-40 object-cover rounded-xl border"
                    />
                  ) : (
                    <div className="w-40 h-40 bg-gray-200 flex items-center justify-center rounded-xl border text-sm text-gray-600">
                      {attachment?.type.includes("pdf") ? "PDF File" : "Video File"}
                    </div>
                  )}

                  {/* REMOVE FILE BUTTON */}
                  <button
                    type="button"
                    onClick={() => {
                      setAttachment(null);
                      setPreview(null);
                    }}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full 
                              w-6 h-6 flex items-center justify-center text-sm shadow cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 space-y-2 text-sm mt-2">
              <label className="flex items-center gap-3 mb-3">
                <input
                  type="checkbox"
                  checked={confirm1}
                  onChange={(e) => setConfirm1(e.target.checked)}
                  className="scale-170 accent-green-600 cursor-pointer mr-4"
                />
                <span className="text-green-600 leading-snug cursor-pointer">
                  By checking this box, I confirm I currently possess the lost item and am willing to return it to its owner.
                </span>
              </label>

              <label className="flex items-center gap-3 mb-10">
                <input
                  type="checkbox"
                  checked={confirm2}
                  onChange={(e) => setConfirm2(e.target.checked)}
                  className="scale-170 accent-red-600 cursor-pointer mr-4"
                />
                <span className="text-red-600 leading-snug cursor-pointer">
                  By checking this box, I confirm I currently possess the lost item and am willing to return it to its owner.
                </span>
              </label>
            </div>

            <div className="flex justify-end mt-6 gap-5">
              <button
                onClick={handleSubmitFoundProof}
                disabled={uploading}
                className="
                  bg-green-500 
                  hover:bg-green-400 
                  text-white 
                  px-6 py-3 
                  rounded-xl 
                  flex items-center gap-2 
                  text-m
                  font-medium
                  shadow-sm
                  disabled:opacity-60
                  cursor-pointer
                "
              >
                <Check size={18} /> {uploading ? 'Submitting...' : 'Submit'}
              </button>

              <button
                onClick={() => setConfirmStep(false)}
                className="
                  bg-red-400 
                  hover:bg-red-300 
                  text-white
                  px-6 py-3 
                  rounded-xl 
                  flex items-center gap-2 
                  text-m
                  font-medium
                  shadow-sm
                  cursor-pointer
                "
              >
                <Trash size={18} /> Discard
              </button>

            </div>
          </div>
        </div>
      )}
    </div>
  )
}
