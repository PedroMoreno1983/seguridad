import sys
from pathlib import Path

from comunas_config import (
    COMUNAS_DIR,
    SUPPORTED_DOCUMENT_EXTENSIONS,
    SUPPORTED_EXCEL_EXTENSIONS,
    iter_comuna_dirs,
    iter_supported_files,
)
from excel_parser import _read_relevant_excel_sheets

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")


def _count_candidate_rows(file_path: Path):
    sheets = _read_relevant_excel_sheets(str(file_path))
    return [(sheet_name, len(df.dropna(how="all"))) for sheet_name, df in sheets]


def main():
    print(f"Directorio base de comunas: {COMUNAS_DIR}")
    if not COMUNAS_DIR.exists():
        raise SystemExit("ERROR: no existe el directorio base de comunas.")

    grand_total = 0
    grand_files = 0

    for comuna_name, comuna_dir in iter_comuna_dirs():
        print(f"\n[{comuna_name}]")
        if not comuna_dir:
            print("  ERROR: carpeta no encontrada")
            continue

        comuna_total = 0
        excel_files = iter_supported_files(comuna_dir, SUPPORTED_EXCEL_EXTENSIONS)
        document_files = iter_supported_files(comuna_dir, SUPPORTED_DOCUMENT_EXTENSIONS)

        for file_path in excel_files:
            sheet_counts = _count_candidate_rows(file_path)
            file_total = sum(count for _, count in sheet_counts)
            if not file_total:
                print(f"  Excel omitido: {file_path.relative_to(comuna_dir)}")
                continue

            grand_files += 1
            comuna_total += file_total
            print(f"  Excel candidato: {file_path.relative_to(comuna_dir)}")
            for sheet_name, count in sheet_counts:
                print(f"    - hoja '{sheet_name}': {count} filas")

        print(f"  Documentos PDF/Word candidatos: {len(document_files)}")
        for file_path in document_files:
            print(f"    - {file_path.relative_to(comuna_dir)}")

        print(f"  Total filas Excel candidatas para insertar: {comuna_total}")
        grand_total += comuna_total

    print("\n=================================")
    print("PRUEBA SECA TERMINADA")
    print(f"Excel relevantes: {grand_files}")
    print(f"Filas Excel candidatas: {grand_total}")
    print("No se modificó la base de datos.")
    print("=================================")


if __name__ == "__main__":
    main()
