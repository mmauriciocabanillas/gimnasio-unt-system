/* Sustituto exclusivo del servidor QA. Nunca importado por src/ ni producción. */
export class BrowserMultiFormatReader {
  async decodeFromConstraints(_constraints, video, callback) {
    const { mode } = await (await fetch('/__qa/scanner-mode')).json();
    if (mode === 'denied') { const e = new Error('Permiso denegado simulado'); e.name = 'NotAllowedError'; throw e; }
    video.setAttribute('aria-label', 'Cámara virtual de auditoría; no es una cámara física');
    const stream = new EventSource('/__qa/events');
    const controls = { stop() { stream.close(); } };
    stream.onmessage = event => { const { code } = JSON.parse(event.data); callback({ getText: () => code }, null, controls); };
    return controls;
  }
}
