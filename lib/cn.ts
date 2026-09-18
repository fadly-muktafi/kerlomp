export type ClassValue = string | false | null | undefined;

/**
 * Gabung className tanpa dependensi tambahan (RULES.md §4: deps minimal).
 * Untuk konflik utility Tailwind yang nyata, selesaikan dengan urutan class, bukan library.
 */
export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}