'use client'

/**
 * Receipt Image with Hover Highlighting
 *
 * Displays a receipt image with a div overlay that highlights
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
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 })
  const [scaledBox, setScaledBox] = useState<{ left: number; top: number; width: number; height: number } | null>(null)

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

  // Calculate scaled box position
  useEffect(() => {
    const img = imageRef.current
    if (!img || !highlightBox || imageDimensions.width === 0) {
      setScaledBox(null)
      return
    }

    const displayWidth = img.clientWidth
    const displayHeight = img.clientHeight

    if (displayWidth === 0 || displayHeight === 0) {
      setScaledBox(null)
      return
    }

    const scaleX = displayWidth / imageDimensions.width
    const scaleY = displayHeight / imageDimensions.height

    const scaled = {
      left: highlightBox.x * scaleX,
      top: highlightBox.y * scaleY,
      width: highlightBox.width * scaleX,
      height: highlightBox.height * scaleY
    }

    console.log('Highlight box calculation:', {
      highlightBox,
      imageDimensions,
      displaySize: { displayWidth, displayHeight },
      scale: { scaleX, scaleY },
      scaledBox: scaled
    })

    setScaledBox(scaled)
  }, [highlightBox, imageDimensions])

  return (
    <div ref={containerRef} className="relative inline-block max-w-full">
      {/* Receipt Image */}
      <img
        ref={imageRef}
        src={imageUrl}
        alt={altText}
        className="w-full h-auto max-h-[600px] object-contain block"
      />

      {/* Highlight Overlay */}
      {scaledBox && (
        <div
          className="absolute pointer-events-none border-4 border-yellow-400 bg-yellow-300/40 transition-all duration-150"
          style={{
            left: `${scaledBox.left}px`,
            top: `${scaledBox.top}px`,
            width: `${scaledBox.width}px`,
            height: `${scaledBox.height}px`,
          }}
        />
      )}
    </div>
  )
}
