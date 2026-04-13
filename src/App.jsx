import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SELECTED_VERSIONS,
  VERSION_CATALOG,
  VERSION_LOOKUP
} from './lib/constants'
import {
  clearApiBibleConfig,
  getDefaultApiBibleConfig,
  loadApiBibleConfig,
  saveApiBibleConfig,
  searchApiBible
} from './lib/apiBible'
import { BOOKS } from './lib/bookNames'
import { deleteVersion, getAllStoredVersions, saveVersion } from './lib/dataStore'
import { buildReferenceLabel, buildVerseKey, getHighlightRegex } from './lib/searchText'

const BOOK_LOOKUP = Object.fromEntries(BOOKS.map((book) => [book.number, book]))
const READER_SECTION_ID = 'chapter-reader'
const FHL_COMMENTARY_URL = 'https://bible.fhl.net/index.html'
const FHL_COMMENTARY_BOOK_ID = '3'
const FHL_ENGS_BY_BOOK_NUMBER = {
  1: 'Gen',
  2: 'Ex',
  3: 'Lev',
  4: 'Num',
  5: 'Deut',
  6: 'Josh',
  7: 'Judg',
  8: 'Ruth',
  9: '1 Sam',
  10: '2 Sam',
  11: '1 Kin',
  12: '2 Kin',
  13: '1 Chr',
  14: '2 Chr',
  15: 'Ezra',
  16: 'Neh',
  17: 'Esth',
  18: 'Job',
  19: 'Ps',
  20: 'Prov',
  21: 'Eccl',
  22: 'Song',
  23: 'Is',
  24: 'Jer',
  25: 'Lam',
  26: 'Ezek',
  27: 'Dan',
  28: 'Hos',
  29: 'Joel',
  30: 'Amos',
  31: 'Obad',
  32: 'Jon',
  33: 'Mic',
  34: 'Nah',
  35: 'Hab',
  36: 'Zeph',
  37: 'Hag',
  38: 'Zech',
  39: 'Mal',
  40: 'Matt',
  41: 'Mark',
  42: 'Luke',
  43: 'John',
  44: 'Acts',
  45: 'Rom',
  46: '1 Cor',
  47: '2 Cor',
  48: 'Gal',
  49: 'Eph',
  50: 'Phil',
  51: 'Col',
  52: '1 Thess',
  53: '2 Thess',
  54: '1 Tim',
  55: '2 Tim',
  56: 'Titus',
  57: 'Philem',
  58: 'Heb',
  59: 'James',
  60: '1 Pet',
  61: '2 Pet',
  62: '1 John',
  63: '2 John',
  64: '3 John',
  65: 'Jude',
  66: 'Rev'
}
const MOBILE_HEADER_COLLAPSE_STORAGE_KEY = 'mobile-header-collapsed'
const VERSE_FONT_SIZE_STORAGE_KEY = 'verse-font-size'
const MIN_VERSE_FONT_SIZE = 12
const MAX_VERSE_FONT_SIZE = 30
const DEFAULT_MOBILE_VERSE_FONT_SIZE = 18
const DEFAULT_DESKTOP_VERSE_FONT_SIZE = 20
const VISIBLE_VERSION_IDS = ['cuv', 'niv', 'esv', 'lzz', 'cnv', 'bbe', 'web', 'bsb', 'kjv', 'asv']
const VISIBLE_VERSION_SET = new Set(VISIBLE_VERSION_IDS)
const VERSION_ORDER_LOOKUP = new Map(VISIBLE_VERSION_IDS.map((id, index) => [id, index]))

function clampVerseFontSize(value) {
  const normalized = Math.round(Number(value))

  if (!Number.isFinite(normalized)) {
    return DEFAULT_MOBILE_VERSE_FONT_SIZE
  }

  return Math.min(MAX_VERSE_FONT_SIZE, Math.max(MIN_VERSE_FONT_SIZE, normalized))
}

function sortVersionIds(versionIds) {
  return [...versionIds].sort((left, right) => {
    const leftIndex = VERSION_ORDER_LOOKUP.get(left) ?? Number.MAX_SAFE_INTEGER
    const rightIndex = VERSION_ORDER_LOOKUP.get(right) ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  })
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-glow">
      <div className="text-xs uppercase tracking-[0.24em] text-slate-600">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      <div className="mt-1 text-sm text-slate-600">{hint}</div>
    </div>
  )
}

function Chip({ active, children, onClick, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
        active
          ? 'border-sky-400/50 bg-sky-100 text-sky-700'
          : 'border-slate-300 bg-white/90 text-slate-700 hover:border-slate-400'
      } ${className}`}
    >
      {children}
    </button>
  )
}

function VersionPicker({
  versions,
  selectedVersionIds,
  versionsById,
  onToggle
}) {
  const selectedVersionIdSet = new Set(selectedVersionIds)

  return (
    <section className="mt-4 rounded-3xl border border-slate-200 bg-white/95 p-4 shadow-glow">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-bold text-slate-900">譯本切換</h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            點一下即可切換。至少保留一個譯本，閱讀器與搜尋結果會同步更新。
          </p>
        </div>
        <div className="text-xs font-medium text-slate-500">
          已選 {selectedVersionIds.length} / {versions.length}
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
        {versions.map((version) => {
          const isSelected = selectedVersionIdSet.has(version.id)
          const isOnlySelected = isSelected && selectedVersionIds.length === 1
          const verseCount = versionsById[version.id]?.verses?.length ?? 0
          const hasLocalJson = verseCount > 0

          return (
            <button
              key={version.id}
              type="button"
              onClick={() => onToggle(version.id)}
              disabled={isOnlySelected}
              aria-pressed={isSelected}
              className={`rounded-2xl border px-3 py-3 text-left transition ${
                isSelected
                  ? 'border-sky-400/40 bg-sky-500/10 shadow-glow'
                  : 'border-slate-200 bg-slate-50/80 hover:border-slate-300 hover:bg-white'
              } ${isOnlySelected ? 'cursor-not-allowed opacity-80' : ''}`}
            >
              <div className="flex items-start justify-between gap-2">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${version.badge}`}
                >
                  {version.short}
                </span>
                <span
                  className={`rounded-full px-2 py-1 text-[11px] font-medium ${
                    isSelected ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isSelected ? '已選' : '未選'}
                </span>
              </div>

              <div className="mt-2">
                <div className="text-sm font-semibold text-slate-900">{version.name}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  {version.language}
                </div>
              </div>

              <div className="mt-2 text-[11px] text-slate-500">
                {hasLocalJson ? `本機 JSON ${verseCount.toLocaleString()} 節` : '目前沒有本機 JSON'}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

function buildFhlCommentaryUrl(location) {
  const bookNumber = Number(location?.bookNumber)
  const chapter = Number(location?.chapter)
  const verse = Number(location?.verse)
  const engs = FHL_ENGS_BY_BOOK_NUMBER[bookNumber]

  if (!engs || !chapter || !verse) {
    return FHL_COMMENTARY_URL
  }

  const params = new URLSearchParams({
    book: FHL_COMMENTARY_BOOK_ID,
    engs,
    chap: String(chapter),
    sec: String(verse),
    m: '0'
  })

  return `https://bible.fhl.net/new/com.php?${params.toString()}`
}

function buildFhlCommentaryUrlFromKey(key) {
  const [bookNumber, chapter, verse] = String(key ?? '')
    .split('-')
    .map((value) => Number(value))

  return buildFhlCommentaryUrl({ bookNumber, chapter, verse })
}

function CommentaryLink({ href, className = '' }) {
  return (
    <a
      href={href || FHL_COMMENTARY_URL}
      target="_blank"
      rel="noreferrer"
      className={`text-sm font-medium text-sky-700 underline-offset-2 transition hover:text-sky-800 hover:underline ${className}`}
    >
      經文註釋
    </a>
  )
}

function highlightText(text, query, exactPhrase) {
  const regex = getHighlightRegex(query, exactPhrase)
  if (!regex || !text) {
    return text
  }

  const matches = [...text.matchAll(regex)]
  if (matches.length === 0) {
    return text
  }

  const nodes = []
  let lastIndex = 0

  matches.forEach((match, index) => {
    const start = match.index ?? 0
    const end = start + match[0].length

    if (start > lastIndex) {
      nodes.push(text.slice(lastIndex, start))
    }

    nodes.push(
      <mark
        key={`${match[0]}-${start}-${index}`}
        className="rounded bg-yellow-300 px-1 font-semibold text-red-700"
      >
        {text.slice(start, end)}
      </mark>
    )

    lastIndex = end
  })

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }

  return nodes
}

function getBookLabel(bookNumber, fallback = '') {
  return fallback || BOOK_LOOKUP[Number(bookNumber)]?.chinese || `書卷 ${bookNumber}`
}

function buildReaderCatalog(version) {
  const books = []
  const booksByNumber = new Map()
  const chaptersByKey = new Map()
  const orderedChapters = []

  for (const rawVerse of version?.verses ?? []) {
    const verse = normalizeImportedVerse(rawVerse)
    const bookLabel = getBookLabel(verse.bookNumber, verse.book)
    const chapterKey = `${verse.bookNumber}-${verse.chapter}`

    let bookMeta = booksByNumber.get(verse.bookNumber)
    if (!bookMeta) {
      bookMeta = {
        bookNumber: verse.bookNumber,
        bookLabel,
        chapters: []
      }
      booksByNumber.set(verse.bookNumber, bookMeta)
      books.push(bookMeta)
    }

    let chapterMeta = chaptersByKey.get(chapterKey)
    if (!chapterMeta) {
      chapterMeta = {
        key: chapterKey,
        bookNumber: verse.bookNumber,
        bookLabel,
        chapter: verse.chapter,
        verses: []
      }
      chaptersByKey.set(chapterKey, chapterMeta)
      orderedChapters.push(chapterMeta)
      bookMeta.chapters.push(chapterMeta)
    }

    chapterMeta.verses.push({
      key: buildVerseKey(verse),
      verse: verse.verse,
      referenceLabel: buildReferenceLabel({
        ...verse,
        book: bookLabel
      })
    })
  }

  books.sort((left, right) => left.bookNumber - right.bookNumber)
  orderedChapters.sort((left, right) => {
    if (left.bookNumber !== right.bookNumber) {
      return left.bookNumber - right.bookNumber
    }

    return left.chapter - right.chapter
  })

  books.forEach((book) => {
    book.chapters.sort((left, right) => left.chapter - right.chapter)
    book.chapters.forEach((chapter) => {
      chapter.verses.sort((left, right) => left.verse - right.verse)
    })
  })

  return {
    books,
    orderedChapters,
    chaptersByKey
  }
}

function normalizeReaderSelection(selection, catalog) {
  const firstChapter = catalog.orderedChapters[0]

  if (!firstChapter) {
    return {
      bookNumber: null,
      chapter: null,
      verse: null
    }
  }

  const currentBook =
    catalog.books.find((book) => book.bookNumber === Number(selection.bookNumber)) ?? catalog.books[0]
  const currentChapter =
    currentBook.chapters.find((chapter) => chapter.chapter === Number(selection.chapter)) ??
    currentBook.chapters[0]
  const requestedVerse = Number(selection.verse)
  const currentVerse =
    currentChapter.verses.find((verse) => verse.verse === requestedVerse)?.verse ??
    currentChapter.verses[0]?.verse ??
    1

  return {
    bookNumber: currentBook.bookNumber,
    chapter: currentChapter.chapter,
    verse: currentVerse
  }
}

function formatEntriesForCopy(entries) {
  return entries
    .map((entry) => {
      const lines = entry.lines
        .map((line) => {
          const version = VERSION_LOOKUP[line.versionId]
          return `[${version?.short ?? line.versionId}] ${line.text}`
        })
        .join('\n')

      return `${entry.referenceLabel}\n${lines}`
    })
    .join('\n\n')
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function ReaderActionBar({ previousChapter, nextChapter, selectedCount, onCopy, onNavigate }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        {previousChapter ? (
          <a
            href={`#${READER_SECTION_ID}`}
            onClick={(event) => {
              event.preventDefault()
              onNavigate(previousChapter)
            }}
            className="text-sky-600 transition hover:text-sky-700 hover:underline"
          >
            上一章：{previousChapter.bookLabel} {previousChapter.chapter}
          </a>
        ) : (
          <span className="text-slate-600">沒有上一章</span>
        )}

        {nextChapter ? (
          <a
            href={`#${READER_SECTION_ID}`}
            onClick={(event) => {
              event.preventDefault()
              onNavigate(nextChapter)
            }}
            className="text-sky-600 transition hover:text-sky-700 hover:underline"
          >
            下一章：{nextChapter.bookLabel} {nextChapter.chapter}
          </a>
        ) : (
          <span className="text-slate-600">沒有下一章</span>
        )}
      </div>

      <button
        type="button"
        onClick={onCopy}
        disabled={selectedCount === 0}
        className="rounded-2xl border border-red-400/40 bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
      >
        複製勾選經文{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </button>
    </div>
  )
}

function VerseFontSizeControl({ value, onChange }) {
  const canDecrease = value > MIN_VERSE_FONT_SIZE
  const canIncrease = value < MAX_VERSE_FONT_SIZE

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs uppercase tracking-[0.24em] text-slate-500">字級</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">經文字體 {value}px</div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onChange(value - 1)}
            disabled={!canDecrease}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            A-
          </button>
          <button
            type="button"
            onClick={() => onChange(value + 1)}
            disabled={!canIncrease}
            className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
          >
            A+
          </button>
        </div>
      </div>

      <label className="mt-3 block">
        <span className="sr-only">調整經文字體大小</span>
        <input
          type="range"
          min={MIN_VERSE_FONT_SIZE}
          max={MAX_VERSE_FONT_SIZE}
          step="1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-2 w-full cursor-pointer accent-sky-600"
        />
      </label>

      <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
        <span>{MIN_VERSE_FONT_SIZE}px</span>
        <span>{MAX_VERSE_FONT_SIZE}px</span>
      </div>
    </div>
  )
}

function normalizeImportedVerse(verse) {
  return {
    ...verse,
    bookNumber: Number(verse.bookNumber),
    chapter: Number(verse.chapter),
    verse: Number(verse.verse),
    id: verse.id ?? buildVerseKey(verse)
  }
}

function validateVersionPayload(rawPayload, fileName) {
  const payload = rawPayload?.payload ?? rawPayload
  const translation = payload?.translation
  const verses = payload?.verses

  if (!translation?.id || !VERSION_LOOKUP[translation.id]) {
    throw new Error(`${fileName} 找不到合法的 translation.id`)
  }

  if (!Array.isArray(verses)) {
    throw new Error(`${fileName} 的 verses 必須是陣列`)
  }

  const normalizedVerses = verses.map((verse, index) => {
    if (
      typeof verse?.bookNumber === 'undefined' ||
      typeof verse?.chapter === 'undefined' ||
      typeof verse?.verse === 'undefined' ||
      typeof verse?.text !== 'string'
    ) {
      throw new Error(`${fileName} 第 ${index + 1} 筆 verse 缺少必要欄位`)
    }

    return normalizeImportedVerse(verse)
  })

  return {
    translation: {
      ...VERSION_LOOKUP[translation.id],
      ...translation
    },
    verses: normalizedVerses
  }
}

function mergeVersionState(catalogEntries, builtInVersions, storedVersions) {
  const nextState = {}

  for (const meta of catalogEntries) {
    const fallback = builtInVersions[meta.id] ?? {
      translation: meta,
      verses: [],
      source: 'bundled'
    }
    const stored = storedVersions[meta.id]
    const resolved = stored?.payload ?? fallback

    nextState[meta.id] = {
      ...resolved,
      source: stored ? 'indexeddb' : fallback.source ?? 'bundled'
    }
  }

  return nextState
}

function buildLocalVerseLookups(versionsById) {
  return Object.fromEntries(
    Object.entries(versionsById).map(([versionId, version]) => [
      versionId,
      new Map(
        (version?.verses ?? []).map((verse) => [buildVerseKey(verse), verse])
      )
    ])
  )
}

function mergeResultsWithLiveNiv(localResults, remoteResults, selectedVersions, localVerseLookups) {
  const merged = new Map()

  for (const result of localResults) {
    merged.set(result.key, {
      ...result,
      matchedVersionIds: [...result.matchedVersionIds],
      lines: [...result.lines]
    })
  }

  for (const remoteResult of remoteResults) {
    const existing = merged.get(remoteResult.key)

    if (existing) {
      if (!existing.matchedVersionIds.includes('niv')) {
        existing.matchedVersionIds.push('niv')
      }

      if (!existing.lines.some((line) => line.versionId === 'niv')) {
        existing.lines.push({
          versionId: 'niv',
          text: remoteResult.lines[0]?.text ?? '',
          matched: true
        })
      }

      continue
    }

    const lines = selectedVersions.flatMap((versionId) => {
      if (versionId === 'niv') {
        return [
          {
            versionId: 'niv',
            text: remoteResult.lines[0]?.text ?? '',
            matched: true
          }
        ]
      }

      const verse = localVerseLookups[versionId]?.get(remoteResult.key)
      if (!verse) {
        return []
      }

      return [
        {
          versionId,
          text: verse.text,
          matched: false
        }
      ]
    })

    merged.set(remoteResult.key, {
      ...remoteResult,
      lines
    })
  }

  return [...merged.values()].sort(
    (left, right) => (left.sortValue ?? Number.MAX_SAFE_INTEGER) - (right.sortValue ?? Number.MAX_SAFE_INTEGER)
  )
}

function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null)

  useEffect(() => {
    function handleBeforeInstall(event) {
      event.preventDefault()
      setPromptEvent(event)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall)
  }, [])

  async function triggerInstall() {
    if (!promptEvent) {
      return false
    }

    await promptEvent.prompt()
    const choice = await promptEvent.userChoice
    if (choice.outcome !== 'accepted') {
      return false
    }

    setPromptEvent(null)
    return true
  }

  return {
    canInstall: Boolean(promptEvent),
    triggerInstall
  }
}

export default function App() {
  const searchWorkerRef = useRef(null)
  const builtInVersionsRef = useRef({})
  const requestIdRef = useRef(0)
  const { canInstall, triggerInstall } = useInstallPrompt()

  const [catalogState, setCatalogState] = useState(
    VERSION_CATALOG.filter((item) => VISIBLE_VERSION_SET.has(item.id))
  )
  const [versionsById, setVersionsById] = useState({})
  const [selectedVersions, setSelectedVersions] = useState(
    sortVersionIds(DEFAULT_SELECTED_VERSIONS.filter((item) => VISIBLE_VERSION_SET.has(item)))
  )
  const [query, setQuery] = useState('')
  const [exactPhrase, setExactPhrase] = useState(false)
  const [limit, setLimit] = useState(150)
  const [activeView, setActiveView] = useState('reader')
  const [appStatus, setAppStatus] = useState('初始化中...')
  const [workerStats, setWorkerStats] = useState({ versionCount: 0, verseCount: 0 })
  const [searchState, setSearchState] = useState({
    requestState: 'idle',
    totalHits: 0,
    elapsedMs: 0,
    results: []
  })
  const [isLoadingApp, setIsLoadingApp] = useState(true)
  const [importMessage, setImportMessage] = useState('')
  const [apiBibleConfig, setApiBibleConfig] = useState(getDefaultApiBibleConfig())
  const [liveNivState, setLiveNivState] = useState({
    requestState: 'idle',
    totalHits: 0,
    results: [],
    error: ''
  })
  const [selectedVerseKeys, setSelectedVerseKeys] = useState([])
  const [copyMessage, setCopyMessage] = useState('')
  const [readerSelection, setReaderSelection] = useState({
    bookNumber: null,
    chapter: null,
    verse: null
  })
  const [readerJumpTarget, setReaderJumpTarget] = useState({
    key: '',
    token: 0
  })
  const [isVersionPickerOpen, setIsVersionPickerOpen] = useState(false)
  const [isHeaderCollapsed, setIsHeaderCollapsed] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }

    const saved = window.localStorage.getItem(MOBILE_HEADER_COLLAPSE_STORAGE_KEY)
    if (saved !== null) {
      return saved === '1'
    }

    return window.matchMedia('(max-width: 1023px)').matches
  })
  const [verseFontSize, setVerseFontSize] = useState(() => {
    if (typeof window === 'undefined') {
      return DEFAULT_MOBILE_VERSE_FONT_SIZE
    }

    const saved = window.localStorage.getItem(VERSE_FONT_SIZE_STORAGE_KEY)
    if (saved !== null) {
      return clampVerseFontSize(saved)
    }

    return window.matchMedia('(max-width: 1023px)').matches
      ? DEFAULT_MOBILE_VERSE_FONT_SIZE
      : DEFAULT_DESKTOP_VERSE_FONT_SIZE
  })

  const availableVersions = useMemo(
    () => catalogState.map((item) => versionsById[item.id]).filter(Boolean),
    [catalogState, versionsById]
  )

  const loadedVersionCount = availableVersions.filter((item) => item.verses.length > 0).length
  const hasLocalNiv = (versionsById.niv?.verses?.length ?? 0) > 0
  const localVerseLookups = useMemo(() => buildLocalVerseLookups(versionsById), [versionsById])
  const shouldUseLiveNiv =
    selectedVersions.includes('niv') &&
    !hasLocalNiv &&
    apiBibleConfig.enabled &&
    apiBibleConfig.apiKey.trim() &&
    apiBibleConfig.bibleId.trim()

  const mergedResults = useMemo(
    () =>
      mergeResultsWithLiveNiv(
        searchState.results,
        shouldUseLiveNiv ? liveNivState.results : [],
        selectedVersions,
        localVerseLookups
      ),
    [liveNivState.results, localVerseLookups, searchState.results, selectedVersions, shouldUseLiveNiv]
  )
  const combinedResults = useMemo(() => mergedResults.slice(0, limit), [limit, mergedResults])
  const selectedVerseKeySet = useMemo(() => new Set(selectedVerseKeys), [selectedVerseKeys])
  const localVersionIds = useMemo(
    () =>
      catalogState
        .filter((item) => (versionsById[item.id]?.verses?.length ?? 0) > 0)
        .map((item) => item.id),
    [catalogState, versionsById]
  )
  const readerPreferredVersionId = useMemo(
    () => selectedVersions.find((id) => localVersionIds.includes(id)) ?? localVersionIds[0] ?? null,
    [localVersionIds, selectedVersions]
  )
  const readerCatalog = useMemo(
    () => buildReaderCatalog(readerPreferredVersionId ? versionsById[readerPreferredVersionId] : null),
    [readerPreferredVersionId, versionsById]
  )
  const readerDisplayVersionIds = useMemo(() => {
    const localSelectedVersions = selectedVersions.filter((id) => localVersionIds.includes(id))
    if (localSelectedVersions.length > 0) {
      return localSelectedVersions
    }

    return readerPreferredVersionId ? [readerPreferredVersionId] : []
  }, [localVersionIds, readerPreferredVersionId, selectedVersions])
  const readerUnavailableVersionIds = useMemo(
    () => selectedVersions.filter((id) => !localVersionIds.includes(id)),
    [localVersionIds, selectedVersions]
  )
  const verseTextStyle = useMemo(
    () => ({
      fontSize: `${verseFontSize}px`,
      lineHeight: 1.8
    }),
    [verseFontSize]
  )
  const currentReaderBook =
    readerCatalog.books.find((book) => book.bookNumber === readerSelection.bookNumber) ?? null
  const currentReaderChapter =
    readerCatalog.chaptersByKey.get(`${readerSelection.bookNumber}-${readerSelection.chapter}`) ?? null
  const readerChapterEntries = useMemo(() => {
    if (!currentReaderChapter) {
      return []
    }

    return currentReaderChapter.verses.map((chapterVerse) => ({
      ...chapterVerse,
      lines: readerDisplayVersionIds.flatMap((versionId) => {
        const verse = localVerseLookups[versionId]?.get(chapterVerse.key)
        if (!verse) {
          return []
        }

        return [
          {
            versionId,
            text: verse.text
          }
        ]
      })
    }))
  }, [currentReaderChapter, localVerseLookups, readerDisplayVersionIds])
  const currentReaderVerseOptions = currentReaderChapter?.verses ?? []
  const currentReaderChapterIndex = readerCatalog.orderedChapters.findIndex(
    (chapter) =>
      chapter.bookNumber === readerSelection.bookNumber &&
      chapter.chapter === readerSelection.chapter
  )
  const previousReaderChapter =
    currentReaderChapterIndex > 0
      ? readerCatalog.orderedChapters[currentReaderChapterIndex - 1]
      : null
  const nextReaderChapter =
    currentReaderChapterIndex >= 0 &&
    currentReaderChapterIndex < readerCatalog.orderedChapters.length - 1
      ? readerCatalog.orderedChapters[currentReaderChapterIndex + 1]
      : null
  const selectedReaderEntries = useMemo(
    () => readerChapterEntries.filter((entry) => selectedVerseKeySet.has(entry.key)),
    [readerChapterEntries, selectedVerseKeySet]
  )
  const selectedSearchEntries = useMemo(
    () => combinedResults.filter((entry) => selectedVerseKeySet.has(entry.key)),
    [combinedResults, selectedVerseKeySet]
  )

  useEffect(() => {
    searchWorkerRef.current = new Worker(new URL('./workers/searchWorker.js', import.meta.url), {
      type: 'module'
    })

    const worker = searchWorkerRef.current

    worker.onmessage = (event) => {
      const payload = event.data

      if (payload.type === 'versions-ready') {
        setWorkerStats(payload.stats)
        setAppStatus(
          `已載入 ${payload.stats.versionCount} 個譯本，索引 ${payload.stats.verseCount.toLocaleString()} 節`
        )
      }

      if (payload.type === 'search-result' && payload.requestId === requestIdRef.current) {
        setSearchState(payload.result)
      }
    }

    return () => worker.terminate()
  }, [])

  useEffect(() => {
    setApiBibleConfig(loadApiBibleConfig())
  }, [])

  useEffect(() => {
    async function bootstrap() {
      setIsLoadingApp(true)

      try {
        setAppStatus('正在載入目錄資料...')
        const catalogResponse = await fetch('/data/catalog.json', { cache: 'no-store' })
        const catalogJson = await catalogResponse.json()
        const catalogEntries = catalogJson.versions
          .filter((entry) => VISIBLE_VERSION_SET.has(entry.id))
          .map((entry) => ({
            ...VERSION_LOOKUP[entry.id],
            ...entry
          }))
          .sort(
            (left, right) =>
              (VERSION_ORDER_LOOKUP.get(left.id) ?? Number.MAX_SAFE_INTEGER) -
              (VERSION_ORDER_LOOKUP.get(right.id) ?? Number.MAX_SAFE_INTEGER)
          )
        setCatalogState(catalogEntries)

        setAppStatus('正在下載內建 JSON...')
        const builtInResponses = await Promise.all(
          catalogEntries.map(async (entry) => {
            const response = await fetch(entry.file, { cache: 'no-store' })
            const payload = await response.json()

            return [
              entry.id,
              {
                ...payload,
                translation: {
                  ...VERSION_LOOKUP[entry.id],
                  ...payload.translation
                },
                source: 'bundled'
              }
            ]
          })
        )

        builtInVersionsRef.current = Object.fromEntries(builtInResponses)

        setAppStatus('正在載入本機資料...')
        const storedVersions = await getAllStoredVersions()
        const storedMap = Object.fromEntries(storedVersions.map((item) => [item.id, item]))

        setVersionsById(
          mergeVersionState(catalogEntries, builtInVersionsRef.current, storedMap)
        )
      } catch (error) {
        console.error(error)
        setAppStatus('載入失敗，請確認 public/data 內的 JSON 檔案')
      } finally {
        setIsLoadingApp(false)
      }
    }

    bootstrap()
  }, [])

  useEffect(() => {
    if (!searchWorkerRef.current) {
      return
    }

    const loadedVersions = Object.values(versionsById)
    if (loadedVersions.length === 0) {
      return
    }

    searchWorkerRef.current.postMessage({
      type: 'sync-versions',
      versions: loadedVersions
    })
  }, [versionsById])

  useEffect(() => {
    if (!searchWorkerRef.current) {
      return
    }

    const trimmedQuery = query.trim()
    if (!trimmedQuery) {
      setSearchState({
        requestState: 'idle',
        totalHits: 0,
        elapsedMs: 0,
        results: []
      })
      return
    }

    const timer = window.setTimeout(() => {
      requestIdRef.current += 1
      setSearchState((current) => ({
        ...current,
        requestState: 'loading'
      }))

      searchWorkerRef.current.postMessage({
        type: 'search',
        requestId: requestIdRef.current,
        query: trimmedQuery,
        exactPhrase,
        selectedVersionIds: selectedVersions,
        limit
      })
    }, 100)

    return () => window.clearTimeout(timer)
  }, [exactPhrase, limit, query, selectedVersions])

  useEffect(() => {
    const trimmedQuery = query.trim()

    if (!trimmedQuery || !shouldUseLiveNiv) {
      setLiveNivState({
        requestState: 'idle',
        totalHits: 0,
        results: [],
        error: ''
      })
      return
    }

    let cancelled = false

    const timer = window.setTimeout(async () => {
      setLiveNivState((current) => ({
        ...current,
        requestState: 'loading',
        error: ''
      }))

      try {
        const result = await searchApiBible({
          apiKey: apiBibleConfig.apiKey.trim(),
          bibleId: apiBibleConfig.bibleId.trim(),
          query: trimmedQuery
        })

        if (cancelled) {
          return
        }

        setLiveNivState({
          requestState: 'done',
          totalHits: result.total,
          results: result.results,
          error: ''
        })
      } catch (error) {
        if (cancelled) {
          return
        }

        setLiveNivState({
          requestState: 'error',
          totalHits: 0,
          results: [],
          error: error.message ?? 'API.Bible 連線失敗'
        })
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [apiBibleConfig.apiKey, apiBibleConfig.bibleId, query, shouldUseLiveNiv])

  useEffect(() => {
    const nextSelection = normalizeReaderSelection(readerSelection, readerCatalog)

    if (
      nextSelection.bookNumber !== readerSelection.bookNumber ||
      nextSelection.chapter !== readerSelection.chapter ||
      nextSelection.verse !== readerSelection.verse
    ) {
      setReaderSelection(nextSelection)
    }
  }, [readerCatalog, readerSelection])

  useEffect(() => {
    if (!copyMessage) {
      return undefined
    }

    const timer = window.setTimeout(() => {
      setCopyMessage('')
    }, 3200)

    return () => window.clearTimeout(timer)
  }, [copyMessage])

  useEffect(() => {
    if (!readerJumpTarget.token) {
      return
    }

    const id = readerJumpTarget.key ? `reader-verse-${readerJumpTarget.key}` : READER_SECTION_ID
    const frameId = window.requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({
        behavior: 'smooth',
        block: readerJumpTarget.key ? 'center' : 'start'
      })
    })

    return () => window.cancelAnimationFrame(frameId)
  }, [readerChapterEntries, readerJumpTarget])

  useEffect(() => {
    window.localStorage.setItem(
      MOBILE_HEADER_COLLAPSE_STORAGE_KEY,
      isHeaderCollapsed ? '1' : '0'
    )
  }, [isHeaderCollapsed])

  useEffect(() => {
    window.localStorage.setItem(VERSE_FONT_SIZE_STORAGE_KEY, String(verseFontSize))
  }, [verseFontSize])

  async function handleImport(event) {
    const files = Array.from(event.target.files ?? [])
    if (files.length === 0) {
      return
    }

    try {
      setImportMessage('正在匯入 JSON...')

      const imported = await Promise.all(
        files.map(async (file) => {
          const text = await file.text()
          const parsed = JSON.parse(text)
          return validateVersionPayload(parsed, file.name)
        })
      )

      for (const version of imported) {
        await saveVersion(version)
      }

      setVersionsById((current) => {
        const next = { ...current }
        imported.forEach((version) => {
          next[version.translation.id] = {
            ...version,
            source: 'indexeddb'
          }
        })
        return next
      })

      setImportMessage(
        `已匯入 ${imported.length} 個譯本：${imported
          .map((item) => item.translation.short)
          .join('、')}`
      )
      setAppStatus('本機 JSON 已更新，搜尋索引重新同步完成')
    } catch (error) {
      console.error(error)
      setImportMessage(error.message ?? 'JSON 匯入失敗')
    } finally {
      event.target.value = ''
    }
  }

  function persistApiBibleConfig() {
    saveApiBibleConfig(apiBibleConfig)
    setImportMessage('NIV Live API 設定已存到瀏覽器本機')
  }

  function resetApiBibleConfig() {
    clearApiBibleConfig()
    setApiBibleConfig(getDefaultApiBibleConfig())
    setImportMessage('NIV Live API 設定已清除')
  }

  async function resetVersion(versionId) {
    await deleteVersion(versionId)
    const fallback = builtInVersionsRef.current[versionId]

    setVersionsById((current) => ({
      ...current,
      [versionId]: {
        ...fallback,
        source: 'bundled'
      }
    }))

    setImportMessage(`${VERSION_LOOKUP[versionId].short} 已恢復為內建版本`)
  }

  function toggleVersion(versionId) {
    setSelectedVersions((current) => {
      if (current.includes(versionId)) {
        if (current.length === 1) {
          return current
        }

        return current.filter((id) => id !== versionId)
      }

      return sortVersionIds([...current, versionId])
    })
  }

  function switchActiveView(nextView) {
    setActiveView(nextView)
    setIsVersionPickerOpen(false)
  }

  function handleVerseFontSizeChange(nextValue) {
    setVerseFontSize(clampVerseFontSize(nextValue))
  }

  function toggleHeaderCollapsed() {
    const nextCollapsed = !isHeaderCollapsed
    setIsHeaderCollapsed(nextCollapsed)

    if (nextCollapsed) {
      setIsVersionPickerOpen(false)
    }
  }

  function openReaderLocation(location, options = {}) {
    const nextVerse = Number(location.verse)

    setReaderSelection({
      bookNumber: Number(location.bookNumber),
      chapter: Number(location.chapter),
      verse: Number.isFinite(nextVerse) ? nextVerse : 1
    })
    setReaderJumpTarget({
      key:
        options.focusVerse && Number.isFinite(nextVerse)
          ? `${location.bookNumber}-${location.chapter}-${nextVerse}`
          : '',
      token: Date.now()
    })
  }

  function toggleVerseSelection(key) {
    setSelectedVerseKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    )
  }

  async function copyEntries(entries, emptyMessage, successLabel) {
    if (entries.length === 0) {
      setCopyMessage(emptyMessage)
      return
    }

    try {
      await copyTextToClipboard(formatEntriesForCopy(entries))
      setCopyMessage(`${successLabel}，已複製 ${entries.length} 節`)
    } catch (error) {
      console.error(error)
      setCopyMessage('複製失敗，請稍後再試')
    }
  }

  function handleReaderBookChange(event) {
    const nextBook = readerCatalog.books.find(
      (book) => book.bookNumber === Number(event.target.value)
    )

    if (!nextBook?.chapters[0]) {
      return
    }

    openReaderLocation(
      {
        bookNumber: nextBook.bookNumber,
        chapter: nextBook.chapters[0].chapter,
        verse: nextBook.chapters[0].verses[0]?.verse ?? 1
      },
      { focusVerse: false }
    )
  }

  function handleReaderChapterChange(event) {
    const targetChapter = readerCatalog.chaptersByKey.get(
      `${readerSelection.bookNumber}-${Number(event.target.value)}`
    )

    if (!targetChapter) {
      return
    }

    openReaderLocation(
      {
        bookNumber: targetChapter.bookNumber,
        chapter: targetChapter.chapter,
        verse: targetChapter.verses[0]?.verse ?? 1
      },
      { focusVerse: false }
    )
  }

  function handleReaderVerseChange(event) {
    const nextVerse = Number(event.target.value)

    setReaderSelection((current) => ({
      ...current,
      verse: nextVerse
    }))
    setReaderJumpTarget({
      key: `${readerSelection.bookNumber}-${readerSelection.chapter}-${nextVerse}`,
      token: Date.now()
    })
  }

  function navigateChapter(targetChapter) {
    openReaderLocation(
      {
        bookNumber: targetChapter.bookNumber,
        chapter: targetChapter.chapter,
        verse: targetChapter.verses[0]?.verse ?? 1
      },
      { focusVerse: false }
    )
  }

  function jumpToReaderFromResult(result) {
    const [bookNumber, chapter, verse] = result.key.split('-').map((value) => Number(value))
    setActiveView('reader')
    openReaderLocation(
      {
        bookNumber,
        chapter,
        verse
      },
      { focusVerse: true }
    )
  }

  const noLoadedData = loadedVersionCount === 0

  return (
    <div className="soft-grid min-h-screen bg-slate-50 text-slate-800">
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-0 pb-10 pt-0 sm:px-6 sm:pt-6 lg:px-8">
        <header
          className={`glass relative sticky top-0 z-20 border border-slate-200/80 shadow-glow sm:top-3 sm:rounded-3xl ${
            isHeaderCollapsed ? 'rounded-none px-4 py-3 sm:p-3' : 'rounded-none px-4 py-5 sm:p-5'
          }`}
        >
          {!isHeaderCollapsed ? (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h1 className="truncate pr-2 text-base font-bold tracking-tight text-blue-700 sm:text-2xl">
                  10譯本關鍵字查詢
                </h1>
              </div>

              <button
                type="button"
                onClick={toggleHeaderCollapsed}
                className="shrink-0 rounded-2xl border border-slate-300 bg-white/90 px-3 py-2 text-xs font-semibold text-slate-800 transition hover:border-slate-400 sm:px-4 sm:py-2.5 sm:text-sm"
              >
                收合
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={toggleHeaderCollapsed}
              className="absolute right-4 top-3 z-10 rounded-full border border-slate-300 bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 sm:right-3 sm:top-3 sm:px-3 sm:py-1.5 sm:text-xs"
            >
              展開
            </button>
          )}

          {!isHeaderCollapsed ? (
            <>
              <p className="mt-4 max-w-3xl text-sm leading-6 text-slate-700 sm:text-base">
                以本機 JSON 為核心，保留和合本、呂振中、BBE、WEB 等常用譯本，搜尋由 Web
                Worker 負責，手機與電腦都能快速閱讀與查詢。
              </p>

              {canInstall ? (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={triggerInstall}
                    className="rounded-2xl border border-sky-400/40 bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                  >
                    安裝到手機 / 電腦
                  </button>
                </div>
              ) : null}

              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatCard
                  label="譯本"
                  value={`${loadedVersionCount} / ${catalogState.length}`}
                  hint="已載入可搜尋的本機 JSON"
                />
                <StatCard
                  label="經節"
                  value={workerStats.verseCount.toLocaleString()}
                  hint="已建立搜尋索引"
                />
                <StatCard
                  label="結果"
                  value={mergedResults.length.toLocaleString()}
                  hint={query.trim() ? '目前查詢的命中節數' : '輸入關鍵字後立即開始搜尋'}
                />
                <StatCard
                  label="速度"
                  value={searchState.elapsedMs ? `${searchState.elapsedMs} ms` : '待命中'}
                  hint={appStatus}
                />
              </div>
            </>
          ) : null}

          <div
            className={`grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-3 ${
              isHeaderCollapsed ? 'mt-0 pr-16 sm:mt-4 sm:pr-0' : 'mt-5'
            }`}
          >
            <button
              type="button"
              onClick={() => switchActiveView('reader')}
              className={`w-full min-w-0 rounded-2xl border px-2 py-2 text-center text-xs font-semibold leading-5 transition sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm ${
                activeView === 'reader'
                  ? 'border-sky-400/40 bg-sky-100 text-sky-700'
                  : 'border-slate-300 bg-white/90 text-slate-700 hover:border-slate-400'
              }`}
            >
              經文閱讀
            </button>
            <button
              type="button"
              onClick={() => switchActiveView('search')}
              className={`w-full min-w-0 rounded-2xl border px-2 py-2 text-center text-xs font-semibold leading-5 transition sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm ${
                activeView === 'search'
                  ? 'border-sky-400/40 bg-sky-100 text-sky-700'
                  : 'border-slate-300 bg-white/90 text-slate-700 hover:border-slate-400'
              }`}
            >
              關鍵字搜尋
            </button>
            <button
              type="button"
              onClick={() => setIsVersionPickerOpen((current) => !current)}
              className={`w-full min-w-0 rounded-2xl border px-2 py-2 text-center text-xs font-semibold leading-5 transition sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm ${
                isVersionPickerOpen
                  ? 'border-sky-400/40 bg-sky-100 text-sky-700'
                  : 'border-slate-300 bg-white/90 text-slate-700 hover:border-slate-400'
              }`}
            >
              譯本切換
            </button>
          </div>

          {isVersionPickerOpen ? (
            <VersionPicker
              versions={catalogState}
              selectedVersionIds={selectedVersions}
              versionsById={versionsById}
              onToggle={toggleVersion}
            />
          ) : null}
        </header>

        <main
          className={`mt-6 grid flex-1 gap-6 ${
            activeView === 'search' ? 'lg:grid-cols-[360px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1fr)]'
          }`}
        >
          {activeView === 'search' ? (
            <aside className="space-y-6">
              <section className="border border-slate-200 bg-white/90 p-5 shadow-glow sm:rounded-3xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">搜尋設定</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      輸入關鍵字後會用本機索引快速搜尋，結果依照聖經書卷順序排列。
                    </p>
                  </div>
                </div>

                <label className="mt-5 block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">關鍵字 / 片語</span>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="例如：grace、與神同行、God so loved"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-sky-400/70"
                  />
                </label>

                <div className="mt-4 flex flex-wrap gap-3">
                  <Chip active={exactPhrase} onClick={() => setExactPhrase((current) => !current)}>
                    {exactPhrase ? '片語完全比對' : '多關鍵字 AND 搜尋'}
                  </Chip>
                  <label className="flex items-center gap-2 rounded-full border border-slate-300 bg-slate-50/90 px-4 py-2 text-sm text-slate-700">
                    <span>上限</span>
                    <select
                      value={limit}
                      onChange={(event) => setLimit(Number(event.target.value))}
                      className="bg-transparent text-slate-900 outline-none"
                    >
                      {[50, 150, 300, 500].map((value) => (
                        <option key={value} value={value} className="bg-white">
                          {value}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>
            </aside>
          ) : null}

          <div className="space-y-6">
            {copyMessage ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {copyMessage}
              </div>
            ) : null}

            {activeView === 'reader' ? (
              <section
                id={READER_SECTION_ID}
                className="border border-slate-200 bg-white/90 p-5 shadow-glow sm:rounded-3xl"
              >
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">經文閱讀</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      選擇書卷與章節後可對照閱讀，勾選核取方塊可複製指定經節。
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    {currentReaderChapter
                      ? `${currentReaderChapter.bookLabel} ${currentReaderChapter.chapter} 章`
                      : '請先選擇章節'}
                  </div>
                </div>

                <div className="mt-4">
                  <VerseFontSizeControl
                    value={verseFontSize}
                    onChange={handleVerseFontSizeChange}
                  />
                </div>

                <div className="mt-5">
                  {isLoadingApp ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                      正在載入本機譯本與搜尋索引...
                    </div>
                  ) : noLoadedData ? (
                    <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 px-5 py-10 text-center">
                      <div className="text-lg font-semibold text-amber-700">目前沒有可用的本機譯本</div>
                      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-700">
                        請先確認 `public/data/bibles` 內有合法 JSON 檔，系統載入後就能開始閱讀與搜尋。
                      </p>
                    </div>
                  ) : !currentReaderChapter ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                      請先選擇書卷和章節，閱讀器就會顯示對應內容。
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-2 md:pl-6">
                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-800">書卷</span>
                          <select
                            value={readerSelection.bookNumber ?? ''}
                            onChange={handleReaderBookChange}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400/70"
                          >
                            {readerCatalog.books.map((book) => (
                              <option key={book.bookNumber} value={book.bookNumber} className="bg-white">
                                {book.bookLabel}
                              </option>
                            ))}
                          </select>
                        </label>

                        <label className="block">
                          <span className="mb-2 block text-sm font-medium text-slate-800">章</span>
                          <select
                            value={readerSelection.chapter ?? ''}
                            onChange={handleReaderChapterChange}
                            className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400/70"
                          >
                            {currentReaderBook?.chapters.map((chapter) => (
                              <option key={chapter.key} value={chapter.chapter} className="bg-white">
                                第 {chapter.chapter} 章
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      {readerUnavailableVersionIds.length > 0 ? (
                        <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-700">
                          下列譯本目前沒有本機 JSON，所以閱讀器暫時不顯示：
                          {readerUnavailableVersionIds
                            .map((id) => VERSION_LOOKUP[id]?.short ?? id)
                            .join('、')}
                        </div>
                      ) : null}

                      <ReaderActionBar
                        previousChapter={previousReaderChapter}
                        nextChapter={nextReaderChapter}
                        selectedCount={selectedReaderEntries.length}
                        onCopy={() =>
                          copyEntries(
                            selectedReaderEntries,
                            '請先勾選要複製的經節',
                            '已複製閱讀器經文'
                          )
                        }
                        onNavigate={navigateChapter}
                      />

                      <div className="-mx-5 space-y-3 sm:mx-0">
                        {readerChapterEntries.map((entry) => {
                          const isChecked = selectedVerseKeySet.has(entry.key)
                          const isFocusedVerse = entry.verse === readerSelection.verse

                          return (
                            <article
                              key={entry.key}
                              id={`reader-verse-${entry.key}`}
                              className={`overflow-hidden border px-5 py-4 sm:rounded-3xl sm:p-4 ${
                                isFocusedVerse
                                  ? 'border-sky-400/40 bg-sky-500/10'
                                  : isChecked
                                    ? 'border-amber-300/30 bg-amber-500/10'
                                    : 'border-slate-200 bg-white/95'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex min-w-10 justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-900">
                                    {entry.verse}
                                  </span>
                                  <span className="text-sm font-medium text-green-700">{entry.referenceLabel}</span>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleVerseSelection(entry.key)}
                                    className="h-5 w-5 shrink-0 rounded border-slate-300 bg-white text-sky-500 focus:ring-2 focus:ring-sky-400/60"
                                  />
                                  <CommentaryLink href={buildFhlCommentaryUrlFromKey(entry.key)} />
                                </div>

                                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                                  {entry.lines.map((line) => {
                                    const version = VERSION_LOOKUP[line.versionId] ?? {
                                      short: line.versionId.toUpperCase(),
                                      badge: 'bg-slate-100 text-slate-700 ring-slate-300'
                                    }

                                    return (
                                      <div
                                        key={`${entry.key}-${line.versionId}`}
                                        className="-mx-5 border-x-0 border-y border-slate-200 bg-slate-50 px-5 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-4"
                                      >
                                        <div className="mb-3 flex items-center gap-3">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${version.badge}`}
                                          >
                                            {version.short}
                                          </span>
                                        </div>
                                        <p className="m-0 text-slate-900" style={verseTextStyle}>
                                          {highlightText(line.text, query, exactPhrase)}
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
                              </div>
                            </article>
                          )
                        })}
                      </div>

                      <ReaderActionBar
                        previousChapter={previousReaderChapter}
                        nextChapter={nextReaderChapter}
                        selectedCount={selectedReaderEntries.length}
                        onCopy={() =>
                          copyEntries(
                            selectedReaderEntries,
                            '請先勾選要複製的經節',
                            '已複製閱讀器經文'
                          )
                        }
                        onNavigate={navigateChapter}
                      />
                    </div>
                  )}
                </div>
              </section>
            ) : null}

            {activeView === 'search' ? (
              <section className="border border-slate-200 bg-white/90 p-5 shadow-glow sm:rounded-3xl">
                <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">搜尋結果</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        結果依照聖經書卷順序排列，點選經節名稱或經文內容可直接跳到閱讀頁對應章節。
                      </p>
                    </div>
                    <div className="text-sm text-slate-600">
                      {query.trim()
                        ? `共 ${mergedResults.length.toLocaleString()} 節，顯示前 ${Math.min(mergedResults.length, limit).toLocaleString()} 節，搜尋耗時 ${searchState.elapsedMs || 0} ms`
                        : '請先輸入關鍵字開始搜尋'}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        copyEntries(
                          selectedSearchEntries,
                          '請先勾選要複製的搜尋結果',
                          '已複製搜尋結果'
                        )
                      }
                      disabled={selectedSearchEntries.length === 0}
                      className="rounded-2xl border border-red-400/40 bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      複製勾選經文{selectedSearchEntries.length > 0 ? ` (${selectedSearchEntries.length})` : ''}
                    </button>
                    <div className="text-sm text-slate-500">勾選核取方塊後，可一次複製多節經文</div>
                  </div>
                </div>

                <div className="mt-4">
                  <VerseFontSizeControl
                    value={verseFontSize}
                    onChange={handleVerseFontSizeChange}
                  />
                </div>

                <div className="mt-5">
                  {isLoadingApp ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                      正在載入本機譯本與搜尋索引...
                    </div>
                  ) : noLoadedData ? (
                    <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 px-5 py-10 text-center">
                      <div className="text-lg font-semibold text-amber-700">目前沒有可用的本機譯本</div>
                      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-700">
                        請先確認 `public/data/bibles` 內有合法 JSON 檔，系統載入後就能開始搜尋。
                      </p>
                    </div>
                  ) : !query.trim() ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                      先輸入關鍵字，例如 <span className="text-slate-900">grace</span>、
                      <span className="text-slate-900"> 與神同行 </span>或
                      <span className="text-slate-900"> God so loved </span>?
                    </div>
                  ) : searchState.requestState === 'loading' ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                      正在搜尋中...
                    </div>
                  ) : mergedResults.length === 0 ? (
                    <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                      目前找不到符合條件的經文，請試試其他關鍵字或改用片語搜尋。
                    </div>
                  ) : (
                    <div className="scrollbar-thin -mx-5 space-y-4 sm:mx-0">
                      {combinedResults.map((result) => {
                        const isChecked = selectedVerseKeySet.has(result.key)

                        return (
                          <article
                            key={result.key}
                            className={`overflow-hidden border px-5 py-5 sm:rounded-3xl sm:p-5 ${
                              isChecked
                                ? 'border-amber-300/30 bg-amber-500/10'
                                : 'border-slate-200 bg-white/95'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="flex items-start gap-3">
                                  <a
                                    href={`#${READER_SECTION_ID}`}
                                    onClick={(event) => {
                                      event.preventDefault()
                                      jumpToReaderFromResult(result)
                                    }}
                                    className="text-lg font-bold text-green-700 transition hover:text-green-800 hover:underline"
                                  >
                                    {result.referenceLabel}
                                  </a>
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleVerseSelection(result.key)}
                                    className="mt-1 h-5 w-5 rounded border-slate-300 bg-white text-sky-500 focus:ring-2 focus:ring-sky-400/60"
                                  />
                                  <CommentaryLink
                                    href={buildFhlCommentaryUrlFromKey(result.key)}
                                    className="mt-0.5"
                                  />
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                {result.lines.map((line) => {
                                  const version = VERSION_LOOKUP[line.versionId] ?? {
                                    short: line.versionId.toUpperCase(),
                                    badge: 'bg-slate-100 text-slate-700 ring-slate-300'
                                  }

                                  return (
                                    <div
                                      key={`${result.key}-${line.versionId}`}
                                      className={`-mx-5 border-x-0 border-y px-5 py-4 sm:mx-0 sm:rounded-2xl sm:border sm:p-4 ${
                                        line.matched
                                          ? 'border-sky-400/30 bg-sky-500/10'
                                          : 'border-slate-200 bg-slate-50'
                                      }`}
                                    >
                                      <div className="mb-3 flex items-center gap-3">
                                        <span
                                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${version.badge}`}
                                        >
                                          {version.short}
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => jumpToReaderFromResult(result)}
                                        className="w-full text-left"
                                      >
                                        <p
                                          className="m-0 text-slate-900 transition hover:text-sky-800"
                                          style={verseTextStyle}
                                        >
                                          {highlightText(line.text, query, exactPhrase)}
                                        </p>
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          </article>
                        )
                      })}

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() =>
                            copyEntries(
                              selectedSearchEntries,
                              '請先勾選要複製的搜尋結果',
                              '已複製搜尋結果'
                            )
                          }
                          disabled={selectedSearchEntries.length === 0}
                          className="rounded-2xl border border-red-400/40 bg-red-100 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                        >
                          複製勾選經文{selectedSearchEntries.length > 0 ? ` (${selectedSearchEntries.length})` : ''}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </section>
            ) : null}
          </div>
        </main>
      </div>
    </div>
  )
}
