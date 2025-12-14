'use client'

import { useState, useEffect } from 'react'
import { enhanceImage, enhanceImageWithPreset, getPresetInfo, EnhancementPreset, EnhancementOptions, PRESETS } from '@/lib/imageEnhancement/enhancer'

type ImageEnhancerProps = {
  originalImage: string
  onEnhancedImage: (enhancedImage: string) => void
  autoEnhance?: boolean
}

export default function ImageEnhancer({ originalImage, onEnhancedImage, autoEnhance = true }: ImageEnhancerProps) {
  const [selectedPreset, setSelectedPreset] = useState<EnhancementPreset>(autoEnhance ? 'auto' : 'none')
  const [enhancedImage, setEnhancedImage] = useState<string>(originalImage)
  const [isProcessing, setIsProcessing] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [showComparison, setShowComparison] = useState(false)

  // Manual controls
  const [brightness, setBrightness] = useState(0)
  const [contrast, setContrast] = useState(0)
  const [sharpness, setSharpness] = useState(0)
  const [saturation, setSaturation] = useState(0)

  const presets: EnhancementPreset[] = ['none', 'auto', 'lowLight', 'fadedReceipt', 'handwritten', 'glossyPhoto', 'highContrast']

  // Apply preset on mount if autoEnhance is true
  useEffect(() => {
    if (autoEnhance && originalImage) {
      applyPreset('auto')
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const applyPreset = async (preset: EnhancementPreset) => {
    setIsProcessing(true)
    setSelectedPreset(preset)
    setShowAdvanced(false)

    try {
      if (preset === 'none') {
        setEnhancedImage(originalImage)
        onEnhancedImage(originalImage)
      } else {
        const enhanced = await enhanceImageWithPreset(originalImage, preset)
        setEnhancedImage(enhanced)
        onEnhancedImage(enhanced)

        // Update sliders to match preset
        const options = PRESETS[preset]
        setBrightness(options.brightness || 0)
        setContrast(options.contrast || 0)
        setSharpness(options.sharpness || 0)
        setSaturation(options.saturation || 0)
      }
    } catch (error) {
      console.error('Enhancement error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const applyManualEnhancement = async () => {
    setIsProcessing(true)
    setSelectedPreset('none')

    try {
      const options: EnhancementOptions = {
        brightness: brightness !== 0 ? brightness : undefined,
        contrast: contrast !== 0 ? contrast : undefined,
        sharpness: sharpness !== 0 ? sharpness : undefined,
        saturation: saturation !== 0 ? saturation : undefined,
      }

      const enhanced = await enhanceImage(originalImage, options)
      setEnhancedImage(enhanced)
      onEnhancedImage(enhanced)
    } catch (error) {
      console.error('Enhancement error:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  const resetManualControls = () => {
    setBrightness(0)
    setContrast(0)
    setSharpness(0)
    setSaturation(0)
    applyPreset('none')
  }

  return (
    <div className="space-y-4">
      {/* Image Preview */}
      <div className="relative bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
        <img
          src={showComparison ? originalImage : enhancedImage}
          alt="Preview"
          className="w-full h-auto max-h-96 object-contain"
        />
        {isProcessing && (
          <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-sm text-gray-600">Processing...</p>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Toggle */}
      <div className="flex justify-center">
        <button
          type="button"
          onMouseDown={() => setShowComparison(true)}
          onMouseUp={() => setShowComparison(false)}
          onMouseLeave={() => setShowComparison(false)}
          onTouchStart={() => setShowComparison(true)}
          onTouchEnd={() => setShowComparison(false)}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
        >
          {showComparison ? '👁️ Viewing Original' : '👁️ Hold to Compare'}
        </button>
      </div>

      {/* Preset Buttons */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Enhancement Presets
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {presets.map((preset) => {
            const info = getPresetInfo(preset)
            return (
              <button
                key={preset}
                type="button"
                onClick={() => applyPreset(preset)}
                disabled={isProcessing}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedPreset === preset && !showAdvanced
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
                title={info.description}
              >
                {info.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Advanced Controls Toggle */}
      <div>
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-indigo-600 hover:text-indigo-700 font-medium flex items-center gap-1"
        >
          <svg className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          Advanced Controls
        </button>
      </div>

      {/* Advanced Manual Controls */}
      {showAdvanced && (
        <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-gray-200">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
              <span>Brightness</span>
              <span className="text-gray-500">{brightness > 0 ? '+' : ''}{brightness}</span>
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              value={brightness}
              onChange={(e) => setBrightness(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
              <span>Contrast</span>
              <span className="text-gray-500">{contrast > 0 ? '+' : ''}{contrast}</span>
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
              <span>Sharpness</span>
              <span className="text-gray-500">{sharpness}</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={sharpness}
              onChange={(e) => setSharpness(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex justify-between">
              <span>Saturation</span>
              <span className="text-gray-500">{saturation > 0 ? '+' : ''}{saturation}</span>
            </label>
            <input
              type="range"
              min="-100"
              max="100"
              value={saturation}
              onChange={(e) => setSaturation(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={applyManualEnhancement}
              disabled={isProcessing}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Apply
            </button>
            <button
              type="button"
              onClick={resetManualControls}
              disabled={isProcessing}
              className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors disabled:opacity-50"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <p className="text-sm text-blue-800">
          <strong>💡 Tip:</strong> For best results, try the preset that matches your image type.
          {selectedPreset !== 'none' && selectedPreset !== 'auto' && (
            <> The <strong>{getPresetInfo(selectedPreset).name}</strong> preset is optimized for {getPresetInfo(selectedPreset).description.toLowerCase()}.</>
          )}
        </p>
      </div>
    </div>
  )
}
