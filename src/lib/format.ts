/** "https://github.com/owner/repo" -> "github.com/owner/repo" for link text. */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
}
