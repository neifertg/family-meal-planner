/**
 * OCR-based Receipt Text Extraction
 *
 * Uses Tesseract.js to extract text with bounding box coordinates
 * Allows visual highlighting of receipt items
 */

import Tesseract from 'tesseract.js'
import { BoundingBox } from './types'

export type OCRWord = {
  text: string
  bbox: BoundingBox
  confidence: number
  line: number
}

export type OCRResult = {
  words: OCRWord[]
  fullText: string
  width: number
  height: number
}

/**
 * Extract text and bounding boxes from receipt image using Tesseract OCR
 */
export async function extractTextWithBoundingBoxes(
  imageData: string
): Promise<OCRResult> {
  try {
    // Run Tesseract OCR
    const result = await Tesseract.recognize(
      imageData,
      'eng',
      {
        logger: (m) => {
          // Optional: Log progress
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`)
          }
        }
      }
    )

    // Extract word-level bounding boxes
    const words: OCRWord[] = []

    // Tesseract.js structure: result.data.lines[] -> line.words[]
    if (result.data && result.data.lines) {
      result.data.lines.forEach((line: any, lineIndex: number) => {
        if (line.words && Array.isArray(line.words)) {
          line.words.forEach((word: any) => {
            if (word && word.text && word.bbox) {
              const bbox = word.bbox
              words.push({
                text: word.text,
                bbox: {
                  x: bbox.x0,
                  y: bbox.y0,
                  width: bbox.x1 - bbox.x0,
                  height: bbox.y1 - bbox.y0
                },
                confidence: word.confidence || 0,
                line: lineIndex
              })
            }
          })
        }
      })
    }

    return {
      words,
      fullText: result.data?.text || '',
      width: result.data?.imageWidth || 0,
      height: result.data?.imageHeight || 0
    }

  } catch (error: any) {
    console.error('OCR extraction error:', error)
    throw new Error(`Failed to extract text from image: ${error.message}`)
  }
}

/**
 * Match a source text string to OCR words and calculate bounding box
 *
 * Finds the best matching sequence of words in the OCR result
 * and returns a combined bounding box that encompasses them
 */
export function matchSourceTextToBoundingBox(
  sourceText: string,
  ocrResult: OCRResult
): BoundingBox | null {
  console.log('matchSourceTextToBoundingBox called:', { sourceText, ocrWordCount: ocrResult.words.length })

  if (!sourceText || ocrResult.words.length === 0) {
    console.log('Early return - no source text or no OCR words')
    return null
  }

  // Normalize source text for matching
  const normalizedSource = sourceText.toLowerCase().replace(/[^a-z0-9\s]/g, '')
  const sourceWords = normalizedSource.split(/\s+/).filter(w => w.length > 0)

  console.log('Normalized source:', { normalizedSource, sourceWords })

  if (sourceWords.length === 0) {
    console.log('Early return - no source words after normalization')
    return null
  }

  // Try to find the best matching sequence in OCR words
  let bestMatch: OCRWord[] = []
  let bestScore = 0

  for (let i = 0; i < ocrResult.words.length; i++) {
    // Try matching starting from this position
    let matchedWords: OCRWord[] = []
    let score = 0
    let sourceIdx = 0

    for (let j = i; j < ocrResult.words.length && sourceIdx < sourceWords.length; j++) {
      const ocrWord = ocrResult.words[j].text.toLowerCase().replace(/[^a-z0-9]/g, '')
      const sourceWord = sourceWords[sourceIdx]

      // Check if OCR word matches or contains source word
      if (ocrWord.includes(sourceWord) || sourceWord.includes(ocrWord)) {
        matchedWords.push(ocrResult.words[j])
        score += ocrWord.length
        sourceIdx++
      } else if (matchedWords.length > 0) {
        // Allow one mismatch in the middle
        if (sourceIdx < sourceWords.length - 1) {
          continue
        } else {
          break
        }
      }
    }

    // Check if this is a better match
    if (sourceIdx >= Math.ceil(sourceWords.length * 0.6) && score > bestScore) {
      bestMatch = matchedWords
      bestScore = score
    }
  }

  // If we found a match, calculate combined bounding box
  if (bestMatch.length > 0) {
    console.log('Found match! bestMatch words:', bestMatch.map(w => w.text))
    const minX = Math.min(...bestMatch.map(w => w.bbox.x))
    const minY = Math.min(...bestMatch.map(w => w.bbox.y))
    const maxX = Math.max(...bestMatch.map(w => w.bbox.x + w.bbox.width))
    const maxY = Math.max(...bestMatch.map(w => w.bbox.y + w.bbox.height))

    const bbox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    }
    console.log('Returning bounding box:', bbox)
    return bbox
  }

  console.log('No match found for source text:', sourceText)
  return null
}

/**
 * Match multiple source texts to bounding boxes in parallel
 */
export function matchMultipleSourceTexts(
  sourceTexts: string[],
  ocrResult: OCRResult
): (BoundingBox | null)[] {
  return sourceTexts.map(text => matchSourceTextToBoundingBox(text, ocrResult))
}
