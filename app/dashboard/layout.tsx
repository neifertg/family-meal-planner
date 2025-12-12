import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/Sidebar'
import MobileBottomNav from '@/components/MobileBottomNav'

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/* Main Content Area */}
      <div className="lg:pl-64">
        <main className="min-h-screen pb-20 lg:pb-0">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 lg:py-6">
            {children}
          </div>
        </main>
      </div>
      {/* Mobile Bottom Navigation */}
      <MobileBottomNav />
    </div>
  )
}
