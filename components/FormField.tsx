'use client'

import { useEffect, useRef } from 'react'

type FormFieldProps = {
  label: string
  error?: string | null
  required?: boolean
  children: React.ReactNode
  scrollToError?: boolean
}

export function FormField({ label, error, required, children, scrollToError = true }: FormFieldProps) {
  const fieldRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (error && scrollToError && fieldRef.current) {
      // Scroll to the error field with some offset for visibility
      const yOffset = -100
      const element = fieldRef.current
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset

      window.scrollTo({ top: y, behavior: 'smooth' })
    }
  }, [error, scrollToError])

  return (
    <div ref={fieldRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
      {error && (
        <div className="mt-2 flex items-start gap-2 animate-shake">
          <svg
            className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5"
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
          <p className="text-sm text-red-600 font-medium">{error}</p>
        </div>
      )}
    </div>
  )
}

type InputFieldProps = {
  label: string
  error?: string | null
  required?: boolean
  scrollToError?: boolean
  [key: string]: any // For all other input props
}

export function InputField({ label, error, required, scrollToError, ...inputProps }: InputFieldProps) {
  return (
    <FormField label={label} error={error} required={required} scrollToError={scrollToError}>
      <input
        {...inputProps}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400 ${
          error
            ? 'border-red-500 focus:ring-red-500 bg-red-50'
            : 'border-gray-300 focus:ring-purple-500'
        } ${inputProps.className || ''}`}
      />
    </FormField>
  )
}

type TextAreaFieldProps = {
  label: string
  error?: string | null
  required?: boolean
  scrollToError?: boolean
  [key: string]: any // For all other textarea props
}

export function TextAreaField({ label, error, required, scrollToError, ...textareaProps }: TextAreaFieldProps) {
  return (
    <FormField label={label} error={error} required={required} scrollToError={scrollToError}>
      <textarea
        {...textareaProps}
        className={`w-full px-4 py-2.5 border rounded-lg focus:ring-2 focus:border-transparent transition-all text-gray-900 placeholder:text-gray-400 ${
          error
            ? 'border-red-500 focus:ring-red-500 bg-red-50'
            : 'border-gray-300 focus:ring-purple-500'
        } ${textareaProps.className || ''}`}
      />
    </FormField>
  )
}
