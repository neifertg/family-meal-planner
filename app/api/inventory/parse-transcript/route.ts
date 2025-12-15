import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { transcript } = await request.json()

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json(
        { error: 'No transcript provided' },
        { status: 400 }
      )
    }

    console.log('Parsing transcript:', transcript.substring(0, 200) + '...')

    // Get today's date for relative date parsing
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0]

    // Use Claude to parse the transcript into structured inventory items
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are an expert at parsing grocery/pantry inventory lists from natural speech transcripts.

Today's date is: ${todayStr}

Parse the following transcript into a JSON array of inventory items. For each item, extract:
- name (string): The item name
- quantity (string|null): Quantity with unit if mentioned (e.g., "2 pounds", "3 cans", "1 gallon"), or null if not mentioned
- category (string): One of: "produce", "meat", "dairy", "pantry", "frozen", "other"
- expiration_date (string|null): ISO date string (YYYY-MM-DD) if mentioned, null otherwise
- confidence (string): "high", "medium", or "low" based on how clear the item information is
- original_text (string): The original phrase from the transcript for this item

Guidelines for parsing:
1. Quantity parsing:
   - "two pounds" → "2 pounds"
   - "three cans" → "3 cans"
   - "a bunch" → "1 bunch"
   - "half gallon" → "0.5 gallon"
   - "some" or vague amounts → null

2. Date parsing (relative to ${todayStr}):
   - "expires January 20th" → "2025-01-20"
   - "good until next Tuesday" → calculate actual date
   - "expires in 3 days" → add 3 days to today
   - "good for another week" → add 7 days to today
   - "probably 5 days left" → add 5 days to today
   - No mention → null

3. Category inference:
   - Vegetables, fruits → "produce"
   - Chicken, beef, pork, fish → "meat"
   - Milk, cheese, yogurt, butter, eggs → "dairy"
   - Canned goods, pasta, rice, flour, spices → "pantry"
   - Frozen meals, ice cream → "frozen"
   - Unclear → "other"

4. Confidence levels:
   - "high": Clear item name, quantity, and optional date
   - "medium": Clear item name, vague or missing quantity/date
   - "low": Unclear or ambiguous item

5. Handle natural speech:
   - "um", "uh", "like" are filler words - ignore them
   - Group related phrases: "two pounds of chicken breast" is ONE item
   - Commas and "and" typically separate different items

Return ONLY valid JSON in this exact format (no markdown, no extra text):
{
  "items": [
    {
      "name": "chicken breast",
      "quantity": "2 pounds",
      "category": "meat",
      "expiration_date": "2025-01-20",
      "confidence": "high",
      "original_text": "two pounds of chicken breast expires January 20th"
    }
  ]
}

Transcript to parse:
${transcript}`
        }
      ]
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    console.log('Claude response:', responseText.substring(0, 200) + '...')

    // Parse the JSON response
    let parsedData
    try {
      // Remove markdown code blocks if present
      const cleanedResponse = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      parsedData = JSON.parse(cleanedResponse)
    } catch (parseError) {
      console.error('Failed to parse Claude response as JSON:', responseText)
      return NextResponse.json(
        { error: 'Failed to parse AI response', raw: responseText },
        { status: 500 }
      )
    }

    if (!parsedData.items || !Array.isArray(parsedData.items)) {
      return NextResponse.json(
        { error: 'Invalid response format from AI', raw: parsedData },
        { status: 500 }
      )
    }

    // Calculate summary
    const highConfidence = parsedData.items.filter((item: any) => item.confidence === 'high').length
    const needsReview = parsedData.items.filter((item: any) => item.confidence === 'low').length

    const response = {
      items: parsedData.items,
      summary: {
        total_items: parsedData.items.length,
        high_confidence: highConfidence,
        needs_review: needsReview
      }
    }

    console.log('Parsed inventory:', response.summary)

    return NextResponse.json(response)
  } catch (error: any) {
    console.error('Error parsing transcript:', error)

    return NextResponse.json(
      { error: error.message || 'Failed to parse transcript' },
      { status: 500 }
    )
  }
}
