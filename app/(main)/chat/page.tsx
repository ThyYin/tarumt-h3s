// chat/page.tsx

'use client'

import { useEffect, useState, useRef } from 'react'
import { useTheme } from 'next-themes'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Check, CheckCheck } from 'lucide-react'

type Profile = {
  id: string
  full_name: string
  avatar_url: string | null
  role: string
}

type Message = {
  id: string
  room_id: string
  sender_id: string
  content: string
  created_at: string
  read_by: string[] | null
}

type ChatRoom = {
  id: string
  user1: string
  user2: string
  lastMsg?: string
  senderId?: string
  read_by?: string[]
  created_at?: string
}

type Target = Profile & {
  roomId?: string
  hasNewMsg?: boolean
  lastMsg?: string
  senderId?: string
  read_by?: string[]
  lastMsgAt?: string | null
}

export default function ChatListPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const router = useRouter()
  const supabase = createClient()
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)
  const [targets, setTargets] = useState<Target[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const msgChannelRef = useRef<any>(null)

  useEffect(() => {
    init()
    setMounted(true)
    return () => {
      if (msgChannelRef.current) supabase.removeChannel(msgChannelRef.current)
    }
  }, [])

  if (!mounted) return null

  async function init() {
  setLoading(true)
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      router.push('/login')
      return
    }

    setCurrentUserId(user.id)

    // fetch their role
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (!profile) throw new Error('Profile not found.')
    setCurrentUserRole(profile.role)

    // ✅ fetch target list depending on role
    let { data: people } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role')

    if (profile.role === 'admin' || profile.role === 'staff') {
      // admin and staff can message everyone except themselves
      people = (people || []).filter((p) => p.id !== user.id)
    } else {
      // ✅ normal users only see existing chatrooms (not all admins)
      const { data: chatRooms, error: roomError } = await supabase
        .from('chat_rooms')
        .select('id, user1, user2')
        .or(`user1.eq.${user.id},user2.eq.${user.id}`)

      if (roomError) throw roomError

      const chatPartnerIds = new Set(
        (chatRooms || [])
          .map((room) => (room.user1 === user.id ? room.user2 : room.user1))
          .filter(Boolean)
      )

      // only include people that match those existing chat partners
      people = (people || []).filter((p) => chatPartnerIds.has(p.id))
    }


    // enhance: attach last message + unread status
    const enhanced = await Promise.all(
      (people || []).map(async (p) => {
        // find existing room between currentUser & target
        const { data: room } = await supabase
          .from('chat_rooms')
          .select('id')
          .or(`and(user1.eq.${user.id},user2.eq.${p.id}),and(user1.eq.${p.id},user2.eq.${user.id})`)
          .maybeSingle()

        if (!room) {
          return {
            ...p,
            lastMsg: 'No messages yet',
            hasNewMsg: false,
            lastMsgAt: null,
          }
        }

        // fetch latest message
        const { data: msgData } = await supabase
          .from('messages')
          .select('sender_id, content, read_by, created_at')
          .eq('room_id', room.id)
          .order('created_at', { ascending: false })
          .limit(1)

        if (!msgData || msgData.length === 0)
          return {
            ...p,
            lastMsg: 'No messages yet',
            hasNewMsg: false,
            lastMsgAt: null,
          }

        const msg = msgData[0]
        let text = ''
        try {
          text = JSON.parse(msg.content).text || '[Attachment]'
        } catch {
          text = msg.content || '[Attachment]'
        }

        const hasNewMsg =
          msg.sender_id !== user.id &&
          !(msg.read_by || []).includes(user.id)

        return {
          ...p,
          lastMsg: text,
          senderId: msg.sender_id,
          read_by: msg.read_by,
          hasNewMsg,
          lastMsgAt: msg.created_at,
        }
      })
    )

    enhanced.sort((a: any, b: any) => {
      const timeA = a.lastMsgAt ? new Date(a.lastMsgAt).getTime() : 0
      const timeB = b.lastMsgAt ? new Date(b.lastMsgAt).getTime() : 0
      return timeB - timeA
    })

    setTargets(enhanced)
    subscribeToNewMessages(user.id) // keep realtime working
  } catch (err) {
    console.error(err)
  } finally {
    setLoading(false)
  }
}


  // ✅ Safely parse message content (from JSON or plain text)
  function safeParseContent(content: any) {
    try {
      const parsed = JSON.parse(content)
      return parsed
    } catch {
      return { text: content }
    }
  }

  // ✅ Subscribe to new incoming messages realtime
  function subscribeToNewMessages(userId: string) {
  if (msgChannelRef.current) return

  msgChannelRef.current = supabase
    .channel('msg-list-realtime')
    .on(
      'postgres_changes',
      {
        event: '*', // listen to INSERT + UPDATE
        schema: 'public',
        table: 'messages',
      },
      async (payload) => {
        const msg = payload.new as Message
        const { room_id, sender_id, content, read_by } = msg

        // confirm this message belongs to one of user's chats
        const { data: room } = await supabase
          .from('chat_rooms')
          .select('*')
          .eq('id', room_id)
          .single()

        if (!room) return
        if (room.user1 !== userId && room.user2 !== userId) return

        const targetId =
          sender_id === userId
            ? room.user1 === userId
              ? room.user2
              : room.user1
            : sender_id

        const parsed = safeParseContent(content)
        const msgText = parsed.text || '[Attachment]'

        // update chat card live
        setTargets((prev) => {
          const updated = prev.map((t) => {
            if (t.id !== targetId) return t

            return {
              ...t,
              lastMsg: msgText,
              senderId: sender_id,
              read_by,
              hasNewMsg:
                sender_id !== userId && payload.eventType === 'INSERT',
              lastMsgAt: msg.created_at, // 👈 IMPORTANT
            }
          })

          // 🔥 re-sort by latest message time
          return [...updated].sort((a: any, b: any) => {
            const timeA = a.lastMsgAt ? new Date(a.lastMsgAt).getTime() : 0
            const timeB = b.lastMsgAt ? new Date(b.lastMsgAt).getTime() : 0
            return timeB - timeA
          })
        })
      }
    )
    .subscribe()
}


  // ✅ Open chat + clear red dot
  async function openChat(targetId: string) {
    if (!currentUserId) return
    try {
      const { data: existingRoom } = await supabase
        .from('chat_rooms')
        .select('*')
        .or(
          `and(user1.eq.${currentUserId},user2.eq.${targetId}),and(user1.eq.${targetId},user2.eq.${currentUserId})`
        )
        .maybeSingle()

      let roomId = existingRoom?.id
      if (!roomId) {
        const { data: newRoom, error } = await supabase
          .from('chat_rooms')
          .insert([{ user1: currentUserId, user2: targetId }])
          .select()
          .single()
        if (error) throw error
        roomId = newRoom.id
      }

      // clear badge
      setTargets((prev) =>
        prev.map((t) => (t.id === targetId ? { ...t, hasNewMsg: false } : t))
      )

      router.push(`/chat/${roomId}`)
    } catch (err) {
      console.error(err)
      alert('Failed to open chat.')
    }
  }

  // ✅ Display ticks based on read status
  function renderMessagePreview(t: Target) {
    if (!t.lastMsg) return <span
                            className={`
                              ${theme === 'dark' ? 'text-gray-200' : 'text-gray-500' }`
                            }
                          >
                            No messages yet
                          </span>

    const isOwn = t.senderId === currentUserId
    const read_by = t.read_by || []

    let ticks = ''
    if (isOwn) {
      if (read_by.length === 1) ticks = <Check size={21} /> // delivered
      if (read_by.length > 1) ticks = <CheckCheck size={21} /> // read
    }

    return (
      <p
        className={`flex items-center gap-1 truncate w-48
          ${theme === 'dark' ? 'text-gray-200' : 'text-gray-500' }`
        }
      >
        {isOwn && ticks}
        <span className="truncate">{t.lastMsg}</span>
      </p>
    )
  }

  return (
    <div className="p-5 flex flex-col mb-6 gap-4">
      <div>
        <h1 className='text-3xl font-extrabold mb-1'>Live Chat</h1>
        <p className="text-gray-500">
          {currentUserRole === 'user'
            ? 'Directly connect with our dedicated staffs once a staff is assigned to handle with your issue'
            : 'Real-time communication to stay in touch with every users'}
        </p>
      </div>

      <input
        type="text"
        placeholder="Search chats..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full mb-5 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      
      {loading ? (
        <div className="flex items-center text-gray-600 text-m">
          {/* Spinning Loader */}
          <div
            className="w-5 h-5 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"
            aria-label="Loading"
          ></div>

          {/* Text */}
          <span>&nbsp;Loading chats...</span>
        </div>
      ) : targets.length === 0 ? (
        <p className="mt-20 text-gray-500 text-xl text-center">No available staffs to chat with. <span className="text-blue-500 underline cursor-pointer" onClick={() => (window.location.href = '/report/new')}>Place a report</span> to begin a conversation!</p>
      ) : (
        <ul className="space-y-5">
          {targets
            .filter((t) =>
              t.full_name
                ?.toLowerCase()
                .includes(search.toLowerCase())
            )
            .map((t) => (
              <li
                key={t.id}
                onClick={() => openChat(t.id)}
                className={`
                  relative flex items-center justify-between rounded-lg shadow p-3 cursor-pointer transition
                  ${
                    t.hasNewMsg
                      ? theme === 'dark'
                        ? 'bg-green-600 hover:bg-green-500 shadow-green-500 shadow-lg'
                        : 'bg-green-200 hover:bg-green-300 shadow-green-300 shadow-lg'
                      : theme === 'dark'
                        ? 'bg-gray-900 hover:bg-gray-800'
                        : 'bg-white hover:bg-gray-100'
                  }
                `}
              >
                {/* 🔴 Red notification dot */}
                {t.hasNewMsg && (
                  <span className="absolute top-2 left-2 w-5 h-5 bg-red-600 rounded-full"></span>
                )}

                <div className="flex items-center space-x-3">
                  <img
                    src={t.avatar_url || '/default-avatar.png'}
                    alt="Avatar"
                    className="w-15 h-15 rounded-full object-cover"
                  />
                  <div>
                    <p className="font-semibold text-lg">{t.full_name}</p>
                    {renderMessagePreview(t)}
                  </div>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  )
}
