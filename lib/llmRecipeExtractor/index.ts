/**
 * Smart Recipe Extractor
 *
 * Hybrid approach:
 * 1. Try schema.org JSON-LD first (fast, free)
 * 2. Fall back to Gemini LLM extraction if needed
 * 3. Support images via OCR + LLM
 */

import { ExtractionResult, ContentSource, ExtractedRecipe } from './types'
import { extractRecipeWithGemini } from './geminiExtractor'
import { scrapeRecipeFromSchemaOrg } from '../recipeScraper/schemaOrgParser'
import { ScrapedRecipe } from '../recipeScraper/types'

/**
 * Convert old ScrapedRecipe format to new ExtractedRecipe format
 */
function convertScrapedToExtracted(scraped: ScrapedRecipe): ExtractedRecipe {
  return {
    title: scraped.name,
    description: scraped.description,
    author: scraped.author,
    source_url: scraped.source_url,

    ingredients: scraped.ingredients.map((item, index) => ({
      item: item,
      // TODO: Parse quantity/unit from string if needed
    })),

    instructions: scraped.instructions.map((instruction, index) => ({
      step_number: index + 1,
      instruction: instruction,
    })),

    prep_time_minutes: scraped.prep_time_minutes,
    cook_time_minutes: scraped.cook_time_minutes,
    total_time_minutes: scraped.total_time_minutes,

    servings: scraped.servings,

    cuisine: scraped.cuisine,
    category: scraped.category,
    difficulty: scraped.difficulty,

    tags: scraped.tags,

    nutrition: scraped.nutrition ? {
      calories: scraped.nutrition.calories,
      protein_g: scraped.nutrition.protein ? parseFloat(scraped.nutrition.protein) : undefined,
      carbohydrates_g: scraped.nutrition.carbohydrates ? parseFloat(scraped.nutrition.carbohydrates) : undefined,
      fat_g: scraped.nutrition.fat ? parseFloat(scraped.nutrition.fat) : undefined,
      fiber_g: scraped.nutrition.fiber ? parseFloat(scraped.nutrition.fiber) : undefined,
      sugar_g: scraped.nutrition.sugar ? parseFloat(scraped.nutrition.sugar) : undefined,
    } : undefined,

    image_url: scraped.image_url,

    rating: scraped.rating,
  }
}

/**
 * Try to extract using schema.org first
 */
async function trySchemaOrgExtraction(url: string): Promise<ExtractedRecipe | null> {
  try {
    console.log('Attempting schema.org extraction...')
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    })

    if (!response.ok) {
      return null
    }

    const html = await response.text()
    const scrapedRecipe = scrapeRecipeFromSchemaOrg(html, url)

    if (scrapedRecipe) {
      console.log('✅ Successfully extracted using schema.org')
      return convertScrapedToExtracted(scrapedRecipe)
    }

    return null
  } catch (error) {
    console.error('Schema.org extraction failed:', error)
    return null
  }
}

/**
 * Main extraction function with smart fallback strategy
 */
export async function extractRecipe(
  source: ContentSource,
  options: {
    preferLLM?: boolean      // Force LLM extraction even if schema.org available
    useCache?: boolean       // Check cache first (TODO: implement)
  } = {}
): Promise<ExtractionResult> {

  // Strategy 1: For URLs, try schema.org first (unless LLM preferred)
  if (source.type === 'url' && !options.preferLLM) {
    const schemaRecipe = await trySchemaOrgExtraction(source.content)

    if (schemaRecipe) {
      return {
        success: true,
        recipe: schemaRecipe,
        confidence: 95, // Schema.org is highly reliable
        extraction_method: 'schema.org',
      }
    }

    console.log('Schema.org not found, falling back to LLM extraction...')
  }

  // Strategy 2: LLM extraction (Gemini)
  console.log('Using Gemini LLM for extraction...')
  return await extractRecipeWithGemini(source)
}

/**
 * Batch extract multiple recipes with rate limiting
 */
export async function extractMultipleRecipes(
  sources: ContentSource[],
  options: {
    delayMs?: number
    preferLLM?: boolean
  } = {}
): Promise<ExtractionResult[]> {
  const results: ExtractionResult[] = []
  const delay = options.delayMs || 1000

  for (let i = 0; i < sources.length; i++) {
    console.log(`Extracting recipe ${i + 1} of ${sources.length}...`)

    const result = await extractRecipe(sources[i], options)
    results.push(result)

    // Rate limiting
    if (i < sources.length - 1) {
      await new Promise(resolve => setTimeout(resolve, delay))
    }
  }

  return results
}

/**
 * Extract recipe from URL (convenience function)
 */
export async function extractRecipeFromURL(
  url: string,
  preferLLM: boolean = false
): Promise<ExtractionResult> {
  return extractRecipe({
    type: 'url',
    content: url,
    metadata: {
      source_url: url,
      date_accessed: new Date().toISOString(),
    },
  }, { preferLLM })
}

/**
 * Extract recipe from HTML (convenience function)
 */
export async function extractRecipeFromHTML(
  html: string,
  sourceUrl?: string
): Promise<ExtractionResult> {
  return extractRecipe({
    type: 'html',
    content: html,
    metadata: {
      source_url: sourceUrl,
      date_accessed: new Date().toISOString(),
    },
  })
}

/**
 * Extract recipe from plain text (convenience function)
 */
export async function extractRecipeFromText(
  text: string
): Promise<ExtractionResult> {
  return extractRecipe({
    type: 'text',
    content: text,
  })
}

/**
 * Extract recipe from OCR text (convenience function)
 */
export async function extractRecipeFromOCR(
  ocrText: string
): Promise<ExtractionResult> {
  return extractRecipe({
    type: 'text',
    content: ocrText,
    metadata: {
      source_name: 'OCR Extraction',
    },
  })
}
