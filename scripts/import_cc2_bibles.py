#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE_DIR = Path.home() / "Desktop" / "聖經註釋CC2" / "public" / "data"
DEFAULT_OUTPUT_DIR = ROOT / "public" / "data" / "bibles"


@dataclass(frozen=True)
class TranslationSpec:
    source_id: str
    output_id: str
    short: str
    name: str
    language: str


SUPPORTED_TRANSLATIONS = {
    "CUV": TranslationSpec(
        source_id="CUV",
        output_id="cuv",
        short="CUV",
        name="Chinese Union Version",
        language="Chinese",
    ),
    "NIV": TranslationSpec(
        source_id="NIV",
        output_id="niv",
        short="NIV",
        name="New International Version",
        language="English",
    ),
    "WEB": TranslationSpec(
        source_id="WEB",
        output_id="web",
        short="WEB",
        name="World English Bible",
        language="English",
    ),
    "ESV": TranslationSpec(
        source_id="ESV",
        output_id="esv",
        short="ESV",
        name="English Standard Version",
        language="English",
    ),
}

HAN_PATTERN = re.compile(r"[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]")


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

    return re.sub(r"\s+", " ", "".join(cleaned)).strip()


def clean_text(value: str) -> str:
    text = unicodedata.normalize("NFKC", str(value or ""))
    text = re.sub(r"\s+", " ", text).strip()
    if HAN_PATTERN.search(text):
        text = re.sub(r"\s+", "", text)
    return text


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Import CC2 Bible JSON files into this site's /public/data/bibles schema."
    )
    parser.add_argument(
        "--source-dir",
        default=str(DEFAULT_SOURCE_DIR),
        help="Folder containing CC2 JSON files such as CUV.json / NIV.json / books.json.",
    )
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Destination folder for converted JSON files.",
    )
    parser.add_argument(
        "--translations",
        nargs="+",
        default=["CUV", "NIV", "WEB", "ESV"],
        help="Translation ids to import from the source folder.",
    )
    return parser.parse_args()


def load_json(path: Path) -> dict | list:
    return json.loads(path.read_text(encoding="utf-8"))


def load_books(source_dir: Path) -> list[dict]:
    books_path = source_dir / "books.json"
    books = load_json(books_path)
    if not isinstance(books, list) or len(books) != 66:
        raise ValueError(f"Invalid books.json at {books_path}")
    return books


def convert_translation(source_dir: Path, output_dir: Path, books: list[dict], spec: TranslationSpec) -> Path:
    source_path = source_dir / f"{spec.source_id}.json"
    payload = load_json(source_path)
    if not isinstance(payload, dict):
        raise ValueError(f"Invalid JSON object in {source_path}")

    source_books = payload.get("books")
    if not isinstance(source_books, list):
        raise ValueError(f"Missing books array in {source_path}")

    source_books_by_id = {str(book.get("id")): book for book in source_books}
    verses: list[dict] = []

    for book_number, book_meta in enumerate(books, start=1):
        book_id = str(book_meta["id"])
        english_name = str(book_meta["en"])
        chinese_name = str(book_meta["zh"])
        source_book = source_books_by_id.get(book_id)
        if source_book is None:
            raise ValueError(f"{spec.source_id} is missing book {book_id}")

        chapters = source_book.get("chapters")
        if not isinstance(chapters, list):
            raise ValueError(f"{spec.source_id} book {book_id} is missing chapters")

        for chapter_number, chapter in enumerate(chapters, start=1):
            if not isinstance(chapter, list):
                raise ValueError(
                    f"{spec.source_id} book {book_id} chapter {chapter_number} is not a verse list"
                )

            for verse_number, raw_text in enumerate(chapter, start=1):
                verse_text = clean_text(str(raw_text))
                verses.append(
                    {
                        "id": f"{book_number}-{chapter_number}-{verse_number}",
                        "bookNumber": book_number,
                        "book": english_name if spec.language == "English" else chinese_name,
                        "chapter": chapter_number,
                        "verse": verse_number,
                        "text": verse_text,
                        "normalizedText": normalize_for_search(verse_text),
                    }
                )

    output_payload = {
        "translation": {
            "id": spec.output_id,
            "short": spec.short,
            "name": spec.name,
            "language": spec.language,
        },
        "metadata": {
            "sourceName": "CC2 JSON export",
            "sourceVersion": spec.source_id,
            "sourceFile": source_path.name,
            "verseCount": len(verses),
        },
        "verses": verses,
    }

    output_path = output_dir / f"{spec.output_id}.json"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(
        json.dumps(output_payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    return output_path


def main() -> int:
    args = parse_args()
    source_dir = Path(args.source_dir).resolve()
    output_dir = Path(args.output_dir).resolve()

    if not source_dir.exists():
        raise FileNotFoundError(f"Source directory not found: {source_dir}")

    books = load_books(source_dir)

    requested = [translation.upper() for translation in args.translations]
    for translation in requested:
        if translation not in SUPPORTED_TRANSLATIONS:
            raise ValueError(
                f"Unsupported translation: {translation}. "
                f"Supported: {', '.join(sorted(SUPPORTED_TRANSLATIONS))}"
            )

    for translation in requested:
        spec = SUPPORTED_TRANSLATIONS[translation]
        output_path = convert_translation(source_dir, output_dir, books, spec)
        print(f"Imported {translation} -> {output_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
