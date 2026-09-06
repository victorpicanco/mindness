export function humanizeSlug(slug: string): string {
  return slug.replaceAll('-', ' ')
}
