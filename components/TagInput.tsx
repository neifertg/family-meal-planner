'use client'

import { useState, KeyboardEvent } from 'react'

type TagInputProps = {
  tags: string[]
  onChange: (tags: string[]) => void
  suggestions?: string[]
  placeholder?: string
  label?: string
  error?: string
}

/**
 * Reusable tag input component with autocomplete suggestions
 * Allows users to add, remove, and manage tags with keyboard shortcuts
 */
export default function TagInput({
  tags,
  onChange,
  suggestions = [],
  placeholder = 'Add a tag and press Enter',
  label = 'Tags',
  error
}: TagInputProps) {
  const [inputValue, setInputValue] = useState('')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [similarTagWarning, setSimilarTagWarning] = useState<string | null>(null)

  // Calculate similarity between two strings (Levenshtein distance)
  const calculateSimilarity = (str1: string, str2: string): number => {
    const len1 = str1.length
    const len2 = str2.length
    const matrix: number[][] = []

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i]
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        )
      }
    }

    return matrix[len1][len2]
  }

  // Find similar existing tags
  const findSimilarTag = (newTag: string): string | null => {
    const normalized = newTag.trim().toLowerCase()
    const allExistingTags = [...suggestions, ...tags]

    for (const existingTag of allExistingTags) {
      const existing = existingTag.toLowerCase()
      if (existing === normalized) continue

      const distance = calculateSimilarity(normalized, existing)
      const maxLength = Math.max(normalized.length, existing.length)
      const similarity = 1 - distance / maxLength

      // If 70% similar or more, warn the user
      if (similarity >= 0.7) {
        return existingTag
      }
    }
    return null
  }

  // Filter suggestions based on input and exclude already-selected tags
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion.toLowerCase())
  )

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase()
    if (normalizedTag && !tags.includes(normalizedTag)) {
      // Check for similar tags
      const similarTag = findSimilarTag(normalizedTag)
      if (similarTag) {
        setSimilarTagWarning(`Similar tag exists: "${similarTag}". Did you mean that instead?`)
        // Still add the tag, but show warning
      } else {
        setSimilarTagWarning(null)
      }

      onChange([...tags, normalizedTag])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
    // Clear warning if user removes the tag that triggered it
    if (similarTagWarning && tags[tags.length - 1] === tagToRemove) {
      setSimilarTagWarning(null)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addTag(inputValue)
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      // Remove last tag when pressing backspace on empty input
      removeTag(tags[tags.length - 1])
    }
  }

  const handleSuggestionClick = (suggestion: string) => {
    addTag(suggestion)
  }

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}

      {/* Tags display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 hover:bg-indigo-200 transition-colors"
          >
            {tag}
            <button
              type="button"
              onClick={() => removeTag(tag)}
              className="text-indigo-600 hover:text-indigo-800 font-bold"
              aria-label={`Remove ${tag} tag`}
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Input field */}
      <div className="relative">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value)
            setShowSuggestions(e.target.value.length > 0)
          }}
          onKeyDown={handleKeyDown}
          onFocus={() => setShowSuggestions(inputValue.length > 0)}
          onBlur={() => {
            // Delay to allow click on suggestions
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          placeholder={placeholder}
          className={`w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 ${
            error ? 'border-red-500' : 'border-gray-300'
          }`}
        />

        {/* Suggestions dropdown */}
        {showSuggestions && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            {filteredSuggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-3 py-2 hover:bg-indigo-50 text-sm text-gray-700 hover:text-indigo-900"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {similarTagWarning && (
        <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <svg className="w-4 h-4 text-yellow-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <p className="text-xs text-yellow-800">{similarTagWarning}</p>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Type a tag and press Enter to add it. Click × to remove tags.
      </p>
    </div>
  )
}

/**
 * Common tag suggestions for recipes
 */
export const COMMON_RECIPE_TAGS = [
  // Meal types
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'appetizer',
  'side dish',

  // Dietary
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'low-carb',
  'paleo',
  'whole30',

  // Cuisine
  'mexican',
  'italian',
  'chinese',
  'japanese',
  'thai',
  'indian',
  'mediterranean',
  'american',
  'french',
  'korean',

  // Cooking method
  'grilled',
  'baked',
  'roasted',
  'fried',
  'slow cooker',
  'instant pot',
  'air fryer',
  'one-pot',
  'no-cook',

  // Characteristics
  'quick',
  'easy',
  'healthy',
  'comfort food',
  'spicy',
  'kid-friendly',
  'budget-friendly',
  'meal prep',
  'freezer-friendly',
  'high-protein',
  'low-calorie',

  // Course
  'soup',
  'salad',
  'sandwich',
  'pasta',
  'rice',
  'pizza',
  'tacos',
  'burgers',
  'chicken',
  'beef',
  'pork',
  'seafood',
  'fish',

  // Season
  'summer',
  'fall',
  'winter',
  'spring',
  'holiday'
]
