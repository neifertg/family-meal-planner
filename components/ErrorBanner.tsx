'use client'

import { useEffect } from 'react'

type ErrorBannerProps = {
  error: string | null
  onDismiss?: () => void
  sticky?: boolean
  scrollToTop?: boolean
}

export default function ErrorBanner({ error, onDismiss, sticky = true, scrollToTop = true }: ErrorBannerProps) {
  useEffect(() => {
    if (error && scrollToTop) {
      // Scroll to top when error appears
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }, [error, scrollToTop])

  if (!error) return null

  return (
    <div
      className={`${
        sticky ? 'sticky top-0 z-50' : ''
      } animate-slide-down`}
      role="alert"
      aria-live="assertive"
    >
      <div className="bg-red-50 border-2 border-red-500 rounded-lg p-4 shadow-lg">
        <div className="flex items-start gap-3">
          {/* Error Icon */}
          <div className="flex-shrink-0">
            <svg
              className="w-6 h-6 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>

          {/* Error Content */}
          <div className="flex-1">
            <h3 className="text-sm font-bold text-red-900 mb-1">
              Unable to Save Recipe
            </h3>
            <p className="text-sm text-red-800">{error}</p>
          </div>

          {/* Dismiss Button */}
          {onDismiss && (
            <button
              onClick={onDismiss}
              className="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors"
              aria-label="Dismiss error"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
