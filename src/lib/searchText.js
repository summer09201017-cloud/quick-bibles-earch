export function normalizeForSearch(value) {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, "'")
    .replace(/[^\p{L}\p{N}\s:'-]+/gu, ' ')
    // Chinese queries should not miss because of FHL's extra spaces before words like " 神".
    .replace(/([\p{Script=Han}])\s+(?=[\p{Script=Han}])/gu, '$1')
    .replace(/([\p{Script=Han}])\s+(?=[A-Za-z0-9])/gu, '$1')
    .replace(/([A-Za-z0-9])\s+(?=[\p{Script=Han}])/gu, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildVerseKey(verse) {
  const bookNumber = Number(verse.bookNumber)
  const chapter = Number(verse.chapter)
  const number = Number(verse.verse)

  return `${bookNumber}-${chapter}-${number}`
}

export function buildReferenceLabel(verse) {
  return `${verse.book} ${verse.chapter}:${verse.verse}`
}

export function getHighlightRegex(query, exactPhrase) {
  const normalizedQuery = String(query ?? '').trim()
  if (!normalizedQuery) {
    return null
  }

  const terms = exactPhrase
    ? [normalizedQuery]
    : normalizedQuery
        .split(/\s+/)
        .map((term) => term.trim())
        .filter(Boolean)

  if (terms.length === 0) {
    return null
  }

  const escapedTerms = terms
    .sort((left, right) => right.length - left.length)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))

  return new RegExp(`(${escapedTerms.join('|')})`, 'giu')
}
