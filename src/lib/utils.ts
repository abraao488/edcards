import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Fisher-Yates shuffle.
 *
 * Returns a new array with the items in random order using the standard
 * backward variant: O(n) time, O(1) extra space and a uniform distribution
 * (no bias, unlike `sort(() => Math.random() - 0.5)` which is not a valid
 * comparator and produces a skewed result).
 *
 * The input array is never mutated.
 */
export function shuffle<T>(array: T[]): T[] {
  const result = [...array]
  for (let i = result.length - 1; i > 0; i--) {
    // Math.random() is uniform in [0, 1), so this yields a uniform integer in [0, i].
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = result[i]
    result[i] = result[j]
    result[j] = tmp
  }
  return result
}
