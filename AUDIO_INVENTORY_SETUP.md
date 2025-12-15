# Audio Inventory Setup Guide

This feature allows users to upload audio files listing their inventory items, which are automatically transcribed and parsed into structured inventory data.

## Prerequisites

1. **OpenAI API Account** (for Whisper speech-to-text)
2. **Anthropic API Account** (for Claude text parsing) - You likely already have this

## Setup Steps

### 1. Get OpenAI API Key

1. Go to https://platform.openai.com/api-keys
2. Sign up or log in
3. Click "Create new secret key"
4. Copy the key (starts with `sk-...`)
5. **Important**: This is separate from ChatGPT Plus subscription

### 2. Add Environment Variables

Add these to your `.env.local` file:

```env
# OpenAI API (for Whisper audio transcription)
OpenAI_Whisper=sk-your-openai-api-key-here

# Anthropic API (for Claude parsing) - you likely already have this
ANTHROPIC_API_KEY=sk-ant-your-anthropic-key-here
```

### 3. Install OpenAI SDK

Run this command to install the required package:

```bash
npm install openai
```

### 4. Restart Development Server

```bash
npm run dev
```

## Pricing

### OpenAI Whisper API
- **Cost**: $0.006 per minute of audio
- **Examples**:
  - 5 minutes: $0.03
  - 10 minutes: $0.06
  - Very affordable for occasional use

### Anthropic Claude API
- You're already using this for receipt scanning
- Parsing a transcript adds minimal cost (~$0.01-0.03 per request)

## How to Use

1. Go to **Dashboard → Inventory**
2. Click the **"Audio Upload"** button (microphone icon)
3. Upload an audio file (MP3, WAV, M4A, WebM - max 25MB)
4. Wait for:
   - **Transcription** (Whisper converts speech to text)
   - **Parsing** (Claude extracts structured inventory data)
5. **Review & Edit** the extracted items
6. Click **"Import Items"** to add them to your inventory

## Supported Audio Formats

- MP3
- WAV
- M4A
- WebM
- OGG
- Max file size: 25MB

## Tips for Best Results

### Speaking Tips
- Speak clearly and at a moderate pace
- Example: "Two pounds of chicken breast expires January 20th, three cans of black beans, half gallon of milk good until next Tuesday"

### Quantity Phrases
- "2 pounds", "3 cans", "half gallon" - Will be parsed correctly
- "A bunch", "some" - Parsed as vague/null quantity
- Numbers can be spoken naturally: "two" or "2"

### Date Phrases
- Absolute: "expires January 20th", "good until March 15th"
- Relative: "expires in 3 days", "good for another week", "expires next Tuesday"
- If not mentioned, expiration date will be null

### Categories
The AI will automatically categorize items:
- **Produce**: Vegetables, fruits
- **Meat**: Chicken, beef, pork, fish
- **Dairy**: Milk, cheese, yogurt, eggs, butter
- **Pantry**: Canned goods, pasta, rice, flour
- **Frozen**: Frozen meals, ice cream
- **Other**: Everything else

## Troubleshooting

### "No API key" error
- Make sure `OpenAI_Whisper` is in your `.env.local`
- Restart the dev server after adding the key

### "Invalid file type" error
- Only use supported audio formats
- Convert other formats using online converters

### "File too large" error
- Max size is 25MB
- Compress audio or split into shorter recordings

### Low confidence items
- Items marked with low confidence need manual review
- Check the original transcript at the top of the review screen
- Edit any incorrect names, quantities, or dates

## Architecture

```
User uploads audio file
    ↓
POST /api/inventory/transcribe-audio
    → OpenAI Whisper API transcribes to text
    ↓
POST /api/inventory/parse-transcript
    → Claude API parses text into structured JSON
    ↓
User reviews & edits items
    ↓
Bulk insert into inventory_items table
```

## Future Enhancements

Potential improvements for later:
- Live microphone recording (no file upload needed)
- Support for longer audio files (chunking)
- Multi-language support
- Voice commands for editing ("delete that last item")
- Auto-categorization learning from user corrections
