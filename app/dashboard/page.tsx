import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import BudgetTracker from '@/components/BudgetTracker'
import SeasonalProduceDialog from '@/components/SeasonalProduceDialog'
import RecentActivity from '@/components/RecentActivity'
import MealConfirmationNotification from '@/components/MealConfirmationNotification'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get family data
  const { data: family } = await supabase
    .from('families')
    .select('*')
    .limit(1)
    .maybeSingle() as any

  // Get upcoming meal plans
  const { data: upcomingMeals } = await supabase
    .from('meal_plans')
    .select(`
      *,
      recipes (
        id,
        name,
        complexity,
        cost_bucket
      )
    `)
    .gte('planned_date', new Date().toISOString().split('T')[0])
    .order('planned_date', { ascending: true })
    .limit(7)

  // Get items expiring soon
  const sevenDaysFromNow = new Date()
  sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7)

  const { data: expiringSoon } = await supabase
    .from('inventory_items')
    .select('*')
    .lte('expiration_date', sevenDaysFromNow.toISOString().split('T')[0])
    .order('expiration_date', { ascending: true })
    .limit(5)

  // Get yesterday's meals for confirmation notification
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yesterdayDate = yesterday.toISOString().split('T')[0]

  const { data: yesterdayMeals } = await supabase
    .from('meal_plans')
    .select(`
      *,
      recipes (
        id,
        name
      )
    `)
    .eq('planned_date', yesterdayDate)
    .order('meal_type', { ascending: true })

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl p-6 md:p-8 text-white shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Welcome back{family ? `, ${family.name}` : ''}!
        </h1>
        <p className="text-blue-100">Here's what's happening with your meal planning</p>
      </div>

      {/* Meal Confirmation Notification */}
      {yesterdayMeals && yesterdayMeals.length > 0 && family?.id && (
        <MealConfirmationNotification
          yesterdayMeals={yesterdayMeals as any}
          familyId={family.id}
        />
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Link
          href="/dashboard/shopping"
          className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
        >
          <svg className="w-6 h-6 text-white mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span className="text-sm font-semibold text-white text-center">Shopping List</span>
        </Link>

        <Link
          href="/dashboard/calendar"
          className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
        >
          <svg className="w-6 h-6 text-white mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-sm font-semibold text-white text-center">Plan Week</span>
        </Link>

        <Link
          href="/dashboard/receipts"
          className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
        >
          <svg className="w-6 h-6 text-white mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span className="text-sm font-semibold text-white text-center">Scan a Receipt</span>
        </Link>

        <Link
          href="/dashboard/inventory"
          className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
        >
          <svg className="w-6 h-6 text-white mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
          <span className="text-sm font-semibold text-white text-center">Inventory</span>
        </Link>

        <Link
          href="/dashboard/recipes"
          className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
        >
          <svg className="w-6 h-6 text-white mb-2 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          <span className="text-sm font-semibold text-white text-center">Recipes</span>
        </Link>

        <SeasonalProduceDialog />
      </div>

      {/* Budget Tracker */}
      <BudgetTracker familyId={family?.id || null} />

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Meals */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              This Week's Meals
            </h2>
            <Link
              href="/dashboard/calendar"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              View Calendar →
            </Link>
          </div>

          {upcomingMeals && upcomingMeals.length > 0 ? (
            <div className="space-y-3">
              {upcomingMeals.map((meal: any) => (
                <div
                  key={meal.id}
                  className="flex items-center justify-between p-4 bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg hover:shadow-sm transition-shadow"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {meal.recipes?.name || 'Unknown Recipe'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(meal.planned_date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {meal.recipes?.complexity === 'quick' && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                        Quick
                      </span>
                    )}
                    {meal.recipes?.cost_bucket && (
                      <span
                        className={`text-xs px-2 py-1 rounded ${
                          meal.recipes.cost_bucket === 'budget'
                            ? 'bg-green-100 text-green-700'
                            : meal.recipes.cost_bucket === 'moderate'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {meal.recipes.cost_bucket}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No meals planned yet</p>
              <Link
                href="/dashboard/calendar"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Plan Your Week
              </Link>
            </div>
          )}
        </div>

        {/* Expiring Soon */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Expiring Soon
            </h2>
            <Link
              href="/dashboard/inventory"
              className="text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
            >
              Manage Inventory →
            </Link>
          </div>

          {expiringSoon && expiringSoon.length > 0 ? (
            <div className="space-y-3">
              {expiringSoon.map((item: any) => {
                const daysUntilExpiration = Math.ceil(
                  (new Date(item.expiration_date).getTime() - new Date().getTime()) /
                    (1000 * 60 * 60 * 24)
                )
                const isUrgent = daysUntilExpiration <= 3

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      isUrgent ? 'bg-red-50' : 'bg-yellow-50'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-gray-900">{item.name}</div>
                      <div className="text-sm text-gray-600 capitalize">{item.category}</div>
                    </div>
                    <div
                      className={`text-sm font-medium ${
                        isUrgent ? 'text-red-600' : 'text-yellow-600'
                      }`}
                    >
                      {daysUntilExpiration === 0
                        ? 'Today'
                        : daysUntilExpiration === 1
                        ? 'Tomorrow'
                        : `${daysUntilExpiration} days`}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <p className="mb-4">No items expiring soon</p>
              <Link
                href="/dashboard/inventory"
                className="inline-block bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Add Inventory
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Recent Activity */}
      <RecentActivity />
    </div>
  )
}
