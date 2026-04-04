import {
  buildReferenceLabel,
  buildVerseKey,
  normalizeForSearch
} from '../lib/searchText'

const versionStore = new Map()

function prepareVerse(rawVerse) {
  const verse = {
    ...rawVerse,
    bookNumber: Number(rawVerse.bookNumber),
    chapter: Number(rawVerse.chapter),
    verse: Number(rawVerse.verse)
  }

  return {
    ...verse,
    key: buildVerseKey(verse),
    referenceLabel: buildReferenceLabel(verse),
    normalizedText: normalizeForSearch(rawVerse.text),
    sortValue:
      Number(verse.bookNumber) * 1000000 +
      Number(verse.chapter) * 1000 +
      Number(verse.verse)
  }
}

function prepareVersion(version) {
  const verses = Array.isArray(version.verses) ? version.verses.map(prepareVerse) : []
  const verseMap = new Map(verses.map((verse) => [verse.key, verse]))

  return {
    translation: version.translation,
    verses,
    verseMap,
    verseCount: verses.length
  }
}

function parseQuery(query, exactPhrase) {
  const normalized = normalizeForSearch(query)

  if (!normalized) {
    return null
  }

  if (exactPhrase) {
    return {
      mode: 'phrase',
      phrase: normalized
    }
  }

  const tokens = normalized.split(/\s+/).filter(Boolean)

  if (tokens.length > 1) {
    return {
      mode: 'tokens',
      tokens
    }
  }

  if (/[\u3400-\u9fff]/u.test(normalized)) {
    return {
      mode: 'phrase',
      phrase: normalized
    }
  }

  return {
    mode: 'tokens',
    tokens
  }
}

function scoreVerse(verse, parsedQuery) {
  if (!parsedQuery) {
    return 0
  }

  if (parsedQuery.mode === 'phrase') {
    return verse.normalizedText.includes(parsedQuery.phrase) ? parsedQuery.phrase.length : 0
  }

  let score = 0

  for (const token of parsedQuery.tokens) {
    if (!verse.normalizedText.includes(token)) {
      return 0
    }

    score += token.length
  }

  return score
}

function searchVersions({ query, exactPhrase, selectedVersionIds, limit }) {
  const startedAt = performance.now()
  const parsedQuery = parseQuery(query, exactPhrase)

  if (!parsedQuery) {
    return {
      requestState: 'idle',
      totalHits: 0,
      elapsedMs: 0,
      results: []
    }
  }

  const grouped = new Map()

  for (const versionId of selectedVersionIds) {
    const preparedVersion = versionStore.get(versionId)
    if (!preparedVersion || preparedVersion.verseCount === 0) {
      continue
    }

    for (const verse of preparedVersion.verses) {
      const score = scoreVerse(verse, parsedQuery)
      if (score === 0) {
        continue
      }

      const existing = grouped.get(verse.key) ?? {
        key: verse.key,
        sortValue: verse.sortValue,
        referenceLabel: verse.referenceLabel,
        matchedVersionIds: [],
        score: 0
      }

      if (!existing.matchedVersionIds.includes(versionId)) {
        existing.matchedVersionIds.push(versionId)
      }

      existing.score += score
      grouped.set(verse.key, existing)
    }
  }

  const ordered = [...grouped.values()]
    .sort((left, right) => left.sortValue - right.sortValue)
    .slice(0, limit)

  const results = ordered.map((entry) => {
    const lines = selectedVersionIds.flatMap((versionId) => {
      const version = versionStore.get(versionId)
      if (!version) {
        return []
      }

      const verse = version.verseMap.get(entry.key)
      if (!verse) {
        return []
      }

      return [
        {
          versionId,
          text: verse.text,
          matched: entry.matchedVersionIds.includes(versionId)
        }
      ]
    })

    return {
      ...entry,
      lines
    }
  })

  return {
    requestState: 'done',
    totalHits: grouped.size,
    elapsedMs: Math.round(performance.now() - startedAt),
    results
  }
}

self.onmessage = (event) => {
  const payload = event.data

  if (payload.type === 'sync-versions') {
    versionStore.clear()

    for (const version of payload.versions) {
      versionStore.set(version.translation.id, prepareVersion(version))
    }

    const versionCount = versionStore.size
    const verseCount = [...versionStore.values()].reduce(
      (sum, version) => sum + version.verseCount,
      0
    )

    self.postMessage({
      type: 'versions-ready',
      stats: {
        versionCount,
        verseCount
      }
    })
  }

  if (payload.type === 'search') {
    const result = searchVersions(payload)
    self.postMessage({
      type: 'search-result',
      requestId: payload.requestId,
      result
    })
  }
}
