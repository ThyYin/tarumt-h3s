// forgot-password

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleReset(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)

    try {
      // send password reset email
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`, // user lands here after clicking email link
      })

      if (error) throw error
      setSent(true)
    } catch (err: any) {
      console.error('Reset password error:', err)
      alert(err.message || 'Failed to send reset link.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full min-h-screen">
      {/* left section */}
      <div className="flex flex-col justify-center items-center w-2/5 bg-gradient-to-b from-white to-blue-300 p-8">
        <img src="/logo-tarumt.png" alt="TARUMT Logo" className="h-25 mb-4" />
        <h1 className="text-3xl font-extrabold text-center mb-6">
          Health and Safety<br />Support System
        </h1>

        <div className="bg-white p-8 rounded-2xl shadow-md w-full max-w-sm">
          <h2 className="text-xl font-bold mb-2">Forgot Password</h2>
          <p className="text-sm text-gray-500 mb-4">
            Enter your email to retrieve your password
          </p>

          <div className="flex items-center justify-center">
            <div className="border-t border-gray-300 flex-grow" />
          </div>

          <br />

          {!sent ? (
            <form onSubmit={handleReset} className="space-y-4">
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

              <button
                type="submit"
                disabled={loading}
                className="cursor-pointer w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition disabled:opacity-60 mt-4"
              >
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>

              <div className="text-center text-sm text-gray-500">
                <a href="/login" className="text-blue-600 hover:underline">
                  Back to Login
                </a>
              </div>
            </form>
          ) : (
            <div className="space-y-10">
              <p className="text-green-600 font-semibold">
                ✅ Password reset link sent successfully!
              </p>
              <p className="text-m text-gray-500">
                Check your <b>inbox</b> <i>(or spam folder)</i> for the reset email link. 📩
              </p>
              <button
                onClick={() => router.push('/login')}
                className="w-full bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
              >
                Return to Login
              </button>
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

      {/* right section */}
      <div
        className="w-3/5 bg-cover bg-center"
        style={{ backgroundImage: "url('/campus.jpg')" }}
      ></div>
    </div>
  )
}
