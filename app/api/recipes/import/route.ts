import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Dynamically import recipe-scraper (it's a CommonJS module)
    const { default: recipeScraper } = await import('recipe-scraper')

    // Scrape the recipe from the URL
    const recipe = await recipeScraper(url)

    if (!recipe) {
      return NextResponse.json(
        { error: 'Could not extract recipe from URL' },
        { status: 400 }
      )
    }

    // Get the authenticated user
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the user's family
    const { data: family, error: familyError } = await supabase
      .from('families')
      .select('id')
      .eq('created_by', user.id)
      .single()

    if (familyError || !family) {
      return NextResponse.json(
        { error: 'Family not found' },
        { status: 404 }
      )
    }

    // Format the recipe data to match our schema
    const recipeData = {
      family_id: family.id,
      name: recipe.name || 'Untitled Recipe',
      description: recipe.description || null,
      source_url: url,
      prep_time_minutes: recipe.prepTime ? parseInt(recipe.prepTime) : null,
      cook_time_minutes: recipe.cookTime ? parseInt(recipe.cookTime) : null,
      total_time_minutes: recipe.totalTime ? parseInt(recipe.totalTime) : null,
      servings: recipe.servings ? parseInt(recipe.servings) : null,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      image_url: recipe.image || null,
      cuisine: recipe.cuisine || null,
      category: recipe.category || null,
      created_by: user.id,
    }

    // Insert the recipe
    const { data: insertedRecipe, error: insertError } = await supabase
      .from('recipes')
      .insert(recipeData)
      .select()
      .single()

    if (insertError) {
      console.error('Error inserting recipe:', insertError)
      return NextResponse.json(
        { error: 'Failed to save recipe' },
        { status: 500 }
      )
    }

    return NextResponse.json({ recipe: insertedRecipe })
  } catch (error) {
    console.error('Error importing recipe:', error)
    return NextResponse.json(
      { error: 'Failed to import recipe' },
      { status: 500 }
    )
  }
}
