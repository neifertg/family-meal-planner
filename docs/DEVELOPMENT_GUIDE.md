# Development Guide

This guide provides code examples and patterns for implementing the remaining features.

## Working with Supabase

### Server Components (Recommended for data fetching)

```typescript
import { createClient } from '@/lib/supabase/server'

export default async function RecipesPage() {
  const supabase = await createClient()

  // Fetch data
  const { data: recipes, error } = await supabase
    .from('recipes')
    .select('*')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching recipes:', error)
  }

  return <div>{/* Render recipes */}</div>
}
```

### Client Components (For interactive features)

```typescript
'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function RecipeForm() {
  const [recipes, setRecipes] = useState([])
  const supabase = createClient()

  useEffect(() => {
    async function fetchRecipes() {
      const { data } = await supabase.from('recipes').select('*')
      setRecipes(data || [])
    }
    fetchRecipes()
  }, [])

  async function addRecipe(recipe) {
    const { data, error } = await supabase
      .from('recipes')
      .insert(recipe)
      .select()
      .single()

    if (!error) {
      setRecipes([...recipes, data])
    }
  }

  return <div>{/* Form UI */}</div>
}
```

## Common Patterns

### Getting Current Family ID

```typescript
const supabase = await createClient()

// Get the authenticated user
const { data: { user } } = await supabase.auth.getUser()

// Get the family for this user
const { data: family } = await supabase
  .from('families')
  .select('id')
  .single()

const familyId = family?.id
```

### Inserting with Relationship

```typescript
// Insert a recipe for the current family
const { data: recipe, error } = await supabase
  .from('recipes')
  .insert({
    family_id: familyId,
    name: 'Spaghetti Carbonara',
    ingredients: [
      { name: 'pasta', quantity: '1 lb' },
      { name: 'eggs', quantity: '4' },
    ],
    instructions: ['Boil pasta', 'Mix eggs'],
    servings: 4,
    complexity: 'quick',
  })
  .select()
  .single()
```

### Filtering and Joins

```typescript
// Get recipes with their ratings
const { data: recipes } = await supabase
  .from('recipes')
  .select(`
    *,
    recipe_ratings (
      id,
      rating,
      comment,
      family_member_id,
      family_members (
        name
      )
    )
  `)
  .eq('family_id', familyId)
  .order('name')
```

### Checking Inventory Before Shopping List

```typescript
// Get ingredients needed for the week
const { data: mealPlans } = await supabase
  .from('meal_plans')
  .select(`
    recipes (
      ingredients
    )
  `)
  .eq('family_id', familyId)
  .gte('planned_date', startOfWeek)
  .lte('planned_date', endOfWeek)

// Extract all ingredients
const allIngredients = mealPlans.flatMap(mp =>
  mp.recipes.ingredients
)

// Check against inventory
const { data: inventory } = await supabase
  .from('inventory_items')
  .select('name')
  .eq('family_id', familyId)

const inventoryNames = new Set(inventory.map(i => i.name.toLowerCase()))

// Filter to only items we need to buy
const shoppingList = allIngredients.filter(ing =>
  !inventoryNames.has(ing.name.toLowerCase())
)
```

## Recipe Import Example

### Using the Recipe Scraper

```typescript
'use client'

import { useState } from 'react'
import { scrapeRecipe } from '@/lib/recipe-scraper'
import { createClient } from '@/lib/supabase/client'

export default function RecipeImportPage() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [scrapedRecipe, setScrapedRecipe] = useState(null)
  const supabase = createClient()

  async function handleScrape() {
    setLoading(true)
    try {
      const recipe = await scrapeRecipe(url)
      setScrapedRecipe(recipe)
    } catch (error) {
      alert('Failed to import recipe: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    const { data: family } = await supabase
      .from('families')
      .select('id')
      .single()

    const { error } = await supabase
      .from('recipes')
      .insert({
        family_id: family.id,
        name: scrapedRecipe.name,
        description: scrapedRecipe.description,
        ingredients: scrapedRecipe.ingredients,
        instructions: scrapedRecipe.instructions,
        prep_time_minutes: scrapedRecipe.prepTimeMinutes,
        cook_time_minutes: scrapedRecipe.cookTimeMinutes,
        servings: scrapedRecipe.servings,
        photo_url: scrapedRecipe.photoUrl,
        source_url: scrapedRecipe.sourceUrl,
        complexity: 'quick', // Let user select
        cost_bucket: 'moderate', // Let user select
      })

    if (!error) {
      // Redirect to recipes page
    }
  }

  return (
    <div>
      <input
        value={url}
        onChange={e => setUrl(e.target.value)}
        placeholder="Paste recipe URL"
      />
      <button onClick={handleScrape} disabled={loading}>
        Import Recipe
      </button>

      {scrapedRecipe && (
        <div>
          <h2>{scrapedRecipe.name}</h2>
          {/* Show preview and save button */}
          <button onClick={handleSave}>Save Recipe</button>
        </div>
      )}
    </div>
  )
}
```

## Meal Planning Calendar Example

### Getting This Week's Meals

```typescript
function getWeekDates() {
  const today = new Date()
  const day = today.getDay()
  const diff = today.getDate() - day + (day === 0 ? -6 : 1) // Monday

  const monday = new Date(today.setDate(diff))
  const dates = []

  for (let i = 0; i < 7; i++) {
    const date = new Date(monday)
    date.setDate(monday.getDate() + i)
    dates.push(date.toISOString().split('T')[0])
  }

  return dates
}

async function getWeekMeals(familyId: string) {
  const dates = getWeekDates()
  const supabase = await createClient()

  const { data: mealPlans } = await supabase
    .from('meal_plans')
    .select(`
      *,
      recipes (
        id,
        name,
        complexity,
        cost_bucket,
        cost_estimate
      )
    `)
    .eq('family_id', familyId)
    .in('planned_date', dates)

  // Create a map of date -> meal
  const weekMeals = {}
  dates.forEach(date => {
    const meal = mealPlans?.find(mp => mp.planned_date === date)
    weekMeals[date] = meal || null
  })

  return weekMeals
}
```

## Smart Recipe Suggestions

### Based on Last Made Date

```typescript
async function getSuggestedRecipes(familyId: string) {
  const supabase = await createClient()

  // Get recipes we haven't made recently (or ever)
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('family_id', familyId)
    .or('last_made_date.is.null,last_made_date.lt.' +
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
    .order('last_made_date', { ascending: true, nullsFirst: true })
    .limit(10)

  return recipes
}
```

### Based on Expiring Inventory

```typescript
async function getRecipesUsingExpiring(familyId: string) {
  const supabase = await createClient()

  // Get items expiring in next 5 days
  const fiveDaysFromNow = new Date()
  fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5)

  const { data: expiring } = await supabase
    .from('inventory_items')
    .select('name')
    .eq('family_id', familyId)
    .lte('expiration_date', fiveDaysFromNow.toISOString().split('T')[0])

  const expiringNames = expiring.map(i => i.name.toLowerCase())

  // Get recipes that use these ingredients
  const { data: recipes } = await supabase
    .from('recipes')
    .select('*, ingredients')
    .eq('family_id', familyId)

  // Filter recipes that contain expiring ingredients
  const matches = recipes?.filter(recipe => {
    const recipeIngredients = recipe.ingredients.map(
      (ing: any) => ing.name.toLowerCase()
    )
    return recipeIngredients.some(ing =>
      expiringNames.some(exp => ing.includes(exp))
    )
  })

  return matches
}
```

## Seasonal Produce Helper

### Get Current Season's Produce

```typescript
async function getSeasonalProduce() {
  const supabase = await createClient()
  const currentMonth = new Date().getMonth() + 1 // 1-12

  const { data: produce } = await supabase
    .from('seasonal_produce')
    .select('*')
    .contains('months', [currentMonth])
    .order('name')

  return produce
}
```

### Filter Recipes by Seasonal Ingredients

```typescript
async function getSeasonalRecipes(familyId: string) {
  const seasonalProduce = await getSeasonalProduce()
  const seasonalNames = seasonalProduce.map(p => p.name.toLowerCase())

  const { data: recipes } = await supabase
    .from('recipes')
    .select('*')
    .eq('family_id', familyId)

  // Score recipes by how many seasonal ingredients they use
  const scored = recipes.map(recipe => {
    const ingredients = recipe.ingredients.map(
      (i: any) => i.name.toLowerCase()
    )
    const seasonalCount = ingredients.filter(ing =>
      seasonalNames.some(s => ing.includes(s))
    ).length

    return { ...recipe, seasonalCount }
  })

  // Sort by seasonal score
  return scored
    .filter(r => r.seasonalCount > 0)
    .sort((a, b) => b.seasonalCount - a.seasonalCount)
}
```

## Form Validation Examples

### Recipe Form Validation

```typescript
function validateRecipe(recipe) {
  const errors = {}

  if (!recipe.name || recipe.name.trim().length === 0) {
    errors.name = 'Recipe name is required'
  }

  if (!recipe.ingredients || recipe.ingredients.length === 0) {
    errors.ingredients = 'At least one ingredient is required'
  }

  if (!recipe.instructions || recipe.instructions.length === 0) {
    errors.instructions = 'At least one instruction is required'
  }

  if (!recipe.servings || recipe.servings < 1) {
    errors.servings = 'Servings must be at least 1'
  }

  if (recipe.cost_estimate && recipe.cost_estimate < 0) {
    errors.cost_estimate = 'Cost cannot be negative'
  }

  return { isValid: Object.keys(errors).length === 0, errors }
}
```

## Mobile-First UI Tips

### Bottom Navigation Safe Area

```css
/* In your globals.css */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}
```

### Touch-Friendly Buttons

```typescript
// Minimum 44x44px touch targets
<button className="min-h-[44px] min-w-[44px] p-3">
  Tap Me
</button>
```

### Swipeable Lists

Consider using a library like `react-swipeable` for swipe-to-delete actions on shopping lists.

## Testing Your Changes

### Manual Testing Checklist

1. Test on mobile viewport (Chrome DevTools)
2. Test authentication flow
3. Verify database operations (check Supabase Table Editor)
4. Test with empty states (no recipes, no inventory, etc.)
5. Test error states (network failures, invalid data)

### Using Supabase Table Editor

- Perfect for adding test data during development
- Verify your inserts/updates worked correctly
- Manually trigger database functions

## Performance Tips

1. **Use Server Components by default** - Only use 'use client' when needed for interactivity
2. **Fetch data at the page level** - Pass props down to client components
3. **Use proper database indexes** - Already set up in migrations
4. **Implement pagination** - For large lists (recipes, inventory)
5. **Optimize images** - Use Next.js Image component for recipe photos

## Common Gotchas

1. **RLS Policies**: Make sure users can only access their family's data
2. **Date Formatting**: Always use `YYYY-MM-DD` format for dates
3. **JSONB Fields**: Ingredients are stored as JSONB, not TEXT[]
4. **Auth State**: Check if user is authenticated before database queries
5. **Environment Variables**: Must start with `NEXT_PUBLIC_` for client-side access

## Next Steps

Start with the Family Setup page, then move to Recipe Import. These are the foundational pieces that unlock the rest of the app. See [GETTING_STARTED.md](../GETTING_STARTED.md) for the recommended build order.
