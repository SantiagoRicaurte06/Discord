#!/usr/bin/env python3
"""Procesa una lista de links de video con transcripcion.py y deja el lote listo para resumir.

Uso:
  python lote.py <links.txt> <carpeta-del-lote> [--fotos DIR] [--fotogramas 4] [--whisper small]
  python lote.py <links.txt> <carpeta-del-lote> --solo-enlaces     # rehace enlaces.md sin bajar nada

- <links.txt>: un link por línea, en orden (los duplicados se mantienen).
- Escribe transcripciones/NN-titulo-corto.txt, estado.json (para retomar si se corta) y enlaces.md.
- Si un video falla, lo anota con el motivo y sigue.
"""
import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")  # títulos con emojis en la consola de Windows

AQUI = Path(__file__).resolve().parent
TRANSCRIPCION = AQUI / "transcripcion.py"


def slug(t: str) -> str:
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode()
    return "-".join(re.findall(r"[a-z0-9]+", t.lower())[:6]) or "video"


def plataforma(url: str) -> str:
    for clave, nombre in (("tiktok", "TikTok"), ("youtu", "YouTube"), ("instagram", "Instagram"),
                          ("x.com", "X"), ("twitter", "X"), ("facebook", "Facebook")):
        if clave in url:
            return nombre
    return "Web"


def escribir_enlaces(links, estado, destino: Path):
    vistos = {}
    filas = ["# Enlaces del lote", "", "| # | Enlace | Plataforma | Estado |", "|---|--------|------------|--------|"]
    for n, url in enumerate(links, 1):
        nn = f"{n:02d}"
        e = estado.get(nn, {})
        st = e.get("estado", "pendiente")
        clave = e.get("id") or url
        if clave in vistos:
            st = f"duplicado de {vistos[clave]}"
        else:
            vistos[clave] = nn
            if e.get("motivo") and st != "procesado":
                st += f" ({e['motivo']})"
        titulo = f" · {e['titulo']}" if e.get("titulo") else ""
        filas.append(f"| {nn} | {url}{titulo.replace('|', '/')} | {plataforma(url)} | {st} |")
    ok = sum(1 for e in estado.values() if e.get("estado") == "procesado")
    sin = sum(1 for e in estado.values() if e.get("estado") == "sin transcripción")
    err = sum(1 for e in estado.values() if e.get("estado") == "error")
    filas += ["", f"Total: {len(links)} · procesados {ok} · sin transcripción {sin} · error {err}"]
    (destino / "enlaces.md").write_text("\n".join(filas) + "\n", encoding="utf-8")


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("links")
    p.add_argument("destino")
    p.add_argument("--fotos", help="carpeta para los fotogramas (por defecto, temporal)")
    p.add_argument("--fotogramas", type=int, default=4)
    p.add_argument("--whisper", default="small", help="modelo de Whisper si no hay subtítulos ('no' para no usarlo)")
    p.add_argument("--solo-enlaces", action="store_true")
    a = p.parse_args()

    destino = Path(a.destino)
    (destino / "transcripciones").mkdir(parents=True, exist_ok=True)
    fotos = Path(a.fotos) if a.fotos else Path(tempfile.mkdtemp(prefix="cerebro-lote-"))
    links = [l.strip() for l in Path(a.links).read_text(encoding="utf-8").split() if l.strip().startswith("http")]
    estado_p = destino / "estado.json"
    estado = json.loads(estado_p.read_text(encoding="utf-8")) if estado_p.exists() else {}
    escribir_enlaces(links, estado, destino)
    if a.solo_enlaces:
        return

    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    for n, url in enumerate(links, 1):
        nn = f"{n:02d}"
        if estado.get(nn, {}).get("estado") in ("procesado", "sin transcripción"):
            continue
        tmp = destino / "transcripciones" / f"{nn}.tmp"
        cmd = [sys.executable, str(TRANSCRIPCION), url, "-o", str(tmp)]
        if a.whisper != "no":
            cmd += ["--whisper", a.whisper]
        if a.fotogramas:
            cmd += ["--fotogramas", str(a.fotogramas), "--carpeta-fotos", str(fotos / nn)]
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", env=env, timeout=1800)
            salida, codigo, stderr = r.stdout, r.returncode, r.stderr
        except subprocess.TimeoutExpired:
            salida, codigo, stderr = "", 1, "se pasó del tiempo (30 min)"
        cab = dict(re.findall(r"^(\w+): (.*)$", salida, re.M))
        e = {"url": url, "id": cab.get("id"), "titulo": cab.get("titulo"), "autor": cab.get("autor"),
             "duracion": cab.get("duracion"), "transcripcion": cab.get("transcripcion"),
             "fotogramas": re.findall(r"^fotograma: (.*)$", salida, re.M)}
        if tmp.exists():
            final = tmp.with_name(f"{nn}-{slug(cab.get('titulo'))}.txt")
            tmp.replace(final)
            e["archivo"] = final.name
        e["estado"] = {0: "procesado", 2: "sin transcripción"}.get(codigo, "error")
        if codigo == 2:
            e["motivo"] = "; ".join(re.findall(r"^motivo: (.*)$", salida, re.M))
        elif codigo != 0:
            lineas = (stderr or salida).strip().splitlines()
            e["motivo"] = lineas[-1][:300] if lineas else "error desconocido"
        estado[nn] = e
        estado_p.write_text(json.dumps(estado, ensure_ascii=False, indent=1), encoding="utf-8")
        escribir_enlaces(links, estado, destino)
        print(nn, e["estado"], e.get("titulo") or "", flush=True)
    print(f"FIN · enlaces: {destino / 'enlaces.md'}")


if __name__ == "__main__":
    main()
