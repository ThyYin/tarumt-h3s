// lib/openChat.ts

import { createClient } from '@/lib/supabase-browser'

export async function openChatWithUser(
  currentUserId: string,
  targetUserId: string,
  reportId?: string
): Promise<string | null> {
  const supabase = createClient()

  try {
    // 🔍 Check for existing chat room
    const { data: existingRoom, error: existingError } = await supabase
      .from('chat_rooms')
      .select('id, metadata')
      .or(
        `and(user1.eq.${currentUserId},user2.eq.${targetUserId}),and(user1.eq.${targetUserId},user2.eq.${currentUserId})`
      )
      .maybeSingle()

    if (existingError) throw existingError

    if (existingRoom) {
      if (reportId) {
        await supabase
          .from('chat_rooms')
          .update({
            metadata: { ...(existingRoom.metadata || {}), report_id: reportId, report_context_sent: false },
          })
          .eq('id', existingRoom.id)
      }
      return existingRoom.id
    }

    // 🆕 Create new room if not exist
    const { data: newRoom, error: newError } = await supabase
      .from('chat_rooms')
      .insert([
        {
          user1: currentUserId,
          user2: targetUserId,
          metadata: reportId
            ? { report_id: reportId, report_context_sent: false }
            : {},
        },
      ])
      .select('id')
      .single()

    if (newError) throw newError

    return newRoom.id
  } catch (err) {
    console.error('openChatWithUser error:', err)
    return null
  }
}