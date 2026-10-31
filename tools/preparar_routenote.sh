#!/bin/zsh

set -euo pipefail

FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
SOURCE_DIR="${1:?Indicá la carpeta con los archivos WAV}"
OUTPUT_DIR="${2:-${SOURCE_DIR}/ROUTENOTE}"
COVER_FILE="${3:-}"

mkdir -p "$OUTPUT_DIR"

local_count=0
for input in "$SOURCE_DIR"/*.wav(N); do
  filename="${input:t:r}.flac"
  output="$OUTPUT_DIR/$filename"

  print -- "Preparando: $filename"
  arch -x86_64 "$FFMPEG_BIN" -hide_banner -nostdin -y -i "$input" \
    -map_metadata -1 \
    -af "aresample=44100:resampler=soxr:precision=28:osf=s16:dither_method=triangular_hp" \
    -c:a flac -compression_level 8 -sample_fmt s16 -bits_per_raw_sample 16 \
    "$output" >/dev/null 2>&1

  (( local_count += 1 ))
done

if (( local_count != 12 )); then
  print -u2 -- "Se esperaban 12 temas y se generaron ${local_count}."
  exit 1
fi

if [[ -n "$COVER_FILE" ]]; then
  cp "$COVER_FILE" "$OUTPUT_DIR/portada.jpg"
fi

print -- "Listo: $OUTPUT_DIR"
