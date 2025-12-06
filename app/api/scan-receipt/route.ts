import { NextRequest, NextResponse } from 'next/server'
import { extractReceiptFromImage } from '@/lib/receiptScanner/claudeExtractor'

export async function POST(request: NextRequest) {
  try {
    const { imageData } = await request.json()

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

    // Extract receipt using Claude Vision
    const result = await extractReceiptFromImage(imageBase64, mimeType)

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
