/**
 * Image Enhancement Utilities
 *
 * Provides image preprocessing functions to improve OCR and vision API accuracy
 * Handles contrast, brightness, sharpness, and other enhancements
 */

export type EnhancementOptions = {
  brightness?: number      // -100 to 100 (0 = no change)
  contrast?: number        // -100 to 100 (0 = no change)
  sharpness?: number       // 0 to 100 (0 = no sharpening)
  saturation?: number      // -100 to 100 (0 = no change)
  autoLevels?: boolean     // Auto-adjust histogram
  grayscale?: boolean      // Convert to grayscale
  denoise?: boolean        // Apply noise reduction
}

export type EnhancementPreset = 'none' | 'auto' | 'lowLight' | 'fadedReceipt' | 'handwritten' | 'glossyPhoto' | 'highContrast'

/**
 * Preset configurations for common scenarios
 */
export const PRESETS: Record<EnhancementPreset, EnhancementOptions> = {
  none: {},
  auto: {
    brightness: 5,
    contrast: 15,
    sharpness: 20,
    autoLevels: true,
  },
  lowLight: {
    brightness: 25,
    contrast: 30,
    sharpness: 25,
    autoLevels: true,
  },
  fadedReceipt: {
    brightness: 15,
    contrast: 40,
    sharpness: 30,
    grayscale: true,
    autoLevels: true,
  },
  handwritten: {
    brightness: 10,
    contrast: 35,
    sharpness: 40,
    grayscale: true,
    autoLevels: true,
  },
  glossyPhoto: {
    brightness: -5,
    contrast: 25,
    sharpness: 15,
    saturation: -20,
  },
  highContrast: {
    brightness: 0,
    contrast: 60,
    sharpness: 30,
    grayscale: true,
  }
}

/**
 * Load image from data URL and return canvas context
 */
async function loadImageToCanvas(imageDataUrl: string): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      canvas.width = img.width
      canvas.height = img.height
      ctx.drawImage(img, 0, 0)

      resolve({ canvas, ctx, img })
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = imageDataUrl
  })
}

/**
 * Apply brightness adjustment
 */
function applyBrightness(imageData: ImageData, value: number): ImageData {
  const data = imageData.data
  const adjustment = (value / 100) * 255

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, data[i] + adjustment))     // R
    data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + adjustment)) // G
    data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + adjustment)) // B
  }

  return imageData
}

/**
 * Apply contrast adjustment
 */
function applyContrast(imageData: ImageData, value: number): ImageData {
  const data = imageData.data
  const factor = (259 * (value + 255)) / (255 * (259 - value))

  for (let i = 0; i < data.length; i += 4) {
    data[i] = Math.max(0, Math.min(255, factor * (data[i] - 128) + 128))     // R
    data[i + 1] = Math.max(0, Math.min(255, factor * (data[i + 1] - 128) + 128)) // G
    data[i + 2] = Math.max(0, Math.min(255, factor * (data[i + 2] - 128) + 128)) // B
  }

  return imageData
}

/**
 * Apply saturation adjustment
 */
function applySaturation(imageData: ImageData, value: number): ImageData {
  const data = imageData.data
  const factor = 1 + (value / 100)

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = Math.max(0, Math.min(255, gray + factor * (data[i] - gray)))     // R
    data[i + 1] = Math.max(0, Math.min(255, gray + factor * (data[i + 1] - gray))) // G
    data[i + 2] = Math.max(0, Math.min(255, gray + factor * (data[i + 2] - gray))) // B
  }

  return imageData
}

/**
 * Convert to grayscale
 */
function applyGrayscale(imageData: ImageData): ImageData {
  const data = imageData.data

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
    data[i] = gray     // R
    data[i + 1] = gray // G
    data[i + 2] = gray // B
  }

  return imageData
}

/**
 * Apply auto-levels (histogram equalization)
 */
function applyAutoLevels(imageData: ImageData): ImageData {
  const data = imageData.data
  const histogram: number[] = new Array(256).fill(0)

  // Build histogram
  for (let i = 0; i < data.length; i += 4) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2])
    histogram[gray]++
  }

  // Calculate cumulative distribution
  const cdf: number[] = new Array(256).fill(0)
  cdf[0] = histogram[0]
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i]
  }

  // Find min and max non-zero values
  let min = 0
  let max = 255
  for (let i = 0; i < 256; i++) {
    if (cdf[i] > 0) {
      min = i
      break
    }
  }
  for (let i = 255; i >= 0; i--) {
    if (cdf[i] < cdf[255]) {
      max = i
      break
    }
  }

  // Apply histogram stretching
  const range = max - min
  if (range > 0) {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.round(((data[i] - min) / range) * 255)         // R
      data[i + 1] = Math.round(((data[i + 1] - min) / range) * 255) // G
      data[i + 2] = Math.round(((data[i + 2] - min) / range) * 255) // B
    }
  }

  return imageData
}

/**
 * Apply sharpening filter
 */
function applySharpness(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, value: number): void {
  if (value === 0) return

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const width = canvas.width
  const height = canvas.height
  const weight = value / 100

  // Sharpening kernel (unsharp mask)
  const kernel = [
    0, -weight, 0,
    -weight, 1 + 4 * weight, -weight,
    0, -weight, 0
  ]

  const output = new Uint8ClampedArray(data)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[idx] * kernel[kernelIdx]
          }
        }
        const idx = (y * width + x) * 4 + c
        output[idx] = Math.max(0, Math.min(255, sum))
      }
    }
  }

  ctx.putImageData(new ImageData(output, width, height), 0, 0)
}

/**
 * Apply simple denoising (bilateral filter approximation)
 */
function applyDenoise(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void {
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data
  const width = canvas.width
  const height = canvas.height
  const output = new Uint8ClampedArray(data)

  // Simple 3x3 Gaussian blur for denoising
  const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1]
  const kernelSum = 16

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) { // RGB channels only
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[idx] * kernel[kernelIdx]
          }
        }
        const idx = (y * width + x) * 4 + c
        output[idx] = sum / kernelSum
      }
    }
  }

  ctx.putImageData(new ImageData(output, width, height), 0, 0)
}

/**
 * Enhance image with specified options
 */
export async function enhanceImage(
  imageDataUrl: string,
  options: EnhancementOptions
): Promise<string> {
  try {
    const { canvas, ctx } = await loadImageToCanvas(imageDataUrl)

    // Get image data for pixel manipulation
    let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)

    // Apply pixel-level operations
    if (options.grayscale) {
      imageData = applyGrayscale(imageData)
    }

    if (options.brightness && options.brightness !== 0) {
      imageData = applyBrightness(imageData, options.brightness)
    }

    if (options.contrast && options.contrast !== 0) {
      imageData = applyContrast(imageData, options.contrast)
    }

    if (options.saturation && options.saturation !== 0) {
      imageData = applySaturation(imageData, options.saturation)
    }

    if (options.autoLevels) {
      imageData = applyAutoLevels(imageData)
    }

    // Put processed image data back
    ctx.putImageData(imageData, 0, 0)

    // Apply canvas-level operations
    if (options.denoise) {
      applyDenoise(canvas, ctx)
    }

    if (options.sharpness && options.sharpness > 0) {
      applySharpness(canvas, ctx, options.sharpness)
    }

    // Convert back to data URL
    return canvas.toDataURL('image/png')
  } catch (error) {
    console.error('Image enhancement error:', error)
    throw error
  }
}

/**
 * Enhance image with preset
 */
export async function enhanceImageWithPreset(
  imageDataUrl: string,
  preset: EnhancementPreset
): Promise<string> {
  const options = PRESETS[preset]
  return enhanceImage(imageDataUrl, options)
}

/**
 * Get preset display information
 */
export function getPresetInfo(preset: EnhancementPreset): { name: string; description: string } {
  const info: Record<EnhancementPreset, { name: string; description: string }> = {
    none: {
      name: 'Original',
      description: 'No enhancement applied'
    },
    auto: {
      name: 'Auto Enhance',
      description: 'Balanced enhancement for most images'
    },
    lowLight: {
      name: 'Low Light',
      description: 'Brighten dark or underexposed images'
    },
    fadedReceipt: {
      name: 'Faded Receipt',
      description: 'Enhance faded or thermal receipts'
    },
    handwritten: {
      name: 'Handwritten',
      description: 'Optimize for handwritten text'
    },
    glossyPhoto: {
      name: 'Glossy Photo',
      description: 'Reduce glare from glossy surfaces'
    },
    highContrast: {
      name: 'High Contrast',
      description: 'Maximum contrast for hard-to-read text'
    }
  }

  return info[preset]
}
