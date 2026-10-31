from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from dataclasses import asdict, dataclass, replace
from pathlib import Path
from typing import Callable


class ConversionError(RuntimeError):
    """El audio no pudo convertirse de forma segura."""


ProgressCallback = Callable[[float, str], None]


@dataclass(frozen=True)
class ConversionSettings:
    format: str
    bits: int
    sample_rate: int
    dither: str = "none"
    normalize: bool = False
    loudness_lufs: float = -14.0
    true_peak_dbtp: float = -1.0

    def validated(self) -> "ConversionSettings":
        output_format = self.format.lower()
        if output_format not in {"wav", "flac", "mp3"}:
            raise ConversionError("Formato de salida no compatible")
        if self.bits not in {16, 24, 32}:
            raise ConversionError("Profundidad de bits no compatible")
        if self.sample_rate not in {44100, 48000, 88200, 96000}:
            raise ConversionError("Frecuencia de muestreo no compatible")
        if self.dither not in {"none", "triangular", "triangular_hp", "rectangular"}:
            raise ConversionError("Método de dithering no compatible")
        if not -24 <= self.loudness_lufs <= -8:
            raise ConversionError("El objetivo de volumen debe estar entre -24 y -8 LUFS")
        if not -6 <= self.true_peak_dbtp <= -0.1:
            raise ConversionError("El true peak debe estar entre -6 y -0.1 dBTP")
        return replace(self, format=output_format)

    def to_dict(self) -> dict[str, object]:
        return asdict(self)


PRESETS: dict[str, ConversionSettings] = {
    "routenote": ConversionSettings("flac", 16, 44100, "triangular_hp"),
    "streaming": ConversionSettings("wav", 24, 44100),
    "archive": ConversionSettings("wav", 24, 96000),
}


def preset_settings(name: str) -> ConversionSettings:
    try:
        return PRESETS[name].validated()
    except KeyError as exc:
        raise ConversionError("Preset de conversión desconocido") from exc


def _executable(name: str) -> str:
    configured = os.environ.get(f"SONGANALYZER_{name.upper()}")
    bundled = Path(os.environ.get("SONGANALYZER_BUNDLE_BIN", "")) / name
    found = configured or (str(bundled) if bundled.is_file() else None) or shutil.which(name)
    if not found:
        raise ConversionError(f"No se encontró {name}. Ejecutá el diagnóstico de SongAnalyzer.")
    return found


def _duration(source: Path) -> float:
    command = [
        _executable("ffprobe"), "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", str(source),
    ]
    result = subprocess.run(command, capture_output=True, text=True, check=False)
    try:
        value = float(result.stdout.strip())
    except ValueError as exc:
        raise ConversionError("FFprobe no pudo leer la duración del audio") from exc
    if result.returncode or value <= 0:
        raise ConversionError(result.stderr.strip() or "El audio no tiene una duración válida")
    return value


def _codec_arguments(settings: ConversionSettings) -> list[str]:
    if settings.format == "wav":
        codec = {16: "pcm_s16le", 24: "pcm_s24le", 32: "pcm_f32le"}[settings.bits]
        return ["-c:a", codec]
    if settings.format == "flac":
        sample_format = "s16" if settings.bits == 16 else "s32"
        return ["-c:a", "flac", "-sample_fmt", sample_format, "-compression_level", "8"]
    return ["-c:a", "libmp3lame", "-b:a", "320k"]


def _audio_filter(settings: ConversionSettings) -> str:
    filters: list[str] = []
    if settings.normalize:
        filters.append(
            f"loudnorm=I={settings.loudness_lufs:g}:TP={settings.true_peak_dbtp:g}:LRA=11"
        )
    resample = f"aresample={settings.sample_rate}"
    if settings.bits < 32 and settings.dither != "none":
        resample += f":dither_method={settings.dither}"
    filters.append(resample)
    return ",".join(filters)


def safe_output_name(filename: str, extension: str) -> str:
    stem = Path(filename).stem.strip() or "audio"
    stem = re.sub(r"[^\w .()\-]+", "-", stem, flags=re.UNICODE).strip(" .-") or "audio"
    return f"{stem}.{extension}"


def convert_audio(
    source: Path,
    destination: Path,
    settings: ConversionSettings,
    *,
    progress_callback: ProgressCallback | None = None,
) -> dict[str, object]:
    settings = settings.validated()
    source = source.expanduser().resolve()
    destination = destination.expanduser().resolve()
    if not source.is_file():
        raise ConversionError("El audio de origen no existe")
    duration = _duration(source)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_name(f"{destination.stem}.partial{destination.suffix}")
    command = [
        _executable("ffmpeg"), "-hide_banner", "-nostdin", "-y", "-i", str(source),
        "-map_metadata", "-1", "-vn", "-af", _audio_filter(settings),
        "-ar", str(settings.sample_rate), *_codec_arguments(settings),
        "-progress", "pipe:1", "-nostats", str(temporary),
    ]
    if progress_callback:
        progress_callback(0.02, "Preparando conversión")
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    assert process.stdout is not None
    for line in process.stdout:
        key, _, value = line.strip().partition("=")
        if key == "out_time_us" and progress_callback:
            try:
                progress_callback(min(0.98, max(0.02, float(value) / 1_000_000 / duration)), "Convirtiendo audio")
            except ValueError:
                pass
    stderr = process.stderr.read() if process.stderr else ""
    returncode = process.wait()
    if returncode:
        temporary.unlink(missing_ok=True)
        detail = stderr.strip().splitlines()[-1] if stderr.strip() else "FFmpeg terminó con un error"
        raise ConversionError(detail)
    os.replace(temporary, destination)
    if progress_callback:
        progress_callback(1.0, "Conversión lista")
    return {
        "filename": destination.name,
        "path": str(destination),
        "size_bytes": destination.stat().st_size,
        "duration_seconds": round(duration, 3),
        "settings": settings.to_dict(),
    }


def manifest(path: Path, files: list[dict[str, object]], settings: ConversionSettings) -> None:
    path.write_text(
        json.dumps({"schema_version": 1, "settings": settings.to_dict(), "files": files}, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
