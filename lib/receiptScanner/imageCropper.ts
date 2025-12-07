/**
 * Image Cropping Utilities
 *
 * Extracts cropped portions of receipt images based on bounding boxes
 */

import { BoundingBox } from './types'

/**
 * Crop a portion of an image using canvas and return as data URL
 *
 * @param imageDataUrl - Base64 data URL of the source image
 * @param boundingBox - Bounding box coordinates to crop
 * @param padding - Optional padding around the crop (in pixels)
 * @returns Promise<string> - Data URL of the cropped image
 */
export async function cropImageSegment(
  imageDataUrl: string,
  boundingBox: BoundingBox,
  padding: number = 5
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()

    img.onload = () => {
      try {
        // Create canvas with the cropped dimensions
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')

        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        // Calculate crop area with padding
        const cropX = Math.max(0, boundingBox.x - padding)
        const cropY = Math.max(0, boundingBox.y - padding)
        const cropWidth = Math.min(
          boundingBox.width + (padding * 2),
          img.width - cropX
        )
        const cropHeight = Math.min(
          boundingBox.height + (padding * 2),
          img.height - cropY
        )

        // Set canvas size to crop dimensions
        canvas.width = cropWidth
        canvas.height = cropHeight

        // Draw the cropped portion
        ctx.drawImage(
          img,
          cropX,      // Source X
          cropY,      // Source Y
          cropWidth,  // Source Width
          cropHeight, // Source Height
          0,          // Destination X
          0,          // Destination Y
          cropWidth,  // Destination Width
          cropHeight  // Destination Height
        )

        // Convert to data URL
        const croppedDataUrl = canvas.toDataURL('image/png')
        resolve(croppedDataUrl)
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('Failed to load image'))
    }

    img.src = imageDataUrl
  })
}

/**
 * Crop multiple image segments in parallel
 *
 * @param imageDataUrl - Base64 data URL of the source image
 * @param boundingBoxes - Array of bounding boxes to crop
 * @param padding - Optional padding around each crop
 * @returns Promise<(string | null)[]> - Array of cropped image data URLs (null if crop failed)
 */
export async function cropMultipleSegments(
  imageDataUrl: string,
  boundingBoxes: (BoundingBox | null)[],
  padding: number = 5
): Promise<(string | null)[]> {
  const cropPromises = boundingBoxes.map(async (bbox) => {
    if (!bbox) return null

    try {
      return await cropImageSegment(imageDataUrl, bbox, padding)
    } catch (error) {
      console.error('Failed to crop image segment:', error)
      return null
    }
  })

  return Promise.all(cropPromises)
}
