'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Check, X } from 'lucide-react'

export default function EditReportPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const params = useParams()
  const supabase = createClient()

  const reportId = params.id as string

  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  // Existing images (from DB)
  const [existingImages, setExistingImages] = useState<
    { id: string; image_url: string }[]
  >([])

  // New images uploaded by user
  const [newImages, setNewImages] = useState<File[]>([])
  const [newPreviews, setNewPreviews] = useState<string[]>([])

  // Images user wants to remove
  const [deleteIds, setDeleteIds] = useState<string[]>([])

  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadReport()
    loadImages()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadReport() {
    const { data, error } = await supabase
      .from('reports')
      .select('*')
      .eq('id', reportId)
      .single()

    if (error || !data) {
      alert('Failed to load report.')
      router.push('/report/list')
      return
    }

    setCategory(data.category)
    setDescription(data.description)
  }

  async function loadImages() {
    const { data, error } = await supabase
      .from('report_images')
      .select('*')
      .eq('report_id', reportId)

    if (!error && data) {
      setExistingImages(data)
    }
  }

  function handleFiles(files: FileList) {
    const arr = Array.from(files)

    if (existingImages.length + newImages.length + arr.length > 5) {
      alert('Maximum 5 images allowed.')
      return
    }

    const valid = arr.filter((f) => f.type.startsWith('image/'))

    setNewImages((p) => [...p, ...valid])
    setNewPreviews((p) => [...p, ...valid.map((f) => URL.createObjectURL(f))])
  }

  function removeNewImage(i: number) {
    setNewImages((prev) => prev.filter((_, idx) => idx !== i))
    setNewPreviews((prev) => prev.filter((_, idx) => idx !== i))
  }

  function removeExistingImage(id: string) {
    setDeleteIds((prev) => [...prev, id])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!user) return router.push('/login')

      // Remove images marked for deletion
      for (const delId of deleteIds) {
        await supabase.from('report_images').delete().eq('id', delId)
      }

      // Upload new images
      const supabaseWithAuth = createClient()
      supabaseWithAuth.auth.setSession({
        access_token: session?.access_token!,
        refresh_token: session?.refresh_token!,
      })

      for (const file of newImages) {
        const fileName = `${user.id}-${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from('uploads').getPublicUrl(fileName)

        await supabase
          .from('report_images')
          .insert({ report_id: reportId, image_url: publicUrl })
      }

      // Update report metadata
      const { error: updateError } = await supabase
        .from('reports')
        .update({
          category,
          description,
        })
        .eq('id', reportId)

      if (updateError) throw updateError

      alert('Report updated successfully!')
      router.push('/report/list')
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold mb-1">Edit Report</h1>
      <p className="text-gray-500">Update your report details</p>

      <div
        className={`max-w-4xl p-6 rounded-2xl shadow mt-6
          ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black' }`
        }
      >
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* CATEGORY */}
          <label className="items-center inline-flex gap-17">
            <span className="font-bold">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="cursor-pointer block border rounded-lg px-3 py-3"
            >
              <option>Electrical Issues</option>
              <option>Plumbing & Water Supply</option>
              <option>Building & Infrastructure</option>
              <option>Furniture & Equipment</option>
              <option>ICT & Network</option>
              <option>Safety & Security</option>
              <option>Cleanliness & Environment</option>
              <option>Lost & Found</option>
              <option>Others</option>
            </select>
          </label>

          {/* DESCRIPTION */}
          <label className="block mt-4">
            <span className="font-bold">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 w-full border rounded-lg px-3 py-2 h-28 resize-none"
            />
          </label>

          {/* EXISTING IMAGES */}
          <div>
            <span className="font-bold">Existing Images</span>
            <div className="grid grid-cols-3 gap-4 mt-3">
              {existingImages
                .filter((img) => !deleteIds.includes(img.id))
                .map((img) => (
                  <div key={img.id} className="relative">
                    <img
                      src={img.image_url}
                      className="w-full h-28 object-cover rounded-xl border"
                    />

                    <button
                      type="button"
                      onClick={() => removeExistingImage(img.id)}
                      className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow cursor-pointer"
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* DRAG & DROP FOR NEW IMAGES */}
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(e.dataTransfer.files)
            }}
            onClick={() =>
              document.getElementById('fileInput')?.click()
            }
            className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer mt-5"
          >
            <p className="text-gray-600">Drag & drop images here, or click to upload</p>
            <p className="text-sm text-gray-400">(Max 5 images total)</p>
            <input
              type="file"
              id="fileInput"
              className="hidden"
              multiple
              accept="image/*"
              onChange={(e) =>
                e.target.files && handleFiles(e.target.files)
              }
            />
          </div>

          {/* PREVIEW OF NEW IMAGES */}
          <div className="grid grid-cols-3 gap-4 mt-4">
            {newPreviews.map((src, i) => (
              <div key={i} className="relative">
                <img
                  src={src}
                  className="w-full h-28 object-cover rounded-xl border"
                />

                <button
                  type="button"
                  onClick={() => removeNewImage(i)}
                  className="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm shadow cursor-pointer"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          {/* ACTION BUTTONS */}
          <div className="flex justify-end gap-4 mt-6">
            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer bg-green-600 hover:bg-green-500 text-white px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <Check size={18} />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/report/list')}
              className="cursor-pointer bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-xl flex items-center gap-2"
            >
              <X size={18} /> Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
