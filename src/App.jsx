import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_SELECTED_VERSIONS,
  DEMO_SCHEMA_URL,
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
const MOBILE_HEADER_LIFT_STORAGE_KEY = 'mobile-header-lift'

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
  return fallback || BOOK_LOOKUP[Number(bookNumber)]?.chinese || `第 ${bookNumber} 卷`
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
          <span className="text-slate-600">已經是第一章</span>
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
          <span className="text-slate-600">已經是最後一章</span>
        )}
      </div>

      <button
        type="button"
        onClick={onCopy}
        disabled={selectedCount === 0}
        className="rounded-2xl border border-sky-400/40 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
      >
        複製勾選經文{selectedCount > 0 ? ` (${selectedCount})` : ''}
      </button>
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
  const headerRef = useRef(null)
  const searchWorkerRef = useRef(null)
  const builtInVersionsRef = useRef({})
  const requestIdRef = useRef(0)
  const { canInstall, triggerInstall } = useInstallPrompt()

  const [catalogState, setCatalogState] = useState(VERSION_CATALOG)
  const [versionsById, setVersionsById] = useState({})
  const [selectedVersions, setSelectedVersions] = useState(DEFAULT_SELECTED_VERSIONS)
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
  const [mobileHeaderLift, setMobileHeaderLift] = useState(() => {
    if (typeof window === 'undefined') {
      return 0
    }

    const saved = Number(window.localStorage.getItem(MOBILE_HEADER_LIFT_STORAGE_KEY) ?? '0')
    return Number.isFinite(saved) ? Math.max(0, saved) : 0
  })
  const [mobileHeaderMaxLift, setMobileHeaderMaxLift] = useState(240)

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
          `已同步 ${payload.stats.versionCount} 個譯本，共 ${payload.stats.verseCount.toLocaleString()} 節`
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
        setAppStatus('讀取譯本目錄...')
        const catalogResponse = await fetch('/data/catalog.json')
        const catalogJson = await catalogResponse.json()
        const catalogEntries = catalogJson.versions.map((entry) => ({
          ...VERSION_LOOKUP[entry.id],
          ...entry
        }))
        setCatalogState(catalogEntries)

        setAppStatus('載入內建 JSON...')
        const builtInResponses = await Promise.all(
          catalogEntries.map(async (entry) => {
            const response = await fetch(entry.file)
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

        setAppStatus('讀取本機快取...')
        const storedVersions = await getAllStoredVersions()
        const storedMap = Object.fromEntries(storedVersions.map((item) => [item.id, item]))

        setVersionsById(
          mergeVersionState(catalogEntries, builtInVersionsRef.current, storedMap)
        )
      } catch (error) {
        console.error(error)
        setAppStatus('載入失敗，請重新整理或檢查 JSON 格式')
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
          error: error.message ?? 'API.Bible 查詢失敗'
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
    function measureMobileHeaderLiftRange() {
      const headerHeight = headerRef.current?.offsetHeight ?? 0
      const nextMaxLift = Math.max(0, headerHeight - 96)
      setMobileHeaderMaxLift(nextMaxLift)
      setMobileHeaderLift((current) => Math.min(current, nextMaxLift))
    }

    measureMobileHeaderLiftRange()
    window.addEventListener('resize', measureMobileHeaderLiftRange)

    return () => window.removeEventListener('resize', measureMobileHeaderLiftRange)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(MOBILE_HEADER_LIFT_STORAGE_KEY, String(mobileHeaderLift))
  }, [mobileHeaderLift])

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
        `完成匯入 ${imported.length} 個檔案：${imported
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

    setImportMessage(`${VERSION_LOOKUP[versionId].short} 已恢復成內建版本`)
  }

  function toggleVersion(versionId) {
    setSelectedVersions((current) => {
      if (current.includes(versionId)) {
        if (current.length === 1) {
          return current
        }

        return current.filter((id) => id !== versionId)
      }

      return [...current, versionId]
    })
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
      setCopyMessage(`${successLabel}，共複製 ${entries.length} 節`)
    } catch (error) {
      console.error(error)
      setCopyMessage('複製失敗，請再試一次')
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
      <div className="mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <header
          ref={headerRef}
          style={{ '--mobile-header-lift': `${mobileHeaderLift}px` }}
          className="glass mobile-shiftable-header sticky top-3 z-20 rounded-3xl border border-slate-200/80 p-5 shadow-glow"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-3 inline-flex items-center rounded-full border border-yellow-400/25 bg-yellow-100 px-3 py-1 text-xs font-semibold tracking-[0.24em] text-yellow-700">
                JSON + React + Vite + Tailwind + PWA
              </div>
              <h1 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
                多譯本聖經關鍵字查詢
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-700 sm:text-base">
                以本機 JSON 為核心，支援 NIV、ESV、和合本、新譯本、呂振中譯本。搜尋在 Web
                Worker 裡進行，手機可安裝成 App，電腦也能像桌面程式一樣用。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {canInstall ? (
                <button
                  type="button"
                  onClick={triggerInstall}
                  className="rounded-2xl border border-sky-400/40 bg-sky-100 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                >
                  安裝到手機 / 電腦
                </button>
              ) : null}
              <a
                href={DEMO_SCHEMA_URL}
                className="rounded-2xl border border-slate-300 bg-white/90 px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-slate-400"
              >
                查看 JSON 範例
              </a>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="譯本"
              value={`${loadedVersionCount} / ${catalogState.length}`}
              hint="已載入可搜尋 JSON"
            />
            <StatCard
              label="節數"
              value={workerStats.verseCount.toLocaleString()}
              hint="目前同步到搜尋 Worker"
            />
            <StatCard
              label="搜尋"
              value={mergedResults.length.toLocaleString()}
              hint={query.trim() ? '符合條件的經文數' : '輸入關鍵字後即時查詢'}
            />
            <StatCard
              label="狀態"
              value={searchState.elapsedMs ? `${searchState.elapsedMs} ms` : '待命'}
              hint={
                liveNivState.requestState === 'loading'
                  ? '本機搜尋完成，NIV Live API 查詢中...'
                  : appStatus
              }
            />
          </div>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setActiveView('reader')}
              className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                activeView === 'reader'
                  ? 'border-sky-400/40 bg-sky-100 text-sky-700'
                  : 'border-slate-300 bg-white/90 text-slate-700 hover:border-slate-400'
              }`}
            >
              經文閱讀
            </button>
            <button
              type="button"
              onClick={() => setActiveView('search')}
              className={`rounded-2xl border px-4 py-2.5 text-sm font-semibold transition ${
                activeView === 'search'
                  ? 'border-sky-400/40 bg-sky-100 text-sky-700'
                  : 'border-slate-300 bg-white/90 text-slate-700 hover:border-slate-400'
              }`}
            >
              關鍵字搜尋
            </button>
          </div>
        </header>

        <div className="mobile-header-slider fixed right-2 top-1/2 z-30 -translate-y-1/2 lg:hidden">
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-300/80 bg-white/95 px-2 py-3 shadow-glow backdrop-blur">
            <span className="[writing-mode:vertical-rl] text-[10px] font-semibold tracking-[0.18em] text-slate-600">
              標題上移
            </span>
            <div className="text-[11px] font-semibold text-sky-700">
              {mobileHeaderLift}px
            </div>
            <input
              type="range"
              min={0}
              max={mobileHeaderMaxLift}
              step={4}
              value={mobileHeaderLift}
              onChange={(event) => setMobileHeaderLift(Number(event.target.value))}
              className="mobile-header-slider-input h-28 w-5 accent-sky-600"
              aria-label="調整標題區上移高度"
            />
            <button
              type="button"
              onClick={() => setMobileHeaderLift(0)}
              className="rounded-full border border-slate-300 bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-700"
            >
              重設
            </button>
          </div>
        </div>

        <main className="mt-6 grid flex-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          <aside className="space-y-6">
            {activeView === 'search' ? (
              <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-glow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">搜尋設定</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    關鍵字輸入後 100ms 內就會丟進 Worker 搜尋。
                  </p>
                </div>
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-medium text-slate-800">關鍵字 / 片語</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="例如：grace、恩典、信心、God so loved"
                  className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-sky-400/70"
                />
              </label>

              <div className="mt-4 flex flex-wrap gap-3">
                <Chip active={exactPhrase} onClick={() => setExactPhrase((current) => !current)}>
                  {exactPhrase ? '精準片語模式' : '多關鍵字 AND 模式'}
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
            ) : null}

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-glow">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">譯本選擇</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    搜尋命中後會平行顯示已選譯本，方便直接對照。
                  </p>
                </div>
                <div className="text-xs text-slate-500">{selectedVersions.length} 個已選</div>
              </div>

              <div className="mt-4 space-y-3">
                {catalogState.map((version) => {
                  const versionData = versionsById[version.id]
                  const isSelected = selectedVersions.includes(version.id)
                  const isLastSelected = isSelected && selectedVersions.length === 1
                  const isLoaded = (versionData?.verses?.length ?? 0) > 0
                  const usesLiveApi =
                    version.id === 'niv' &&
                    !isLoaded &&
                    Boolean(
                      apiBibleConfig.enabled &&
                        apiBibleConfig.apiKey.trim() &&
                        apiBibleConfig.bibleId.trim()
                    )

                  return (
                    <label
                      key={version.id}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isSelected
                          ? 'border-sky-400/40 bg-sky-500/10'
                          : 'border-slate-200 bg-white/95 hover:border-slate-300'
                      } ${isLastSelected ? 'cursor-default' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start gap-4">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleVersion(version.id)}
                          disabled={isLastSelected}
                          className="mt-1 h-5 w-5 rounded border-slate-300 bg-white text-sky-500 focus:ring-2 focus:ring-sky-400/60 disabled:cursor-not-allowed disabled:opacity-50"
                        />

                        <div className="flex flex-1 items-center justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span
                                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${version.badge}`}
                              >
                                {version.short}
                              </span>
                              <span className="text-sm text-slate-800">{version.name}</span>
                            </div>

                            <div className="mt-2 text-xs text-slate-600">
                              {isLoaded
                                ? `${versionData.verses.length.toLocaleString()} 節`
                                : usesLiveApi
                                  ? '改走 NIV Live API'
                                  : '尚未匯入實際經文 JSON'}
                            </div>

                            {isLastSelected ? (
                              <div className="mt-2 text-xs text-amber-700">至少保留 1 個譯本</div>
                            ) : null}
                          </div>

                          <div className="text-right">
                            <div
                              className={`text-xs font-semibold ${
                                versionData?.source === 'indexeddb'
                                  ? 'text-emerald-700'
                                  : usesLiveApi
                                    ? 'text-sky-600'
                                    : 'text-slate-600'
                              }`}
                            >
                              {versionData?.source === 'indexeddb'
                                ? '本機快取'
                                : usesLiveApi
                                  ? 'Live API'
                                  : '內建佔位'}
                            </div>
                            <div className="mt-2 text-xs text-slate-500">{version.language}</div>
                          </div>
                        </div>
                      </div>
                    </label>
                  )
                })}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-glow">
              <h2 className="text-lg font-bold text-slate-900">JSON 匯入</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                直接匯入你的 和合本 / 呂振中 / BBE / WEB / BSB / OEB / KJV / ASV / NIV / ESV / 新譯本 JSON。匯入後會存到瀏覽器本機，之後離線也能搜尋。
              </p>

              <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/90 px-4 py-6 text-center transition hover:border-sky-400/40 hover:bg-sky-500/5">
                <span className="text-sm font-semibold text-slate-900">選擇 JSON 檔案</span>
                <span className="mt-1 text-xs text-slate-500">
                  可一次選多個檔案，translation.id 需為 cuv / lzz / bbe / web / bsb / oeb / kjv / asv / niv / esv / cnv
                </span>
                <input
                  type="file"
                  accept=".json,application/json"
                  multiple
                  onChange={handleImport}
                  className="hidden"
                />
              </label>

              {importMessage ? (
                <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-sm text-slate-700">
                  {importMessage}
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {catalogState.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => resetVersion(version.id)}
                    className="rounded-full border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:border-slate-400"
                  >
                    重設 {version.short}
                  </button>
                ))}
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-glow">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">NIV Live API</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    不把 NIV 全文打包進站，改用你自己的 API.Bible 權限即時查詢。
                    金鑰只會存到目前瀏覽器，不會寫進專案檔案。
                  </p>
                </div>
                <Chip
                  active={Boolean(apiBibleConfig.enabled)}
                  onClick={() =>
                    setApiBibleConfig((current) => ({
                      ...current,
                      enabled: !current.enabled
                    }))
                  }
                >
                  {apiBibleConfig.enabled ? '已啟用' : '未啟用'}
                </Chip>
              </div>

              <div className="mt-4 space-y-3">
                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">API key</span>
                  <input
                    type="password"
                    value={apiBibleConfig.apiKey}
                    onChange={(event) =>
                      setApiBibleConfig((current) => ({
                        ...current,
                        apiKey: event.target.value
                      }))
                    }
                    placeholder="貼上你的 API.Bible api-key"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-sky-400/70"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">Bible ID</span>
                  <input
                    value={apiBibleConfig.bibleId}
                    onChange={(event) =>
                      setApiBibleConfig((current) => ({
                        ...current,
                        bibleId: event.target.value
                      }))
                    }
                    placeholder="例如你的 NIV bibleId"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-sky-400/70"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-medium text-slate-800">顯示名稱</span>
                  <input
                    value={apiBibleConfig.label}
                    onChange={(event) =>
                      setApiBibleConfig((current) => ({
                        ...current,
                        label: event.target.value
                      }))
                    }
                    placeholder="NIV Live"
                    className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-sky-400/70"
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={persistApiBibleConfig}
                  className="rounded-2xl border border-sky-400/40 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200"
                >
                  儲存本機設定
                </button>
                <button
                  type="button"
                  onClick={resetApiBibleConfig}
                  className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-slate-400"
                >
                  清除設定
                </button>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3 text-xs leading-6 text-slate-600">
                {hasLocalNiv
                  ? '目前你已經有本機 NIV JSON，Live API 會被本機資料優先取代。'
                  : '啟用後，只有在你勾選 NIV 且本機沒有 NIV JSON 時，才會改走 API.Bible。'}
              </div>

              {liveNivState.error ? (
                <div className="mt-4 rounded-2xl border border-rose-400/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-700">
                  {liveNivState.error}
                </div>
              ) : null}
            </section>
          </aside>

          <div className="space-y-6">
            {copyMessage ? (
              <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700">
                {copyMessage}
              </div>
            ) : null}

            {activeView === 'reader' ? (
              <section
                id={READER_SECTION_ID}
                className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-glow"
              >
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">經文閱讀</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    可切換書卷、章、節，並勾選要複製的經節。
                  </p>
                </div>
                <div className="text-sm text-slate-600">
                  {currentReaderChapter
                    ? `${currentReaderChapter.bookLabel} ${currentReaderChapter.chapter} 章`
                    : '尚無可閱讀章節'}
                </div>
              </div>

              <div className="mt-5">
                {isLoadingApp ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                    系統初始化中，正在整理閱讀索引...
                  </div>
                ) : noLoadedData ? (
                  <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 px-5 py-10 text-center">
                    <div className="text-lg font-semibold text-amber-700">目前沒有可閱讀的本機經文資料</div>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-700">
                      匯入合法授權的 JSON 後，就能使用章節閱讀、上一章 / 下一章與勾選複製功能。
                    </p>
                  </div>
                ) : !currentReaderChapter ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                    找不到可用章節，請先勾選至少一個有本機 JSON 的譯本。
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid gap-3 md:grid-cols-3">
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

                      <label className="block">
                        <span className="mb-2 block text-sm font-medium text-slate-800">節</span>
                        <select
                          value={readerSelection.verse ?? ''}
                          onChange={handleReaderVerseChange}
                          className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-sky-400/70"
                        >
                          {currentReaderVerseOptions.map((verse) => (
                            <option key={verse.key} value={verse.verse} className="bg-white">
                              第 {verse.verse} 節
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    {readerUnavailableVersionIds.length > 0 ? (
                      <div className="rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-700">
                        閱讀器目前只顯示本機 JSON 譯本；以下勾選的版本暫時不會出現在整章閱讀：
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
                          '請先在經文閱讀區勾選要複製的經節',
                          '本章勾選經文已複製'
                        )
                      }
                      onNavigate={navigateChapter}
                    />

                    <div className="space-y-3">
                      {readerChapterEntries.map((entry) => {
                        const isChecked = selectedVerseKeySet.has(entry.key)
                        const isFocusedVerse = entry.verse === readerSelection.verse

                        return (
                          <article
                            key={entry.key}
                            id={`reader-verse-${entry.key}`}
                            className={`rounded-3xl border p-4 ${
                              isFocusedVerse
                                ? 'border-sky-400/40 bg-sky-500/10'
                                : isChecked
                                  ? 'border-amber-300/30 bg-amber-500/10'
                                  : 'border-slate-200 bg-white/95'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => toggleVerseSelection(entry.key)}
                                className="mt-1 h-5 w-5 rounded border-slate-300 bg-white text-sky-500 focus:ring-2 focus:ring-sky-400/60"
                              />

                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-3">
                                  <span className="inline-flex min-w-10 justify-center rounded-full border border-slate-300 bg-white px-3 py-1 text-sm font-semibold text-slate-900">
                                    {entry.verse}
                                  </span>
                                  <span className="text-sm font-medium text-green-700">{entry.referenceLabel}</span>
                                </div>

                                <div className="mt-3 grid gap-3 xl:grid-cols-2">
                                  {entry.lines.map((line) => {
                                    const version = VERSION_LOOKUP[line.versionId]

                                    return (
                                      <div
                                        key={`${entry.key}-${line.versionId}`}
                                        className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
                                      >
                                        <div className="mb-3 flex items-center justify-between gap-3">
                                          <span
                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${version.badge}`}
                                          >
                                            {version.short}
                                          </span>
                                          <span className="text-xs text-slate-500">閱讀</span>
                                        </div>
                                        <p className="m-0 text-sm leading-7 text-slate-900 sm:text-[15px]">
                                          {highlightText(line.text, query, exactPhrase)}
                                        </p>
                                      </div>
                                    )
                                  })}
                                </div>
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
                          '請先在經文閱讀區勾選要複製的經節',
                          '本章勾選經文已複製'
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
              <section className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-glow">
              <div className="flex flex-col gap-3 border-b border-slate-200 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">搜尋結果</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      點經文參照可直接跳到上方閱讀器，同一節也能勾選後複製。
                    </p>
                  </div>
                  <div className="text-sm text-slate-600">
                    {query.trim()
                      ? `找到 ${mergedResults.length.toLocaleString()} 筆，顯示前 ${Math.min(mergedResults.length, limit).toLocaleString()} 筆`
                      : '輸入關鍵字開始搜尋'}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      copyEntries(
                        selectedSearchEntries,
                        '請先在搜尋結果區勾選要複製的經節',
                        '搜尋結果勾選經文已複製'
                      )
                    }
                    disabled={selectedSearchEntries.length === 0}
                    className="rounded-2xl border border-sky-400/40 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                  >
                    複製勾選結果{selectedSearchEntries.length > 0 ? ` (${selectedSearchEntries.length})` : ''}
                  </button>
                  <div className="text-sm text-slate-500">勾選後即可複製目前搜尋列表中的經節</div>
                </div>
              </div>

              <div className="mt-5">
                {shouldUseLiveNiv ? (
                  <div className="mb-4 rounded-2xl border border-sky-400/20 bg-sky-500/10 px-4 py-3 text-sm leading-6 text-sky-700">
                    目前 NIV 走 {apiBibleConfig.provider} live mode。英文關鍵字 / 經文參照最適合；
                    中文關鍵字仍主要由本機中文 JSON 搜尋。
                  </div>
                ) : null}

                {isLoadingApp ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                    系統初始化中，正在準備 JSON 與搜尋 Worker...
                  </div>
                ) : noLoadedData ? (
                  <div className="rounded-3xl border border-amber-400/20 bg-amber-400/10 px-5 py-10 text-center">
                    <div className="text-lg font-semibold text-amber-700">目前沒有實際經文資料</div>
                    <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-amber-700">
                      這個專案已經把 UI、PWA、搜尋 Worker、IndexedDB 快取都接好了；你只要匯入合法授權的 JSON，就能在手機與電腦上做超快本機搜尋。
                    </p>
                  </div>
                ) : !query.trim() ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                    先輸入關鍵字，例如 <span className="text-slate-900">grace</span>、<span className="text-slate-900">恩典</span>、<span className="text-slate-900">信心</span> 或 <span className="text-slate-900">神愛世人</span>。
                  </div>
                ) : searchState.requestState === 'loading' ||
                  liveNivState.requestState === 'loading' ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                    正在搜尋中...
                  </div>
                ) : mergedResults.length === 0 &&
                  liveNivState.requestState !== 'loading' ? (
                  <div className="rounded-3xl border border-slate-200 bg-slate-50/90 px-5 py-12 text-center text-slate-600">
                    找不到符合結果，試試不同關鍵字或切換精準片語模式。
                  </div>
                ) : (
                  <div className="scrollbar-thin space-y-4">
                    {combinedResults.map((result) => {
                      const isChecked = selectedVerseKeySet.has(result.key)

                      return (
                        <article
                          key={result.key}
                          className={`rounded-3xl border p-5 ${
                            isChecked
                              ? 'border-amber-300/30 bg-amber-500/10'
                              : 'border-slate-200 bg-white/95'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleVerseSelection(result.key)}
                              className="mt-1 h-5 w-5 rounded border-slate-300 bg-white text-sky-500 focus:ring-2 focus:ring-sky-400/60"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
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
                                  <div className="mt-1 text-xs text-sky-600">點這裡跳到經文閱讀</div>
                                  <div className="mt-1 text-sm text-slate-600">
                                    命中譯本：
                                    {result.matchedVersionIds
                                      .map((id) => VERSION_LOOKUP[id].short)
                                      .join('、')}
                                  </div>
                                </div>
                                <div className="rounded-full border border-slate-300 px-3 py-1 text-xs text-slate-600">
                                  {result.matchedVersionIds.length} 個譯本命中
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3 xl:grid-cols-2">
                                {result.lines.map((line) => {
                                  const version = VERSION_LOOKUP[line.versionId]

                                  return (
                                    <div
                                      key={`${result.key}-${line.versionId}`}
                                      className={`rounded-2xl border p-4 ${
                                        line.matched
                                          ? 'border-sky-400/30 bg-sky-500/10'
                                          : 'border-slate-200 bg-slate-50'
                                      }`}
                                    >
                                      <div className="mb-3 flex items-center justify-between gap-3">
                                        <span
                                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${version.badge}`}
                                        >
                                          {version.short}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {line.matched ? '命中' : '對照'}
                                        </span>
                                      </div>
                                      <p className="m-0 text-sm leading-7 text-slate-900 sm:text-[15px]">
                                        {highlightText(line.text, query, exactPhrase)}
                                      </p>
                                    </div>
                                  )
                                })}
                              </div>
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
                            '請先在搜尋結果區勾選要複製的經節',
                            '搜尋結果勾選經文已複製'
                          )
                        }
                        disabled={selectedSearchEntries.length === 0}
                        className="rounded-2xl border border-sky-400/40 bg-sky-100 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-200 disabled:cursor-not-allowed disabled:border-slate-300 disabled:bg-slate-50 disabled:text-slate-500"
                      >
                        複製勾選結果{selectedSearchEntries.length > 0 ? ` (${selectedSearchEntries.length})` : ''}
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
