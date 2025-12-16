'use client'

import '@/app/globals.css'
import { usePathname } from 'next/navigation'
import { Sidebar } from '@/components/Sidebar'
import { Header } from '@/components/Header'
import { ThemeProvider } from 'next-themes'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  const noLayoutRoutes = [
    '/'
  ]

  const hideLayout = noLayoutRoutes.includes(pathname)

  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-gray-100 dark:bg-gray-900 transition-colours duration-300">
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
          {hideLayout ? (
            // directly render the page (no header/sidebar)
            <main className="min-h-screen">{children}</main>
          ) : (
            // 🧠 standard layout for all other pages
            <div className="flex flex-col h-screen">
              {/* header always on top */}
              <Header />

              {/* sidebar below the header */}
              <div className="flex flex-1 overflow-hidden">
                <Sidebar />

                <main className="flex-1 p-6 overflow-y-auto">
                  {children}
                </main>
              </div>
            </div>
          )}
        </ThemeProvider>
      </body>
    </html>
  )
}
