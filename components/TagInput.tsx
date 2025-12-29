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

  // Filter suggestions based on input and exclude already-selected tags
  const filteredSuggestions = suggestions.filter(
    (suggestion) =>
      suggestion.toLowerCase().includes(inputValue.toLowerCase()) &&
      !tags.includes(suggestion.toLowerCase())
  )

  const addTag = (tag: string) => {
    const normalizedTag = tag.trim().toLowerCase()
    if (normalizedTag && !tags.includes(normalizedTag)) {
      onChange([...tags, normalizedTag])
      setInputValue('')
      setShowSuggestions(false)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter((tag) => tag !== tagToRemove))
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
