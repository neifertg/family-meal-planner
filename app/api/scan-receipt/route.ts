import { NextRequest, NextResponse } from 'next/server'
import { extractReceiptFromImage } from '@/lib/receiptScanner/claudeExtractor'
import { getVendorLearningExamples, getGeneralLearningExamples } from '@/lib/receiptScanner/learningSystem'

export async function POST(request: NextRequest) {
  try {
    const { imageData, familyId, storeName } = await request.json()

    if (!imageData) {
      return NextResponse.json(
        { success: false, error: 'No image data provided' },
        { status: 400 }
      )
    }

    // Validate image data format
    const base64Match = imageData.match(/^data:([^;]+);base64,(.+)$/)
    if (!base64Match) {
      return NextResponse.json(
        { success: false, error: 'Invalid image data format. Expected base64 data URL.' },
        { status: 400 }
      )
    }

    const [, mimeType, imageBase64] = base64Match

    // Validate mime type
    if (!mimeType.startsWith('image/')) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Must be an image.' },
        { status: 400 }
      )
    }

    // Fetch learning examples to improve extraction accuracy
    let learningExamples: any[] = []
    if (familyId) {
      // Try vendor-specific examples first
      if (storeName) {
        learningExamples = await getVendorLearningExamples(familyId, storeName, 10)
      }

      // If no vendor-specific examples, get general ones
      if (learningExamples.length === 0) {
        learningExamples = await getGeneralLearningExamples(familyId, 5)
      }
    }

    // Extract receipt using Claude Vision with learning examples
    const result = await extractReceiptFromImage(imageBase64, mimeType, learningExamples)

    return NextResponse.json(result)

  } catch (error: any) {
    console.error('Receipt scanning error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to scan receipt'
      },
      { status: 500 }
    )
  }
}
