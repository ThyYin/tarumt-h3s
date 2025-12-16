// chat/[id]/page.tsx

'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from 'next-themes'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import toast, { Toaster } from 'react-hot-toast'
import { SendHorizontal, Paperclip, ChevronLeft } from 'lucide-react'

type LinkedReport = {
  id: string
  type: 'report' | 'lostfound'
  category: string
  description: string
  images: { image_url: string }[]
}

type Message = {
  id: string
  room_id: string
  sender_id: string | null   // ⬅ FIX
  content: string
  read_by: string[] | null
  created_at: string
}

type ChatRoom = {
  id: string
  metadata?: { report_id?: string }
}

export default function ChatRoomPage() {
  const { theme } = useTheme()
  const [mounted, setMounted] = useState(false)

  const supabase = createClient()
  const router = useRouter()
  const { id: roomId } = useParams()

  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [typing, setTyping] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [zoomMedia, setZoomMedia] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  // 🔗 linked report state
  const [linkedReport, setLinkedReport] = useState<LinkedReport | null>(null)

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const typingTimeout = useRef<any>(null)
  const msgChannelRef = useRef<any>(null)
  const typingChannelRef = useRef<any>(null)
  const mountedRef = useRef(true)

  const [roomMetadata, setRoomMetadata] = useState<any>(null)
  const [contextSent, setContextSent] = useState(false)

  const searchParams = new URLSearchParams(window.location.search);
  const shouldAttach = searchParams.get("attach") === "1";

  const [targetProfile, setTargetProfile] = useState<Profile | null>(null)

  type Profile = {
    id: string
    full_name: string
    avatar_url: string | null
    email?: string | null
  }

  useEffect(() => {
    mountedRef.current = true
    init()
    setMounted(true)
    return () => {
      mountedRef.current = false
      cleanupRealtime()
      if (filePreview) URL.revokeObjectURL(filePreview)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

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
      if (!mountedRef.current) return
      setCurrentUserId(user.id)

      await loadRoomMetadata(user.id)
      await loadMessages()
      subscribeToRealtime(user.id)
    } catch (err) {
      console.error('init error', err)
    } finally {
      setLoading(false)
    }
  }

  // 🔍 Load report metadata if linked
  async function loadRoomMetadata(userId: string) {

    const emailRes = await fetch('/api/admin/list-user-emails')
    const emailMap: Record<string, string> = await emailRes.json()

    try {
      const { data: room } = await supabase
        .from('chat_rooms')
        .select('user1, user2, metadata')
        .eq('id', roomId)
        .single()

      if (room) {
        const targetId =
          room.user1 === userId ? room.user2 : room.user1

        const { data: target } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .eq('id', targetId)
          .single()

        if (target) {
          setTargetProfile({
            ...target,
            email: emailMap[targetId] || null,
          })
        }
      }

      if (!room) return

      setRoomMetadata(room.metadata || {})
      setContextSent(room.metadata?.report_context_sent || false)

      const reportId = room?.metadata?.report_id
      if (!reportId) return

      // Try general reports
      const { data: rep } = await supabase
        .from('reports')
        .select('id, category, description, images:report_images(image_url)')
        .eq('id', reportId)
        .single()

      if (rep) {
        setLinkedReport({
          id: rep.id,
          type: 'report',
          category: rep.category,
          description: rep.description,
          images: rep.images
        })
        return
      }

      // Try lost & found
      const { data: lf } = await supabase
        .from('lost_found')
        .select('id, item_name, description, images:lost_found_images(media_url)')
        .eq('id', reportId)
        .single()

      if (lf) {
        setLinkedReport({
          id: lf.id,
          type: 'lostfound',
          category: 'Lost & Found',
          description: lf.description,
          images: lf.images?.length > 0
            ? [ { image_url: lf.images[0].media_url } ]
            : []
        })
      }

    } catch (err) {
      console.error("Error loading report metadata:", err)
    }
  }


  async function loadMessages() {
    try {
      const { data, error } = await supabase
      .from('messages')
      .select('id, room_id, sender_id, content, read_by, created_at')
      .eq('room_id', roomId)
      .order('created_at', { ascending: true })

      if (error) {
        console.error('loadMessages error', error)
        return
      }
      setMessages((data as Message[]) || [])
      scrollToBottom()
    } catch (err) {
      console.error('loadMessages thrown', err)
    }
  }

  function scrollToBottom() {
    setTimeout(() => {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 80)
  }

  function subscribeToRealtime(userId: string) {
    if (msgChannelRef.current) return

    const msgChannel = supabase
      .channel(`room-${roomId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `room_id=eq.${roomId}`,
        },
        (payload: any) => {
          const evt = payload.eventType ?? payload.type ?? payload.event
          const incoming = payload.new as Message

          if (evt === 'INSERT') {
            setMessages((prev) => {
              if (prev.some((m) => m.id === incoming.id)) return prev
              return [...prev, incoming]
            })
            scrollToBottom()
          } else if (evt === 'UPDATE') {
            const updated = incoming
            setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
          }
        }
      )
      .subscribe()

    const typingChannel = supabase
      .channel(`typing-${roomId}`)
      .on('broadcast', { event: 'typing' }, (payload: any) => {
        const sender = payload?.payload?.sender_id
        if (sender && sender !== userId) {
          setTyping(true)
          clearTimeout(typingTimeout.current)
          typingTimeout.current = setTimeout(() => setTyping(false), 1500)
        }
      })
      .subscribe()

    msgChannelRef.current = msgChannel
    typingChannelRef.current = typingChannel
  }

  function cleanupRealtime() {
    try {
      if (msgChannelRef.current) {
        supabase.removeChannel(msgChannelRef.current)
        msgChannelRef.current = null
      }
      if (typingChannelRef.current) {
        supabase.removeChannel(typingChannelRef.current)
        typingChannelRef.current = null
      }
    } catch (e) {
      console.warn('cleanupRealtime failed', e)
    }
  }

  useEffect(() => {
    if (!currentUserId) return
    markAsRead()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages])

  async function markAsRead() {
    if (!currentUserId) return
    const unread = messages.filter(
      (m) => m.sender_id !== currentUserId && !(m.read_by ?? []).includes(currentUserId)
    )
    if (unread.length === 0) return

    try {
      const ids = unread.map((m) => m.id)
      await Promise.all(
        ids.map((id) =>
          supabase.rpc('mark_message_read', { msg_id: id, uid: currentUserId })
        )
      )
    } catch (err) {
      console.error('markAsRead failed', err)
    }
  }

  async function handleTyping() {
    if (!currentUserId) return
    try {
      await supabase.channel(`typing-${roomId}`).send({
        type: 'broadcast',
        event: 'typing',
        payload: { sender_id: currentUserId },
      })
    } catch {
      // ignore
    }
  }

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!newMessage.trim() && !file) return;
    if (!currentUserId) {
      toast.error("Not authenticated");
      return;
    }

    try {
      const text = newMessage.trim();
      let fileUrl: string | null = null;

      if (file) {
        const fileName = `${currentUserId}-${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from("chat_uploads")
          .upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data } = supabase.storage
          .from("chat_uploads")
          .getPublicUrl(fileName);
        fileUrl = data.publicUrl;
      }

      const contentObj: Record<string, string> = {};
      if (text) contentObj.text = text;
      if (fileUrl) contentObj.media = fileUrl;
      const finalContent = JSON.stringify(contentObj);

      // CARD, before normal message
      if (linkedReport && shouldAttach) {

        const { data: sysData, error: sysErr } = await supabase
          .from("messages")
          .insert({
            room_id: roomId,
            sender_id: currentUserId,
            content: JSON.stringify({
              system: true,
              report: {
                id: linkedReport.id,
                type: linkedReport.type,
                category: linkedReport.category,
                description: linkedReport.description,
                image: linkedReport.images?.[0]?.image_url || null,
              },
            }),
            read_by: [],
          })
          .select("*");

        console.log("SYSTEM MSG INSERT:", sysData, sysErr);

        setLinkedReport(null);
      }

      // Send normal message
      const { error } = await supabase.from("messages").insert([
        {
          room_id: roomId,
          sender_id: currentUserId,
          content: finalContent,
          read_by: [currentUserId]
        }
      ]);

      if (error) throw error;

      setNewMessage("");
      if (filePreview) {
        URL.revokeObjectURL(filePreview);
        setFilePreview(null);
      }
      setFile(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }

      scrollToBottom();
    } catch (err: any) {
      console.error("sendMessage failed", err);
      toast.error(err.message || "Failed to send message");
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    if (!selected) {
      if (filePreview) URL.revokeObjectURL(filePreview)
      setFile(null)
      setFilePreview(null)
      return
    }
    setFile(selected)
    const preview = URL.createObjectURL(selected)
    setFilePreview(preview)
  }
  function removeSelectedFile() {
    if (filePreview) URL.revokeObjectURL(filePreview)

    setFile(null)
    setFilePreview(null)

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function isImage(url: string) {
    return /\.(jpe?g|png|gif|webp)$/i.test(url)
  }
  function isVideo(url: string) {
    return /\.(mp4|mov|webm)$/i.test(url)
  }
  function formatTime(ts: string) {
    const date = new Date(ts)
    let hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours >= 12 ? 'PM' : 'AM'
    hours = hours % 12 || 12
    return `${hours}:${minutes} ${ampm}`
  }
  function getStatus(m: Message) {
    if (!currentUserId) return ''
    if (m.sender_id !== currentUserId) return ''
    const readArr = m.read_by ?? []
    if (readArr.length === 0) return 'Sending...'
    if (readArr.length === 1) return 'Delivered'
    return 'Read'
  }

  function formatChatDate(ts: string) {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(Date.now() - 86400000);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

    return date.toLocaleDateString("en-GB", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  return (
    <div className="flex flex-col mx-auto p-4 h-[80vh]">
      <Toaster position="bottom-right" />

      <div className="flex items-center gap-4 mb-4 sticky top-0 z-30 pb-2">
        {/* Back button */}
        <button
          onClick={() => router.push('/chat')}
          className={`p-2 cursor-pointer rounded-full transition
            ${theme === 'dark' ? 'hover:bg-gray-800' : 'hover:bg-gray-200' }`
          }
        >
          <ChevronLeft size={40} />
        </button>

        {/* Avatar */}
        {targetProfile && (
          <img
            src={targetProfile.avatar_url || '/default-avatar.png'}
            alt="Avatar"
            className="w-17 h-17 rounded-full object-cover"
          />
        )}

        {/* Name + role */}
        <div>
          <p className="font-bold text-xl">
            {targetProfile?.full_name || 'Loading...'}
          </p>
          <p
            className={`text-sm
              ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500' }`
            }
          >
            {targetProfile?.email}
          </p>
        </div>
      </div>

      {/* 🔗 Linked Report Banner */}
      {linkedReport && shouldAttach && !contextSent && (
        <div
          className={` border  px-4 py-3 rounded-lg mb-4 shadow flex gap-4
              ${theme === 'dark' ? 'bg-orange-300 border-orange-500' : 'bg-orange-200 border-orange-300'}`
            }
        >
          {/* Thumbnail */}
          {linkedReport.images?.[0] && (
            <img
              src={linkedReport.images[0].image_url}
              className="w-16 h-16 rounded-md object-cover"
            />
          )}

          {/* Info */}
          <div className="flex-1">
            <p className="font-bold text-orange-700">
              {linkedReport.category}
            </p>
            <p className="text-sm text-gray-700 truncate">
              {linkedReport.description}
            </p>
            <p className="text-sm text-red-500 truncate italic font-semibold">
              You are inquiring about this report
            </p>
          </div>
        </div>
      )}

      <div
        className={`flex-1 overflow-y-auto rounded-lg shadow p-4
          ${theme === 'dark' ? 'bg-gray-900' : '' }`
        }
      >
        {loading ? (
          <p>Loading chat...</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-gray-500">No messages yet — send the first one.</p>
        ) : (
          (() => {
            // 🔥 Group messages by date
            const groups: Record<string, Message[]> = {};

            messages.forEach(msg => {
              const dateKey = new Date(msg.created_at).toDateString();
              if (!groups[dateKey]) groups[dateKey] = [];
              groups[dateKey].push(msg);
            });

            const dateKeys = Object.keys(groups);

            return dateKeys.map(dateKey => {
              const dayMessages = groups[dateKey];

              return (
                <div key={dateKey}>
                  
                  {/* 🔥 STICKY DATE HEADER */}
                  <div className="sticky top-0 z-20 flex justify-center my-2 pointer-events-none">
                    <span className="bg-black text-white px-4 py-1 rounded-full text-sm opacity-80 shadow backdrop-blur-sm">
                      {formatChatDate(dayMessages[0].created_at)}
                    </span>
                  </div>

                  {/* 🔥 RENDER ALL MESSAGES FOR THIS DATE */}
                  {dayMessages.map(msg => {
                    let parsed: any = { text: "", media: "" };

                    try {
                      parsed = JSON.parse(msg.content);
                    } catch {
                      parsed = { text: String(msg.content), media: "" };
                    }

                    const text = parsed.text || "";
                    const media = parsed.media || "";
                    const isOwn = msg.sender_id === currentUserId;

                    // SYSTEM REPORT CARD MESSAGE
                    if (parsed.system && parsed.report) {
                      const r = parsed.report;
                      return (
                        <div key={msg.id} className="my-4 flex justify-center">
                          <div
                          className={`border px-4 py-4 rounded-lg shadow max-w-lg flex gap-6
                            ${theme === 'dark' ? 'bg-orange-300 border-orange-600' : 'bg-orange-200 border-orange-300' }`
                          }
                        >
                            {r.image && (
                              <img
                                src={r.image}
                                className="w-12 h-12 object-cover rounded-md"
                              />
                            )}
                            <div>
                              <p className="font-bold text-orange-700">{r.category}</p>
                              <p className="text-sm text-gray-700">{r.description}</p>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    // NORMAL USER MESSAGE
                    return (
                      <div
                        key={msg.id}
                        className={`my-3 flex flex-col ${
                          isOwn ? "items-end" : "items-start"
                        }`}
                      >
                        <div
                          className={`px-4 py-2 rounded-lg max-w-[70%] ${
                            isOwn
                              ? "bg-green-600 text-white"
                              : "bg-gray-500 text-white"
                          }`}
                        >
                          <div className="space-y-2">
                            {media && isImage(media) && (
                              <img
                                src={media}
                                className="rounded-lg max-w-[200px] cursor-pointer"
                                onClick={() => setZoomMedia(media)}
                              />
                            )}
                            {media && isVideo(media) && (
                              <video
                                src={media}
                                controls
                                className="rounded-lg max-w-[250px] cursor-pointer"
                              />
                            )}
                            {text && <p>{text}</p>}
                          </div>
                        </div>

                        <div
                          className={`text-xs underline mt-1 
                            ${
                              isOwn 
                                ? theme === 'dark'
                                  ? 'text-right text-gray-300' 
                                  : 'text-right text-gray-500'
                                : theme === 'dark'
                                  ? 'text-left text-gray-300'
                                  : 'text-left text-gray-500'
                            }
                          `}
                        >
                          {formatTime(msg.created_at)}

                          {isOwn && (
                            <>
                              {" · "}
                             <span
                              className={
                                getStatus(msg) === 'Read'
                                  ? theme === 'dark'
                                    ? 'text-blue-400 font-semibold'
                                    : 'text-blue-600 font-semibold'
                                  : getStatus(msg) === 'Sending...'
                                    ? 'italic text-gray-500'
                                    : 'text-gray-500'
                              }
                            >
                                {getStatus(msg)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}

                </div>
              );
            });
          })()
        )}
        
        <div ref={scrollRef} />
      </div>

      {typing && <p className="text-sm text-gray-400 mt-1">User is typing...</p>}

      {filePreview && (
        <div
          className={`flex items-center space-x-3 mt-3 p-2 rounded-lg
            ${theme === 'dark' ? 'bg-gray-900' : 'bg-gray-100'}`
          }
        >
          {file && file.type.startsWith('image') ? (
            <img src={filePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
          ) : file && file.type.startsWith('video') ? (
            <video src={filePreview} className="w-24 h-20 rounded-lg" controls />
          ) : null}
          <button onClick={removeSelectedFile} className="cursor-pointer text-red-600 font-bold text-xl hover:text-red-800">✕</button>
        </div>
      )}

      <form onSubmit={sendMessage} className="flex items-center mt-5 space-x-4">
        <label htmlFor="file-input" className="cursor-pointer text-white bg-green-600 px-5 py-3 rounded-lg hover:bg-green-500 transition">
          <Paperclip size={28} />
        </label>
        <input
          ref={fileInputRef}
          id="file-input"
          type="file"
          className="hidden"
          accept="image/*,video/*"
          onChange={handleFileSelect}
        />
        <input
          type="text"
          value={newMessage}
          onChange={(e) => {
            setNewMessage(e.target.value)
            handleTyping()
          }}
          placeholder="Type a message..."
          className="flex-1 border-2 border-green-600 text-green-600 rounded-lg px-5 py-3 
                     focus:border-green-600 focus:outline-none"
        />
        <button type="submit" className="cursor-pointer bg-green-600 text-white px-5 py-3 rounded-lg hover:bg-green-500">
          <SendHorizontal size={28} />
        </button>
      </form>

      {zoomMedia && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setZoomMedia(null)}>
          <div className="relative">
            {isImage(zoomMedia) ? (
              <img src={zoomMedia} alt="Zoomed" className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-lg" />
            ) : (
              <video src={zoomMedia} controls autoPlay className="max-h-[80vh] max-w-[90vw] rounded-lg shadow-lg" />
            )}
          </div>
        </div>
      )}
    </div>
  )
}
