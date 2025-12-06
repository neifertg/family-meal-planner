import { NextRequest, NextResponse } from 'next/server'
import { extractRecipeFromURL, extractRecipeFromText } from '@/lib/llmRecipeExtractor'

/**
 * POST /api/scrape-recipe
 *
 * Extracts a recipe using AI-powered extraction
 *
 * Body:
 * {
 *   url?: string - The recipe URL to extract from
 *   text?: string - Plain text or OCR text to extract from
 *   preferLLM?: boolean - Force LLM extraction even if schema.org available
 * }
 *
 * Returns:
 * {
 *   success: boolean
 *   recipe?: ExtractedRecipe
 *   error?: string
 *   extraction_method?: 'gemini' | 'claude' | 'schema.org' | 'fallback'
 *   confidence?: number
 *   tokens_used?: number
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url, text, preferLLM = false } = body

    // Validate input
    if (!url && !text) {
      return NextResponse.json(
        { success: false, error: 'Either url or text is required' },
        { status: 400 }
      )
    }

    // Extract the recipe
    let result
    if (url) {
      console.log(`API: Extracting recipe from URL: ${url}`)
      result = await extractRecipeFromURL(url, preferLLM)
    } else {
      console.log(`API: Extracting recipe from text input`)
      result = await extractRecipeFromText(text)
    }

    if (result.success) {
      console.log(`API: Successfully extracted recipe using ${result.extraction_method}`)
      console.log(`API: Confidence: ${result.confidence}%`)
      if (result.tokens_used) {
        console.log(`API: Tokens used: ${result.tokens_used}`)
      }
      return NextResponse.json(result)
    } else {
      console.log(`API: Failed to extract recipe: ${result.error}`)
      return NextResponse.json(result, { status: 400 })
    }
  } catch (error: any) {
    console.error('API: Extraction error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Internal server error while extracting recipe',
        extraction_method: 'fallback'
      },
      { status: 500 }
    )
  }
}
