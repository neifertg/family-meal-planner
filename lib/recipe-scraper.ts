import * as cheerio from 'cheerio'

export interface ScrapedRecipe {
  name: string
  description?: string
  ingredients: { name: string; quantity: string; unit?: string }[]
  instructions: string[]
  prepTimeMinutes?: number
  cookTimeMinutes?: number
  servings: number
  photoUrl?: string
  sourceUrl: string
}

/**
 * Extracts time in minutes from a string like "30 minutes", "1 hour 15 minutes", etc.
 */
function parseTimeToMinutes(timeStr: string): number | undefined {
  if (!timeStr) return undefined

  const hourMatch = timeStr.match(/(\d+)\s*hour/i)
  const minuteMatch = timeStr.match(/(\d+)\s*min/i)

  let totalMinutes = 0
  if (hourMatch) totalMinutes += parseInt(hourMatch[1]) * 60
  if (minuteMatch) totalMinutes += parseInt(minuteMatch[1])

  return totalMinutes > 0 ? totalMinutes : undefined
}

/**
 * Scrape recipe from Mel's Kitchen Cafe
 */
async function scrapeMelsKitchenCafe(html: string, url: string): Promise<ScrapedRecipe> {
  const $ = cheerio.load(html)

  // Try to find JSON-LD structured data first
  const jsonLd = $('script[type="application/ld+json"]').html()
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd)
      const recipe = Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Recipe') : data

      if (recipe && recipe['@type'] === 'Recipe') {
        return {
          name: recipe.name,
          description: recipe.description,
          ingredients: (recipe.recipeIngredient || []).map((ing: string) => ({
            name: ing,
            quantity: '',
          })),
          instructions: (recipe.recipeInstructions || []).map((inst: any) =>
            typeof inst === 'string' ? inst : inst.text || ''
          ),
          prepTimeMinutes: recipe.prepTime ? parseTimeToMinutes(recipe.prepTime) : undefined,
          cookTimeMinutes: recipe.cookTime ? parseTimeToMinutes(recipe.cookTime) : undefined,
          servings: parseInt(recipe.recipeYield) || 4,
          photoUrl: recipe.image?.url || recipe.image,
          sourceUrl: url,
        }
      }
    } catch (e) {
      console.error('Error parsing JSON-LD:', e)
    }
  }

  // Fallback to manual scraping
  const name = $('.entry-title').first().text().trim() ||
               $('h1').first().text().trim()

  const ingredients: { name: string; quantity: string }[] = []
  $('.wprm-recipe-ingredient').each((_, el) => {
    const amount = $(el).find('.wprm-recipe-ingredient-amount').text().trim()
    const unit = $(el).find('.wprm-recipe-ingredient-unit').text().trim()
    const name = $(el).find('.wprm-recipe-ingredient-name').text().trim()
    ingredients.push({
      name: name,
      quantity: `${amount} ${unit}`.trim(),
    })
  })

  const instructions: string[] = []
  $('.wprm-recipe-instruction-text').each((_, el) => {
    const text = $(el).text().trim()
    if (text) instructions.push(text)
  })

  const prepTime = $('.wprm-recipe-prep_time-minutes').text().trim()
  const cookTime = $('.wprm-recipe-cook_time-minutes').text().trim()
  const servings = $('.wprm-recipe-servings').text().trim()

  return {
    name,
    ingredients,
    instructions,
    prepTimeMinutes: prepTime ? parseInt(prepTime) : undefined,
    cookTimeMinutes: cookTime ? parseInt(cookTime) : undefined,
    servings: servings ? parseInt(servings) : 4,
    sourceUrl: url,
  }
}

/**
 * Scrape recipe from Tastes Better From Scratch
 */
async function scrapeTastesBetterFromScratch(html: string, url: string): Promise<ScrapedRecipe> {
  const $ = cheerio.load(html)

  // Try to find JSON-LD structured data first
  const jsonLd = $('script[type="application/ld+json"]').html()
  if (jsonLd) {
    try {
      const data = JSON.parse(jsonLd)
      const recipe = Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Recipe') : data

      if (recipe && recipe['@type'] === 'Recipe') {
        return {
          name: recipe.name,
          description: recipe.description,
          ingredients: (recipe.recipeIngredient || []).map((ing: string) => ({
            name: ing,
            quantity: '',
          })),
          instructions: (recipe.recipeInstructions || []).map((inst: any) =>
            typeof inst === 'string' ? inst : inst.text || ''
          ),
          prepTimeMinutes: recipe.prepTime ? parseTimeToMinutes(recipe.prepTime) : undefined,
          cookTimeMinutes: recipe.cookTime ? parseTimeToMinutes(recipe.cookTime) : undefined,
          servings: parseInt(recipe.recipeYield) || 4,
          photoUrl: recipe.image?.url || recipe.image,
          sourceUrl: url,
        }
      }
    } catch (e) {
      console.error('Error parsing JSON-LD:', e)
    }
  }

  // Fallback to manual scraping
  const name = $('.entry-title').first().text().trim() ||
               $('h1').first().text().trim()

  const ingredients: { name: string; quantity: string }[] = []
  $('.wprm-recipe-ingredient, .ingredient').each((_, el) => {
    const text = $(el).text().trim()
    if (text) {
      ingredients.push({
        name: text,
        quantity: '',
      })
    }
  })

  const instructions: string[] = []
  $('.wprm-recipe-instruction-text, .instruction').each((_, el) => {
    const text = $(el).text().trim()
    if (text) instructions.push(text)
  })

  return {
    name,
    ingredients,
    instructions,
    servings: 4,
    sourceUrl: url,
  }
}

/**
 * Main function to scrape recipe from a URL
 */
export async function scrapeRecipe(url: string): Promise<ScrapedRecipe> {
  try {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`Failed to fetch recipe: ${response.statusText}`)
    }

    const html = await response.text()

    // Determine which scraper to use based on URL
    if (url.includes('melskitchencafe.com')) {
      return await scrapeMelsKitchenCafe(html, url)
    } else if (url.includes('tastesbetterfromscratch.com')) {
      return await scrapeTastesBetterFromScratch(html, url)
    } else {
      // Try generic JSON-LD parsing for other sites
      const $ = cheerio.load(html)
      const jsonLd = $('script[type="application/ld+json"]').html()

      if (jsonLd) {
        try {
          const data = JSON.parse(jsonLd)
          const recipe = Array.isArray(data) ? data.find((item: any) => item['@type'] === 'Recipe') : data

          if (recipe && recipe['@type'] === 'Recipe') {
            return {
              name: recipe.name,
              description: recipe.description,
              ingredients: (recipe.recipeIngredient || []).map((ing: string) => ({
                name: ing,
                quantity: '',
              })),
              instructions: (recipe.recipeInstructions || []).map((inst: any) =>
                typeof inst === 'string' ? inst : inst.text || ''
              ),
              prepTimeMinutes: recipe.prepTime ? parseTimeToMinutes(recipe.prepTime) : undefined,
              cookTimeMinutes: recipe.cookTime ? parseTimeToMinutes(recipe.cookTime) : undefined,
              servings: parseInt(recipe.recipeYield) || 4,
              photoUrl: recipe.image?.url || recipe.image,
              sourceUrl: url,
            }
          }
        } catch (e) {
          console.error('Error parsing JSON-LD:', e)
        }
      }

      throw new Error('Unsupported recipe source. Please try Mel\'s Kitchen Cafe or Tastes Better From Scratch, or add the recipe manually.')
    }
  } catch (error) {
    console.error('Error scraping recipe:', error)
    throw error
  }
}
