// Common English words and short tokens that should never be treated as a
// character or location name during highlight rendering, even if a scrap of
// extracted state momentarily matches them.

export const HIGHLIGHT_STOPWORDS = new Set<string>([
  // Articles / pronouns
  'the', 'a', 'an',
  'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'us', 'them', 'him', 'her',
  'my', 'your', 'his', 'hers', 'its', 'our', 'their',
  'this', 'that', 'these', 'those',
  // Auxiliary / common verbs
  'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
  'do', 'does', 'did', 'doing',
  'have', 'has', 'had',
  'will', 'would', 'shall', 'should', 'can', 'could', 'may', 'might', 'must',
  // Conjunctions / prepositions / fillers
  'and', 'or', 'but', 'if', 'then', 'so', 'yet',
  'in', 'on', 'at', 'by', 'to', 'of', 'for', 'with', 'from', 'as', 'into', 'onto', 'over', 'under',
  'up', 'down', 'out', 'off', 'about',
  // Common scene words that get capitalised mid-sentence
  'you', 'You', 'sir', 'Sir', 'lady', 'Lady', 'lord', 'Lord',
  'no', 'yes', 'ok',
])

/** Lowercase test — true if the word is a common stopword that should not be treated as a name. */
export function isStopword(word: string): boolean {
  if (!word) return true
  if (word.length < 2) return true
  return HIGHLIGHT_STOPWORDS.has(word.toLowerCase())
}
