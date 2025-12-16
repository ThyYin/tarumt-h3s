'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { openChatWithUser } from '@/lib/openChat'
import { X, MessageCircleMore, UserRoundPlus, Ban } from 'lucide-react'

type Profile = {
  id: string
  full_name: string | null
  role: string
  created_at: string
  avatar_url: string | null
  email?: string
  active: boolean
}

export default function AdminUsersPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()

  const [profiles, setProfiles] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  // modal visibility
  const [showAddModal, setShowAddModal] = useState(false)

  // add-user form state
  const [newFullName, setNewFullName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPassword, setNewPassword] = useState('')

  // avatar upload states
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)

  // search + filter
  const [searchText, setSearchText] = useState('')
  const [roleFilter, setRoleFilter] = useState('All')

  // activate / deactivate account(s)
  const [showActiveModal, setShowActiveModal] = useState(false)
  const [activeTarget, setActiveTarget] = useState<Profile | null>(null)
  const [confirmName, setConfirmName] = useState('')

  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 5

  useEffect(() => {
    setCurrentPage(1)
    loadUsers()
    setMounted(true)
  }, [])

  if (!mounted) return null

  async function loadUsers() {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return router.push('/login')

      setCurrentUserId(user.id)

      // check admin
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

      if (profile?.role !== 'admin') {
        alert('Access denied.')
        return router.push('/')
      }

      setIsAdmin(true)

      // fetch all profiles except current admin
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, role, avatar_url, created_at, active')
        .neq('id', user.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const emailRes = await fetch('/api/admin/list-user-emails')
      const emailMap = await emailRes.json()

      const usersWithEmail = data.map((p: Profile) => ({
        ...p,
        email: emailMap[p.id] || 'unknown'
      }))

      setProfiles(usersWithEmail)
    } catch (err: any) {
      console.error(err)
      alert(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleChatUser(targetUserId: string) {
    try {
      if (!currentUserId) return

      const roomId = await openChatWithUser(
        currentUserId, // admin
        targetUserId   // user/staff
      )

      if (!roomId) {
        alert('Failed to open chat.')
        return
      }

      router.push(`/chat/${roomId}`)
    } catch (err) {
      console.error('Admin chat error:', err)
      alert('Unable to open chat.')
    }
  }

  // handle avatar selection
  function handleAvatarFile(files: FileList) {
    const file = files[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.')
      return
    }

    setAvatarFile(file)

    const url = URL.createObjectURL(file)
    setAvatarPreview((old) => {
      if (old) URL.revokeObjectURL(old)
      return url
    })
  }

  function clearAvatar() {
    if (avatarPreview) URL.revokeObjectURL(avatarPreview)
    setAvatarPreview(null)
    setAvatarFile(null)
  }

  // create a new user
  async function handleAddUser(e: React.FormEvent) {
    e.preventDefault()
    try {

      if (
        !newEmail.toLowerCase().endsWith('@tarc.edu.my') && 
        !newEmail.toLowerCase().endsWith('@student.tarc.edu.my')
      ) {
        return alert('Only @tarc.edu.my / @student.tarc.edu.my emails are allowed!');
      }
      
      // create user via API route
      const res = await fetch('/api/admin/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          full_name: newFullName,
          role: 'staff',
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      const newUserId = data.id

      // optional avatar upload
      if (avatarFile) {
        const fileName = `avatar-${newUserId}-${Date.now()}-${avatarFile.name}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(fileName, avatarFile)

        if (uploadError) throw uploadError

        const {
          data: { publicUrl },
        } = supabase.storage.from('avatars').getPublicUrl(fileName)

        await supabase
          .from('profiles')
          .update({ avatar_url: publicUrl })
          .eq('id', newUserId)
      }

      alert('✅ New staff successfully added!')
      setShowAddModal(false)
      clearAvatar()
      setNewFullName('')
      setNewEmail('')
      setNewPassword('')

      loadUsers()
    } catch (err: any) {
      alert(err.message)
    }
  }

  // activate / deactivate
  async function toggleActive(id: string, current: boolean) {
    await supabase.from('profiles').update({ active: !current }).eq('id', id)

    setProfiles((prev) =>
      prev.map((p) => (p.id === id ? { ...p, active: !current } : p))
    )
  }

  // filter list
  const filtered = profiles.filter((p) => {
    const searchMatch =
      p.full_name?.toLowerCase().includes(searchText.toLowerCase()) ||
      p.email?.toLowerCase().includes(searchText.toLowerCase())

    const roleMatch = roleFilter === 'All' || p.role === roleFilter

    return searchMatch && roleMatch
  })

  const totalPages = Math.ceil(filtered.length / ITEMS_PER_PAGE) || 1

  const paginatedUsers = filtered.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 className="text-3xl font-extrabold mb-1">Staff & Users</h1>
          <p className="text-gray-500">
            Manage user accounts, roles, and access across the H3S system
          </p>
        </div>

        {/* add user button */}
        <button
          onClick={() => setShowAddModal(true)}
          className="cursor-pointer bg-blue-600 hover:bg-blue-500 transition text-white px-4 py-2 rounded-xl flex items-center gap-2"
        >
          <UserRoundPlus size={18} /> Add Staff
        </button>
      </div>

      {/* search + filter + export */}
      <div className="flex flex-wrap items-center gap-10">

        {/* LEFT: search bar */}
        <div className="flex items-center">
          <input
            type="text"
            placeholder="Search staff or users..."
            className="py-2 px-5 border rounded-lg w-64"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        {/* RIGHT: Filters + Export */}
        <div className="flex items-center">
          <select
            className={`cursor-pointer border rounded-lg px-5 py-2
              ${theme === 'dark' ? 'bg-black text-white' : 'bg-white text-black'}`
            }
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="All">All Roles</option>
            <option value="user">User</option>
            <option value="staff">Staff</option>
          </select>
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto border rounded-xl shadow bg-white mt-8">
        <table
          className={`w-full border-collapse
            ${theme === 'dark' ? 'bg-black' : 'bg-white'}`
          }
        >
          <thead
            className={`text-left
              ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`
            }
          >
            <tr>
              <th className="p-3">Avatar</th>
              <th className="p-3">Name</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3 text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {paginatedUsers.map((p) => (
              <tr key={p.id} className="border-t">
                <td className="p-3">
                  {p.avatar_url ? (
                    <img
                      src={p.avatar_url || 'default-avatar.png'} // need fix
                      className="w-10 h-10 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-300" />
                  )}
                </td>

                <td className="p-3">{p.full_name ?? '—'}</td>
                <td className="p-3">{p.email}</td>

                <td className="p-3 capitalize">{p.role}</td>

                <td className="p-3">
                  {p.active ? (
                    <span className="text-green-600">Active</span>
                  ) : (
                    <span className="text-red-500">Inactive</span>
                  )}
                </td>

                <td className="p-3 text-sm text-gray-500">
                  {new Date(p.created_at).toLocaleDateString('en-GB')}
                </td>

                <td className="p-3 text-center space-x-2 flex items-center">

                  {/* CHAT */}
                  <button
                    onClick={() => handleChatUser(p.id)}
                    className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white px-3 py-1.5 rounded-lg inline-flex items-center gap-1"
                  >
                    <MessageCircleMore size={21} />
                  </button>

                  {/* ACTIVATE / DEACTIVATE */}
                  <button
                    onClick={() => {
                      setActiveTarget(p)
                      setConfirmName('')
                      setShowActiveModal(true)
                    }}
                    className={`cursor-pointer px-3 py-1 rounded-lg text-white ${
                      p.active
                        ? 'bg-red-600 hover:bg-red-500'
                        : 'bg-green-600 hover:bg-green-500'
                    }`}
                  >
                    {p.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 🔹 PAGINATION — PASTE HERE */}
      {filtered.length > 0 && (
        <div className="flex justify-center items-center gap-2 mt-6">
          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(1)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            «
          </button>

          <button
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ‹
          </button>

          {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((page) => (
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
          ))}

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            ›
          </button>

          <button
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(totalPages)}
            className="p-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            »
          </button>
        </div>
      )}

      {/* ========== ADD USER MODAL ========== */}
      {showAddModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowAddModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md p-6 rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto relative"
          >
            <button
              onClick={() => setShowAddModal(false)}
              className="cursor-pointer absolute right-4 top-4 text-gray-500 hover:text-black"
            >
              <X size={27} />
            </button>

            <h2 className="text-2xl font-extrabold mb-10">Add New Staff</h2>

            {/* avatar uploader */}
            <div className="flex flex-col items-center">
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault()
                  handleAvatarFile(e.dataTransfer.files)
                }}
                onClick={() => document.getElementById('avatarInput')?.click()}
                className="border-2 border-dashed border-gray-400 rounded-full w-32 h-32 flex items-center justify-center overflow-hidden cursor-pointer hover:border-blue-500"
              >
                {avatarPreview ? (
                  <img
                    src={avatarPreview}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <p className="text-xs text-gray-400 text-center px-2">
                    Click or drag to upload avatar (optional)
                  </p>
                )}

                <input
                  id="avatarInput"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) =>
                    e.target.files && handleAvatarFile(e.target.files)
                  }
                />
              </div>

              {avatarPreview && (
                <button
                  type="button"
                  onClick={clearAvatar}
                  className="text-red-500 mt-2 text-xs underline"
                >
                  Remove avatar
                </button>
              )}
            </div>

            {/* form */}
            <form onSubmit={handleAddUser} className="mt-5 space-y-4">

              <input
                type="text"
                placeholder="Full name"
                className="w-full border px-3 py-2 rounded-lg"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                required
              />

              <input
                type="email"
                placeholder="Email"
                className="w-full border px-3 py-2 rounded-lg"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password"
                className="w-full border px-3 py-2 rounded-lg"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />

              <div className="flex items-center gap-4 justify-end">
                <button
                type="submit"
                className="cursor-pointer flex items-center gap-3 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-xl mt-15 px-5"
                >
                  <UserRoundPlus size={18} /> Add Staff
                </button>

                <button
                  onClick={() => setShowAddModal(false)}
                  className="cursor-pointer flex items-center gap-3 bg-gray-500 hover:bg-gray-600 text-white py-3 rounded-xl mt-15 px-5"
                >
                  <Ban size={18} /> Cancel
                </button>
              </div>

              
            </form>
          </div>
        </div>
      )}

      {/* ========== ACTIVATE / DEACTIVATE ACCOUNT MODAL ========== */}
      {showActiveModal && activeTarget && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
          onClick={() => setShowActiveModal(false)}
        >
          <div
            className={`p-6 w-full max-w-md rounded-2xl shadow-xl
              ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`
            }
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-extrabold mb-6">
              {activeTarget.active ? '🔒 Deactivate Account' : '🔓 Activate Account'}
            </h2>

            <p
              className={`mb-4
                ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`
              }
            >
              Type the user's full name to confirm:
              <br />
              <span
                className={`font-semibold
                  ${theme === 'dark' ? 'text-white' : 'text-black'}`
                }
              >
                {activeTarget.full_name}
              </span>
            </p>

            <input
              className="w-full border rounded-lg px-3 py-2"
              placeholder="Type full name to confirm..."
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
            />

            <div className="flex justify-end gap-3 mt-10">
              <button
                disabled={confirmName !== activeTarget.full_name}
                className={`px-5 py-2 rounded-lg text-white ${
                  confirmName === activeTarget.full_name
                    ? activeTarget.active
                      ? 'bg-red-600 hover:bg-red-500 cursor-pointer'
                      : 'bg-green-600 hover:bg-green-500 cursor-pointer'
                    : 'bg-gray-400'
                }`}
                onClick={async () => {
                  await toggleActive(activeTarget.id, activeTarget.active)
                  setShowActiveModal(false)
                }}
              >
                {activeTarget.active ? 'Deactivate' : 'Activate'}
              </button>

              <button
                className="cursor-pointer px-5 py-2 rounded-lg bg-gray-500 hover:bg-gray-600 text-white flex items-center gap-3"
                onClick={() => setShowActiveModal(false)}
              >
                <Ban size={18} /> Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
