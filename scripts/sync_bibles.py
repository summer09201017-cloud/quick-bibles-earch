#!/usr/bin/env python3
from __future__ import annotations

import io
import json
import re
import sys
import time
import unicodedata
import xml.etree.ElementTree as ET
import zipfile
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "public" / "data" / "bibles"


@dataclass(frozen=True)
class Book:
    number: int
    english: str
    chinese_full: str
    chinese_short: str
    chapters: int


BOOKS = [
    Book(1, "Genesis", "創世記", "創", 50),
    Book(2, "Exodus", "出埃及記", "出", 40),
    Book(3, "Leviticus", "利未記", "利", 27),
    Book(4, "Numbers", "民數記", "民", 36),
    Book(5, "Deuteronomy", "申命記", "申", 34),
    Book(6, "Joshua", "約書亞記", "書", 24),
    Book(7, "Judges", "士師記", "士", 21),
    Book(8, "Ruth", "路得記", "得", 4),
    Book(9, "1 Samuel", "撒母耳記上", "撒上", 31),
    Book(10, "2 Samuel", "撒母耳記下", "撒下", 24),
    Book(11, "1 Kings", "列王紀上", "王上", 22),
    Book(12, "2 Kings", "列王紀下", "王下", 25),
    Book(13, "1 Chronicles", "歷代志上", "代上", 29),
    Book(14, "2 Chronicles", "歷代志下", "代下", 36),
    Book(15, "Ezra", "以斯拉記", "拉", 10),
    Book(16, "Nehemiah", "尼希米記", "尼", 13),
    Book(17, "Esther", "以斯帖記", "斯", 10),
    Book(18, "Job", "約伯記", "伯", 42),
    Book(19, "Psalms", "詩篇", "詩", 150),
    Book(20, "Proverbs", "箴言", "箴", 31),
    Book(21, "Ecclesiastes", "傳道書", "傳", 12),
    Book(22, "Song of Solomon", "雅歌", "歌", 8),
    Book(23, "Isaiah", "以賽亞書", "賽", 66),
    Book(24, "Jeremiah", "耶利米書", "耶", 52),
    Book(25, "Lamentations", "耶利米哀歌", "哀", 5),
    Book(26, "Ezekiel", "以西結書", "結", 48),
    Book(27, "Daniel", "但以理書", "但", 12),
    Book(28, "Hosea", "何西阿書", "何", 14),
    Book(29, "Joel", "約珥書", "珥", 3),
    Book(30, "Amos", "阿摩司書", "摩", 9),
    Book(31, "Obadiah", "俄巴底亞書", "俄", 1),
    Book(32, "Jonah", "約拿書", "拿", 4),
    Book(33, "Micah", "彌迦書", "彌", 7),
    Book(34, "Nahum", "那鴻書", "鴻", 3),
    Book(35, "Habakkuk", "哈巴谷書", "哈", 3),
    Book(36, "Zephaniah", "西番雅書", "番", 3),
    Book(37, "Haggai", "哈該書", "該", 2),
    Book(38, "Zechariah", "撒迦利亞書", "亞", 14),
    Book(39, "Malachi", "瑪拉基書", "瑪", 4),
    Book(40, "Matthew", "馬太福音", "太", 28),
    Book(41, "Mark", "馬可福音", "可", 16),
    Book(42, "Luke", "路加福音", "路", 24),
    Book(43, "John", "約翰福音", "約", 21),
    Book(44, "Acts", "使徒行傳", "徒", 28),
    Book(45, "Romans", "羅馬書", "羅", 16),
    Book(46, "1 Corinthians", "哥林多前書", "林前", 16),
    Book(47, "2 Corinthians", "哥林多後書", "林後", 13),
    Book(48, "Galatians", "加拉太書", "加", 6),
    Book(49, "Ephesians", "以弗所書", "弗", 6),
    Book(50, "Philippians", "腓立比書", "腓", 4),
    Book(51, "Colossians", "歌羅西書", "西", 4),
    Book(52, "1 Thessalonians", "帖撒羅尼迦前書", "帖前", 5),
    Book(53, "2 Thessalonians", "帖撒羅尼迦後書", "帖後", 3),
    Book(54, "1 Timothy", "提摩太前書", "提前", 6),
    Book(55, "2 Timothy", "提摩太後書", "提後", 4),
    Book(56, "Titus", "提多書", "多", 3),
    Book(57, "Philemon", "腓利門書", "門", 1),
    Book(58, "Hebrews", "希伯來書", "來", 13),
    Book(59, "James", "雅各書", "雅", 5),
    Book(60, "1 Peter", "彼得前書", "彼前", 5),
    Book(61, "2 Peter", "彼得後書", "彼後", 3),
    Book(62, "1 John", "約翰壹書", "約一", 5),
    Book(63, "2 John", "約翰貳書", "約二", 1),
    Book(64, "3 John", "約翰參書", "約三", 1),
    Book(65, "Jude", "猶大書", "猶", 1),
    Book(66, "Revelation", "啟示錄", "啟", 22),
]


VPL_BOOK_CODES = [
    "GEN",
    "EXO",
    "LEV",
    "NUM",
    "DEU",
    "JOS",
    "JDG",
    "RUT",
    "1SA",
    "2SA",
    "1KI",
    "2KI",
    "1CH",
    "2CH",
    "EZR",
    "NEH",
    "EST",
    "JOB",
    "PSA",
    "PRO",
    "ECC",
    "SNG",
    "ISA",
    "JER",
    "LAM",
    "EZK",
    "DAN",
    "HOS",
    "JOL",
    "AMO",
    "OBA",
    "JON",
    "MIC",
    "NAM",
    "HAB",
    "ZEP",
    "HAG",
    "ZEC",
    "MAL",
    "MAT",
    "MRK",
    "LUK",
    "JHN",
    "ACT",
    "ROM",
    "1CO",
    "2CO",
    "GAL",
    "EPH",
    "PHP",
    "COL",
    "1TH",
    "2TH",
    "1TI",
    "2TI",
    "TIT",
    "PHM",
    "HEB",
    "JAS",
    "1PE",
    "2PE",
    "1JN",
    "2JN",
    "3JN",
    "JUD",
    "REV",
]

BOOK_BY_VPL_CODE = dict(zip(VPL_BOOK_CODES, BOOKS))


FHL_TRANSLATIONS = [
    {
        "id": "web",
        "short": "WEB",
        "name": "World English Bible",
        "language": "English",
        "fhl_version": "web",
        "source_name": "信望愛 FHL JSON API",
        "source_url": "https://bible.fhl.net/json/",
    },
    {
        "id": "kjv",
        "short": "KJV",
        "name": "King James Version",
        "language": "English",
        "fhl_version": "kjv",
        "source_name": "信望愛 FHL JSON API",
        "source_url": "https://bible.fhl.net/json/",
    },
    {
        "id": "asv",
        "short": "ASV",
        "name": "American Standard Version",
        "language": "English",
        "fhl_version": "asv",
        "source_name": "信望愛 FHL JSON API",
        "source_url": "https://bible.fhl.net/json/",
    },
    {
        "id": "bbe",
        "short": "BBE",
        "name": "Bible in Basic English",
        "language": "English",
        "fhl_version": "bbe",
        "source_name": "信望愛 FHL JSON API",
        "source_url": "https://bible.fhl.net/json/",
    },
    {
        "id": "cuv",
        "short": "和合本",
        "name": "FHL和合本",
        "language": "中文",
        "fhl_version": "unv",
        "source_name": "信望愛 FHL JSON API",
        "source_url": "https://bible.fhl.net/json/",
    },
    {
        "id": "lzz",
        "short": "呂振中",
        "name": "呂振中譯本",
        "language": "中文",
        "fhl_version": "lcc",
        "source_name": "信望愛 FHL JSON API",
        "source_url": "https://bible.fhl.net/json/",
    },
]

VPL_TRANSLATIONS = [
    {
        "id": "bsb",
        "short": "BSB",
        "name": "Berean Standard Bible",
        "language": "English",
        "download_url": "https://ebible.org/Scriptures/engbsb_vpl.zip",
        "source_name": "eBible.org Scripture archive",
        "source_url": "https://berean.bible/downloads.htm",
        "provider": "eBible.org / Berean Bible",
        "provider_version": "engbsb_vpl",
    },
    {
        "id": "oeb",
        "short": "OEB",
        "name": "Open English Bible (44 books)",
        "language": "English",
        "download_url": "https://ebible.org/Scriptures/engoebus_vpl.zip",
        "source_name": "eBible.org Scripture archive",
        "source_url": "https://ebible.org/find/show.php?id=engoebus",
        "provider": "eBible.org / Open English Bible",
        "provider_version": "engoebus_vpl",
    },
]


def normalize_for_search(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).lower()
    value = value.replace("’", "'").replace("`", "'")

    cleaned: list[str] = []
    previous_space = False

    for char in value:
        category = unicodedata.category(char)
        keep_char = category[0] in {"L", "N"} or char in {" ", ":", "'", "-"}
        if keep_char:
            cleaned.append(char)
            previous_space = char == " "
            continue

        if not previous_space:
            cleaned.append(" ")
            previous_space = True

    return re.sub(r"\s+", " ", "".join(cleaned)).strip()


def fetch_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": "bible-keyword-search-sync/1.0 (+local build)",
            "Accept": "*/*",
        },
    )

    with urlopen(request, timeout=120) as response:
        return response.read()


def fetch_json(url: str) -> Any:
    request = Request(
        url,
        headers={
            "User-Agent": "bible-keyword-search-sync/1.0 (+local build)",
            "Accept": "application/json",
        },
    )

    with urlopen(request, timeout=60) as response:
        return json.load(response)


def strip_bom(value: str) -> str:
    return value[1:] if value.startswith("\ufeff") else value


def build_fhl_book_payload(version_code: str, book: Book) -> list[dict[str, Any]]:
    params = urlencode(
        {
            "version": version_code,
            "engs": book.chinese_short,
            "qstr": f"1:1-{book.chapters}:999",
            "strong": 0,
            "gb": 0,
        }
    )
    url = f"https://bible.fhl.net/json/qsb.php?{params}"
    payload = fetch_json(url)

    if payload.get("status") != "success":
        raise RuntimeError(f"FHL API failed for {version_code} {book.chinese_full}")

    verses = []
    for verse in payload.get("record", []):
        verse_text = str(verse.get("bible_text", "")).strip()
        verses.append(
            {
                "id": f"{book.number}-{int(verse['chap'])}-{int(verse['sec'])}",
                "bookNumber": book.number,
                "book": book.chinese_full,
                "chapter": int(verse["chap"]),
                "verse": int(verse["sec"]),
                "text": verse_text,
                "normalizedText": normalize_for_search(verse_text),
            }
        )

    if not verses:
        raise RuntimeError(f"No verses returned for {version_code} {book.chinese_full}")

    return verses


def build_fhl_translation(spec: dict[str, str]) -> dict[str, Any]:
    verses: list[dict[str, Any]] = []
    started_at = time.perf_counter()

    for index, book in enumerate(BOOKS, start=1):
        print(f"[{spec['id']}] {index:02d}/66 下載 {book.chinese_full}", flush=True)
        verses.extend(build_fhl_book_payload(spec["fhl_version"], book))
        time.sleep(0.08)

    elapsed = time.perf_counter() - started_at
    print(
        f"[{spec['id']}] 完成，共 {len(verses):,} 節，耗時 {elapsed:.1f}s",
        flush=True,
    )

    return {
        "translation": {
            "id": spec["id"],
            "short": spec["short"],
            "name": spec["name"],
            "language": spec["language"],
            "sourceName": spec["source_name"],
            "sourceUrl": spec["source_url"],
            "sourceVersion": spec["fhl_version"],
            "downloadedAt": datetime.now(timezone.utc).isoformat(),
        },
        "metadata": {
            "provider": "FHL",
            "providerVersion": spec["fhl_version"],
            "verseCount": len(verses),
        },
        "verses": verses,
    }


def parse_vpl_xml_verses(xml_bytes: bytes) -> list[dict[str, Any]]:
    root = ET.fromstring(strip_bom(xml_bytes.decode("utf-8")))
    verses: list[dict[str, Any]] = []

    for node in root.findall("v"):
        code = str(node.attrib.get("b", "")).strip().upper()
        book = BOOK_BY_VPL_CODE.get(code)
        if not book:
            continue

        chapter = int(node.attrib["c"])
        verse_number = int(node.attrib["v"])
        verse_text = " ".join("".join(node.itertext()).split()).strip()
        if not verse_text:
            continue

        verses.append(
            {
                "id": f"{book.number}-{chapter}-{verse_number}",
                "bookNumber": book.number,
                "book": book.chinese_full,
                "chapter": chapter,
                "verse": verse_number,
                "text": verse_text,
                "normalizedText": normalize_for_search(verse_text),
            }
        )

    return verses


def build_vpl_translation(spec: dict[str, str]) -> dict[str, Any]:
    print(f"[{spec['id']}] 下載 {spec['download_url']}", flush=True)
    archive_bytes = fetch_bytes(spec["download_url"])

    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        xml_name = next(
            (name for name in archive.namelist() if name.endswith("_vpl.xml")),
            None,
        )
        if not xml_name:
            raise RuntimeError(f"{spec['id']} 找不到 *_vpl.xml")

        verses = parse_vpl_xml_verses(archive.read(xml_name))

    if not verses:
        raise RuntimeError(f"{spec['id']} 沒有成功解析任何經文")

    print(f"[{spec['id']}] 完成，共 {len(verses):,} 節", flush=True)

    return {
        "translation": {
            "id": spec["id"],
            "short": spec["short"],
            "name": spec["name"],
            "language": spec["language"],
            "sourceName": spec["source_name"],
            "sourceUrl": spec["source_url"],
            "sourceVersion": spec["provider_version"],
            "downloadedAt": datetime.now(timezone.utc).isoformat(),
        },
        "metadata": {
            "provider": spec["provider"],
            "providerVersion": spec["provider_version"],
            "verseCount": len(verses),
        },
        "verses": verses,
    }


def write_translation_file(translation_id: str, payload: dict[str, Any]) -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    target = OUTPUT_DIR / f"{translation_id}.json"
    target.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"已寫入 {target}", flush=True)


def main() -> int:
    print("開始同步本站使用的本機 JSON 譯本...", flush=True)

    for spec in FHL_TRANSLATIONS:
        payload = build_fhl_translation(spec)
        write_translation_file(spec["id"], payload)

    for spec in VPL_TRANSLATIONS:
        payload = build_vpl_translation(spec)
        write_translation_file(spec["id"], payload)

    print("同步完成。", flush=True)
    print("注意：NIV、ESV、新譯本、NLT、NCV / ICB、NIrV 目前沒有在這支腳本內自動下載。", flush=True)
    print("原因是來源授權條件不一致，請以你自己的合法 JSON 匯入。", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
