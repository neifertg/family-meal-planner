declare module 'recipe-scraper' {
  interface Recipe {
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

  function recipeScraper(url: string): Promise<Recipe | null>
  export default recipeScraper
}
