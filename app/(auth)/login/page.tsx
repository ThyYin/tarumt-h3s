// login

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Eye, EyeOff } from 'lucide-react'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      const user = data.user

      const { data: profile } = await supabase
        .from('profiles')
        .select('active, role')
        .eq('id', user.id)
        .single()

      if (!profile?.active) {
        await supabase.auth.signOut()
        alert('Your account has been deactivated.')
        return
      }

      // router.push(profile.role === 'admin' ? '/admin/dashboard' : profile.role === 'staff' ? 'staff/dashboard' : '/report/list')
      router.push('/')

    } catch (err: any) {
      alert(err.message || 'Login failed.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* left half - login card */}
      <div className="flex flex-col justify-center items-center w-2/5 bg-gradient-to-b from-white to-blue-300 p-8">
        <img src="/logo-tarumt.png" alt="TARUMT Logo" className="h-25 mb-4" />
        <h1 className="text-3xl font-extrabold text-center mb-6">
          Health and Safety<br></br>Support System
        </h1>

        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
          <h2 className="text-xl font-bold mb-2">
            Welcome back!
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Please enter your information
          </p>

          <div className="flex items-center justify-center">
            <div className="border-t border-gray-300 flex-grow" />
          </div>

          <br />

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-m font-medium mb-2 block">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border rounded-lg px-3 py-2"
                required
              />
            </div>

            <div className="relative">
              <label className="text-m font-medium mb-2 block">Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="cursor-pointer absolute right-3 top-11 text-gray-500 hover:black"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
              <br></br>
              <a href="/forgot-password" className="text-xs text-blue-600 float-right mt-2">
                <b>Forgot password?</b>
              </a>
              <br></br>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="cursor-pointer mt-3 mb-2 w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-500 transition disabled:opacity-60"
            >
              {loading ? 'Logging in...' : 'Login'}
            </button>

          </form>
        </div>
        <br />

        <div className="text-center text-sm [&>a]:text-blue-600 [&>a]:underline">
          <a href="http://www.tarc.edu.my/disclaimer.jsp" target="_blank">Disclaimer</a> |{' '}
          <a href="http://www.tarc.edu.my/privacy-policy.jsp" target="_blank">Privacy Policy</a> |{' '}
          <a href="https://www.tarc.edu.my/files/tarc/TARUMT_ABAC_Policy.pdf" target="_blank">ABAC Policy</a>
          <br /><br />
          <b>COPYRIGHT © 2025 TAR UMT. ALL RIGHTS RESERVED</b>
        </div>
      </div>

      {/* right half - image */}
      <div
        className="w-3/5 bg-cover bg-center"
        style={{ backgroundImage: "url('/campus.jpg')" }}
      ></div>
    </div>
  )
}
