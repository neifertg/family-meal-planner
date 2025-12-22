/**
 * Shared Validation Utilities
 *
 * Common field validation functions and error message generation
 * for consistent validation across all forms in the application.
 */

export type ValidationError = {
  field: string
  message: string
}

export type ValidationResult = {
  isValid: boolean
  errors: ValidationError[]
}

/**
 * Required field validation
 */
export function validateRequired(value: string | null | undefined, fieldName: string): ValidationError | null {
  if (!value || value.trim() === '') {
    return {
      field: fieldName,
      message: `${fieldName} is required`
    }
  }
  return null
}

/**
 * Validate string length
 */
export function validateLength(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): ValidationError | null {
  if (min !== undefined && value.length < min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${min} character${min === 1 ? '' : 's'}`
    }
  }
  if (max !== undefined && value.length > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${max} character${max === 1 ? '' : 's'}`
    }
  }
  return null
}

/**
 * Validate numeric value
 */
export function validateNumber(
  value: string | number,
  fieldName: string,
  min?: number,
  max?: number
): ValidationError | null {
  const num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid number`
    }
  }

  if (min !== undefined && num < min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${min}`
    }
  }

  if (max !== undefined && num > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${max}`
    }
  }

  return null
}

/**
 * Validate integer value
 */
export function validateInteger(
  value: string | number,
  fieldName: string,
  min?: number,
  max?: number
): ValidationError | null {
  const num = typeof value === 'string' ? parseInt(value, 10) : value

  if (isNaN(num) || !Number.isInteger(num)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a whole number`
    }
  }

  if (min !== undefined && num < min) {
    return {
      field: fieldName,
      message: `${fieldName} must be at least ${min}`
    }
  }

  if (max !== undefined && num > max) {
    return {
      field: fieldName,
      message: `${fieldName} must be no more than ${max}`
    }
  }

  return null
}

/**
 * Validate date
 */
export function validateDate(
  value: string,
  fieldName: string,
  options?: {
    min?: Date
    max?: Date
    allowFuture?: boolean
    allowPast?: boolean
  }
): ValidationError | null {
  if (!value) {
    return null // Use validateRequired separately if date is required
  }

  const date = new Date(value)

  if (isNaN(date.getTime())) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid date`
    }
  }

  const now = new Date()

  if (options?.allowFuture === false && date > now) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be in the future`
    }
  }

  if (options?.allowPast === false && date < now) {
    return {
      field: fieldName,
      message: `${fieldName} cannot be in the past`
    }
  }

  if (options?.min && date < options.min) {
    return {
      field: fieldName,
      message: `${fieldName} must be after ${options.min.toLocaleDateString()}`
    }
  }

  if (options?.max && date > options.max) {
    return {
      field: fieldName,
      message: `${fieldName} must be before ${options.max.toLocaleDateString()}`
    }
  }

  return null
}

/**
 * Validate email format
 */
export function validateEmail(value: string, fieldName: string): ValidationError | null {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

  if (!emailRegex.test(value)) {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid email address`
    }
  }

  return null
}

/**
 * Validate URL format
 */
export function validateUrl(value: string, fieldName: string): ValidationError | null {
  try {
    new URL(value)
    return null
  } catch {
    return {
      field: fieldName,
      message: `${fieldName} must be a valid URL`
    }
  }
}

/**
 * Validate array has minimum items
 */
export function validateArrayLength<T>(
  value: T[],
  fieldName: string,
  min: number,
  max?: number
): ValidationError | null {
  if (value.length < min) {
    return {
      field: fieldName,
      message: `${fieldName} must have at least ${min} item${min === 1 ? '' : 's'}`
    }
  }

  if (max !== undefined && value.length > max) {
    return {
      field: fieldName,
      message: `${fieldName} must have no more than ${max} item${max === 1 ? '' : 's'}`
    }
  }

  return null
}

/**
 * Combine multiple validation errors
 */
export function combineValidations(...errors: (ValidationError | null)[]): ValidationResult {
  const validErrors = errors.filter((e): e is ValidationError => e !== null)

  return {
    isValid: validErrors.length === 0,
    errors: validErrors
  }
}

/**
 * Format validation errors for display
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) return ''

  if (errors.length === 1) {
    return errors[0].message
  }

  return `Please fix the following errors:\n${errors.map(e => `• ${e.message}`).join('\n')}`
}

/**
 * Get field-specific error message
 */
export function getFieldError(errors: ValidationError[], fieldName: string): string | undefined {
  const error = errors.find(e => e.field === fieldName)
  return error?.message
}

/**
 * Specific validators for common use cases
 */

export function validateAge(age: string | number, fieldName: string = 'Age'): ValidationError | null {
  return validateInteger(age, fieldName, 0, 150)
}

export function validatePrice(price: string | number, fieldName: string = 'Price'): ValidationError | null {
  return validateNumber(price, fieldName, 0)
}

export function validateQuantity(quantity: string | number, fieldName: string = 'Quantity'): ValidationError | null {
  return validateNumber(quantity, fieldName, 0)
}

export function validateServings(servings: string | number, fieldName: string = 'Servings'): ValidationError | null {
  return validateInteger(servings, fieldName, 1, 100)
}

export function validatePrepTime(minutes: string | number, fieldName: string = 'Prep time'): ValidationError | null {
  return validateInteger(minutes, fieldName, 0, 1440) // Max 24 hours
}

export function validateCookTime(minutes: string | number, fieldName: string = 'Cook time'): ValidationError | null {
  return validateInteger(minutes, fieldName, 0, 1440) // Max 24 hours
}

export function validateBirthday(birthday: string, fieldName: string = 'Birthday'): ValidationError | null {
  return validateDate(birthday, fieldName, {
    allowFuture: false,
    min: new Date('1900-01-01')
  })
}

export function validatePurchaseDate(date: string, fieldName: string = 'Purchase date'): ValidationError | null {
  return validateDate(date, fieldName, {
    allowFuture: false
  })
}

export function validateExpirationDate(date: string, fieldName: string = 'Expiration date'): ValidationError | null {
  return validateDate(date, fieldName, {
    allowPast: false
  })
}
