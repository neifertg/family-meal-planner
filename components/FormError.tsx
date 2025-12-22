/**
 * FormError Component
 *
 * Standardized error display for forms with consistent styling
 * and support for field-level and form-level errors
 */

type FormErrorProps = {
  error?: string | string[]
  className?: string
}

/**
 * Field-level error display (inline with field)
 */
export function FieldError({ error, className = '' }: FormErrorProps) {
  if (!error) return null

  const errors = Array.isArray(error) ? error : [error]

  return (
    <div className={`mt-1 ${className}`}>
      {errors.map((err, index) => (
        <p key={index} className="text-sm text-red-600 flex items-start gap-1">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
          <span>{err}</span>
        </p>
      ))}
    </div>
  )
}

/**
 * Form-level error banner (displayed at top of form)
 */
export function FormErrorBanner({ error, className = '' }: FormErrorProps) {
  if (!error) return null

  const errors = Array.isArray(error) ? error : [error]

  return (
    <div className={`bg-red-50 border-l-4 border-red-500 p-4 rounded-md ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          {errors.length === 1 ? (
            <p className="text-sm text-red-700 font-medium">{errors[0]}</p>
          ) : (
            <>
              <p className="text-sm text-red-700 font-medium mb-2">Please fix the following errors:</p>
              <ul className="list-disc list-inside text-sm text-red-700 space-y-1">
                {errors.map((err, index) => (
                  <li key={index}>{err}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Success banner (for successful form submissions)
 */
export function FormSuccessBanner({ message, className = '' }: { message?: string; className?: string }) {
  if (!message) return null

  return (
    <div className={`bg-green-50 border-l-4 border-green-500 p-4 rounded-md ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-green-700 font-medium">{message}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Warning banner (for non-critical issues)
 */
export function FormWarningBanner({ message, className = '' }: { message?: string | string[]; className?: string }) {
  if (!message) return null

  const messages = Array.isArray(message) ? message : [message]

  return (
    <div className={`bg-yellow-50 border-l-4 border-yellow-500 p-4 rounded-md ${className}`}>
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          {messages.length === 1 ? (
            <p className="text-sm text-yellow-700 font-medium">{messages[0]}</p>
          ) : (
            <>
              <p className="text-sm text-yellow-700 font-medium mb-2">Please note:</p>
              <ul className="list-disc list-inside text-sm text-yellow-700 space-y-1">
                {messages.map((msg, index) => (
                  <li key={index}>{msg}</li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
