import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as cheerio from 'cheerio'

type ScrapedRecipe = {
  name?: string
  description?: string
  image?: string
  ingredients?: string[]
  instructions?: string[]
  prepTime?: string
  cookTime?: string
  totalTime?: string
  servings?: string
  cuisine?: string
  category?: string
}

async function scrapeRecipe(url: string): Promise<ScrapedRecipe | null> {
  try {
    const response = await fetch(url)
    const html = await response.text()
    const $ = cheerio.load(html)

    // Try to find JSON-LD schema.org Recipe data (most recipe sites use this)
    const jsonLd = $('script[type="application/ld+json"]')
      .toArray()
      .map((el) => {
        try {
          return JSON.parse($(el).html() || '{}')
        } catch {
          return null
        }
      })
      .filter(Boolean)

    // Find the Recipe schema
    let recipeData: any = jsonLd.find((data: any) => data['@type'] === 'Recipe')

    // Sometimes it's nested in a graph
    if (!recipeData) {
      const graphData = jsonLd.find((data: any) => data['@graph'])
      if (graphData) {
        recipeData = graphData['@graph'].find((item: any) => item['@type'] === 'Recipe')
      }
    }

    if (!recipeData) {
      return null
    }

    // Extract ingredients
    let ingredients: string[] = []
    if (Array.isArray(recipeData.recipeIngredient)) {
      ingredients = recipeData.recipeIngredient
    } else if (typeof recipeData.recipeIngredient === 'string') {
      ingredients = [recipeData.recipeIngredient]
    }

    // Extract instructions
    let instructions: string[] = []
    if (Array.isArray(recipeData.recipeInstructions)) {
      instructions = recipeData.recipeInstructions.map((inst: any) => {
        if (typeof inst === 'string') return inst
        if (inst.text) return inst.text
        return JSON.stringify(inst)
      })
    } else if (typeof recipeData.recipeInstructions === 'string') {
      instructions = [recipeData.recipeInstructions]
    }

    return {
      name: recipeData.name || '',
      description: recipeData.description || '',
      image: recipeData.image?.url || recipeData.image || '',
      ingredients,
      instructions,
      prepTime: recipeData.prepTime || '',
      cookTime: recipeData.cookTime || '',
      totalTime: recipeData.totalTime || '',
      servings: recipeData.recipeYield?.toString() || '',
      cuisine: recipeData.recipeCuisine || '',
      category: recipeData.recipeCategory || '',
    }
  } catch (error) {
    console.error('Error scraping recipe:', error)
    return null
  }
}

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json(
        { error: 'URL is required' },
        { status: 400 }
      )
    }

    // Scrape the recipe from the URL
    const recipe = await scrapeRecipe(url)

    if (!recipe) {
      return NextResponse.json(
        { error: 'Could not extract recipe from URL. Make sure the URL points to a recipe page with structured data.' },
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

    const familyId = (family as { id: string }).id

    // Parse time strings (ISO 8601 duration format like "PT30M" = 30 minutes)
    const parseISODuration = (duration: string): number | null => {
      if (!duration) return null
      const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/)
      if (!match) return null
      const hours = parseInt(match[1] || '0')
      const minutes = parseInt(match[2] || '0')
      return hours * 60 + minutes
    }

    // Format the recipe data to match our schema
    const recipeData = {
      family_id: familyId,
      name: recipe.name || 'Untitled Recipe',
      description: recipe.description || null,
      source_url: url,
      prep_time_minutes: parseISODuration(recipe.prepTime || ''),
      cook_time_minutes: parseISODuration(recipe.cookTime || ''),
      total_time_minutes: parseISODuration(recipe.totalTime || ''),
      servings: recipe.servings ? parseInt(recipe.servings) : null,
      ingredients: recipe.ingredients || [],
      instructions: recipe.instructions || [],
      image_url: recipe.image || null,
      cuisine: recipe.cuisine || null,
      category: recipe.category || null,
      created_by: user.id,
    } as any

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
