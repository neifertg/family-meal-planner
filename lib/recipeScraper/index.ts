/**
 * Main Recipe Scraper
 *
 * Orchestrates the scraping process:
 * 1. Try schema.org JSON-LD (works for 80% of sites)
 * 2. Fallback to HTML parsing
 * 3. Site-specific scrapers for special cases
 */

import { scrapeRecipeFromSchemaOrg } from './schemaOrgParser'
import { scrapeRecipeFromHTML } from './htmlFallbackParser'
import { ScrapedRecipe, ScrapeResult, ScrapeError } from './types'

/**
 * Fetch HTML from URL with proper headers
 */
async function fetchRecipePage(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  return await response.text()
}

/**
 * Validate URL
 */
function validateUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/**
 * Clean and validate scraped recipe data
 */
function validateRecipe(recipe: ScrapedRecipe): boolean {
  // Must have a name
  if (!recipe.name || recipe.name.length < 3) {
    return false
  }

  // Must have either ingredients or instructions
  if ((!recipe.ingredients || recipe.ingredients.length === 0) &&
      (!recipe.instructions || recipe.instructions.length === 0)) {
    return false
  }

  return true
}

/**
 * Clean recipe data (remove excessive whitespace, fix formatting)
 */
function cleanRecipeData(recipe: ScrapedRecipe): ScrapedRecipe {
  return {
    ...recipe,
    name: recipe.name.trim().replace(/\s+/g, ' '),
    description: recipe.description?.trim().replace(/\s+/g, ' '),
    ingredients: recipe.ingredients.map(ing => ing.trim().replace(/\s+/g, ' ')),
    instructions: recipe.instructions.map(inst => inst.trim().replace(/\s+/g, ' ')),
    tags: recipe.tags?.map(tag => tag.trim()),
  }
}

/**
 * Main scraper function
 * Attempts multiple scraping strategies in order
 */
export async function scrapeRecipe(url: string): Promise<ScrapeResult> {
  // Validate URL
  if (!validateUrl(url)) {
    return {
      success: false,
      error: 'Invalid URL format',
    }
  }

  try {
    // Fetch the page
    console.log(`Fetching recipe from: ${url}`)
    const html = await fetchRecipePage(url)

    // Strategy 1: Try schema.org JSON-LD (most common)
    console.log('Attempting schema.org extraction...')
    let recipe = scrapeRecipeFromSchemaOrg(html, url)

    if (recipe && validateRecipe(recipe)) {
      console.log('✅ Successfully scraped using schema.org')
      return {
        success: true,
        recipe: cleanRecipeData(recipe),
        method: 'schema.org',
      }
    }

    // Strategy 2: HTML fallback parsing
    console.log('Schema.org not found, attempting HTML parsing...')
    recipe = scrapeRecipeFromHTML(html, url)

    if (recipe && validateRecipe(recipe)) {
      console.log('✅ Successfully scraped using HTML parsing')
      return {
        success: true,
        recipe: cleanRecipeData(recipe),
        method: 'html-fallback',
      }
    }

    // No recipe found
    console.log('❌ No recipe data found')
    return {
      success: false,
      error: 'Could not find recipe data on this page. The page may not contain a recipe or uses an unsupported format.',
    }

  } catch (error: any) {
    console.error('Scraping error:', error)

    let errorMessage = 'Failed to scrape recipe'
    if (error.message.includes('HTTP')) {
      errorMessage = `Failed to fetch page: ${error.message}`
    } else if (error.message.includes('timeout')) {
      errorMessage = 'Request timed out. Please try again.'
    } else if (error.message.includes('ENOTFOUND')) {
      errorMessage = 'Website not found. Please check the URL.'
    }

    return {
      success: false,
      error: errorMessage,
    }
  }
}

/**
 * Scrape multiple recipes from a list of URLs
 * Includes rate limiting to be respectful to servers
 */
export async function scrapeMultipleRecipes(
  urls: string[],
  delayMs: number = 1000
): Promise<ScrapeResult[]> {
  const results: ScrapeResult[] = []

  for (let i = 0; i < urls.length; i++) {
    console.log(`Scraping recipe ${i + 1} of ${urls.length}...`)

    const result = await scrapeRecipe(urls[i])
    results.push(result)

    // Rate limiting: wait between requests
    if (i < urls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
  }

  return results
}

/**
 * Test if a URL likely contains a recipe
 * (Quick check before doing full scrape)
 */
export async function isRecipeUrl(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    // Check content type
    const contentType = response.headers.get('content-type')
    if (!contentType?.includes('text/html')) {
      return false
    }

    // Basic heuristic: recipe URLs often contain these terms
    const lowerUrl = url.toLowerCase()
    const recipeTerms = ['recipe', 'recipes', 'cook', 'food', 'dish', 'meal']

    return recipeTerms.some(term => lowerUrl.includes(term))
  } catch {
    return false
  }
}
