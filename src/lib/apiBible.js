import { BOOK_NUMBER_BY_ENGLISH } from './bookNames'

export const API_BIBLE_STORAGE_KEY = 'bible-live-api-bible'

export function getDefaultApiBibleConfig() {
  return {
    enabled: false,
    apiKey: '',
    bibleId: '',
    label: 'NIV Live',
    provider: 'API.Bible'
  }
}

export function loadApiBibleConfig() {
  try {
    const rawValue = window.localStorage.getItem(API_BIBLE_STORAGE_KEY)
    if (!rawValue) {
      return getDefaultApiBibleConfig()
    }

    return {
      ...getDefaultApiBibleConfig(),
      ...JSON.parse(rawValue)
    }
  } catch {
    return getDefaultApiBibleConfig()
  }
}

export function saveApiBibleConfig(config) {
  window.localStorage.setItem(API_BIBLE_STORAGE_KEY, JSON.stringify(config))
}

export function clearApiBibleConfig() {
  window.localStorage.removeItem(API_BIBLE_STORAGE_KEY)
}

function stripHtml(value) {
  return String(value ?? '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseReference(reference) {
  const match = String(reference ?? '')
    .trim()
    .match(/^(.+?)\s+(\d+):(\d+)/)

  if (!match) {
    return null
  }

  const bookName = match[1].trim().toLowerCase()
  const bookNumber = BOOK_NUMBER_BY_ENGLISH[bookName]

  if (!bookNumber) {
    return null
  }

  const chapter = Number(match[2])
  const verse = Number(match[3])

  return {
    key: `${bookNumber}-${chapter}-${verse}`,
    sortValue: bookNumber * 1000000 + chapter * 1000 + verse
  }
}

function normalizeSearchPayload(data) {
  if (Array.isArray(data?.verses)) {
    return {
      total: Number(data.total ?? data.verses.length ?? 0),
      results: data.verses
        .map((verse) => {
          const parsed = parseReference(verse.reference)
          if (!parsed) {
            return null
          }

          return {
            key: parsed.key,
            referenceLabel: verse.reference,
            text: stripHtml(verse.text ?? verse.content),
            matchedVersionIds: ['niv'],
            lines: [
              {
                versionId: 'niv',
                text: stripHtml(verse.text ?? verse.content),
                matched: true
              }
            ],
            sortValue: parsed.sortValue
          }
        })
        .filter(Boolean)
    }
  }

  if (Array.isArray(data?.passages)) {
    return {
      total: Number(data.total ?? data.passages.length ?? 0),
      results: data.passages
        .map((passage) => {
          const parsed = parseReference(passage.reference)
          if (!parsed) {
            return null
          }

          return {
            key: parsed.key,
            referenceLabel: passage.reference,
            text: stripHtml(passage.content),
            matchedVersionIds: ['niv'],
            lines: [
              {
                versionId: 'niv',
                text: stripHtml(passage.content),
                matched: true
              }
            ],
            sortValue: parsed.sortValue
          }
        })
        .filter(Boolean)
    }
  }

  return {
    total: 0,
    results: []
  }
}

export async function searchApiBible({ apiKey, bibleId, query, offset = 0 }) {
  const url = new URL(`https://api.scripture.api.bible/v1/bibles/${bibleId}/search`)
  url.searchParams.set('query', query)
  url.searchParams.set('offset', String(offset))

  const response = await fetch(url, {
    headers: {
      'api-key': apiKey
    }
  })

  if (!response.ok) {
    const errorText = await response.text()

    if (response.status === 401) {
      throw new Error('API.Bible 金鑰無效或沒有 API 權限。')
    }

    if (response.status === 403) {
      throw new Error('這把 API.Bible 金鑰沒有權限讀取該 NIV 版本。')
    }

    throw new Error(errorText || `API.Bible 查詢失敗 (${response.status})`)
  }

  const payload = await response.json()
  return normalizeSearchPayload(payload.data)
}
