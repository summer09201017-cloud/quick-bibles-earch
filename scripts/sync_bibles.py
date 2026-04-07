#!/usr/bin/env python3
from __future__ import annotations

import argparse
import html
import io
import json
import re
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
DEFAULT_OUTPUT_DIR = ROOT / "public" / "data" / "bibles"
FHL_API_BASE = "https://bible.fhl.net/json"


@dataclass(frozen=True)
class Book:
    number: int
    english: str
    chapters: int
    vpl_code: str
    fhl_engs: str


@dataclass(frozen=True)
class TranslationSpec:
    id: str
    short: str
    name: str
    language: str
    source_name: str
    source_url: str
    provider: str
    provider_version: str
    kind: str
    remote_id: str


BOOKS = [
    Book(1, "Genesis", 50, "GEN", "Gen"),
    Book(2, "Exodus", 40, "EXO", "Exo"),
    Book(3, "Leviticus", 27, "LEV", "Lev"),
    Book(4, "Numbers", 36, "NUM", "Num"),
    Book(5, "Deuteronomy", 34, "DEU", "Deu"),
    Book(6, "Joshua", 24, "JOS", "Josh"),
    Book(7, "Judges", 21, "JDG", "Judg"),
    Book(8, "Ruth", 4, "RUT", "Ruth"),
    Book(9, "1 Samuel", 31, "1SA", "1 Sam"),
    Book(10, "2 Samuel", 24, "2SA", "2 Sam"),
    Book(11, "1 Kings", 22, "1KI", "1 Kin"),
    Book(12, "2 Kings", 25, "2KI", "2 Kin"),
    Book(13, "1 Chronicles", 29, "1CH", "1 Chr"),
    Book(14, "2 Chronicles", 36, "2CH", "2 Chr"),
    Book(15, "Ezra", 10, "EZR", "Ezra"),
    Book(16, "Nehemiah", 13, "NEH", "Neh"),
    Book(17, "Esther", 10, "EST", "Est"),
    Book(18, "Job", 42, "JOB", "Job"),
    Book(19, "Psalms", 150, "PSA", "Ps"),
    Book(20, "Proverbs", 31, "PRO", "Prov"),
    Book(21, "Ecclesiastes", 12, "ECC", "Eccl"),
    Book(22, "Song of Solomon", 8, "SNG", "Song"),
    Book(23, "Isaiah", 66, "ISA", "Isa"),
    Book(24, "Jeremiah", 52, "JER", "Jer"),
    Book(25, "Lamentations", 5, "LAM", "Lam"),
    Book(26, "Ezekiel", 48, "EZK", "Ezek"),
    Book(27, "Daniel", 12, "DAN", "Dan"),
    Book(28, "Hosea", 14, "HOS", "Hos"),
    Book(29, "Joel", 3, "JOL", "Joel"),
    Book(30, "Amos", 9, "AMO", "Amos"),
    Book(31, "Obadiah", 1, "OBA", "Obad"),
    Book(32, "Jonah", 4, "JON", "Jon"),
    Book(33, "Micah", 7, "MIC", "Mic"),
    Book(34, "Nahum", 3, "NAM", "Nah"),
    Book(35, "Habakkuk", 3, "HAB", "Hab"),
    Book(36, "Zephaniah", 3, "ZEP", "Zeph"),
    Book(37, "Haggai", 2, "HAG", "Hag"),
    Book(38, "Zechariah", 14, "ZEC", "Zech"),
    Book(39, "Malachi", 4, "MAL", "Mal"),
    Book(40, "Matthew", 28, "MAT", "Matt"),
    Book(41, "Mark", 16, "MRK", "Mark"),
    Book(42, "Luke", 24, "LUK", "Luke"),
    Book(43, "John", 21, "JHN", "John"),
    Book(44, "Acts", 28, "ACT", "Acts"),
    Book(45, "Romans", 16, "ROM", "Rom"),
    Book(46, "1 Corinthians", 16, "1CO", "1 Cor"),
    Book(47, "2 Corinthians", 13, "2CO", "2 Cor"),
    Book(48, "Galatians", 6, "GAL", "Gal"),
    Book(49, "Ephesians", 6, "EPH", "Eph"),
    Book(50, "Philippians", 4, "PHP", "Phil"),
    Book(51, "Colossians", 4, "COL", "Col"),
    Book(52, "1 Thessalonians", 5, "1TH", "1 Thess"),
    Book(53, "2 Thessalonians", 3, "2TH", "2 Thess"),
    Book(54, "1 Timothy", 6, "1TI", "1 Tim"),
    Book(55, "2 Timothy", 4, "2TI", "2 Tim"),
    Book(56, "Titus", 3, "TIT", "Titus"),
    Book(57, "Philemon", 1, "PHM", "Philem"),
    Book(58, "Hebrews", 13, "HEB", "Heb"),
    Book(59, "James", 5, "JAS", "James"),
    Book(60, "1 Peter", 5, "1PE", "1 Pet"),
    Book(61, "2 Peter", 3, "2PE", "2 Pet"),
    Book(62, "1 John", 5, "1JN", "1 John"),
    Book(63, "2 John", 1, "2JN", "2 John"),
    Book(64, "3 John", 1, "3JN", "3 John"),
    Book(65, "Jude", 1, "JUD", "Jude"),
    Book(66, "Revelation", 22, "REV", "Rev"),
]

BOOK_BY_NUMBER = {book.number: book for book in BOOKS}
BOOK_BY_VPL_CODE = {book.vpl_code: book for book in BOOKS}

FHL_TRANSLATIONS = [
    TranslationSpec(
        id="cuv",
        short="CUV",
        name="Chinese Union Version",
        language="Chinese",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="unv",
        kind="fhl",
        remote_id="unv",
    ),
    TranslationSpec(
        id="cnv",
        short="CNV",
        name="Chinese New Version",
        language="Chinese",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="ncv",
        kind="fhl",
        remote_id="ncv",
    ),
    TranslationSpec(
        id="lzz",
        short="LZZ",
        name="Lu Chen Chung Version",
        language="Chinese",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="lcc",
        kind="fhl",
        remote_id="lcc",
    ),
    TranslationSpec(
        id="bbe",
        short="BBE",
        name="Bible in Basic English",
        language="English",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="bbe",
        kind="fhl",
        remote_id="bbe",
    ),
    TranslationSpec(
        id="web",
        short="WEB",
        name="World English Bible",
        language="English",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="web",
        kind="fhl",
        remote_id="web",
    ),
    TranslationSpec(
        id="kjv",
        short="KJV",
        name="King James Version",
        language="English",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="kjv",
        kind="fhl",
        remote_id="kjv",
    ),
    TranslationSpec(
        id="asv",
        short="ASV",
        name="American Standard Version",
        language="English",
        source_name="FHL JSON API",
        source_url="https://bible.fhl.net/json/",
        provider="FHL",
        provider_version="asv",
        kind="fhl",
        remote_id="asv",
    ),
]

VPL_TRANSLATIONS = [
    TranslationSpec(
        id="bsb",
        short="BSB",
        name="Berean Standard Bible",
        language="English",
        source_name="eBible.org Scripture archive",
        source_url="https://berean.bible/downloads.htm",
        provider="eBible.org / Berean Bible",
        provider_version="engbsb_vpl",
        kind="vpl",
        remote_id="https://ebible.org/Scriptures/engbsb_vpl.zip",
    ),
    TranslationSpec(
        id="oeb",
        short="OEB",
        name="Open English Bible",
        language="English",
        source_name="eBible.org Scripture archive",
        source_url="https://ebible.org/find/show.php?id=engoebus",
        provider="eBible.org / Open English Bible",
        provider_version="engoebus_vpl",
        kind="vpl",
        remote_id="https://ebible.org/Scriptures/engoebus_vpl.zip",
    ),
]

ALL_TRANSLATIONS = [*FHL_TRANSLATIONS, *VPL_TRANSLATIONS]
TRANSLATION_BY_ID = {spec.id: spec for spec in ALL_TRANSLATIONS}

HAN_PATTERN = r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]"


def normalize_for_search(value: str) -> str:
    value = unicodedata.normalize("NFKC", str(value or "")).lower()
    value = value.replace("\u2018", "'").replace("\u2019", "'").replace("`", "'")

    cleaned: list[str] = []
    previous_space = False

    for char in value:
        category = unicodedata.category(char)
        keep_char = category[:1] in {"L", "N"} or char in {" ", ":", "'", "-"}
        if keep_char:
            cleaned.append(char)
            previous_space = char == " "
            continue

        if not previous_space:
            cleaned.append(" ")
            previous_space = True

    normalized = re.sub(r"\s+", " ", "".join(cleaned)).strip()
    normalized = re.sub(rf"({HAN_PATTERN})\s+(?={HAN_PATTERN})", r"\1", normalized)
    normalized = re.sub(rf"({HAN_PATTERN})\s+(?=[A-Za-z0-9])", r"\1", normalized)
    normalized = re.sub(rf"([A-Za-z0-9])\s+(?={HAN_PATTERN})", r"\1", normalized)
    return normalized


def strip_markup(value: str) -> str:
    text = html.unescape(str(value or ""))
    text = re.sub(r"<br\s*/?>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    return re.sub(r"\s+", " ", text).strip()


def decode_response_body(data: bytes, content_type: str | None) -> str:
    candidates: list[str] = []
    charset_match = re.search(r"charset=([a-z0-9_-]+)", content_type or "", flags=re.IGNORECASE)
    if charset_match:
        candidates.append(charset_match.group(1))

    candidates.extend(["utf-8-sig", "utf-8", "cp950", "big5", "latin-1"])

    tried: set[str] = set()
    for encoding in candidates:
        normalized = encoding.lower()
        if normalized in tried:
            continue
        tried.add(normalized)

        try:
            return data.decode(encoding)
        except UnicodeDecodeError:
            continue

    raise UnicodeDecodeError("utf-8", data, 0, len(data), "Unable to decode response body")


def fetch_bytes(url: str) -> bytes:
    request = Request(
        url,
        headers={
            "User-Agent": "bible-keyword-search-sync/2.0",
            "Accept": "*/*",
        },
    )
    with urlopen(request, timeout=120) as response:
        return response.read()


def fetch_json(url: str) -> Any:
    request = Request(
        url,
        headers={
            "User-Agent": "bible-keyword-search-sync/2.0",
            "Accept": "application/json,text/plain,*/*",
        },
    )
    with urlopen(request, timeout=120) as response:
        raw_body = response.read()
        text = decode_response_body(raw_body, response.headers.get("Content-Type"))
        return json.loads(text)


def build_translation_payload(spec: TranslationSpec, verses: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "translation": {
            "id": spec.id,
            "short": spec.short,
            "name": spec.name,
            "language": spec.language,
            "sourceName": spec.source_name,
            "sourceUrl": spec.source_url,
            "sourceVersion": spec.provider_version,
            "downloadedAt": datetime.now(timezone.utc).isoformat(),
        },
        "metadata": {
            "provider": spec.provider,
            "providerVersion": spec.provider_version,
            "verseCount": len(verses),
        },
        "verses": verses,
    }


def build_fhl_chapter_payload(spec: TranslationSpec, book: Book, chapter_number: int) -> list[dict[str, Any]]:
    payload_errors: list[str] = []
    records: list[dict[str, Any]] = []

    qb_params = urlencode(
        {
            "version": spec.remote_id,
            "bid": book.number,
            "chap": chapter_number,
            "sec": "1-999",
            "strong": 0,
            "gb": 0,
        }
    )
    qb_url = f"https://bible.fhl.net/api/qb.php?{qb_params}"

    try:
        payload = fetch_json(qb_url)
        qb_records = payload.get("record", [])
        if payload.get("status") == "success" and isinstance(qb_records, list) and qb_records:
            records = qb_records
    except Exception as error:
        payload_errors.append(f"api/qb.php failed: {error}")

    if not records:
        qsb_params = urlencode(
            {
                "version": spec.remote_id,
                "engs": book.fhl_engs,
                "qstr": f"{chapter_number}:1-{chapter_number}:999",
                "strong": 0,
                "gb": 0,
            }
        )
        qsb_url = f"{FHL_API_BASE}/qsb.php?{qsb_params}"

        try:
            payload = fetch_json(qsb_url)
            qsb_records = payload.get("record", [])
            if payload.get("status") == "success" and isinstance(qsb_records, list) and qsb_records:
                records = qsb_records
            else:
                payload_errors.append(f"json/qsb.php returned no records for {book.fhl_engs} {chapter_number}")
        except Exception as error:
            payload_errors.append(f"json/qsb.php failed: {error}")

    if not records:
        joined_errors = "; ".join(payload_errors) if payload_errors else "no response details"
        raise RuntimeError(
            f"FHL returned no verses for {spec.id} {book.english} {chapter_number}. {joined_errors}"
        )

    verses: list[dict[str, Any]] = []
    for record in records:
        verse_number = int(record["sec"])
        if spec.language == "Chinese":
            book_label = str(record.get("chineses") or book.english)
        else:
            book_label = book.english

        verse_text = strip_markup(record.get("bible_text", ""))
        verses.append(
            {
                "id": f"{book.number}-{chapter_number}-{verse_number}",
                "bookNumber": book.number,
                "book": book_label,
                "chapter": chapter_number,
                "verse": verse_number,
                "text": verse_text,
                "normalizedText": normalize_for_search(verse_text),
            }
        )

    return verses


def build_fhl_translation(spec: TranslationSpec, delay_seconds: float) -> dict[str, Any]:
    verses: list[dict[str, Any]] = []
    started_at = time.perf_counter()

    for book in BOOKS:
        print(f"[{spec.id}] {book.english}", flush=True)
        for chapter_number in range(1, book.chapters + 1):
            verses.extend(build_fhl_chapter_payload(spec, book, chapter_number))
            if delay_seconds > 0:
                time.sleep(delay_seconds)

    elapsed = time.perf_counter() - started_at
    print(f"[{spec.id}] synced {len(verses):,} verses in {elapsed:.1f}s", flush=True)
    return build_translation_payload(spec, verses)


def parse_vpl_xml_verses(xml_bytes: bytes) -> list[dict[str, Any]]:
    text = decode_response_body(xml_bytes, "application/xml")
    root = ET.fromstring(text)
    verses: list[dict[str, Any]] = []

    for node in root.findall("v"):
        book = BOOK_BY_VPL_CODE.get(str(node.attrib.get("b", "")).strip().upper())
        if not book:
            continue

        chapter_number = int(node.attrib["c"])
        verse_number = int(node.attrib["v"])
        verse_text = strip_markup("".join(node.itertext()))
        if not verse_text:
            continue

        verses.append(
            {
                "id": f"{book.number}-{chapter_number}-{verse_number}",
                "bookNumber": book.number,
                "book": book.english,
                "chapter": chapter_number,
                "verse": verse_number,
                "text": verse_text,
                "normalizedText": normalize_for_search(verse_text),
            }
        )

    return verses


def build_vpl_translation(spec: TranslationSpec) -> dict[str, Any]:
    print(f"[{spec.id}] downloading {spec.remote_id}", flush=True)
    archive_bytes = fetch_bytes(spec.remote_id)

    with zipfile.ZipFile(io.BytesIO(archive_bytes)) as archive:
        xml_name = next((name for name in archive.namelist() if name.endswith("_vpl.xml")), None)
        if not xml_name:
            raise RuntimeError(f"{spec.id}: zip archive does not contain a *_vpl.xml file")
        verses = parse_vpl_xml_verses(archive.read(xml_name))

    if not verses:
        raise RuntimeError(f"{spec.id}: archive did not yield any verses")

    print(f"[{spec.id}] synced {len(verses):,} verses", flush=True)
    return build_translation_payload(spec, verses)


def write_translation_file(output_dir: Path, spec: TranslationSpec, payload: dict[str, Any]) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    target = output_dir / f"{spec.id}.json"
    target.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"[{spec.id}] wrote {target}", flush=True)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Download Bible JSON files from FHL and VPL sources into public/data/bibles."
    )
    parser.add_argument(
        "--only",
        nargs="*",
        default=[],
        metavar="ID",
        help="Translation ids to sync, e.g. --only cuv cnv lzz web bsb",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Output folder for generated JSON files.",
    )
    parser.add_argument(
        "--fhl-delay",
        type=float,
        default=0.03,
        help="Delay in seconds between FHL chapter requests.",
    )
    return parser.parse_args()


def resolve_translation_specs(requested_ids: list[str]) -> list[TranslationSpec]:
    if not requested_ids:
        return ALL_TRANSLATIONS

    resolved: list[TranslationSpec] = []
    seen: set[str] = set()
    for raw_id in requested_ids:
        translation_id = raw_id.strip().lower()
        if not translation_id or translation_id in seen:
            continue
        spec = TRANSLATION_BY_ID.get(translation_id)
        if not spec:
            valid = ", ".join(sorted(TRANSLATION_BY_ID))
            raise SystemExit(f"Unknown translation id: {raw_id}. Valid ids: {valid}")
        seen.add(translation_id)
        resolved.append(spec)

    return resolved


def main() -> int:
    args = parse_args()
    output_dir = Path(args.output_dir).resolve()
    selected_specs = resolve_translation_specs(args.only)

    print(f"Output directory: {output_dir}", flush=True)
    print("Translations:", ", ".join(spec.id for spec in selected_specs), flush=True)

    for spec in selected_specs:
        if spec.kind == "fhl":
            payload = build_fhl_translation(spec, delay_seconds=max(args.fhl_delay, 0.0))
        elif spec.kind == "vpl":
            payload = build_vpl_translation(spec)
        else:
            raise RuntimeError(f"Unsupported translation kind: {spec.kind}")

        write_translation_file(output_dir, spec, payload)

    print("Bible sync finished.", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
