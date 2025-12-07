'use client'

/**
 * Receipt Image with Hover Highlighting
 *
 * Displays a receipt image with a canvas overlay that highlights
 * specific text regions when user hovers over corresponding items
 */

import { useEffect, useRef, useState } from 'react'
import { BoundingBox } from '@/lib/receiptScanner/types'

type ReceiptImageWithHighlightProps = {
  imageUrl: string
  highlightBox: BoundingBox | null
  altText?: string
}

export default function ReceiptImageWithHighlight({
  imageUrl,
  highlightBox,
  altText = 'Receipt'
}: ReceiptImageWithHighlightProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })

  // Load image and set dimensions
  useEffect(() => {
    const img = imageRef.current
    if (!img) return

    const handleLoad = () => {
      setImageDimensions({
        width: img.naturalWidth,
        height: img.naturalHeight
      })
    }

    if (img.complete) {
      handleLoad()
    } else {
      img.addEventListener('load', handleLoad)
      return () => img.removeEventListener('load', handleLoad)
    }
  }, [imageUrl])

  // Draw highlight box on canvas
  useEffect(() => {
    const canvas = canvasRef.current
    const img = imageRef.current
    if (!canvas || !img) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // If there's a highlight box, draw it
    if (highlightBox && imageDimensions.width > 0 && imageDimensions.height > 0) {
      const scaleX = canvas.width / imageDimensions.width
      const scaleY = canvas.height / imageDimensions.height

      // Scale bounding box to canvas size
      const scaledBox = {
        x: highlightBox.x * scaleX,
        y: highlightBox.y * scaleY,
        width: highlightBox.width * scaleX,
        height: highlightBox.height * scaleY
      }

      // Draw yellow highlight with transparency
      ctx.fillStyle = 'rgba(255, 255, 0, 0.3)'
      ctx.fillRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height)

      // Draw border
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.8)'
      ctx.lineWidth = 2
      ctx.strokeRect(scaledBox.x, scaledBox.y, scaledBox.width, scaledBox.height)
    }
  }, [highlightBox, imageDimensions])

  return (
    <div className="relative inline-block max-w-full">
      {/* Receipt Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={altText}
        className="w-full h-auto max-h-[600px] object-contain"
      />

      {/* Canvas Overlay for Highlights */}
      <canvas
        ref={canvasRef}
        width={imageDimensions.width}
        height={imageDimensions.height}
        className="absolute top-0 left-0 w-full h-full pointer-events-none"
        style={{
          maxHeight: '600px',
          objectFit: 'contain'
        }}
      />
    </div>
  )
}
