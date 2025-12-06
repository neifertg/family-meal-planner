/**
 * LLM-Based Recipe Extraction Types
 *
 * Structured schema for AI to extract recipe data from any source
 */

export type RecipeIngredient = {
  item: string                    // e.g., "flour"
  quantity?: number               // e.g., 2
  unit?: string                   // e.g., "cups"
  preparation?: string            // e.g., "sifted", "chopped"
  notes?: string                  // e.g., "or substitute almond flour"
}

export type RecipeInstruction = {
  step_number: number
  instruction: string
  time_minutes?: number           // Time for this specific step
  temperature?: string            // e.g., "350°F"
}

export type NutritionalInfo = {
  calories?: number
  protein_g?: number
  carbohydrates_g?: number
  fat_g?: number
  fiber_g?: number
  sugar_g?: number
  sodium_mg?: number
  serving_size?: string
}

export type ExtractedRecipe = {
  // Basic Info
  title: string
  description?: string
  author?: string
  source_url?: string

  // Ingredients
  ingredients: RecipeIngredient[]
  ingredient_groups?: {
    group_name: string            // e.g., "For the dough", "For the sauce"
    ingredients: RecipeIngredient[]
  }[]

  // Instructions
  instructions: RecipeInstruction[]

  // Timing
  prep_time_minutes?: number
  cook_time_minutes?: number
  total_time_minutes?: number

  // Serving Info
  servings?: number
  yield?: string                   // e.g., "12 cookies", "1 9-inch cake"

  // Classification
  cuisine?: string                 // e.g., "Italian", "Mexican"
  category?: string                // e.g., "Dessert", "Main Course"
  difficulty?: 'easy' | 'medium' | 'hard'
  meal_type?: string[]             // e.g., ["breakfast", "brunch"]

  // Dietary & Tags
  dietary_tags?: string[]          // e.g., ["vegetarian", "gluten-free", "dairy-free"]
  allergens?: string[]             // e.g., ["nuts", "dairy", "eggs"]
  tags?: string[]                  // e.g., ["quick", "one-pot", "make-ahead"]

  // Nutrition
  nutrition?: NutritionalInfo

  // Additional Info
  equipment_needed?: string[]      // e.g., ["stand mixer", "9-inch pan"]
  tips?: string[]                  // Cooking tips from the recipe
  substitutions?: string[]         // Mentioned ingredient substitutions
  storage_instructions?: string

  // Images
  image_url?: string
  image_urls?: string[]            // Multiple images if available

  // Metadata
  rating?: {
    value: number                  // e.g., 4.5
    count: number                  // Number of ratings
  }
  reviews_summary?: string         // Summary of what reviewers said
}

export type ExtractionResult = {
  success: boolean
  recipe?: ExtractedRecipe
  error?: string
  confidence?: number              // 0-100, how confident the LLM is
  extraction_method: 'gemini' | 'claude' | 'schema.org' | 'fallback'
  tokens_used?: number
  cost_usd?: number
}

export type ContentSource = {
  type: 'url' | 'html' | 'image' | 'pdf' | 'text'
  content: string                  // URL, HTML string, image URL/base64, PDF path, or plain text
  metadata?: {
    source_name?: string
    source_url?: string
    date_accessed?: string
  }
}
