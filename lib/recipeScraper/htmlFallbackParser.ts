/**
 * HTML Fallback Parser
 *
 * Used when schema.org data is not available.
 * Uses heuristics and common HTML patterns to extract recipe data.
 */

import * as cheerio from 'cheerio'
import { ScrapedRecipe } from './types'

/**
 * Extract recipe title from HTML
 */
function extractTitle($: cheerio.CheerioAPI): string | undefined {
  // Try various selectors in order of specificity
  const selectors = [
    'h1[class*="recipe"][class*="title"]',
    'h1[class*="title"]',
    '.recipe-title',
    '.entry-title',
    'article h1',
    'h1',
  ]

  for (const selector of selectors) {
    const title = $(selector).first().text().trim()
    if (title && title.length > 3 && title.length < 200) {
      return title
    }
  }

  // Fallback to page title
  const pageTitle = $('title').text().trim()
  if (pageTitle) {
    // Remove common suffixes like " - Site Name", " | Blog Name"
    return pageTitle.split(/\s*[-|]\s*/)[0].trim()
  }

  return undefined
}

/**
 * Extract ingredients from HTML
 */
function extractIngredients($: cheerio.CheerioAPI): string[] {
  const ingredients: string[] = []

  // Try various selectors
  const selectors = [
    '.recipe-ingredients li',
    '.ingredients li',
    '[class*="ingredient"] li',
    '.recipe-ingredient',
    '[itemprop="recipeIngredient"]',
  ]

  for (const selector of selectors) {
    const items = $(selector)
    if (items.length > 0) {
      items.each((_, el) => {
        const text = $(el).text().trim()
        if (text && text.length > 2 && text.length < 500) {
          ingredients.push(text)
        }
      })

      if (ingredients.length > 0) break
    }
  }

  return ingredients
}

/**
 * Extract instructions from HTML
 */
function extractInstructions($: cheerio.CheerioAPI): string[] {
  const instructions: string[] = []

  // Try various selectors
  const selectors = [
    '.recipe-instructions li',
    '.instructions li',
    '.recipe-steps li',
    '[class*="instruction"] li',
    '[class*="direction"] li',
    '[class*="step"] li',
    '[itemprop="recipeInstructions"] li',
  ]

  for (const selector of selectors) {
    const items = $(selector)
    if (items.length > 0) {
      items.each((_, el) => {
        const text = $(el).text().trim()
        // Remove step numbers like "1.", "Step 1:", etc.
        const cleanText = text.replace(/^(?:step\s*)?\d+[.):]\s*/i, '').trim()
        if (cleanText && cleanText.length > 5 && cleanText.length < 2000) {
          instructions.push(cleanText)
        }
      })

      if (instructions.length > 0) break
    }
  }

  // If no list items found, try paragraphs
  if (instructions.length === 0) {
    const paragraphSelectors = [
      '.recipe-instructions p',
      '.instructions p',
      '[class*="instruction"] p',
    ]

    for (const selector of paragraphSelectors) {
      const items = $(selector)
      if (items.length > 0) {
        items.each((_, el) => {
          const text = $(el).text().trim()
          const cleanText = text.replace(/^(?:step\s*)?\d+[.):]\s*/i, '').trim()
          if (cleanText && cleanText.length > 10) {
            instructions.push(cleanText)
          }
        })

        if (instructions.length > 0) break
      }
    }
  }

  return instructions
}

/**
 * Extract image URL from HTML
 */
function extractImageUrl($: cheerio.CheerioAPI): string | undefined {
  // Try meta tags first (highest quality)
  const ogImage = $('meta[property="og:image"]').attr('content')
  if (ogImage) return ogImage

  const twitterImage = $('meta[name="twitter:image"]').attr('content')
  if (twitterImage) return twitterImage

  // Try recipe-specific image selectors
  const selectors = [
    '.recipe-image img',
    '.recipe-photo img',
    '[class*="recipe"][class*="image"] img',
    'article img[class*="feat"]',
    '.wp-post-image',
  ]

  for (const selector of selectors) {
    const src = $(selector).first().attr('src')
    if (src && src.startsWith('http')) {
      return src
    }
  }

  return undefined
}

/**
 * Extract time values from HTML
 */
function extractTime($: cheerio.CheerioAPI, type: 'prep' | 'cook' | 'total'): number | undefined {
  const selectors = [
    `[class*="${type}"][class*="time"]`,
    `[itemprop="${type}Time"]`,
    `.${type}-time`,
  ]

  for (const selector of selectors) {
    const text = $(selector).text().trim()
    if (text) {
      // Extract numbers and units
      const match = text.match(/(\d+)\s*(hour|hr|h|minute|min|m)/i)
      if (match) {
        const value = parseInt(match[1])
        const unit = match[2].toLowerCase()

        if (unit.startsWith('h')) {
          return value * 60
        } else {
          return value
        }
      }

      // Just a number, assume minutes
      const numMatch = text.match(/(\d+)/)
      if (numMatch) {
        return parseInt(numMatch[1])
      }
    }
  }

  return undefined
}

/**
 * Extract servings from HTML
 */
function extractServings($: cheerio.CheerioAPI): number | undefined {
  const selectors = [
    '[class*="serving"]',
    '[class*="yield"]',
    '[itemprop="recipeYield"]',
  ]

  for (const selector of selectors) {
    const text = $(selector).text().trim()
    if (text) {
      const match = text.match(/(\d+)/)
      if (match) {
        return parseInt(match[1])
      }
    }
  }

  return undefined
}

/**
 * Extract description from HTML
 */
function extractDescription($: cheerio.CheerioAPI): string | undefined {
  // Try meta description first
  const metaDesc = $('meta[name="description"]').attr('content')
  if (metaDesc) return metaDesc.trim()

  const ogDesc = $('meta[property="og:description"]').attr('content')
  if (ogDesc) return ogDesc.trim()

  // Try recipe-specific description
  const selectors = [
    '.recipe-description',
    '.recipe-summary',
    '[class*="recipe"][class*="desc"]',
    'article p',
  ]

  for (const selector of selectors) {
    const text = $(selector).first().text().trim()
    if (text && text.length > 20 && text.length < 500) {
      return text
    }
  }

  return undefined
}

/**
 * Fallback scraping function using HTML parsing
 */
export function scrapeRecipeFromHTML(html: string, url: string): ScrapedRecipe | null {
  const $ = cheerio.load(html)

  const name = extractTitle($)
  if (!name) {
    return null // Must have at least a title
  }

  const ingredients = extractIngredients($)
  const instructions = extractInstructions($)

  // Must have either ingredients or instructions
  if (ingredients.length === 0 && instructions.length === 0) {
    return null
  }

  const recipe: ScrapedRecipe = {
    name,
    description: extractDescription($),
    image_url: extractImageUrl($),
    prep_time_minutes: extractTime($, 'prep'),
    cook_time_minutes: extractTime($, 'cook'),
    total_time_minutes: extractTime($, 'total'),
    servings: extractServings($),
    ingredients,
    instructions,
    source_url: url,
  }

  return recipe
}
