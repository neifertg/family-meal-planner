'use client'

import { useState } from 'react'
import { getCurrentSeasonalProduce } from '@/lib/seasonalProduce'

export default function SeasonalProduceDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const seasonalData = getCurrentSeasonalProduce()

  return (
    <>
      {/* Seasonal Produce Card - Clickable */}
      <button
        onClick={() => setIsOpen(true)}
        className="w-full bg-gradient-to-br from-green-400 to-emerald-500 p-6 rounded-2xl shadow-md hover:shadow-xl transition-all duration-200 hover:scale-105 text-left"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <h3 className="text-lg font-bold text-white">In Season Now</h3>
          </div>
          <svg className="w-5 h-5 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <p className="text-white/90 text-sm mb-3">
          {seasonalData.monthName} seasonal produce
        </p>
        <div className="flex flex-wrap gap-2">
          {[...seasonalData.fruits.slice(0, 3), ...seasonalData.vegetables.slice(0, 3)].map((item, idx) => (
            <span key={idx} className="text-xs bg-white/20 text-white px-2 py-1 rounded-full">
              {item}
            </span>
          ))}
          <span className="text-xs bg-white/30 text-white px-2 py-1 rounded-full">
            +{seasonalData.fruits.length + seasonalData.vegetables.length - 6} more
          </span>
        </div>
      </button>

      {/* Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setIsOpen(false)}>
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="sticky top-0 bg-gradient-to-r from-green-500 to-emerald-600 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                    <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    What's In Season
                  </h2>
                  <p className="text-green-50 text-sm mt-1">
                    Fresh produce for {seasonalData.monthName}
                  </p>
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-white/80 hover:text-white transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Fruits Section */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🍎</span>
                  Fruits
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {seasonalData.fruits.map((fruit, idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 hover:shadow-md transition-shadow"
                    >
                      {fruit}
                    </div>
                  ))}
                </div>
              </div>

              {/* Vegetables Section */}
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                  <span className="text-2xl">🥬</span>
                  Vegetables
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {seasonalData.vegetables.map((vegetable, idx) => (
                    <div
                      key={idx}
                      className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-lg px-3 py-2 text-sm font-medium text-gray-800 hover:shadow-md transition-shadow"
                    >
                      {vegetable}
                    </div>
                  ))}
                </div>
              </div>

              {/* Info Footer */}
              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-900">
                  <strong>💡 Tip:</strong> Buying seasonal produce is often fresher, tastier, and more affordable.
                  Use these ingredients in your meal planning for the best quality and value!
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
