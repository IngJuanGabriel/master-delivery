# Master Delivery

Laboratorio de audio de Juan Gabriel Villar / El Arte de Rocky para preparar masters con ajustes de formato, resolución, frecuencia, dithering y normalización.

## Estado

Prototipo de interfaz en React. La selección de WAV y los ajustes funcionan en el navegador; el botón de preparación todavía no está conectado al motor de conversión. Los archivos seleccionados no se suben a un servidor. No se ofrece una conversión web terminada.

El motor Python original de conversión de SongAnalyzer está en `engine/converter.py`, con presets RouteNote, streaming y archivo; permite convertir audio usando FFmpeg/FFprobe. Puede usarse independientemente de la interfaz. La conexión entre ambos sigue pendiente.

Las herramientas de `tools/` se ejecutan por separado en macOS con zsh, Python 3 y FFmpeg para x86_64 (o Rosetta). `generar_prueba_spotify.sh` usa un perfil de ejemplo de 12 pistas numeradas, con objetivos individuales de LUFS y medición en dos pasadas. `preparar_routenote.sh` convierte 12 WAV a FLAC de 16 bits / 44,1 kHz y admite una portada opcional. Son perfiles del flujo original del proyecto, no requisitos universales de las plataformas.

## Interfaz

Requiere Node.js 22.13 o superior.

```sh
npm install
npm run dev
npm run build
```

## Herramientas locales

Trabajá sobre copias de tus masters: los scripts sobrescriben los archivos de salida con el mismo nombre.

```sh
zsh tools/generar_prueba_spotify.sh /ruta/wavs /ruta/salida all
zsh tools/preparar_routenote.sh /ruta/wavs /ruta/flac /ruta/portada.jpg
```

No se incluyen canciones, portadas, datos personales, claves ni configuración del alojamiento. La interfaz pública se extrajo del proyecto El Arte de Rocky.

## Autoría

Juan Gabriel Villar · [GitHub](https://github.com/IngJuanGabriel) · [El Arte de Rocky](https://elartederocky.com.ar/).

Código publicado para consulta. No se ha elegido una licencia de redistribución.
