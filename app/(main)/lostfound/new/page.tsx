'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Check, Trash } from 'lucide-react'

export default function LostFoundNewPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const supabase = createClient()

  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [dateLost, setDateLost] = useState('')

  // Multiple media files
  const [media, setMedia] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const [confirmTruth, setConfirmTruth] = useState(false)
  const [confirmWarning, setConfirmWarning] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    checkUser()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function checkUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) router.push('/login')
  }

  function handleFiles(files: FileList) {
    const arr = Array.from(files)

    if (media.length + arr.length > 5) {
      alert('Maximum 5 attachments allowed.')
      return
    }

    const valid = arr.filter(file =>
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type === 'application/pdf'
    )

    setMedia(prev => [...prev, ...valid])

    // For preview: PDF/video won't preview as thumbnails, so show fallback
    setPreviews(prev => [
      ...prev,
      ...valid.map(file =>
        file.type.startsWith('image/')
          ? URL.createObjectURL(file)
          : '/file-icon.png' // You can replace with your own thumbnail icon
      ),
    ])
  }

  function removeMedia(index: number) {
    setMedia(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!confirmTruth || !confirmWarning) {
      alert('⚠️ Please check both confirmation boxes before submitting.')
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      // Fetch owner full name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .single()

      // Insert LostFound record
      const { data: inserted, error: insertErr } = await supabase
        .from('lost_found')
        .insert({
          user_id: user.id,
          owner_name: profile?.full_name || 'Anonymous',
          item_name: itemName,
          description,
          location,
          lost_date: dateLost || null,
        })
        .select()
        .single()

      if (insertErr) throw insertErr

      const lfId = inserted.id

      await fetch(
        'https://lcbwiranwqjkqwrnlycz.functions.supabase.co/new-lost-found-notification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${(
              await supabase.auth.getSession()
            ).data.session?.access_token}`,
          },
          body: JSON.stringify({
            lfId,
            itemName,
            location,
          }),
        }
      )

      // Upload media files
      for (const file of media) {
        const fileName = `${user.id}-${Date.now()}-${file.name}`
        const upload = await supabase.storage.from('uploads').upload(fileName, file)
        if (upload.error) throw upload.error

        const { data: { publicUrl } } = supabase.storage
          .from('uploads')
          .getPublicUrl(fileName)

        await supabase.from('lost_found_images').insert({
          lf_id: lfId,
          media_url: publicUrl,
        })
      }

      alert('✅ Lost & Found report submitted successfully!')
      router.push('/report/list')
    } catch (err: any) {
      console.error('Submit Error:', err)
      alert(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold mb-1">Lost & Found Report Submission</h1>
      <p className="text-gray-500">Describe your missing item and we'll inform our TARCIans</p>

      <div
        className={`max-w-4xl p-8 rounded-2xl shadow-md mt-6
          ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-6">

          {/* Item Name */}
          <div className='inline-flex items-center gap-20 mb-8'>
            <label className="font-bold">Name of Item</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              required
              className="border rounded-lg px-3 py-2 w-lg"
            />
          </div>

          {/* Item Description */}
          <div className='inline-flex gap-14 mb-8'>
            <label className="font-bold mb-1 mt-3">Item Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="border rounded-lg w-lg px-3 py-2 h-28 resize-none"
              placeholder="Describe the characteristics of your lost item (e.g. colour, model)"
            />
          </div>

          {/* Lost Since */}
          <div className='inline-flex items-center gap-25 mb-8'>
            <label className="font-bold">Lost since</label>
            <input
              type="date"
              value={dateLost}
              onChange={(e) => setDateLost(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              required
              className="cursor-pointer border rounded-lg px-3 py-2 w-45"
            />
          </div>

          <br />

          {/* Location */}
          <div className='inline-flex gap-26 mb-8'>
            <label className="font-bold mt-3">Last seen</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border rounded-lg w-lg px-3 py-2"
              placeholder="e.g. Block D, Canteen"
            />
          </div>

          {/* Drag & Drop Attachments */}
          <div>
            <label className="font-semibold block mb-3">Attachment <span className='italic font-medium'>(if any)</span></label>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => document.getElementById('fileInputLost')?.click()}
              className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer"
            >
              <p className="text-blue-400">Drag & drop images here, or click to upload</p>
              <p className="text-sm text-gray-400">max. FIVE (5) medias, accepted formats: PNG, JPG, GIF, PDF, MP4, MOV</p>

              <input
                id="fileInputLost"
                type="file"
                multiple
                accept="image/*,video/*,application/pdf"
                className="hidden"
                onChange={(e) => e.target.files && handleFiles(e.target.files)}
              />
            </div>

            {/* Preview */}
            <div className="grid grid-cols-3 gap-4 mt-4">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img
                    src={src}
                    className="w-full h-28 object-cover rounded-xl border bg-gray-100"
                  />
                  <button
                    type="button"
                    onClick={() => removeMedia(i)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full 
                    w-6 h-6 flex items-center justify-center text-sm shadow cursor-pointer"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* CONFIRMATIONS */}
          <div className="mt-10 space-y-2 ml-2">
            <label className="flex items-center gap-10 mb-5">
              <input
                type="checkbox"
                checked={confirmTruth}
                onChange={(e) => setConfirmTruth(e.target.checked)}
                className="scale-170 accent-green-600 cursor-pointer"
              />
              <span className="text-green-600 leading-snug cursor-pointer">
                By checking this box, I confirm that the details of my lost item provided in this report is accurate and truthful, and that this item is truly lost from my possession.
              </span>
            </label>

            <label className="flex items-center gap-10 mb-10">
              <input
                type="checkbox"
                checked={confirmWarning}
                onChange={(e) => setConfirmWarning(e.target.checked)}
                className="scale-170 accent-red-600 cursor-pointer"
              />
              <span className="text-red-600 leading-snug cursor-pointer">
                I understand that providing false or misleading information may lead to disciplinary or legal action by the administration.
              </span>
            </label>
          </div>

          {/* Buttons */}
          <div className="flex justify-end mt-6 gap-6">
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <Check size={18} /> {loading ? 'Submitting...' : 'Submit'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/lostfound/list')}
              className="cursor-pointer bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <Trash size={18} /> Discard
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
