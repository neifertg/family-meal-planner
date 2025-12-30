import { NextRequest, NextResponse } from 'next/server'
import { extractReceiptFromImage, extractReceiptWithChunking, extractReceiptWithOCR } from '@/lib/receiptScanner/claudeExtractor'
import { getVendorLearningExamples, getGeneralLearningExamples } from '@/lib/receiptScanner/learningSystem'

// Configure route to handle large payloads (base64 images)
// For Vercel: maxDuration is max execution time
// Body size is controlled by Vercel deployment settings
export const maxDuration = 60 // 60 seconds max execution time

/**
 * Receipt Scanning API - CLAUDE VISION ONLY
 *
 * This endpoint exclusively uses Claude Vision (Anthropic's multimodal AI) for receipt scanning.
 * There is NO OCR fallback. All receipt processing goes through Claude Sonnet 4.
 *
 * If scanning fails, check:
 * 1. ANTHROPIC_API_KEY environment variable is set correctly
 * 2. Image is in valid format (JPEG, PNG, WebP)
 * 3. Image size is under Claude's limits
 * 4. API rate limits haven't been exceeded
 */
export async function POST(request: NextRequest) {
  try {
    console.log('[scan-receipt] Request received', {
      timestamp: new Date().toISOString(),
      headers: Object.fromEntries(request.headers.entries())
    })

    const body = await request.json()
    const { imageData, familyId, storeName, options } = body

    console.log('[scan-receipt] Request parsed', {
      hasImageData: !!imageData,
      imageDataLength: imageData?.length,
      familyId,
      storeName
    })

    if (!imageData) {
      console.error('[scan-receipt] No image data provided')
      return NextResponse.json(
        { success: false, error: 'No image data provided' },
        { status: 400 }
      )
    }

    if (!familyId) {
      console.error('[scan-receipt] No family ID provided')
      return NextResponse.json(
        { success: false, error: 'Family ID is required' },
        { status: 400 }
      )
    }

    // Validate image data format
    const base64Match = imageData.match(/^data:([^;]+);base64,(.+)$/)
    if (!base64Match) {
      console.error('[scan-receipt] Invalid image format', {
        imageDataPrefix: imageData.substring(0, 100)
      })
      return NextResponse.json(
        { success: false, error: 'Invalid image data format. Expected base64 data URL.' },
        { status: 400 }
      )
    }

    const [, mimeType, imageBase64] = base64Match

    console.log('[scan-receipt] Image validated', {
      mimeType,
      base64Length: imageBase64.length,
      estimatedSizeKB: Math.round(imageBase64.length * 0.75 / 1024)
    })

    // Validate mime type
    if (!mimeType.startsWith('image/')) {
      console.error('[scan-receipt] Invalid mime type', { mimeType })
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Must be an image.' },
        { status: 400 }
      )
    }

    // Fetch learning examples to improve extraction accuracy
    let learningExamples: any[] = []
    if (familyId) {
      console.log('[scan-receipt] Fetching learning examples', { familyId, storeName })
      // Try vendor-specific examples first
      if (storeName) {
        learningExamples = await getVendorLearningExamples(familyId, storeName, 10)
        console.log('[scan-receipt] Vendor-specific examples found', { count: learningExamples.length })
      }

      // If no vendor-specific examples, get general ones
      if (learningExamples.length === 0) {
        learningExamples = await getGeneralLearningExamples(familyId, 5)
        console.log('[scan-receipt] General examples found', { count: learningExamples.length })
      }
    }

    // Phase 2: Decide which extraction method to use
    let result

    // Option 1: User explicitly enabled chunking
    if (options?.enable_chunking && options?.estimated_item_count) {
      console.log('[scan-receipt] Using CHUNKING extraction (user-enabled)', {
        estimatedItems: options.estimated_item_count
      })
      result = await extractReceiptWithChunking(
        imageBase64,
        mimeType,
        learningExamples,
        options.estimated_item_count
      )
    }
    // Option 2: User explicitly enabled OCR
    else if (options?.enable_ocr) {
      console.log('[scan-receipt] Using OCR-enhanced extraction (user-enabled)')
      result = await extractReceiptWithOCR(imageBase64, mimeType, learningExamples)
    }
    // Option 3: Auto-enable chunking for very long receipts
    else if (options?.estimated_item_count && options.estimated_item_count >= 35) {
      console.log('[scan-receipt] Auto-enabling CHUNKING for long receipt', {
        estimatedItems: options.estimated_item_count
      })
      result = await extractReceiptWithChunking(
        imageBase64,
        mimeType,
        learningExamples,
        options.estimated_item_count
      )
    }
    // Default: Phase 1 extraction (anchor calibration + gap detection)
    else {
      console.log('[scan-receipt] Using standard extraction (Phase 1)')
      result = await extractReceiptFromImage(imageBase64, mimeType, learningExamples)
    }

    console.log('[scan-receipt] Extraction response', {
      success: result.success,
      hasReceipt: !!result.receipt,
      error: result.error,
      itemCount: result.receipt?.items?.length,
      confidence: result.confidence,
      tokensUsed: result.tokens_used,
      costUsd: result.cost_usd
    })

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('[scan-receipt] Exception caught:', {
      error,
      message: error.message,
      stack: error.stack,
      name: error.name
    })
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to scan receipt'
      },
      { status: 500 }
    )
  }
}
