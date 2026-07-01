export function deriveInitials(name: string, email: string): string {
  // First letter of the first name + first letter of the last name.
  // A single name yields just its first letter (e.g. "Antonio" → "A").
  const words = name.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w))
  if (words.length >= 2) {
    const first = words[0][0]
    const last = words[words.length - 1][0]
    return (first + last).toUpperCase()
  }
  if (words.length === 1) return words[0][0].toUpperCase()
  // Fall back to the email local part when no name is available.
  const localPart = email.split('@')[0].replace(/[^\p{L}]/gu, '')
  return (localPart.slice(0, 2) || 'AR').toUpperCase()
}
