'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function HomeRedirect() {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    async function redirectUser() {
      try {
        // get current logged-in user
        const {
          data: { user },
        } = await supabase.auth.getUser()

        // if not logged in, go to login page
        if (!user) {
          router.replace('/login')
          return
        }

        // get user profile (to fetch role)
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single()

        if (error || !profile) {
          console.error('Profile not found:', error)
          router.replace('/login')
          return
        }

        // redirect based on role
        if (profile.role === 'admin') {
          router.replace('/admin/dashboard')
        } else if (profile.role === 'staff') {
          router.replace('/staff/dashboard')
        } else {
          router.replace('/report/list')
        }
      } catch (err) {
        console.error('Error checking role:', err)
        router.replace('/login')
      }
    }

    redirectUser()
  }, [router, supabase])

  // loading screen while redirecting
  return (
  // <div className="flex items-center justify-center min-h-screen text-gray-600 text-3xl gap-4">
  //   {/* Spinning Loader */}
  //   <div
  //     className="w-10 h-10 border- 4 border-gray-400 border-t-blue-600 rounded-full animate-spin"
  //     aria-label="Loading"
  //   ></div>

  //   {/* Text */}
  //   &nbsp;<p>Redirecting...</p>
  // </div>

  <div className="flex items-center justify-center min-h-screen text-gray-600 text-3xl gap-4">
    {/* Spinning Loader */}
    <div
      className="w-10 h-10 border-4 border-gray-400 border-t-blue-600 rounded-full animate-spin mr-2"
      aria-label="Loading"
    ></div>

    {/* Text */}
    <span>&nbsp;Redirecting...</span>
  </div>
)
}
