import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function GET() {
  const { data, error } = await admin.auth.admin.listUsers()
  if (error) return NextResponse.json({}, { status: 500 })

  const map: Record<string, string> = {}
  data.users.forEach(u => map[u.id] = u.email || '')

  return NextResponse.json(map)
}
