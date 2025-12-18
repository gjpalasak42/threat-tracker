import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

/**
 * Utility function to merge Tailwind CSS classes with proper precedence
 * 
 * Combines clsx for conditional class names and tailwind-merge to handle
 * conflicting Tailwind classes, ensuring the last class takes precedence.
 * 
 * @param inputs - Class values to merge (strings, objects, arrays)
 * @returns Merged class string with conflicts resolved
 * 
 * @example
 * ```ts
 * cn('px-4 py-2', 'px-6') // returns 'py-2 px-6'
 * cn('text-red-500', condition && 'text-blue-500') // conditional classes
 * ```
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
