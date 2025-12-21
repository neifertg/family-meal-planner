import { NextRequest, NextResponse } from 'next/server'
import { extractReceiptFromImage } from '@/lib/receiptScanner/claudeExtractor'
import { getVendorLearningExamples, getGeneralLearningExamples } from '@/lib/receiptScanner/learningSystem'

// Increase body size limit for base64 image uploads (default is 4MB)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
}

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
    const { imageData, familyId, storeName } = body

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

    // Extract receipt using Claude Vision with learning examples
    console.log('[scan-receipt] Calling Claude Vision API...')
    const result = await extractReceiptFromImage(imageBase64, mimeType, learningExamples)

    console.log('[scan-receipt] Claude Vision response', {
      success: result.success,
      hasReceipt: !!result.receipt,
      error: result.error,
      itemCount: result.receipt?.items?.length,
      confidence: result.confidence
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
