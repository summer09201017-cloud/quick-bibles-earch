#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


BOOKS = [
    (1, "Genesis", "創世記"),
    (2, "Exodus", "出埃及記"),
    (3, "Leviticus", "利未記"),
    (4, "Numbers", "民數記"),
    (5, "Deuteronomy", "申命記"),
    (6, "Joshua", "約書亞記"),
    (7, "Judges", "士師記"),
    (8, "Ruth", "路得記"),
    (9, "1 Samuel", "撒母耳記上"),
    (10, "2 Samuel", "撒母耳記下"),
    (11, "1 Kings", "列王紀上"),
    (12, "2 Kings", "列王紀下"),
    (13, "1 Chronicles", "歷代志上"),
    (14, "2 Chronicles", "歷代志下"),
    (15, "Ezra", "以斯拉記"),
    (16, "Nehemiah", "尼希米記"),
    (17, "Esther", "以斯帖記"),
    (18, "Job", "約伯記"),
    (19, "Psalms", "詩篇"),
    (20, "Proverbs", "箴言"),
    (21, "Ecclesiastes", "傳道書"),
    (22, "Song of Solomon", "雅歌"),
    (23, "Isaiah", "以賽亞書"),
    (24, "Jeremiah", "耶利米書"),
    (25, "Lamentations", "耶利米哀歌"),
    (26, "Ezekiel", "以西結書"),
    (27, "Daniel", "但以理書"),
    (28, "Hosea", "何西阿書"),
    (29, "Joel", "約珥書"),
    (30, "Amos", "阿摩司書"),
    (31, "Obadiah", "俄巴底亞書"),
    (32, "Jonah", "約拿書"),
    (33, "Micah", "彌迦書"),
    (34, "Nahum", "那鴻書"),
    (35, "Habakkuk", "哈巴谷書"),
    (36, "Zephaniah", "西番雅書"),
    (37, "Haggai", "哈該書"),
    (38, "Zechariah", "撒迦利亞書"),
    (39, "Malachi", "瑪拉基書"),
    (40, "Matthew", "馬太福音"),
    (41, "Mark", "馬可福音"),
    (42, "Luke", "路加福音"),
    (43, "John", "約翰福音"),
    (44, "Acts", "使徒行傳"),
    (45, "Romans", "羅馬書"),
    (46, "1 Corinthians", "哥林多前書"),
    (47, "2 Corinthians", "哥林多後書"),
    (48, "Galatians", "加拉太書"),
    (49, "Ephesians", "以弗所書"),
    (50, "Philippians", "腓立比書"),
    (51, "Colossians", "歌羅西書"),
    (52, "1 Thessalonians", "帖撒羅尼迦前書"),
    (53, "2 Thessalonians", "帖撒羅尼迦後書"),
    (54, "1 Timothy", "提摩太前書"),
    (55, "2 Timothy", "提摩太後書"),
    (56, "Titus", "提多書"),
    (57, "Philemon", "腓利門書"),
    (58, "Hebrews", "希伯來書"),
    (59, "James", "雅各書"),
    (60, "1 Peter", "彼得前書"),
    (61, "2 Peter", "彼得後書"),
    (62, "1 John", "約翰壹書"),
    (63, "2 John", "約翰貳書"),
    (64, "3 John", "約翰參書"),
    (65, "Jude", "猶大書"),
    (66, "Revelation", "啟示錄"),
]


def normalize_for_search(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).lower()
    value = value.replace("’", "'").replace("`", "'")
    cleaned = []
    previous_space = False

    for char in value:
      category = unicodedata.category(char)
      keep = category[0] in {"L", "N"} or char in {" ", ":", "'", "-"}
      if keep:
          cleaned.append(char)
          previous_space = char == " "
      elif not previous_space:
          cleaned.append(" ")
          previous_space = True

    return re.sub(r"\s+", " ", "".join(cleaned)).strip()


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Convert a folder of per-book Bible JSON files into the site's schema."
    )
    parser.add_argument("--source-dir", required=True, help="Folder containing one JSON file per Bible book.")
    parser.add_argument("--translation-id", required=True, help="Target translation id, e.g. niv / esv / cnv.")
    parser.add_argument("--short", required=True, help="Short label shown in the UI.")
    parser.add_argument("--name", required=True, help="Full translation name.")
    parser.add_argument("--language", default="English", help="Translation language label.")
    parser.add_argument("--output", required=True, help="Output JSON file path.")
    parser.add_argument("--source-name", default="", help="Human-readable source note.")
    parser.add_argument("--source-url", default="", help="Source URL note.")
    return parser.parse_args()


def load_book_json(source_dir: Path, english_name: str) -> dict:
    candidates = [
        source_dir / f"{english_name}.json",
        source_dir / f"{english_name.replace('Song of Solomon', 'Song Of Solomon')}.json",
    ]

    for candidate in candidates:
        if candidate.exists():
            return json.loads(candidate.read_text(encoding="utf-8"))

    raise FileNotFoundError(f"Missing book file for {english_name}")


def convert_book(book_number: int, english_name: str, chinese_name: str, raw_book: dict) -> list[dict]:
    chapters = raw_book.get("chapters")
    if not isinstance(chapters, list):
        raise ValueError(f"{english_name} is missing a chapters array")

    verses = []
    for chapter in chapters:
        chapter_number = int(chapter["chapter"])
        chapter_verses = chapter.get("verses")
        if not isinstance(chapter_verses, list):
            raise ValueError(f"{english_name} chapter {chapter_number} is missing verses")

        for verse in chapter_verses:
            verse_number = int(verse["verse"])
            verse_text = str(verse["text"]).strip()
            verses.append(
                {
                    "id": f"{book_number}-{chapter_number}-{verse_number}",
                    "bookNumber": book_number,
                    "book": english_name if re.search(r"[A-Za-z]", verse_text) else chinese_name,
                    "chapter": chapter_number,
                    "verse": verse_number,
                    "text": verse_text,
                    "normalizedText": normalize_for_search(verse_text),
                }
            )

    return verses


def main() -> int:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    output_path = Path(args.output).resolve()

    if not source_dir.exists():
        print(f"Source folder not found: {source_dir}", file=sys.stderr)
        return 1

    verses = []
    for book_number, english_name, chinese_name in BOOKS:
        print(f"Converting {english_name}...", flush=True)
        raw_book = load_book_json(source_dir, english_name)
        verses.extend(convert_book(book_number, english_name, chinese_name, raw_book))

    payload = {
        "translation": {
            "id": args.translation_id,
            "short": args.short,
            "name": args.name,
            "language": args.language,
        },
        "metadata": {
            "sourceName": args.source_name,
            "sourceUrl": args.source_url,
            "verseCount": len(verses),
        },
        "verses": verses,
    }

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(verses):,} verses to {output_path}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
