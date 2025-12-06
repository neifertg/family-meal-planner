export type ParsedRecipe = {
  name: string
  description: string
  prepTime: string
  cookTime: string
  servings: string
  ingredients: string
  instructions: string
}

export function parseRecipeText(text: string): ParsedRecipe {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0)

  let name = ''
  let description = ''
  let prepTime = ''
  let cookTime = ''
  let servings = ''
  const ingredients: string[] = []
  const instructions: string[] = []

  let currentSection: 'none' | 'ingredients' | 'instructions' | 'directions' = 'none'

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const lowerLine = line.toLowerCase()

    // Extract recipe name (usually first line or largest text)
    if (i === 0 && !name && line.length > 0 && line.length < 100) {
      name = line
      continue
    }

    // Detect sections
    if (lowerLine.includes('ingredient')) {
      currentSection = 'ingredients'
      continue
    }

    if (lowerLine.includes('instruction') || lowerLine.includes('direction') || lowerLine.includes('steps')) {
      currentSection = 'instructions'
      continue
    }

    // Extract times and servings
    const prepMatch = line.match(/prep(?:\s+time)?:?\s*(\d+)\s*(?:min|minute)/i)
    if (prepMatch) {
      prepTime = prepMatch[1]
      continue
    }

    const cookMatch = line.match(/cook(?:\s+time)?:?\s*(\d+)\s*(?:min|minute)/i)
    if (cookMatch) {
      cookTime = cookMatch[1]
      continue
    }

    const servingsMatch = line.match(/(?:serves?|servings?|yields?):?\s*(\d+)/i)
    if (servingsMatch) {
      servings = servingsMatch[1]
      continue
    }

    // Add to current section
    if (currentSection === 'ingredients') {
      // Check if line looks like an ingredient (has measurements, common ingredient words, etc.)
      if (
        line.length > 2 &&
        (
          /^\d/.test(line) || // Starts with number
          /cup|tbsp|tsp|oz|lb|gram|ml|liter/i.test(line) || // Has measurements
          /^\s*[-•*]/.test(line) || // Starts with bullet
          /\d+\/\d+/.test(line) // Has fractions
        )
      ) {
        ingredients.push(line.replace(/^[-•*]\s*/, '')) // Remove bullet points
      }
    } else if (currentSection === 'instructions') {
      // Check if line looks like an instruction
      if (line.length > 10) {
        // Remove step numbers like "1.", "Step 1:", etc.
        const cleanedLine = line.replace(/^(?:step\s*)?\d+[.):]\s*/i, '')
        if (cleanedLine.length > 5) {
          instructions.push(cleanedLine)
        }
      }
    } else if (currentSection === 'none' && i > 0 && i < 5) {
      // First few lines might be description
      if (line.length > 20 && line.length < 500 && !description) {
        description = line
      }
    }
  }

  return {
    name: name || 'Untitled Recipe',
    description: description || '',
    prepTime: prepTime || '',
    cookTime: cookTime || '',
    servings: servings || '',
    ingredients: ingredients.join('\n'),
    instructions: instructions.join('\n')
  }
}
