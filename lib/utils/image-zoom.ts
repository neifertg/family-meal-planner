/**
 * Dynamic Image Zoom for Receipt Scanning
 *
 * Provides ability to zoom into specific regions of a receipt image
 * for enhanced accuracy on hard-to-read items and prices.
 */

export interface ZoomRegion {
  y_start_percent: number  // 0-100
  y_end_percent: number    // 0-100
  description: string       // e.g., "items 10-15"
  zoom_level?: number       // 1.0 = normal, 2.0 = 2x zoom
}

/**
 * Crop and optionally zoom a base64 image to a specific vertical region
 * Uses canvas API for client-side processing, or can be done server-side
 */
export async function cropAndZoomImage(
  imageBase64: string,
  mimeType: string,
  region: ZoomRegion
): Promise<string> {
  // This is a Node.js environment, so we'll use sharp if available
  // Otherwise, we'll return the original with instructions to Claude

  try {
    // Check if sharp is available (optional dependency)
    const sharp = await import('sharp').catch(() => null)

    if (!sharp) {
      console.log('[image-zoom] Sharp not available, returning original image with crop instructions')
      return imageBase64
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64')

    // Get image metadata
    const metadata = await sharp.default(imageBuffer).metadata()
    const imageHeight = metadata.height || 1000
    const imageWidth = metadata.width || 800

    // Calculate crop region
    const top = Math.round((region.y_start_percent / 100) * imageHeight)
    const bottom = Math.round((region.y_end_percent / 100) * imageHeight)
    const cropHeight = bottom - top

    // Crop the image
    let processedImage = sharp.default(imageBuffer)
      .extract({
        left: 0,
        top,
        width: imageWidth,
        height: cropHeight
      })

    // Apply zoom if specified
    if (region.zoom_level && region.zoom_level > 1.0) {
      const newWidth = Math.round(imageWidth * region.zoom_level)
      const newHeight = Math.round(cropHeight * region.zoom_level)
      processedImage = processedImage.resize(newWidth, newHeight, {
        kernel: sharp.default.kernel.lanczos3,
        fit: 'fill'
      })
    }

    // Convert back to base64
    const outputBuffer = await processedImage.toBuffer()
    const croppedBase64 = outputBuffer.toString('base64')

    console.log('[image-zoom] Image cropped and zoomed', {
      originalSize: `${imageWidth}x${imageHeight}`,
      cropRegion: `${region.y_start_percent}%-${region.y_end_percent}%`,
      zoomLevel: region.zoom_level || 1.0,
      newSize: metadata.width + 'x' + cropHeight
    })

    return croppedBase64

  } catch (error: any) {
    console.error('[image-zoom] Failed to crop/zoom image:', error)
    // Return original image if processing fails
    return imageBase64
  }
}

/**
 * Generate a prompt instruction for Claude to focus on a specific region
 * Used when actual image cropping is not possible
 */
export function generateZoomPrompt(region: ZoomRegion): string {
  return `
FOCUS REGION: Please pay special attention to the vertical region between ${region.y_start_percent}% and ${region.y_end_percent}% of the receipt (${region.description}).

For items in this region:
1. Read item names VERY carefully - check for typos, abbreviations, and partial text
2. Extract prices with EXTREME precision - verify decimal points and digits
3. If any text is blurry or hard to read, note it in quality_warnings
4. Use context from surrounding items to validate prices (e.g., similar items should have similar prices)

This is a zoomed/focused extraction pass for maximum accuracy.
`
}

/**
 * Decide whether to use zoom based on receipt characteristics
 */
export function shouldUseZoom(
  itemCount: number,
  hasLowQualityWarnings: boolean = false
): boolean {
  // Use zoom for:
  // 1. Very long receipts where small text might be hard to read
  // 2. Receipts with quality warnings (blur, damage, etc.)
  return itemCount > 20 || hasLowQualityWarnings
}

/**
 * Generate zoom regions for a receipt
 * Strategy: Create overlapping zoomed views for different sections
 */
export function generateZoomRegions(
  itemCount: number,
  itemsPerRegion: number = 5
): ZoomRegion[] {
  const numRegions = Math.ceil(itemCount / itemsPerRegion)
  const regions: ZoomRegion[] = []

  for (let i = 0; i < numRegions; i++) {
    const startItem = i * itemsPerRegion + 1
    const endItem = Math.min(itemCount, (i + 1) * itemsPerRegion)

    const startPercent = Math.max(0, Math.round((startItem - 1) / itemCount * 100))
    const endPercent = Math.min(100, Math.round(endItem / itemCount * 100))

    // Add some padding to ensure we capture full items
    const paddedStart = Math.max(0, startPercent - 2)
    const paddedEnd = Math.min(100, endPercent + 2)

    regions.push({
      y_start_percent: paddedStart,
      y_end_percent: paddedEnd,
      description: `items ${startItem}-${endItem}`,
      zoom_level: 1.5  // 1.5x zoom for better readability
    })
  }

  return regions
}

/**
 * Extract items from a zoomed region with enhanced prompting
 */
export async function extractWithZoom(
  imageBase64: string,
  mimeType: string,
  region: ZoomRegion,
  extractionFunction: (imageData: string, prompt: string) => Promise<any>
): Promise<any> {
  // Attempt to crop and zoom the image
  const zoomedImage = await cropAndZoomImage(imageBase64, mimeType, region)

  // Generate focused extraction prompt
  const zoomPrompt = generateZoomPrompt(region)

  // Call extraction function with zoomed image and enhanced prompt
  return await extractionFunction(zoomedImage, zoomPrompt)
}
