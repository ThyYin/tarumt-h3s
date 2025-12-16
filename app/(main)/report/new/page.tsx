'use client'

import { useState, useEffect } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Check, Trash } from 'lucide-react'

export default function NewReportPage() {
  const router = useRouter()
  const supabase = createClient()

  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  // Multi-image support
  const [images, setImages] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])

  const [loading, setLoading] = useState(false)
  const [confirm1, setConfirm1] = useState(false)
  const [confirm2, setConfirm2] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    if (!confirm1 || !confirm2) {
      alert('Please check both confirmations.')
      setLoading(false)
      return
    }

    try {
      // Get logged in user
      const {
        data: { user },
      } = await supabase.auth.getUser()

      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!user) {
        alert('Please log in first.')
        router.push('/login')
        return
      }

      // Insert base report row
      const supabaseWithAuth = createClient()
      supabaseWithAuth.auth.setSession({
        access_token: session?.access_token!,
        refresh_token: session?.refresh_token!,
      })

      const { data: inserted, error: insertError } = await supabaseWithAuth
        .from('reports')
        .insert({
          user_id: user.id,
          category,
          description,
        })
        .select()
        .single()

      if (insertError) throw insertError

      const reportId = inserted.id

      await fetch(
        'https://lcbwiranwqjkqwrnlycz.functions.supabase.co/new-general-report-notification',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            reportId,
            category,
            description,
          }),
        }
      )

      // Upload images
      for (const file of images) {
        const fileName = `${user.id}-${Date.now()}-${file.name}`

        const { error: uploadError } = await supabase.storage
          .from('uploads')
          .upload(fileName, file)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from('uploads').getPublicUrl(fileName)

        // Insert each image into report_images table
        const { error: imageInsertError } = await supabase
          .from('report_images')
          .insert({
            report_id: reportId,
            image_url: publicUrl,
          })

        if (imageInsertError) throw imageInsertError
      }

      alert('✅ Report submitted successfully!')
      router.push('/report/list')
    } catch (err: any) {
      console.error(err)
      alert(err.message || 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-extrabold mb-1">General Issues Report Submission</h1>
      <p className="text-gray-500">Let us know about the issues you have encountered today</p>

      <div
        className={`max-w-4xl p-6 rounded-2xl shadow mt-6
          ${theme === 'dark' ? 'bg-black' : 'bg-white'}
        `}
      >
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* CATEGORY */}
          <label className="items-center inline-flex gap-17">
            <span className="font-bold">Category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={`cursor-pointer block border rounded-lg px-3 py-3
                ${theme === 'dark' ? 'bg-black' : 'bg-white'}
              `}
              required
            >
              <option value="" disabled hidden>Select a category</option>
              <option>Electrical Issues</option>
              <option>Plumbing & Water Supply</option>
              <option>Building & Infrastructure</option>
              <option>Furniture & Equipment</option>
              <option>ICT & Network</option>
              <option>Safety & Security</option>
              <option>Cleanliness & Environment</option>
              <option>Others</option>
            </select>
          </label>

          {/* DESCRIPTION */}
          <label className="mt-5 block inline-flex gap-12">
            <span className="font-bold mt-3">Description</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              className="mt-1 w-2xl border rounded-lg px-3 py-2 h-28 resize-none"
              placeholder="max. 300 words"
            />
          </label>

          {/* DRAG + DROP UPLOADER */}
          <div className='mt-10'>
            <span className="font-bold">Attachment(s)</span>

            <div
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                handleFiles(e.dataTransfer.files)
              }}
              onClick={() => document.getElementById('fileInput')?.click()}
              className="border-2 border-dashed border-gray-400 rounded-xl p-6 text-center hover:border-blue-500 transition cursor-pointer mt-3"
            >
              <p className="text-blue-400">Drag & drop images here, or click to upload</p>
              <p className="text-sm text-gray-400">max. FIVE (5) medias, accepted formats: PNG, JPG, GIF, PDF, MP4, MOV</p>

              <input
                type="file"
                id="fileInput"
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

          {/* CONFIRMATIONS */}
          <div className="mt-10 space-y-2 ml-2">
            <label className="flex items-center gap-10 mb-5">
              <input
                type="checkbox"
                checked={confirm1}
                onChange={(e) => setConfirm1(e.target.checked)}
                className="scale-170 accent-green-600 cursor-pointer"
              />
              <span className="text-green-600 leading-snug cursor-pointer">
                By checking this box, I confirm that the complaint provided in this report is accurate and truthful.
              </span>
            </label>

            <label className="flex items-center gap-10 mb-10">
              <input
                type="checkbox"
                checked={confirm2}
                onChange={(e) => setConfirm2(e.target.checked)}
                className="scale-170 accent-red-600 cursor-pointer"
              />
              <span className="text-red-600 leading-snug cursor-pointer">
                I understand that providing false or misleading information may lead to disciplinary or legal action by the administration.
              </span>
            </label>
          </div>

          {/* SUBMIT */}
          <div className="flex justify-end mt-6 gap-6">
            <button
              type="submit"
              disabled={loading}
              className="bg-green-500 hover:bg-green-400 text-white px-6 py-3 rounded-xl flex items-center gap-2 text-m font-medium shadow-sm cursor-pointer"
            >
              <Check size={18} /> {loading ? 'Submitting...' : 'Submit'}
            </button>

            <button
              type="button"
              onClick={() => router.push('/report/list')}
              className="bg-red-500 hover:bg-red-400 text-white px-6 py-3 rounded-xl flex items-center gap-2 text-m font-medium shadow-sm cursor-pointer"
            >
              <Trash size={18} /> Discard
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
