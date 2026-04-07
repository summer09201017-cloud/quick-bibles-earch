export const VERSION_CATALOG = [
  {
    id: 'cuv',
    short: '和合本',
    name: '中文和合本',
    language: '中文',
    badge: 'bg-orange-100 text-blue-900 ring-orange-300'
  },
  {
    id: 'cnv',
    short: '新譯本',
    name: '中文新譯本',
    language: '中文',
    badge: 'bg-amber-500/15 text-slate-900 ring-amber-400/25'
  },
  {
    id: 'lzz',
    short: '呂振中',
    name: '呂振中譯本',
    language: '中文',
    badge: 'bg-orange-100 text-blue-900 ring-orange-300'
  },
  {
    id: 'bbe',
    short: 'BBE',
    name: 'Bible in Basic English',
    language: 'English',
    badge: 'bg-yellow-100 text-blue-900 ring-yellow-300'
  },
  {
    id: 'web',
    short: 'WEB',
    name: 'World English Bible',
    language: 'English',
    badge: 'bg-yellow-100 text-blue-900 ring-yellow-300'
  },
  {
    id: 'bsb',
    short: 'BSB',
    name: 'Berean Standard Bible',
    language: 'English',
    badge: 'bg-lime-500/15 text-lime-200 ring-lime-400/25'
  },
  {
    id: 'oeb',
    short: 'OEB',
    name: 'Open English Bible (44 books)',
    language: 'English',
    badge: 'bg-orange-500/15 text-orange-200 ring-orange-400/25'
  },
  {
    id: 'kjv',
    short: 'KJV',
    name: 'King James Version',
    language: 'English',
    badge: 'bg-blue-500/15 text-blue-200 ring-blue-400/25'
  },
  {
    id: 'asv',
    short: 'ASV',
    name: 'American Standard Version',
    language: 'English',
    badge: 'bg-violet-500/15 text-violet-200 ring-violet-400/25'
  },
  {
    id: 'niv',
    short: 'NIV',
    name: 'New International Version',
    language: 'English',
    badge: 'bg-sky-500/15 text-slate-900 ring-sky-400/25'
  },
  {
    id: 'esv',
    short: 'ESV',
    name: 'English Standard Version',
    language: 'English',
    badge: 'bg-indigo-500/15 text-slate-900 ring-indigo-400/25'
  }
]

export const VERSION_LOOKUP = Object.fromEntries(
  VERSION_CATALOG.map((item) => [item.id, item])
)

export const DEFAULT_SELECTED_VERSIONS = ['cuv', 'niv', 'esv', 'lzz', 'cnv']
export const DEMO_SCHEMA_URL = '/data/schema/bible-json-example.json'
export const DB_NAME = 'bible-keyword-search'
export const DB_VERSION = 1
export const DB_STORE = 'versions'
