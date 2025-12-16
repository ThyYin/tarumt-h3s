import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { email, password, full_name, role = 'user' } = body

    const { data: createData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })
    if (createError) throw createError

    const newUserId = createData.user?.id
    if (!newUserId) throw new Error('No user id returned.')

    // Upsert profile
    const { error: upsertError } = await supabaseAdmin
      .from('profiles')
      .upsert(
        [
          {
            id: newUserId,
            full_name: full_name ?? null,
            role,
            avatar_url: null,
            active: true,
          },
        ],
        { onConflict: 'id' }
      )
    if (upsertError) throw upsertError

    return NextResponse.json({ success: true, id: newUserId }, { status: 201 })
  } catch (err: any) {
    console.error('Add user route error:', err)
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 400 })
  }
}
