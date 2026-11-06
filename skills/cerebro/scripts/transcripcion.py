#!/usr/bin/env python3
"""Saca de un link de video lo que el cerebro necesita: datos, descripción, transcripción y fotogramas.

Uso:
  python transcripcion.py <url> [-o archivo.txt] [--idiomas es,en] [--bloque 60]
                                [--fotogramas N --carpeta-fotos DIR]

- YouTube: título y canal por oEmbed y transcripción con youtube-transcript-api.
- TikTok, Instagram, X, YouTube Shorts y demás: datos, descripción y hashtags con yt-dlp, más subtítulos
  (automáticos o del autor) si el video los tiene.
- --whisper [modelo]: si no hay subtítulos, baja el audio y lo transcribe con Whisper (base, small, medium…).
- --fotogramas N: baja el video y saca N imágenes repartidas (requiere ffmpeg). Sirve para leer lo que
  aparece en pantalla (texto, código, diapositivas) cuando no hay subtítulos o el video es visual.

Dependencias: pip install youtube-transcript-api yt-dlp curl_cffi truststore faster-whisper   (y ffmpeg para fotogramas)
  curl_cffi hace falta para TikTok (yt-dlp se hace pasar por un navegador).
Código de salida 2 = no hubo transcripción (igual imprime datos, descripción y fotogramas si los hay).
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
import urllib.request
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Usa los certificados del sistema (evita CERTIFICATE_VERIFY_FAILED con antivirus o proxies que
# inspeccionan HTTPS). Opcional: pip install truststore
try:
    import truststore
    truststore.inject_into_ssl()
except ImportError:
    pass


def ytdlp_cmd():
    """Comando de yt-dlp con los certificados del sistema y Node como intérprete de JavaScript
    (YouTube lo necesita). Si están el módulo yt_dlp y truststore, lo corre dentro de Python con
    truststore cargado: es lo más fiable en Windows con antivirus que inspeccionan HTTPS."""
    try:
        import yt_dlp  # noqa: F401
        import truststore  # noqa: F401
        base = [sys.executable, "-c",
                "import sys,truststore;truststore.inject_into_ssl();import yt_dlp;yt_dlp.main(sys.argv[1:])"]
    except ImportError:
        if shutil.which("yt-dlp"):
            base = ["yt-dlp"]
        else:
            try:
                import yt_dlp  # noqa: F401
                base = [sys.executable, "-m", "yt_dlp"]
            except ImportError:
                return None
        base += ["--compat-options", "no-certifi"]
    if shutil.which("node"):
        base += ["--js-runtimes", "node"]
    return base


def id_youtube(url: str):
    if not re.search(r"(youtube\.com|youtu\.be)", url):
        return None
    m = re.search(r"(?:v=|youtu\.be/|/shorts/|/embed/|/live/)([A-Za-z0-9_-]{11})", url)
    return m.group(1) if m else None


def plataforma(url: str) -> str:
    host = urllib.parse.urlparse(url).netloc.lower()
    for clave, nombre in (("youtu", "youtube"), ("tiktok", "tiktok"), ("instagram", "instagram"),
                          ("twitter", "x"), ("x.com", "x"), ("facebook", "facebook"), ("fb.watch", "facebook")):
        if clave in host:
            return nombre
    return host or "web"


def carrusel_tiktok(url: str):
    """Los carruseles de fotos de TikTok (/photo/) no los lee yt-dlp; con la ruta /video/ del mismo ID
    sí entrega título y descripción (las imágenes no). Devuelve la URL a usar, o None si no es carrusel."""
    if "tiktok" not in url:
        return None
    final = url
    if "/photo/" not in url:
        try:
            req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=20) as r:
                final = r.geturl()
        except Exception:
            return None
    return final.split("?")[0].replace("/photo/", "/video/") if "/photo/" in final else None


def mmss(seg: float) -> str:
    seg = int(seg or 0)
    h, r = divmod(seg, 3600)
    return f"{h}:{r // 60:02d}:{r % 60:02d}" if h else f"{r // 60:02d}:{r % 60:02d}"


def oembed_youtube(url: str) -> dict:
    try:
        q = urllib.parse.urlencode({"url": url, "format": "json"})
        with urllib.request.urlopen(f"https://www.youtube.com/oembed?{q}", timeout=15) as r:
            d = json.load(r)
        return {"titulo": d.get("title"), "autor": d.get("author_name"), "autor_url": d.get("author_url")}
    except Exception:
        return {}


def meta_ytdlp(url: str) -> dict:
    cmd = ytdlp_cmd()
    if not cmd:
        return {}
    try:
        r = subprocess.run(cmd + ["--dump-single-json", "--skip-download", "--no-warnings", url],
                           capture_output=True, text=True, encoding="utf-8", timeout=120)
        d = json.loads(r.stdout)
    except Exception:
        return {}
    if not isinstance(d, dict):
        return {}
    desc = (d.get("description") or "").strip()
    return {
        "id": d.get("id"),
        "url_final": d.get("webpage_url"),
        "titulo": d.get("title") or d.get("fulltitle"),
        "autor": d.get("uploader") or d.get("channel") or d.get("creator"),
        "autor_url": d.get("uploader_url") or d.get("channel_url"),
        "fecha_publicado": (lambda f: f"{f[:4]}-{f[4:6]}-{f[6:]}" if f and len(f) == 8 else None)(d.get("upload_date")),
        "duracion": mmss(d["duration"]) if d.get("duration") else None,
        "vistas": d.get("view_count"),
        "hashtags": sorted(set(re.findall(r"#(\w+)", desc)) | set(d.get("tags") or [])),
        "descripcion": desc,
    }


def agrupar(fragmentos, bloque: int) -> str:
    """fragmentos: [(inicio_seg, texto)] -> párrafos de ~bloque segundos con [mm:ss]."""
    salida, actual, inicio = [], [], None
    for t, txt in fragmentos:
        txt = re.sub(r"\s+", " ", txt).strip()
        if not txt:
            continue
        if inicio is None:
            inicio = t
        actual.append(txt)
        if t - inicio >= bloque:
            salida.append(f"[{mmss(inicio)}] {' '.join(actual)}")
            actual, inicio = [], None
    if actual:
        salida.append(f"[{mmss(inicio)}] {' '.join(actual)}")
    return "\n\n".join(salida)


def subs_api(vid: str, idiomas):
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        return None, "falta youtube-transcript-api (pip install youtube-transcript-api truststore)"
    try:
        lista = YouTubeTranscriptApi().list(vid)
        try:
            tr = lista.find_transcript(idiomas)
        except Exception:
            tr = next(iter(lista))  # cualquier idioma disponible
        frag = [(s.start, s.text) for s in tr.fetch()]
        return {"idioma": tr.language_code, "automatica": tr.is_generated, "fragmentos": frag}, None
    except Exception as e:  # sin subtítulos, video privado, bloqueo de IP…
        return None, f"{type(e).__name__}: {str(e).splitlines()[0] if str(e) else ''}"


def leer_vtt(ruta: Path):
    frag, visto, tiempo = [], set(), 0.0
    for linea in ruta.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = re.match(r"(?:(\d+):)?(\d+):(\d+)\.\d+ -->", linea)
        if m:
            h, mi, s = (int(x) if x else 0 for x in m.groups())
            tiempo = h * 3600 + mi * 60 + s
            continue
        txt = re.sub(r"<[^>]+>", "", linea).strip()
        if not txt or txt.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")) or txt in visto:
            continue
        visto.add(txt)  # los subtítulos automáticos repiten cada línea
        frag.append((tiempo, txt))
    return frag


def subs_ytdlp(url: str, idiomas):
    cmd = ytdlp_cmd()
    if not cmd:
        return None, "yt-dlp no está instalado (pip install yt-dlp)"
    langs = ",".join(f"{i}.*" for i in idiomas) + "," + ",".join(idiomas)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(cmd + ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-format", "vtt/best",
                              "--convert-subs", "vtt", "--sub-langs", langs, "--no-warnings",
                              "-o", str(Path(d) / "v"), url],
                       capture_output=True, text=True, encoding="utf-8", timeout=180)
        vtts = sorted(Path(d).glob("*.vtt"))
        if not vtts:
            return None, "el video no tiene subtítulos"
        # el primero que respete el orden de idiomas pedido
        vtts.sort(key=lambda p: next((n for n, i in enumerate(idiomas) if f".{i}" in p.name), 99))
        idioma = vtts[0].name.split(".")[-2] if vtts[0].name.count(".") >= 2 else "?"
        return {"idioma": idioma, "automatica": None, "fragmentos": leer_vtt(vtts[0])}, None


# Frases que Whisper inventa cuando solo hay música o silencio.
ALUCINACIONES = re.compile(r"amara\.org|subt[ií]tulos (realizados )?por|gracias por ver|suscr[ií]bete|^\W*(you|thank you)\W*$", re.I)


def limpiar(frag):
    return [(t, txt) for t, txt in frag if not ALUCINACIONES.search(txt.strip())]


def subs_whisper(url: str, modelo: str, idiomas):
    """Último recurso: baja solo el audio y lo transcribe con Whisper (faster-whisper).
    Usa la GPU NVIDIA si está lista; si no, la CPU."""
    cmd = ytdlp_cmd()
    if not cmd:
        return None, "yt-dlp no está instalado"
    try:
        from faster_whisper import WhisperModel
    except ImportError:
        return None, "falta faster-whisper (pip install faster-whisper)"
    with tempfile.TemporaryDirectory() as d:
        # En TikTok el formato "solo audio" suele ser la canción de fondo, no la voz del video:
        # se baja el video más liviano (trae su propio audio).
        formato = "worst[vcodec!=none][acodec!=none]/worst" if "tiktok" in url else "bestaudio/best"
        subprocess.run(cmd + ["-f", formato, "--no-warnings", "-o", str(Path(d) / "audio.%(ext)s"), url],
                       capture_output=True, text=True, encoding="utf-8", timeout=600)
        audios = list(Path(d).glob("audio.*"))
        if not audios:
            return None, "no se pudo bajar el audio"
        ultimo = None
        for dispositivo, tipo in (("cuda", "float16"), ("cpu", "int8")):
            try:
                m = WhisperModel(modelo, device=dispositivo, compute_type=tipo)
                segs, info = m.transcribe(str(audios[0]), vad_filter=True, beam_size=5)
                frag = limpiar([(sg.start, sg.text) for sg in segs])  # la transcripción ocurre al recorrer
                idioma = info.language
                if len(" ".join(t for _, t in frag).split()) < 5 and idiomas:
                    # Casi vacío: suele ser idioma mal detectado (voz sobre música). Reintento forzando
                    # el idioma preferido y sin filtro de silencios.
                    segs, info = m.transcribe(str(audios[0]), language=idiomas[0], vad_filter=False, beam_size=5)
                    frag2 = limpiar([(sg.start, sg.text) for sg in segs])
                    if len(" ".join(t for _, t in frag2).split()) > len(" ".join(t for _, t in frag).split()):
                        frag, idioma = frag2, idiomas[0]
                return {"idioma": idioma, "automatica": True, "whisper": f"{modelo}/{dispositivo}",
                        "fragmentos": frag}, None
            except Exception as e:  # sin CUDA/cuDNN -> se intenta en CPU
                ultimo = f"{type(e).__name__}: {e}"
        return None, f"whisper falló: {ultimo}"


def fotogramas(url: str, n: int, carpeta: Path):
    cmd = ytdlp_cmd()
    if not cmd:
        return [], "yt-dlp no está instalado"
    if not shutil.which("ffmpeg"):
        return [], "ffmpeg no está instalado"
    carpeta.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory() as d:
        subprocess.run(cmd + ["-f", "worst[ext=mp4]/worst", "--no-warnings", "-o", str(Path(d) / "video.%(ext)s"), url],
                       capture_output=True, text=True, encoding="utf-8", timeout=600)
        videos = list(Path(d).glob("video.*"))
        if not videos:
            return [], "no se pudo bajar el video"
        v = videos[0]
        try:
            dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(v)],
                                       capture_output=True, text=True, timeout=60).stdout.strip())
        except Exception:
            dur = 0
        rutas = []
        for k in range(n):
            t = dur * (k + 0.5) / n if dur else k * 5
            salida = carpeta / f"fotograma-{k + 1:02d}-{mmss(t).replace(':', 'm')}s.jpg"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-ss", str(t), "-i", str(v), "-frames:v", "1",
                            "-vf", "scale='min(720,iw)':-2", str(salida)], timeout=60)
            if salida.exists():
                rutas.append(str(salida))
        return rutas, None


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("url")
    p.add_argument("--idiomas", default="es,en", help="orden de preferencia (por defecto es,en)")
    p.add_argument("--bloque", type=int, default=60, help="segundos por párrafo (por defecto 60)")
    p.add_argument("-o", "--salida", help="guardar en archivo en vez de imprimir")
    p.add_argument("--whisper", nargs="?", const="small", default=None, metavar="MODELO",
                   help="si no hay subtítulos, transcribir el audio con Whisper (por defecto: small)")
    p.add_argument("--solo-whisper", action="store_true",
                   help="ignorar subtítulos y transcribir el audio original (útil si TikTok solo da una traducción, p. ej. eng-US)")
    p.add_argument("--fotogramas", type=int, default=0, help="cuántas imágenes sacar del video (0 = ninguna)")
    p.add_argument("--carpeta-fotos", help="dónde guardar los fotogramas (por defecto, una carpeta temporal)")
    a = p.parse_args()
    idiomas = [x.strip() for x in a.idiomas.split(",") if x.strip()]

    vid = id_youtube(a.url)
    url_carrusel = carrusel_tiktok(a.url)
    meta = meta_ytdlp(url_carrusel or a.url)
    if vid and not meta.get("titulo"):
        meta.update({k: v for k, v in oembed_youtube(a.url).items() if v})

    res, errores = None, []
    if a.solo_whisper:
        a.whisper = a.whisper or "small"
    elif vid:
        res, err = subs_api(vid, idiomas)
        if err:
            errores.append(f"youtube-transcript-api: {err}")
    if res is None and not a.solo_whisper:
        res, err = subs_ytdlp(a.url, idiomas)
        if err:
            errores.append(err)
    if url_carrusel:
        errores.append("es un carrusel de fotos: no hay voz y las imágenes no se pueden bajar (pide capturas)")
    if res is None and a.whisper and not url_carrusel:
        res, err = subs_whisper(a.url, a.whisper, idiomas)
        if err:
            errores.append(err)

    fotos, err_fotos = [], None
    if a.fotogramas > 0 and not url_carrusel:
        carpeta = Path(a.carpeta_fotos) if a.carpeta_fotos else Path(tempfile.mkdtemp(prefix="cerebro-fotos-"))
        fotos, err_fotos = fotogramas(a.url, a.fotogramas, carpeta)

    cab = [f"url: {a.url}", f"plataforma: {plataforma(a.url)}"]
    if url_carrusel:
        cab.append("formato: carrusel de fotos")
    if vid:
        cab.append(f"youtube_id: {vid}")
    for k in ("id", "url_final", "titulo", "autor", "autor_url", "fecha_publicado", "duracion", "vistas"):
        if meta.get(k):
            cab.append(f"{k}: {meta[k]}")
    if meta.get("hashtags"):
        cab.append("hashtags: " + ", ".join(meta["hashtags"][:30]))
    if res:
        auto = {True: " (automática)", False: " (del autor)", None: ""}[res["automatica"]]
        if res.get("whisper"):
            auto = f" (Whisper {res['whisper']})"
        cab.append(f"transcripcion: {res['idioma']}{auto}")
        if not meta.get("duracion") and res["fragmentos"]:
            cab.append(f"duracion_aprox: {mmss(res['fragmentos'][-1][0])}")
    else:
        cab.append("transcripcion: NO DISPONIBLE")
        cab += [f"motivo: {e}" for e in errores]
    if a.fotogramas > 0 and not url_carrusel:
        cab += [f"fotograma: {f}" for f in fotos] if fotos else [f"fotogramas: NO ({err_fotos})"]

    partes = ["\n".join(cab)]
    if meta.get("descripcion"):
        partes.append("## Descripción del autor\n" + meta["descripcion"])
    if res:
        partes.append("## Transcripción\n" + agrupar(res["fragmentos"], a.bloque))
    texto = "\n---\n".join(partes) + "\n"

    if a.salida:
        Path(a.salida).write_text(texto, encoding="utf-8")
        print("\n".join(cab))
        print(f"guardado en: {a.salida} ({len(texto.split())} palabras)")
    else:
        print(texto)
    sys.exit(0 if res else 2)


if __name__ == "__main__":
    main()
