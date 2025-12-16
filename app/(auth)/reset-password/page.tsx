// reset-password

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { Eye, EyeOff } from 'lucide-react'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [sessionValid, setSessionValid] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  // ✅ Check for a valid reset session (Supabase automatically sets one when coming from email)
  useEffect(() => {
    async function checkSession() {
      const { data } = await supabase.auth.getSession()
      if (data.session) {
        setSessionValid(true)
      }
    }
    checkSession()
  }, [supabase])

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()

    if (password.length < 6) {
      alert('Password must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      alert('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) throw error

      alert('✅ Password updated successfully! Please log in again.')
      router.push('/login')
    } catch (err: any) {
      console.error('Password reset error:', err)
      alert(err.message || 'Failed to reset password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* left side - reset form */}
      <div className="flex flex-col justify-center items-center w-2/5 bg-gradient-to-b from-white to-blue-300 p-8">
        <img src="/logo-tarumt.png" alt="TARUMT Logo" className="h-25 mb-4" />
        <h1 className="text-3xl font-extrabold text-center mb-6">
          Health and Safety<br />Support System
        </h1>

        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
          <h2 className="text-xl font-bold mb-2">Reset Your Password</h2>

          <div className="flex items-center justify-center">
            <div className="border-t border-gray-300 flex-grow" />
          </div>

          <br />

          {sessionValid ? (
            <form onSubmit={handleReset} className="space-y-4">

              <div className="relative">
                <label className="text-m font-medium mb-2 block">New Password</label>
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
                  className="absolute right-3 top-11 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <div className="relative">
                <label className="text-m font-medium mb-2 block">Confirm Password</label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-11 text-gray-500 hover:text-gray-700"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60 mt-4"
              >
                {loading ? 'Updating...' : 'Update Password'}
              </button>

              <div className="text-center text-sm text-gray-500">
                <a href="/login" className="text-blue-600 hover:underline">
                  Cancel Password Reset
                </a>
              </div>
            </form>
          ) : (
            <div className="text-center text-gray-500 py-10">
              <p className="mb-4">Verifying your reset link...</p>
              <p>If this page doesn’t load correctly, try reopening the email link.</p>
            </div>
          )}
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

      {/* right side - image */}
      <div
        className="w-3/5 bg-cover bg-center"
        style={{ backgroundImage: "url('/campus.jpg')" }}
      ></div>
    </div>
  )
}
