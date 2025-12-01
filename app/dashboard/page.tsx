import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Get family data
  const { data: family } = await supabase
    .from('families')
    .select('*')
    .single() as any

  // Get counts for dashboard stats
  const { count: recipeCount } = await supabase
    .from('recipes')
    .select('*', { count: 'exact', head: true })

  const { count: inventoryCount } = await supabase
    .from('inventory_items')
    .select('*', { count: 'exact', head: true })

  const { count: memberCount } = await supabase
    .from('family_members')
    .select('*', { count: 'exact', head: true })

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

  return (
    <div className="space-y-6">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl p-6 md:p-8 text-white shadow-lg">
        <h1 className="text-2xl md:text-3xl font-bold mb-2">
          Welcome back{family ? `, ${family.name}` : ''}!
        </h1>
        <p className="text-blue-100">Here's what's happening with your meal planning</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Link href="/dashboard/recipes" className="group bg-gradient-to-br from-orange-400 to-pink-500 p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 hover:scale-105">
          <div className="text-xl mb-2">📖</div>
          <div className="text-3xl font-bold text-white mb-1">{recipeCount || 0}</div>
          <div className="text-sm font-medium text-white/90">Recipes</div>
        </Link>

        <div className="bg-gradient-to-br from-cyan-400 to-blue-500 p-6 rounded-2xl shadow-md">
          <div className="text-xl mb-2">📦</div>
          <div className="text-3xl font-bold text-white mb-1">{inventoryCount || 0}</div>
          <div className="text-sm font-medium text-white/90">Inventory Items</div>
        </div>

        <div className="bg-gradient-to-br from-purple-400 to-indigo-500 p-6 rounded-2xl shadow-md">
          <div className="text-xl mb-2">👨‍👩‍👧‍👦</div>
          <div className="text-3xl font-bold text-white mb-1">{memberCount || 0}</div>
          <div className="text-sm font-medium text-white/90">Family Members</div>
        </div>

        <div className="bg-gradient-to-br from-emerald-400 to-teal-500 p-6 rounded-2xl shadow-md">
          <div className="text-xl mb-2">💰</div>
          <div className="text-3xl font-bold text-white mb-1">
            {family?.monthly_budget ? `$${family.monthly_budget}` : '-'}
          </div>
          <div className="text-sm font-medium text-white/90">Monthly Budget</div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Upcoming Meals */}
        <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">🍽️</span>
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
            <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <span className="text-xl">⏰</span>
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

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-2xl shadow-md border border-gray-100">
        <h2 className="text-2xl font-bold text-gray-900 mb-5 flex items-center gap-2">
          <span className="text-xl">⚡</span>
          Quick Actions
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/dashboard/recipes"
            className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-orange-400 to-pink-500 hover:from-orange-500 hover:to-pink-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
          >
            <span className="text-xl mb-2 group-hover:scale-110 transition-transform">📖</span>
            <span className="text-sm font-semibold text-white">Manage Recipes</span>
          </Link>

          <Link
            href="/dashboard/recipes/import"
            className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-emerald-400 to-teal-500 hover:from-emerald-500 hover:to-teal-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
          >
            <span className="text-xl mb-2 group-hover:scale-110 transition-transform">➕</span>
            <span className="text-sm font-semibold text-white">Import Recipe</span>
          </Link>

          <Link
            href="/dashboard/calendar"
            className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-cyan-400 to-blue-500 hover:from-cyan-500 hover:to-blue-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
          >
            <span className="text-xl mb-2 group-hover:scale-110 transition-transform">📅</span>
            <span className="text-sm font-semibold text-white">Plan Week</span>
          </Link>

          <Link
            href="/dashboard/inventory"
            className="group flex flex-col items-center justify-center p-5 bg-gradient-to-br from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 rounded-2xl transition-all duration-200 shadow-md hover:shadow-lg hover:scale-105"
          >
            <span className="text-xl mb-2 group-hover:scale-110 transition-transform">📦</span>
            <span className="text-sm font-semibold text-white">Add Inventory</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
