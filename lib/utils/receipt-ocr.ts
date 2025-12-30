/**
 * Receipt OCR Preprocessing
 *
 * Uses OCR to extract text with bounding boxes for pixel-perfect positioning.
 * This complements Claude Vision by providing structured text coordinates.
 */

export interface OCRWord {
  text: string
  confidence: number
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface OCRLine {
  id: number
  text: string
  words: OCRWord[]
  bbox: {
    x: number
    y: number
    width: number
    height: number
  }
  avg_confidence: number
}

export interface OCRResult {
  lines: OCRLine[]
  image_width: number
  image_height: number
  total_confidence: number
  processing_time_ms: number
}

/**
 * Group OCR words into lines based on y-coordinate proximity
 */
function groupWordsIntoLines(words: OCRWord[], yTolerance: number = 5): OCRLine[] {
  if (words.length === 0) return []

  // Sort words by y-coordinate, then x-coordinate
  const sorted = [...words].sort((a, b) => {
    const yDiff = a.bbox.y - b.bbox.y
    return Math.abs(yDiff) < yTolerance ? a.bbox.x - b.bbox.x : yDiff
  })

  const lines: OCRLine[] = []
  let currentLine: OCRWord[] = [sorted[0]]

  for (let i = 1; i < sorted.length; i++) {
    const word = sorted[i]
    const prevWord = sorted[i - 1]

    // If y-coordinate is close to previous word, add to same line
    if (Math.abs(word.bbox.y - prevWord.bbox.y) < yTolerance) {
      currentLine.push(word)
    } else {
      // Start new line
      lines.push(createLineFromWords(currentLine, lines.length))
      currentLine = [word]
    }
  }

  // Add final line
  if (currentLine.length > 0) {
    lines.push(createLineFromWords(currentLine, lines.length))
  }

  return lines
}

/**
 * Create an OCRLine object from an array of words
 */
function createLineFromWords(words: OCRWord[], lineId: number): OCRLine {
  const text = words.map(w => w.text).join(' ')
  const avgConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length

  // Calculate bounding box that encompasses all words
  const minX = Math.min(...words.map(w => w.bbox.x))
  const minY = Math.min(...words.map(w => w.bbox.y))
  const maxX = Math.max(...words.map(w => w.bbox.x + w.bbox.width))
  const maxY = Math.max(...words.map(w => w.bbox.y + w.bbox.height))

  return {
    id: lineId,
    text,
    words,
    bbox: {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    },
    avg_confidence: avgConfidence
  }
}

/**
 * Perform OCR on receipt image (browser-based using Tesseract.js)
 */
export async function performOCR(
  imageBase64: string,
  mimeType: string
): Promise<OCRResult | null> {
  try {
    const startTime = Date.now()

    console.log('[receipt-ocr] Starting OCR processing...')

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      console.warn('[receipt-ocr] OCR only available in browser environment')
      return null
    }

    // Dynamically import Tesseract.js (client-side only)
    const Tesseract = await import('tesseract.js')

    // Convert base64 to image element for Tesseract
    const imageDataUrl = imageBase64.startsWith('data:')
      ? imageBase64
      : `data:${mimeType};base64,${imageBase64}`

    console.log('[receipt-ocr] Running Tesseract recognition...')

    // Run OCR with Tesseract.js
    const { data } = await Tesseract.recognize(imageDataUrl, 'eng', {
      logger: (m: any) => {
        if (m.status === 'recognizing text') {
          console.log('[receipt-ocr] Progress:', Math.round(m.progress * 100) + '%')
        }
      }
    })

    // Extract words with bounding boxes
    const words: OCRWord[] = data.words.map(word => ({
      text: word.text,
      confidence: word.confidence,
      bbox: {
        x: word.bbox.x0,
        y: word.bbox.y0,
        width: word.bbox.x1 - word.bbox.x0,
        height: word.bbox.y1 - word.bbox.y0
      }
    }))

    // Group words into lines
    const lines = groupWordsIntoLines(words)

    const processingTime = Date.now() - startTime
    const totalConfidence = words.reduce((sum, w) => sum + w.confidence, 0) / words.length

    console.log('[receipt-ocr] OCR complete', {
      lineCount: lines.length,
      wordCount: words.length,
      avgConfidence: totalConfidence.toFixed(1) + '%',
      processingTime: processingTime + 'ms'
    })

    return {
      lines,
      image_width: data.imageWidth,
      image_height: data.imageHeight,
      total_confidence: totalConfidence,
      processing_time_ms: processingTime
    }

  } catch (error: any) {
    console.error('[receipt-ocr] OCR failed:', error)
    return null
  }
}

/**
 * Format OCR results for inclusion in Claude prompt
 */
export function formatOCRForPrompt(ocrResult: OCRResult): string {
  const lines = ocrResult.lines.map(line => ({
    line_id: line.id,
    text: line.text,
    y_position: line.bbox.y,
    height: line.bbox.height,
    confidence: Math.round(line.avg_confidence)
  }))

  return `
OCR TEXT STRUCTURE (${lines.length} lines detected):
${JSON.stringify(lines, null, 2)}

Image dimensions: ${ocrResult.image_width}x${ocrResult.image_height}px
Average OCR confidence: ${ocrResult.total_confidence.toFixed(1)}%

INSTRUCTIONS FOR USING OCR DATA:
1. For each item you extract, reference the OCR line via "ocr_line_id"
2. Use OCR text to help parse difficult-to-read items
3. OCR may have errors (low confidence) - use the IMAGE to correct them
4. If an item spans multiple OCR lines, reference the FIRST line
5. Use OCR y_position for pixel-perfect position_percent calculation:
   position_percent = (y_position / ${ocrResult.image_height}) * 100
`
}

/**
 * Calculate position_percent from OCR bounding box
 */
export function calculatePositionFromOCR(
  ocrLineId: number,
  ocrResult: OCRResult
): number {
  const line = ocrResult.lines.find(l => l.id === ocrLineId)
  if (!line) return 0

  // Calculate position as percentage of image height
  const positionPercent = (line.bbox.y / ocrResult.image_height) * 100

  // Clamp to valid range
  return Math.max(0, Math.min(100, positionPercent))
}

/**
 * Match extracted items to OCR lines based on text similarity
 */
export function matchItemsToOCR(
  itemSourceText: string,
  ocrResult: OCRResult
): number | null {
  const normalizedSource = itemSourceText.toLowerCase().replace(/[^\w\s]/g, '')

  // Find OCR line with highest text similarity
  let bestMatch: { lineId: number; similarity: number } | null = null

  for (const line of ocrResult.lines) {
    const normalizedOCR = line.text.toLowerCase().replace(/[^\w\s]/g, '')

    // Simple substring matching (could be improved with Levenshtein)
    const similarity = calculateTextSimilarity(normalizedSource, normalizedOCR)

    if (similarity > 0.5 && (!bestMatch || similarity > bestMatch.similarity)) {
      bestMatch = { lineId: line.id, similarity }
    }
  }

  return bestMatch?.lineId || null
}

/**
 * Simple text similarity calculation (Jaccard similarity)
 */
function calculateTextSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.split(/\s+/))
  const words2 = new Set(text2.split(/\s+/))

  const intersection = new Set([...words1].filter(w => words2.has(w)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Decide whether to use OCR based on receipt characteristics
 */
export function shouldUseOCR(config?: { enable_ocr?: boolean; min_items_for_ocr?: number }): boolean {
  // For Phase 2, make OCR opt-in
  return config?.enable_ocr === true
}
