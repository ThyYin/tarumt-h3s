'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Check, Trash } from 'lucide-react'

export default function LostFoundEditPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const { id } = useParams()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)

  // FORM FIELDS
  const [itemName, setItemName] = useState('')
  const [description, setDescription] = useState('')
  const [location, setLocation] = useState('')
  const [dateLost, setDateLost] = useState('')

  // MEDIA
  const [media, setMedia] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [existingImages, setExistingImages] = useState<{ id: string; media_url: string }[]>([])
  const [removeIds, setRemoveIds] = useState<string[]>([]) // db images to delete

  useEffect(() => {
    loadReport()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadReport() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return router.push('/login')

    // load main lost_found record
    const { data: lf } = await supabase
      .from('lost_found')
      .select('*')
      .eq('id', id)
      .single()

    if (!lf) return router.push('/report/list')

    // fill form
    setItemName(lf.item_name)
    setDescription(lf.description)
    setLocation(lf.location ?? '')
    setDateLost(lf.lost_date ?? '')

    // load images
    const { data: imgs } = await supabase
      .from('lost_found_images')
      .select('*')
      .eq('lf_id', id)

    setExistingImages(imgs ?? [])

    setLoading(false)
  }

  function handleFiles(files: FileList) {
    const arr = Array.from(files)

    if (media.length + existingImages.length + arr.length > 5) {
      alert('Maximum 5 attachments allowed.')
      return
    }

    const valid = arr.filter(file =>
      file.type.startsWith('image/') ||
      file.type.startsWith('video/') ||
      file.type === 'application/pdf'
    )

    setMedia(prev => [...prev, ...valid])
    setPreviews(prev => [...prev, ...valid.map(f =>
      f.type.startsWith('image/') ? URL.createObjectURL(f) : '/file-icon.png'
    )])
  }

  function removeNewMedia(i: number) {
    setMedia(prev => prev.filter((_, x) => x !== i))
    setPreviews(prev => prev.filter((_, x) => x !== i))
  }

  function removeExisting(id: string) {
    setRemoveIds(prev => [...prev, id])
    setExistingImages(prev => prev.filter(img => img.id !== id))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      // 1️⃣ Update lost_found table
      const { error: updateErr } = await supabase
        .from('lost_found')
        .update({
          item_name: itemName,
          description,
          location,
          lost_date: dateLost || null,
        })
        .eq('id', id)

      if (updateErr) throw updateErr

      // 2️⃣ Delete removed images
      for (const imgId of removeIds) {
        await supabase
          .from('lost_found_images')
          .delete()
          .eq('id', imgId)
      }

      // 3️⃣ Upload new media
      for (const file of media) {
        const fileName = `${user.id}-${Date.now()}-${file.name}`

        // Upload to storage
        const upload = await supabase.storage
            .from('uploads')
            .upload(fileName, file)

        if (upload.error) throw upload.error

        // Get public URL correctly
        const { data: urlData } = supabase.storage
            .from('uploads')
            .getPublicUrl(fileName)

        const publicUrl = urlData.publicUrl

        // Insert into DB
        await supabase
            .from('lost_found_images')
            .insert({
            lf_id: id,
            media_url: publicUrl,
            })
        }

      alert('✅ Report updated successfully!')
      router.push('/report/list')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Something went wrong.')
    }

    setLoading(false)
  }

  if (loading) return <div className="p-8">Loading...</div>

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold mb-1">Edit Lost & Found Report</h1>
      <p className="text-gray-500">Update your item details</p>

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

          {/* Description */}
          <div className='inline-flex gap-14 mb-8'>
            <label className="font-bold mt-3">Item Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="border rounded-lg w-lg px-3 py-2 h-28 resize-none"
            />
          </div>

          {/* Lost since */}
          <div className='inline-flex items-center gap-25 mb-8'>
            <label className="font-bold">Lost since</label>
            <input
              type="date"
              value={dateLost ?? ''}
              onChange={(e) => setDateLost(e.target.value)}
              className="cursor-pointer border rounded-lg px-3 py-2 w-45"
            />
          </div>

          {/* Location */}
          <div className='inline-flex gap-26 mb-8'>
            <label className="font-bold mt-3">Last seen</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="border rounded-lg w-lg px-3 py-2"
            />
          </div>

          {/* Attachments */}
          <label className="font-semibold block mb-3">Attachment <span className='italic'>(if any)</span></label>

          {/* EXISTING IMAGES */}
          {existingImages.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mb-4">
              {existingImages.map((img) => (
                <div key={img.id} className="relative">
                  <img src={img.media_url} className="w-full h-28 object-cover rounded-xl border" />
                  <button
                    type="button"
                    onClick={() => removeExisting(img.id)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* NEW UPLOADS */}
          <div
            className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center cursor-pointer"
            onClick={() => document.getElementById('fileInputEdit')?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(e.dataTransfer.files)
            }}
          >
            <p className="text-blue-400">Drag & drop images here, or click to upload</p>
            <p className="text-sm text-gray-400">max 5 files total</p>

            <input
              id="fileInputEdit"
              type="file"
              multiple
              accept="image/*,video/*,application/pdf"
              className="hidden"
              onChange={(e) => e.target.files && handleFiles(e.target.files)}
            />
          </div>

          {/* NEW PREVIEWS */}
          {previews.length > 0 && (
            <div className="grid grid-cols-3 gap-4 mt-4">
              {previews.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} className="w-full h-28 object-cover rounded-xl border bg-gray-100" />
                  <button
                    type="button"
                    onClick={() => removeNewMedia(i)}
                    className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* BUTTONS */}
          <div className="flex justify-end gap-6 mt-6">
            <button
              type="submit"
              className="cursor-pointer bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <Check size={18} /> Save Changes
            </button>

            <button
              type="button"
              onClick={() => router.push('/report/list')}
              className="cursor-pointer bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <Trash size={18} /> Cancel
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}
