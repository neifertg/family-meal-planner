import { NextRequest, NextResponse } from 'next/server'
import { scrapeRecipe } from '@/lib/recipeScraper'

/**
 * POST /api/scrape-recipe
 *
 * Scrapes a recipe from a URL
 *
 * Body:
 * {
 *   url: string - The recipe URL to scrape
 * }
 *
 * Returns:
 * {
 *   success: boolean
 *   recipe?: ScrapedRecipe
 *   error?: string
 *   method?: 'schema.org' | 'html-fallback' | 'site-specific'
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    // Validate URL
    if (!url || typeof url !== 'string') {
      return NextResponse.json(
        { success: false, error: 'URL is required' },
        { status: 400 }
      )
    }

    // Scrape the recipe
    console.log(`API: Scraping recipe from ${url}`)
    const result = await scrapeRecipe(url)

    if (result.success) {
      console.log(`API: Successfully scraped recipe using ${result.method}`)
      return NextResponse.json(result)
    } else {
      console.log(`API: Failed to scrape recipe: ${result.error}`)
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error: any) {
    console.error('API: Scraping error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error while scraping recipe'
      },
      { status: 500 }
    )
  }
}
