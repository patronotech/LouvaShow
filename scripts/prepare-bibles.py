#!/usr/bin/env python3
"""Reproduce the licensed offline Bible datasets; never called by the app/build.

Usage: python3 scripts/prepare-bibles.py --cache /temporary/bible-sources [--download]
Upstream changes require manual license/content review and a new pinned digest.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import tempfile
import urllib.request
import xml.etree.ElementTree as ET
from collections import OrderedDict
from html.parser import HTMLParser
from pathlib import Path
from zipfile import ZipFile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "src-tauri/resources/bibles"
MAX_ARCHIVE = 16 * 1024 * 1024
MAX_MEMBER = 12 * 1024 * 1024
BOOKS = dict(line.split("|", 1) for line in """GEN|Gênesis
EXO|Êxodo
LEV|Levítico
NUM|Números
DEU|Deuteronômio
JOS|Josué
JDG|Juízes
RUT|Rute
1SA|1 Samuel
2SA|2 Samuel
1KI|1 Reis
2KI|2 Reis
1CH|1 Crônicas
2CH|2 Crônicas
EZR|Esdras
NEH|Neemias
EST|Ester
JOB|Jó
PSA|Salmos
PRO|Provérbios
ECC|Eclesiastes
SNG|Cântico dos Cânticos
ISA|Isaías
JER|Jeremias
LAM|Lamentações
EZK|Ezequiel
DAN|Daniel
HOS|Oseias
JOL|Joel
AMO|Amós
OBA|Obadias
JON|Jonas
MIC|Miqueias
NAM|Naum
HAB|Habacuque
ZEP|Sofonias
HAG|Ageu
ZEC|Zacarias
MAL|Malaquias
TOB|Tobias
JDT|Judite
ESG|Ester (grego)
WIS|Sabedoria
SIR|Sirácida (Eclesiástico)
BAR|Baruc
1MA|1 Macabeus
2MA|2 Macabeus
1ES|1 Esdras
MAN|Oração de Manassés
PS2|Salmo 151
3MA|3 Macabeus
2ES|2 Esdras
4MA|4 Macabeus
DAG|Daniel (grego)
MAT|Mateus
MRK|Marcos
LUK|Lucas
JHN|João
ACT|Atos
ROM|Romanos
1CO|1 Coríntios
2CO|2 Coríntios
GAL|Gálatas
EPH|Efésios
PHP|Filipenses
COL|Colossenses
1TH|1 Tessalonicenses
2TH|2 Tessalonicenses
1TI|1 Timóteo
2TI|2 Timóteo
TIT|Tito
PHM|Filemom
HEB|Hebreus
JAS|Tiago
1PE|1 Pedro
2PE|2 Pedro
1JN|1 João
2JN|2 João
3JN|3 João
JUD|Judas
REV|Apocalipse""".splitlines())

CHANGES = (
    "Conversão técnica do VPL XML publicado pelo eBible.org para JSON por livro; "
    "nomes de livros apresentados em português. A fonte VPL já omite notas, títulos "
    "editoriais, introduções e formatação. Espaços nas extremidades dos registros foram "
    "removidos; o texto dos versículos não foi reescrito. "
    "Esta conversão não implica endosso dos titulares ao LouvaShow."
)
SOURCES = [
    {
        "id": "blivre", "upstream": "porbr2018", "name": "Bíblia Livre — edição de fevereiro de 2018",
        "abbreviation": "BLIVRE", "license": "CC BY 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by/4.0/",
        "sourceSha256": "1f71b7765795ae7cc416a9255c7d9c3a3932ce868206fa762606c7438c8fc682",
        "bookCount": 66, "verseCount": 31102, "emptyCount": 0,
        "attribution": "Bíblia Livre (BLIVRE), Copyright © 2018 Diego Santos, Mario Sérgio e Marco Teles. Edição de fevereiro de 2018. https://sites.google.com/site/biblialivre/ — CC BY 4.0: https://creativecommons.org/licenses/by/4.0/. Reprodução permitida com menção à fonte e aos autores. Trabalho em andamento. " + CHANGES,
    },
    {
        "id": "onbv", "upstream": "poronbv", "name": "Biblica® Open Nova Bíblia Viva™",
        "abbreviation": "ONBV", "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "sourceSha256": "c63a702ba4b33ea0d4ff52048b5e488bf61b0fbc115f411d3a24731615cfc8db",
        "bookCount": 66, "verseCount": 31105, "emptyCount": 0,
        "attribution": "Biblica® Open Nova Bíblia Viva™. Copyright © 2007, 2010 by Biblica, Inc. “Biblica” é uma marca registrada na Oficina de Patentes e Marcas dos Estados Unidos por Biblica, Inc. Usado com permissão. “Biblica” is a trademark registered in the United States Patent and Trademark Office by Biblica, Inc. Used with permission. The original Work by its copyright holders is available for free at www.biblica.com and open.bible. CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/. O texto e esta conversão de dados são distribuídos sob a mesma licença CC BY-SA 4.0. " + CHANGES,
    },
    {
        "id": "bpm", "upstream": "porbrbsl", "name": "Bíblia Portuguesa Mundial (rascunho)",
        "abbreviation": "BPM", "license": "Domínio público",
        "licenseUrl": "https://ebible.org/details.php?id=porbrbsl",
        "sourceSha256": "c203fcc6c198f0e8469c22838a7106ee1a5d9034f2c817229834fa35b080880a",
        "bookCount": 81, "verseCount": 38029, "emptyCount": 29,
        "attribution": "Bíblia Portuguesa Mundial (BPM), domínio público conforme declaração do eBible.org. Rascunho de tradução ainda em revisão; fonte atualizada em 2026-10-08. Inclui os 81 livros/documentos presentes no pacote, com deuterocanônicos e livros adicionais; não representa uma escolha de cânon pelo LouvaShow. 29 registros vazios da fonte foram omitidos, preservando lacunas na numeração. " + CHANGES,
    },
    {
        "id": "blt", "upstream": "porblt", "name": "Bíblia Livre Para Todos (Novo Testamento)",
        "abbreviation": "BLT", "license": "CC BY-SA 4.0",
        "licenseUrl": "https://creativecommons.org/licenses/by-sa/4.0/",
        "sourceSha256": "dc3b4ee61f2d428703a9ad88b573b7c90e68ca86985ff0938f74d2c98b9a1773",
        "bookCount": 27, "verseCount": 7942, "emptyCount": 17,
        "attribution": "Bíblia Livre Para Todos (BLT). Copyright © 2022 Free Bible Ministry, Inc. https://www.freebibleministry.org/. CC BY-SA 4.0: https://creativecommons.org/licenses/by-sa/4.0/. O pacote contém somente os 27 livros do Novo Testamento. 17 registros vazios da fonte foram omitidos, preservando lacunas na numeração. O texto e esta conversão de dados são distribuídos sob a mesma licença CC BY-SA 4.0. " + CHANGES,
    },
]


class PlainText(HTMLParser):
    """Preserve upstream legal notices as plain runtime text, without HTML."""

    def __init__(self) -> None:
        super().__init__()
        self.parts: list[str] = []

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def archive(source: dict, cache: Path, download: bool) -> Path:
    path = cache / f"{source['upstream']}_vpl.zip"
    if not path.exists():
        if not download:
            raise ValueError(f"Missing {path.name}; use --download explicitly to fetch development inputs.")
        request = urllib.request.Request(
            f"https://ebible.org/Scriptures/{path.name}", headers={"User-Agent": "Mozilla/5.0"}
        )
        with urllib.request.urlopen(request, timeout=60) as response:
            if not response.url.startswith("https://ebible.org/"):
                raise ValueError("Unexpected download host")
            data = response.read(MAX_ARCHIVE + 1)
        if len(data) > MAX_ARCHIVE:
            raise ValueError("Archive exceeds the development download limit")
        if hashlib.sha256(data).hexdigest() != source["sourceSha256"]:
            raise ValueError(f"Upstream digest changed for {path.name}; review the new edition before updating.")
        path.write_bytes(data)
    if path.stat().st_size > MAX_ARCHIVE or hashlib.sha256(path.read_bytes()).hexdigest() != source["sourceSha256"]:
        raise ValueError(f"Invalid pinned archive {path.name}")
    return path


def read_member(zipped: ZipFile, name: str) -> bytes:
    entries = [entry for entry in zipped.infolist() if entry.filename == name]
    if len(entries) != 1 or entries[0].file_size > MAX_MEMBER:
        raise ValueError(f"Unexpected archive member {name}")
    # Read the single allowlisted member in memory; never extract paths from ZIP.
    with zipped.open(entries[0]) as stream:
        data = stream.read(MAX_MEMBER + 1)
    if len(data) > MAX_MEMBER:
        raise ValueError("Expanded member exceeds the development limit")
    return data


def convert(source: dict, path: Path, output: Path) -> tuple[dict, str]:
    with ZipFile(path) as zipped:
        xml = read_member(zipped, f"{source['upstream']}_vpl.xml")
        about = read_member(zipped, f"{source['upstream']}_about.htm").decode("utf-8-sig")
    if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
        raise ValueError("DTD and entity declarations are not permitted")
    root = ET.fromstring(xml)
    if root.tag != "verseFile":
        raise ValueError("Unexpected VPL XML root")
    books: OrderedDict[str, OrderedDict[int, list[dict]]] = OrderedDict()
    previous: dict[tuple[str, int], int] = {}
    omitted = []
    for verse in root:
        if verse.tag != "v" or len(verse) or set(verse.attrib) != {"b", "c", "v"}:
            raise ValueError("Unexpected VPL verse structure")
        book_id, chapter_label, number = (verse.attrib[key] for key in ("b", "c", "v"))
        if book_id not in BOOKS or not re.fullmatch(r"[1-9][0-9]*", chapter_label):
            raise ValueError("Unknown book or invalid chapter")
        if not re.fullmatch(r"[1-9][0-9]*(?:-[1-9][0-9]*)?", number):
            raise ValueError("Unsupported verse label: preserve source labels before adding this edition")
        start, end = (int(number.split("-")[0]), int(number.split("-")[-1]))
        chapter = int(chapter_label)
        if end < start or start <= previous.get((book_id, chapter), 0):
            raise ValueError("Duplicate, unordered or overlapping verses")
        previous[(book_id, chapter)] = end
        text = (verse.text or "").strip()
        chapter_verses = books.setdefault(book_id, OrderedDict()).setdefault(chapter, [])
        if not text.strip():
            omitted.append(f"{book_id} {chapter}:{number}")
            continue
        if len(text) > 100_000 or any(ord(c) < 32 and c not in "\n\t\r" for c in text):
            raise ValueError("Unexpected whitespace/control characters in verse; review upstream")
        chapter_verses.append({"number": number, "text": text})
    verse_count = sum(len(verses) for chapters in books.values() for verses in chapters.values())
    if (len(books), verse_count, len(omitted)) != (source["bookCount"], source["verseCount"], source["emptyCount"]):
        raise ValueError("The pinned source inventory does not match the reviewed edition")
    metadata = {key: source[key] for key in ("id", "name", "abbreviation", "license", "licenseUrl", "attribution", "sourceSha256")}
    metadata.update(language="pt-BR", sourceUrl=f"https://ebible.org/details.php?id={source['upstream']}", books=[])
    for book_id, chapters in books.items():
        if list(chapters) != list(range(1, len(chapters) + 1)) or any(not verses for verses in chapters.values()):
            raise ValueError(f"Non-contiguous or empty chapters: {book_id}")
        filename = f"{source['id']}/{book_id}.json"
        book = {"id": book_id, "name": BOOKS[book_id], "chapters": [{"number": chapter, "verses": verses} for chapter, verses in chapters.items()]}
        target = output / filename
        target.parent.mkdir(parents=True, exist_ok=True)
        payload = json.dumps(book, ensure_ascii=False, indent=2) + "\n"
        if len(payload.encode()) > 5_000_000:
            raise ValueError("Book exceeds public source audit limit")
        target.write_text(payload, encoding="utf-8")
        metadata["books"].append({"id": book_id, "name": BOOKS[book_id], "chapterCount": len(chapters), "file": filename})
    parser = PlainText()
    parser.feed(about)
    upstream_notice = " ".join(" ".join(parser.parts).split())
    notice = f"{source['name']}\n{metadata['sourceUrl']}\nArchive SHA-256: {source['sourceSha256']}\n\n{source['attribution']}\n\nAvisos da fonte:\n{upstream_notice}\n"
    if omitted:
        notice += "\nRegistros vazios omitidos (nenhum texto criado): " + "; ".join(omitted) + "\n"
    print(f"{source['id']}: {len(books)} books, {verse_count} verses, {len(omitted)} empty source entries omitted")
    return metadata, notice


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--cache", type=Path, required=True)
    parser.add_argument("--download", action="store_true")
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    # Validate every input before replacing any reviewed runtime file.
    with tempfile.TemporaryDirectory(prefix="louvashow-bibles-") as temporary:
        stage = Path(temporary)
        manifest, notices = [], []
        for source in SOURCES:
            metadata, notice = convert(source, archive(source, args.cache, args.download), stage)
            manifest.append(metadata)
            notices.append(notice)
        (stage / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        (stage / "THIRD_PARTY.txt").write_text("TEXTOS BÍBLICOS — AVISOS DE TERCEIROS\n\nEstes avisos são parte dos dados redistribuídos, independentes da licença do aplicativo.\n\n" + "\n\n".join(notices), encoding="utf-8")
        for file in stage.rglob("*"):
            if file.is_file():
                target = OUTPUT / file.relative_to(stage)
                target.parent.mkdir(parents=True, exist_ok=True)
                payload = file.read_bytes()
                if not target.exists() or target.read_bytes() != payload:
                    target.write_bytes(payload)


if __name__ == "__main__":
    main()
