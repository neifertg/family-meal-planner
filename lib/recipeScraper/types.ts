/**
 * Recipe Scraper Types
 * Defines the structure for scraped recipe data
 */

export type ScrapedRecipe = {
  name: string
  description?: string
  image_url?: string
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number
  servings?: number
  cuisine?: string
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'
  ingredients: string[]
  instructions: string[]
  tags?: string[]
  source_url: string
  source_name?: string
  author?: string
  nutrition?: {
    calories?: number
    protein?: string
    carbohydrates?: string
    fat?: string
    fiber?: string
    sugar?: string
  }
  rating?: {
    value: number
    count: number
  }
}

export type ScrapeResult = {
  success: boolean
  recipe?: ScrapedRecipe
  error?: string
  method?: 'schema.org' | 'html-fallback' | 'site-specific'
}

export type ScrapeError = {
  code: 'FETCH_ERROR' | 'PARSE_ERROR' | 'NO_RECIPE_FOUND' | 'INVALID_URL'
  message: string
  url: string
}
