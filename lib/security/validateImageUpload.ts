export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Sniffs the first bytes of an uploaded file to identify its real image
 * type, instead of trusting the client-supplied filename/MIME type.
 * Returns a safe extension to store the file under, or null if the
 * content doesn't match a supported image format.
 */
export async function sniffImageExtension(file: File): Promise<string | null> {
  const header = new Uint8Array(await file.slice(0, 12).arrayBuffer())

  if (matches(header, [0xff, 0xd8, 0xff])) {
    return 'jpg'
  }

  if (matches(header, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'png'
  }

  if (matches(header, [0x47, 0x49, 0x46, 0x38])) {
    return 'gif'
  }

  if (
    matches(header, [0x52, 0x49, 0x46, 0x46]) && // "RIFF"
    matches(header.slice(8, 12), [0x57, 0x45, 0x42, 0x50]) // "WEBP"
  ) {
    return 'webp'
  }

  return null
}

function matches(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false
  return signature.every((byte, i) => bytes[i] === byte)
}
