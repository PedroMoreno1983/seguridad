import sys
from pathlib import Path

from comunas_config import (
    COMUNAS_DIR,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    SUPPORTED_EXCEL_EXTENSIONS,
    iter_comuna_dirs,
    iter_supported_files,
    normalize_text,
)

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _print_files(label: str, files: list[Path], root: Path):
    print(f"  {label}: {len(files)}")
    for file_path in files:
        print(f"    - {file_path.relative_to(root)}")


def main():
    print(f"Directorio base de comunas: {COMUNAS_DIR}")
    if not COMUNAS_DIR.exists():
        raise SystemExit("ERROR: no existe el directorio base de comunas.")

    canonical_names = {normalize_text(name) for name, _ in iter_comuna_dirs()}
    extra_dirs = [
        path.name
        for path in COMUNAS_DIR.iterdir()
        if path.is_dir()
        and not normalize_text(path.name).startswith("tmp")
        and normalize_text(path.name) not in canonical_names
    ]

    if extra_dirs:
        print("\nDirectorios no mapeados:")
        for name in sorted(extra_dirs, key=normalize_text):
            print(f"  - {name}")

    print("\nArchivos que serán considerados por comuna:")
    for comuna_name, comuna_dir in iter_comuna_dirs():
        print(f"\n[{comuna_name}]")
        if not comuna_dir:
            print("  ERROR: carpeta no encontrada")
            continue

        excel_files = iter_supported_files(comuna_dir, SUPPORTED_EXCEL_EXTENSIONS)
        document_files = iter_supported_files(comuna_dir, SUPPORTED_DOCUMENT_EXTENSIONS)
        _print_files("Excel", excel_files, comuna_dir)
        _print_files("PDF/Word", document_files, comuna_dir)


if __name__ == "__main__":
    main()
