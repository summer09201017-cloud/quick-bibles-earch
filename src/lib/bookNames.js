export const BOOKS = [
  { number: 1, english: 'Genesis', chinese: '創世記' },
  { number: 2, english: 'Exodus', chinese: '出埃及記' },
  { number: 3, english: 'Leviticus', chinese: '利未記' },
  { number: 4, english: 'Numbers', chinese: '民數記' },
  { number: 5, english: 'Deuteronomy', chinese: '申命記' },
  { number: 6, english: 'Joshua', chinese: '約書亞記' },
  { number: 7, english: 'Judges', chinese: '士師記' },
  { number: 8, english: 'Ruth', chinese: '路得記' },
  { number: 9, english: '1 Samuel', chinese: '撒母耳記上' },
  { number: 10, english: '2 Samuel', chinese: '撒母耳記下' },
  { number: 11, english: '1 Kings', chinese: '列王紀上' },
  { number: 12, english: '2 Kings', chinese: '列王紀下' },
  { number: 13, english: '1 Chronicles', chinese: '歷代志上' },
  { number: 14, english: '2 Chronicles', chinese: '歷代志下' },
  { number: 15, english: 'Ezra', chinese: '以斯拉記' },
  { number: 16, english: 'Nehemiah', chinese: '尼希米記' },
  { number: 17, english: 'Esther', chinese: '以斯帖記' },
  { number: 18, english: 'Job', chinese: '約伯記' },
  { number: 19, english: 'Psalms', chinese: '詩篇' },
  { number: 20, english: 'Proverbs', chinese: '箴言' },
  { number: 21, english: 'Ecclesiastes', chinese: '傳道書' },
  { number: 22, english: 'Song of Solomon', chinese: '雅歌' },
  { number: 23, english: 'Isaiah', chinese: '以賽亞書' },
  { number: 24, english: 'Jeremiah', chinese: '耶利米書' },
  { number: 25, english: 'Lamentations', chinese: '耶利米哀歌' },
  { number: 26, english: 'Ezekiel', chinese: '以西結書' },
  { number: 27, english: 'Daniel', chinese: '但以理書' },
  { number: 28, english: 'Hosea', chinese: '何西阿書' },
  { number: 29, english: 'Joel', chinese: '約珥書' },
  { number: 30, english: 'Amos', chinese: '阿摩司書' },
  { number: 31, english: 'Obadiah', chinese: '俄巴底亞書' },
  { number: 32, english: 'Jonah', chinese: '約拿書' },
  { number: 33, english: 'Micah', chinese: '彌迦書' },
  { number: 34, english: 'Nahum', chinese: '那鴻書' },
  { number: 35, english: 'Habakkuk', chinese: '哈巴谷書' },
  { number: 36, english: 'Zephaniah', chinese: '西番雅書' },
  { number: 37, english: 'Haggai', chinese: '哈該書' },
  { number: 38, english: 'Zechariah', chinese: '撒迦利亞書' },
  { number: 39, english: 'Malachi', chinese: '瑪拉基書' },
  { number: 40, english: 'Matthew', chinese: '馬太福音' },
  { number: 41, english: 'Mark', chinese: '馬可福音' },
  { number: 42, english: 'Luke', chinese: '路加福音' },
  { number: 43, english: 'John', chinese: '約翰福音' },
  { number: 44, english: 'Acts', chinese: '使徒行傳' },
  { number: 45, english: 'Romans', chinese: '羅馬書' },
  { number: 46, english: '1 Corinthians', chinese: '哥林多前書' },
  { number: 47, english: '2 Corinthians', chinese: '哥林多後書' },
  { number: 48, english: 'Galatians', chinese: '加拉太書' },
  { number: 49, english: 'Ephesians', chinese: '以弗所書' },
  { number: 50, english: 'Philippians', chinese: '腓立比書' },
  { number: 51, english: 'Colossians', chinese: '歌羅西書' },
  { number: 52, english: '1 Thessalonians', chinese: '帖撒羅尼迦前書' },
  { number: 53, english: '2 Thessalonians', chinese: '帖撒羅尼迦後書' },
  { number: 54, english: '1 Timothy', chinese: '提摩太前書' },
  { number: 55, english: '2 Timothy', chinese: '提摩太後書' },
  { number: 56, english: 'Titus', chinese: '提多書' },
  { number: 57, english: 'Philemon', chinese: '腓利門書' },
  { number: 58, english: 'Hebrews', chinese: '希伯來書' },
  { number: 59, english: 'James', chinese: '雅各書' },
  { number: 60, english: '1 Peter', chinese: '彼得前書' },
  { number: 61, english: '2 Peter', chinese: '彼得後書' },
  { number: 62, english: '1 John', chinese: '約翰壹書' },
  { number: 63, english: '2 John', chinese: '約翰貳書' },
  { number: 64, english: '3 John', chinese: '約翰參書' },
  { number: 65, english: 'Jude', chinese: '猶大書' },
  { number: 66, english: 'Revelation', chinese: '啟示錄' }
]

export const BOOK_ENGLISH_BY_NUMBER = Object.fromEntries(
  BOOKS.map((book) => [book.number, book.english])
)

export const BOOK_NUMBER_BY_ENGLISH = Object.fromEntries(
  BOOKS.flatMap((book) => {
    const aliases = [book.english]

    if (book.english === 'Song of Solomon') {
      aliases.push('Song Of Solomon')
      aliases.push('Song of Songs')
    }

    return aliases.map((alias) => [alias.toLowerCase(), book.number])
  })
)

export function buildEnglishReferenceFromKey(key) {
  const [bookNumber, chapter, verse] = String(key ?? '')
    .split('-')
    .map((value) => Number(value))

  if (!bookNumber || !chapter || !verse) {
    return ''
  }

  const englishBook = BOOK_ENGLISH_BY_NUMBER[bookNumber]
  if (!englishBook) {
    return ''
  }

  return `${englishBook} ${chapter}:${verse}`
}
