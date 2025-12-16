import '../globals.css'

export const metadata = {
  title: 'TARUMT Health & Safety - Auth',
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-r from-white to-blue-100">
        {children}
      </body>
    </html>
  )
}
