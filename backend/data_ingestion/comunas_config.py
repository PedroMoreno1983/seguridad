import os
import unicodedata
from pathlib import Path


PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_DATA_ROOT = PROJECT_ROOT.parent
COMUNAS_DIR = Path(
    os.getenv("SAFECITY_COMUNAS_DIR", DEFAULT_DATA_ROOT / "Comunas")
).resolve()


COMUNA_METADATA = {
    "La Cisterna": {
        "codigo_ine": "13109",
        "region": "Región Metropolitana de Santiago",
        "codigo_region": "13",
        "provincia": "Santiago",
    },
    "La Granja": {
        "codigo_ine": "13111",
        "region": "Región Metropolitana de Santiago",
        "codigo_region": "13",
        "provincia": "Santiago",
    },
    "Maipú": {
        "codigo_ine": "13119",
        "region": "Región Metropolitana de Santiago",
        "codigo_region": "13",
        "provincia": "Santiago",
    },
    "Peñalolén": {
        "codigo_ine": "13122",
        "region": "Región Metropolitana de Santiago",
        "codigo_region": "13",
        "provincia": "Santiago",
    },
    "Pudahuel": {
        "codigo_ine": "13124",
        "region": "Región Metropolitana de Santiago",
        "codigo_region": "13",
        "provincia": "Santiago",
    },
    "San Bernardo": {
        "codigo_ine": "13401",
        "region": "Región Metropolitana de Santiago",
        "codigo_region": "13",
        "provincia": "Maipo",
    },
    "Valparaíso": {
        "codigo_ine": "05101",
        "region": "Valparaíso",
        "codigo_region": "05",
        "provincia": "Valparaíso",
    },
}

CANONICAL_COMUNAS = tuple(COMUNA_METADATA.keys())
SUPPORTED_EXCEL_EXTENSIONS = (".xlsx", ".xls")
SUPPORTED_DOCUMENT_EXTENSIONS = (".pdf", ".docx")


def normalize_text(value: str) -> str:
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return " ".join(text.lower().strip().split())


def get_comuna_metadata(comuna_name: str) -> dict:
    wanted = normalize_text(comuna_name)
    for canonical_name, metadata in COMUNA_METADATA.items():
        if normalize_text(canonical_name) == wanted:
            return metadata
    return {}


def _is_ignored_dir(path: Path) -> bool:
    name = normalize_text(path.name)
    return name.startswith("tmp") or name in {"__macosx", ".git"}


def resolve_comuna_dir(comuna_name: str) -> Path | None:
    if not COMUNAS_DIR.exists():
        return None

    exact = COMUNAS_DIR / comuna_name
    if exact.exists() and exact.is_dir():
        return exact

    wanted = normalize_text(comuna_name)
    for child in COMUNAS_DIR.iterdir():
        if child.is_dir() and not _is_ignored_dir(child) and normalize_text(child.name) == wanted:
            return child
    return None


def iter_comuna_dirs():
    for comuna_name in CANONICAL_COMUNAS:
        yield comuna_name, resolve_comuna_dir(comuna_name)


def iter_supported_files(root: Path, extensions: tuple[str, ...]):
    if not root or not root.exists():
        return []

    files = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if any(_is_ignored_dir(parent) for parent in path.parents if parent != root.parent):
            continue
        if path.suffix.lower() in extensions:
            files.append(path)
    return sorted(files, key=lambda p: normalize_text(str(p.relative_to(root))))
