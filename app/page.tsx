import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = await createClient()

  // Check if user is already logged in
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  // Auto-login with default account (temporary for development)
  const { error } = await supabase.auth.signInWithPassword({
    email: 'neifert_family@example.com',
    password: 'neifert_family_2024',
  })

  if (!error) {
    redirect('/dashboard')
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-green-50 to-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Family Meal Planner
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Plan your family meals with ease. Manage recipes, track inventory, stay in budget, and shop smart.
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-4">
          <Link
            href="/auth/login"
            className="block w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg text-center transition-colors"
          >
            Sign In
          </Link>
          <Link
            href="/auth/signup"
            className="block w-full bg-white hover:bg-gray-50 text-green-600 font-semibold py-3 px-6 rounded-lg text-center border-2 border-green-600 transition-colors"
          >
            Create Family Account
          </Link>
        </div>

        <div className="mt-16 grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">📅</div>
            <h3 className="text-xl font-semibold mb-2">Weekly Planning</h3>
            <p className="text-gray-600">
              Plan your meals for the week considering seasonality, budget, and what you have on hand.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🥗</div>
            <h3 className="text-xl font-semibold mb-2">Recipe Management</h3>
            <p className="text-gray-600">
              Import recipes from your favorite sites or add your own. Track ratings and when you last made each dish.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🛒</div>
            <h3 className="text-xl font-semibold mb-2">Smart Shopping</h3>
            <p className="text-gray-600">
              Auto-generate grocery lists from your meal plan, organized by category and checked against your inventory.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">📦</div>
            <h3 className="text-xl font-semibold mb-2">Inventory Tracking</h3>
            <p className="text-gray-600">
              Keep track of what's in your pantry and when items expire to reduce waste.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">💰</div>
            <h3 className="text-xl font-semibold mb-2">Budget Aware</h3>
            <p className="text-gray-600">
              Track meal costs and stay within your monthly budget with cost categorization.
            </p>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md">
            <div className="text-3xl mb-3">🌱</div>
            <h3 className="text-xl font-semibold mb-2">Seasonal Guide</h3>
            <p className="text-gray-600">
              Get suggestions for seasonal produce to cook fresh, local ingredients.
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
