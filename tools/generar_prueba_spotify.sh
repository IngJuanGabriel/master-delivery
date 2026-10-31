#!/bin/zsh

set -euo pipefail

FFMPEG_BIN="${FFMPEG_BIN:-ffmpeg}"
SOURCE_DIR="${1:?Indicá la carpeta con los archivos WAV}"
OUTPUT_DIR="${2:-${SOURCE_DIR}/PRUEBA}"
TRACK_FILTER="${3:-all}"

mkdir -p "$OUTPUT_DIR"

REPORT="$OUTPUT_DIR/mediciones-prueba.tsv"
if [[ "$TRACK_FILTER" == "all" || ! -f "$REPORT" ]]; then
  print -r -- $'Tema\tObjetivo_LUFS\tLUFS_original\tLRA_original\tTP_original_dBTP\tLUFS_prueba\tLRA_prueba\tTP_prueba_dBTP' > "$REPORT"
fi

json_value() {
  python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))[sys.argv[2]])' "$1" "$2"
}

measure() {
  local input="$1"
  local target="$2"
  local json_out="$3"
  local log_out="${json_out}.log"

  arch -x86_64 "$FFMPEG_BIN" -hide_banner -nostats -i "$input" \
    -af "loudnorm=I=${target}:LRA=11:TP=-1.2:print_format=json" \
    -f null - 2> "$log_out"
  sed -n '/^{/,/^}/p' "$log_out" > "$json_out"
}

process_track() {
  local track_number="$1"
  local target="$2"
  local -a matches
  local filename input output
  local sample_rate
  local before_json after_json

  if [[ "$TRACK_FILTER" != "all" && ",${TRACK_FILTER}," != *",${track_number},"* ]]; then
    return 0
  fi

  matches=("$SOURCE_DIR"/${track_number}\ -\ *.wav(N))
  if (( ${#matches} != 1 )); then
    print -u2 -- "Se esperaba un WAV para el tema ${track_number}; encontrados: ${#matches}"
    return 1
  fi

  input="${matches[1]}"
  filename="${input:t}"
  output="$OUTPUT_DIR/$filename"

  sample_rate="$(afinfo "$input" | sed -n 's/.*ch, *\([0-9][0-9]*\) Hz,.*/\1/p' | head -1)"
  before_json="$(mktemp /private/tmp/rocky-before.XXXXXX.json)"
  after_json="$(mktemp /private/tmp/rocky-after.XXXXXX.json)"

  print -- "Midiendo: $filename"
  measure "$input" "$target" "$before_json"

  local input_i input_lra input_tp input_thresh target_offset
  input_i="$(json_value "$before_json" input_i)"
  input_lra="$(json_value "$before_json" input_lra)"
  input_tp="$(json_value "$before_json" input_tp)"
  input_thresh="$(json_value "$before_json" input_thresh)"
  target_offset="$(json_value "$before_json" target_offset)"

  print -- "Generando prueba: $filename → ${target} LUFS"
  arch -x86_64 "$FFMPEG_BIN" -hide_banner -nostdin -y -i "$input" \
    -af "loudnorm=I=${target}:LRA=11:TP=-1.2:measured_I=${input_i}:measured_LRA=${input_lra}:measured_TP=${input_tp}:measured_thresh=${input_thresh}:offset=${target_offset}:linear=true:print_format=summary" \
    -ar "$sample_rate" -c:a pcm_s24le "$output" >/dev/null 2>&1

  measure "$output" "$target" "$after_json"

  local output_i output_lra output_tp
  output_i="$(json_value "$after_json" input_i)"
  output_lra="$(json_value "$after_json" input_lra)"
  output_tp="$(json_value "$after_json" input_tp)"

  if [[ "$TRACK_FILTER" != "all" ]]; then
    local clean_report="$(mktemp /private/tmp/rocky-report.XXXXXX.tsv)"
    awk -F '\t' -v prefix="${track_number} - " 'NR == 1 || index($1, prefix) != 1' "$REPORT" > "$clean_report"
    cp "$clean_report" "$REPORT"
    rm -f "$clean_report"
  fi

  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
    "${filename%.wav}" "$target" "$input_i" "$input_lra" "$input_tp" \
    "$output_i" "$output_lra" "$output_tp" >> "$REPORT"

  rm -f "$before_json" "${before_json}.log" "$after_json" "${after_json}.log"
}

process_track "01" -14.00
process_track "02" -12.75
process_track "03" -13.25
process_track "04" -13.00
process_track "05" -15.00
process_track "06" -15.50
process_track "07" -15.00
process_track "08" -13.00
process_track "09" -15.50
process_track "10" -12.00
process_track "11" -14.00
process_track "12" -15.50

sorted_report="$(mktemp /private/tmp/rocky-report-sorted.XXXXXX.tsv)"
{
  head -n 1 "$REPORT"
  tail -n +2 "$REPORT" | sort -t $'\t' -k1,1n
} > "$sorted_report"
cp "$sorted_report" "$REPORT"
rm -f "$sorted_report"

print -- "Listo: $OUTPUT_DIR"
print -- "Informe: $REPORT"
