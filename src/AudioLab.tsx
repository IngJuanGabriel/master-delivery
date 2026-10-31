import { DragEvent, useMemo, useRef, useState } from "react";

type AudioFile = { id: string; name: string; size: number };
type PresetId = "routenote" | "spotify" | "archive" | "custom";

const presets = {
  routenote: { name: "RouteNote", detail: "Distribución digital", format: "FLAC", bits: "16 bit", rate: "44.1 kHz", dither: "Triangular HP" },
  spotify: { name: "Streaming", detail: "Spotify · Apple · Tidal", format: "WAV", bits: "24 bit", rate: "44.1 kHz", dither: "Sin dithering" },
  archive: { name: "Archivo master", detail: "Máxima fidelidad", format: "WAV", bits: "24 bit", rate: "96 kHz", dither: "Sin dithering" },
  custom: { name: "Personalizado", detail: "Configuración manual", format: "FLAC", bits: "24 bit", rate: "48 kHz", dither: "Triangular" },
} as const;

const formatSize = (bytes: number) => bytes > 1024 ** 3 ? `${(bytes / 1024 ** 3).toFixed(2)} GB` : `${(bytes / 1024 ** 2).toFixed(1)} MB`;

export default function AudioLabPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<AudioFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [presetId, setPresetId] = useState<PresetId>("routenote");
  const [showDestinations, setShowDestinations] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [format, setFormat] = useState("FLAC");
  const [bits, setBits] = useState("24 bit");
  const [rate, setRate] = useState("48 kHz");
  const [dither, setDither] = useState("Triangular");
  const [normalize, setNormalize] = useState(false);
  const [truePeak, setTruePeak] = useState("-1.0 dBTP");

  const selected = presetId === "custom" ? { ...presets.custom, format, bits, rate, dither } : presets[presetId];
  const totalSize = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);

  const addFiles = (incoming: FileList | null) => {
    if (!incoming) return;
    const wavs = Array.from(incoming).filter((file) => file.name.toLowerCase().endsWith(".wav"))
      .map((file) => ({ id: `${file.name}-${file.lastModified}-${file.size}`, name: file.name, size: file.size }));
    setFiles((current) => [...current, ...wavs.filter((file) => !current.some((item) => item.id === file.id))]);
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); addFiles(event.dataTransfer.files); };
  const selectPreset = (id: PresetId) => { setPresetId(id); setShowDestinations(false); setAdvanced(id === "custom"); };

  return (
    <main className="audio-lab">
      <header className="audio-header">
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- avoids a vinext client-runtime incompatibility */}
        <a className="audio-brand" href="https://elartederocky.com.ar/" aria-label="Visitar El Arte de Rocky"><span className="audio-brand-mark">R</span><span><strong>El Arte de Rocky</strong><small>Laboratorio de audio</small></span></a>
        <div className="audio-header-right"><span className="local-badge"><i /> Procesamiento local</span><button className="help-button" type="button" title="Ayuda">?</button></div>
      </header>

      <section className="audio-workspace">
        <div className="audio-intro">
          <p className="audio-eyebrow">MASTER DELIVERY · 01</p><h1>Tu master,<br /><em>listo para salir.</em></h1>
          <p>Arrastrá tus WAV. Elegí el destino. Nosotros cuidamos cada bit del camino.</p>
          <ol className="audio-steps"><li className="active"><b>01</b><span>Cargá<br />tus masters</span></li><li><b>02</b><span>Elegí<br />el destino</span></li><li><b>03</b><span>Prepará<br />la entrega</span></li></ol>
        </div>

        <div className="drop-column">
          <div className={`audio-dropzone ${dragging ? "is-dragging" : ""} ${files.length ? "compact" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }} onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} role="button" tabIndex={0}
            onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}>
            <input ref={inputRef} type="file" accept=".wav,audio/wav" multiple hidden onChange={(event) => addFiles(event.target.files)} />
            <div className="drop-icon"><span>＋</span></div><h2>{files.length ? "Sumar más masters" : "Soltá tus masters acá"}</h2>
            <p>{files.length ? "WAV · podés agregar varios" : <>WAV · uno o varios archivos<br />o <u>elegí desde tu equipo</u></>}</p>
            {!files.length && <span className="drop-privacy">Tus archivos no salen de este equipo</span>}
          </div>
          {files.length > 0 && <section className="file-queue" aria-label="Archivos cargados">
            <div className="queue-head"><span>{files.length} {files.length === 1 ? "master" : "masters"}</span><span>{formatSize(totalSize)}</span></div>
            {files.map((file, index) => <div className="queue-file" key={file.id}><span className="file-number">{String(index + 1).padStart(2, "0")}</span><span className="file-wave">▮▯▮▮▯▮▯▮▮▯▮▮</span><span className="file-name"><strong>{file.name.replace(/\.wav$/i, "")}</strong><small>WAV · {formatSize(file.size)}</small></span><button type="button" aria-label={`Quitar ${file.name}`} onClick={(event) => { event.stopPropagation(); setFiles((items) => items.filter((item) => item.id !== file.id)); }}>×</button></div>)}
          </section>}
        </div>

        <aside className="preset-card">
          <p className="audio-eyebrow">DESTINO · 02</p>
          <div className="preset-heading"><span className="service-icon">{presetId === "routenote" ? "R" : presetId === "spotify" ? "S" : "⌁"}</span><div><small>Preset seleccionado</small><h2>{selected.name}</h2></div><span className="check-mark">✓</span></div>
          <dl className="preset-specs"><div><dt>Formato</dt><dd>{selected.format}</dd></div><div><dt>Resolución</dt><dd>{selected.bits}</dd></div><div><dt>Frecuencia</dt><dd>{selected.rate}</dd></div><div><dt>Dithering</dt><dd>{selected.dither}</dd></div>{normalize && <><div><dt>Normalización</dt><dd>-14 LUFS-I</dd></div><div><dt>True peak</dt><dd>{truePeak}</dd></div></>}</dl>
          <p className="preset-note">{presetId === "routenote" ? "Configuración recomendada para distribución digital. Lista para entregar." : selected.detail}</p>
          <button className="change-preset" type="button" onClick={() => setShowDestinations((value) => !value)}>Cambiar destino <span>{showDestinations ? "↑" : "→"}</span></button>
          {showDestinations && <div className="destination-list">{(Object.keys(presets) as PresetId[]).map((id) => <button type="button" className={id === presetId ? "selected" : ""} onClick={() => selectPreset(id)} key={id}><span>{presets[id].name}<small>{presets[id].detail}</small></span><b>{id === presetId ? "✓" : ""}</b></button>)}</div>}
          <button className={`advanced-toggle ${advanced ? "open" : ""}`} type="button" onClick={() => setAdvanced((value) => !value)}><span>⌁</span> Ajustes avanzados <b>{advanced ? "−" : "+"}</b></button>
        </aside>
      </section>

      {advanced && <section className="advanced-panel">
        <div className="advanced-title"><p className="audio-eyebrow">AJUSTES AVANZADOS</p><h2>Control fino,<br /><em>sin adivinar.</em></h2></div>
        <label>Formato<select value={format} onChange={(event) => { setFormat(event.target.value); setPresetId("custom"); }}><option>FLAC</option><option>WAV</option><option>MP3</option></select></label>
        <label>Profundidad<select value={bits} onChange={(event) => { setBits(event.target.value); setPresetId("custom"); }}><option>16 bit</option><option>24 bit</option><option>32 bit float</option></select></label>
        <label>Frecuencia<select value={rate} onChange={(event) => { setRate(event.target.value); setPresetId("custom"); }}><option>44.1 kHz</option><option>48 kHz</option><option>88.2 kHz</option><option>96 kHz</option></select></label>
        <label>Dithering<select value={dither} onChange={(event) => { setDither(event.target.value); setPresetId("custom"); }}><option>Sin dithering</option><option>Triangular</option><option>Triangular HP</option><option>Rectangular</option></select></label>
        <label className="toggle-field"><span>Normalizar volumen<small>Ajustar a -14 LUFS-I</small></span><input type="checkbox" checked={normalize} onChange={(event) => setNormalize(event.target.checked)} /></label>
        <label>True peak<select value={truePeak} disabled={!normalize} onChange={(event) => setTruePeak(event.target.value)}><option>-1.0 dBTP</option><option>-1.5 dBTP</option><option>-2.0 dBTP</option></select></label>
      </section>}

      <section className="delivery-bar"><div><span>Salida</span><strong>{selected.format} · {selected.bits} · {selected.rate}</strong></div><div><span>Dithering</span><strong>{selected.dither}</strong></div><button type="button" disabled={!files.length}>Preparar {files.length || ""} {files.length === 1 ? "archivo" : "archivos"} <span>→</span></button></section>
      <p className="engine-note">Interfaz lista · conexión con el motor local pendiente</p>
    </main>
  );
}
