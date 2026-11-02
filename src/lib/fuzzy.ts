/**
 * Small fuzzy matcher for the command palette: every query character must
 * appear in order. Consecutive runs and matches at word starts score higher,
 * so "kok" ranks "Kokkos" above "work book". Returns 0 for no match.
 */
export function fuzzyScore(query: string, text: string): number {
  const q = query.toLowerCase().replace(/\s+/g, '');
  const t = text.toLowerCase();
  if (!q) return 1;
  let score = 0;
  let run = 0;
  let from = 0;
  for (const char of q) {
    const index = t.indexOf(char, from);
    if (index === -1) return 0;
    run = index === from ? run + 1 : 1;
    const wordStart = index === 0 || /[\s\-_/:.,(]/.test(t[index - 1]);
    score += 1 + run * 2 + (wordStart ? 6 : 0);
    from = index + 1;
  }
  // Prefer shorter texts and earlier first matches.
  return score + Math.max(0, 10 - t.indexOf(q[0])) - text.length / 50;
}
