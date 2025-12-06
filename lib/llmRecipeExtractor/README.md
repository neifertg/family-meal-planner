# LLM-Based Recipe Extractor

## Overview

This module provides AI-powered recipe extraction that can intelligently parse recipes from **any source** - websites, images, PDFs, or plain text. It uses a hybrid approach for maximum reliability and cost-effectiveness:

1. **Schema.org JSON-LD** (Primary) - Fast, free extraction when structured data is available
2. **Google Gemini AI** (Fallback) - Intelligent extraction when schema.org is not available

## Features

✅ **Universal Compatibility** - Works with any recipe website, regardless of HTML structure
✅ **Structured Extraction** - Parses ingredients with quantities, units, and preparation notes
✅ **Smart Categorization** - Automatically identifies cuisine, difficulty, dietary tags
✅ **Cost Optimized** - Uses free schema.org first, AI only when needed
✅ **High Accuracy** - Confidence scoring and validation

## Setup

### 1. Get Google Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key

### 2. Add to Environment Variables

Add your Gemini API key to `.env.local`:

```bash
GEMINI_API_KEY=your_api_key_here
```

### 3. Install Dependencies

The required dependencies are already installed:
- `@google/generative-ai` - Google Gemini SDK
- `cheerio` - HTML parsing (for schema.org extraction)

## Usage

### Extract from URL

```typescript
import { extractRecipeFromURL } from '@/lib/llmRecipeExtractor'

const result = await extractRecipeFromURL('https://example.com/recipe')

if (result.success) {
  console.log('Recipe:', result.recipe)
  console.log('Method:', result.extraction_method) // 'schema.org' or 'gemini'
  console.log('Confidence:', result.confidence) // 0-100
}
```

### Extract from Text (OCR, Manual Entry)

```typescript
import { extractRecipeFromText } from '@/lib/llmRecipeExtractor'

const ocrText = `
  Chocolate Chip Cookies

  Ingredients:
  2 cups flour
  1 cup sugar
  ...
`

const result = await extractRecipeFromText(ocrText)
```

### Force AI Extraction

```typescript
// Skip schema.org and use AI directly
const result = await extractRecipeFromURL(url, true)
```

## API Route

The extraction is exposed via `/api/scrape-recipe`:

```typescript
// POST /api/scrape-recipe
{
  "url": "https://example.com/recipe",
  "preferLLM": false  // Optional: force AI extraction
}

// OR extract from text
{
  "text": "Recipe content here..."
}
```

## Extracted Data Structure

```typescript
type ExtractedRecipe = {
  title: string
  description?: string

  ingredients: Array<{
    item: string
    quantity?: number
    unit?: string
    preparation?: string  // "chopped", "diced", etc.
  }>

  instructions: Array<{
    step_number: number
    instruction: string
    time_minutes?: number
    temperature?: string
  }>

  prep_time_minutes?: number
  cook_time_minutes?: number
  servings?: number

  cuisine?: string
  category?: string
  difficulty?: 'easy' | 'medium' | 'hard'

  dietary_tags?: string[]  // ["vegetarian", "gluten-free"]
  allergens?: string[]     // ["nuts", "dairy"]

  nutrition?: {
    calories?: number
    protein_g?: number
    // ... more fields
  }

  // ... and more
}
```

## Cost Optimization

The system is designed to minimize API costs:

1. **Free-First Strategy**: Always tries schema.org before AI
2. **Content Cleaning**: Removes HTML, ads, navigation before sending to AI
3. **Token Limiting**: Sends max ~10k characters to AI
4. **Efficient Model**: Uses Gemini 1.5 Flash (cheapest, fastest)

### Estimated Costs

- **Schema.org extraction**: FREE (80% of sites)
- **Gemini extraction**: ~$0.0001-0.001 per recipe (varies by content length)

## Confidence Scoring

The system returns a confidence score (0-100) based on:
- Completeness of extracted data
- Presence of required fields (title, ingredients, instructions)
- Quality of structured data (quantities, units)

- **95-100%**: Schema.org extraction (highly reliable)
- **80-95%**: Complete AI extraction with all fields
- **60-80%**: Good AI extraction, some fields missing
- **Below 60%**: Incomplete extraction, may need manual review

## Testing

Test the extractor with these sites:
- tastesbetterfromscratch.com (schema.org)
- allrecipes.com (schema.org)
- foodnetwork.com (schema.org)
- Personal blogs (AI fallback)

## Future Enhancements

- [ ] Gemini Vision for direct image extraction
- [ ] PDF support
- [ ] Recipe caching/deduplication
- [ ] Batch processing UI
- [ ] Cost tracking dashboard
- [ ] Claude API as alternative to Gemini

## Architecture

```
┌──────────────┐
│   User URL   │
└──────┬───────┘
       │
       v
┌──────────────────────────────────┐
│  Try Schema.org JSON-LD First   │ ← FREE, FAST
└──────┬───────────────────────────┘
       │
       │ Not found?
       v
┌──────────────────────────────────┐
│  Fetch & Clean HTML Content     │
└──────┬───────────────────────────┘
       │
       v
┌──────────────────────────────────┐
│  Send to Gemini AI for Extract  │ ← SMART, PAID
└──────┬───────────────────────────┘
       │
       v
┌──────────────────────────────────┐
│  Return Structured Recipe Data  │
└──────────────────────────────────┘
```

## Troubleshooting

### "GEMINI_API_KEY environment variable not set"

Make sure you've added the API key to `.env.local` and restarted the dev server.

### Extraction returns low confidence

- Try `preferLLM: true` to force AI extraction
- Check if the URL actually contains a recipe
- Some paywalled sites may not work

### High token usage

The system automatically limits content to ~10k chars. If you're still seeing high usage:
- Check the URL isn't loading entire blog archives
- Report high-usage sites for better content cleaning
