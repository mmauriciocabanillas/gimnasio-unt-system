/* Google en memoria: jamás abre red, Drive real ni .env.local. */
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createHmac, randomBytes } from 'node:crypto';
import { hashPassword } from '../../server/auth.mjs';

const source = ['Domain.js', 'Code.js'].map(name => readFileSync(new URL(`../../apps-script/${name}`, import.meta.url), 'utf8')).join('\n');
const copy = value => JSON.parse(JSON.stringify(value));
export function googleHarness(initial = '2026-10-01T07:00:00-05:00', sourceOverride = source) {
  let clock = new Date(initial).getTime(), held = false, serial = 0;
  const sheets = new Map(), files = new Map(), folders = new Map(), props = new Map(), cache = new Map();
  const stats = { batchReads: 0, metadataReads: 0, batchWrites: 0, writtenCells: 0, exports: 0 };
  const exports = [];
  const env = { APPS_SCRIPT_URL: 'https://script.google.com/macros/s/QA_ONLY/exec', APPS_SCRIPT_SECRET: 'QA_NOT_A_REAL_SECRET_'.padEnd(64, 'x'), SESSION_SECRET: 'QA_SESSION_ONLY_'.padEnd(64, 'y') };
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [clock])); } static now() { return clock; } }
  class Range {
    constructor(sheet, row, col, rows, cols) { Object.assign(this, { sheet, row, col, rows, cols }); }
    setValues(values) { values.forEach((r, i) => r.forEach((v, j) => { const target = this.sheet.values[this.row - 1 + i] ||= []; target[this.col - 1 + j] = v; })); return this; }
    getValues() { return Array.from({ length: this.rows }, (_, i) => Array.from({ length: this.cols }, (_, j) => this.sheet.values[this.row - 1 + i]?.[this.col - 1 + j] ?? '')); }
    setNumberFormat() { return this; } setBackground() { return this; } setFontColor() { return this; } setFontWeight() { return this; }
  }
  class Sheet {
    constructor(name) { this.name = name; this.id = ++serial; this.values = []; this.charts = []; this.rows = 1000; this.cols = 26; }
    getSheetId() { return this.id; } getName() { return this.name; } setName(name) { this.name = name; return this; }
    getLastRow() { return this.values.length; } getMaxRows() { return this.rows; } getMaxColumns() { return this.cols; }
    insertRowsAfter(_, n) { this.rows += n; } insertColumnsAfter(_, n) { this.cols += n; }
    clearContents() { this.values = []; } getRange(...args) { return new Range(this, ...args); }
    hideColumns() {} hideSheet() {} setFrozenRows() {} autoResizeColumns() {}
    getCharts() { return this.charts; } insertChart(chart) { this.charts.push(chart); } removeChart(chart) { this.charts = this.charts.filter(c => c !== chart); }
    newChart() { const chart = { ranges: [], options: {}, getOptions: () => ({ get: key => chart.options[key] }) }; const builder = { asColumnChart: () => builder, addRange: r => { chart.ranges.push([r.row, r.col, r.rows, r.cols]); return builder; }, setPosition: () => builder, setOption: (k, v) => { chart.options[k] = v; return builder; }, build: () => chart }; return builder; }
  }
  class Book {
    constructor(name) { this.name = name; this.id = 'qa-sheet-' + ++serial; this.tabs = [new Sheet('Hoja 1')]; sheets.set(this.id, this); files.set(this.id, { id: this.id, name, trashed: false, moveTo() { return this; }, setTrashed: flag => { files.get(this.id).trashed = flag; } }); }
    getId() { return this.id; } getUrl() { return `https://docs.google.com/spreadsheets/d/${this.id}/edit`; }
    getSheets() { return this.tabs; } getSheetByName(name) { return this.tabs.find(s => s.name === name); }
    insertSheet(name) { const sheet = new Sheet(name); this.tabs.push(sheet); return sheet; } setSpreadsheetTimeZone() {}
  }
  function folder(name) {
    const child = new Map();
    return { getName: () => name, getFoldersByName: name => { const value = child.get(name); return { hasNext: () => Boolean(value), next: () => value }; }, createFolder: name => { const value = folder(name); child.set(name, value); return value; }, createFile: blob => { const id = 'qa-export-' + ++serial; const f = { id, name: blob.getName(), getId: () => id, getUrl: () => `https://drive.google.com/file/d/${id}` }; files.set(id, f); return f; } };
  }
  const properties = { getProperty: key => props.get(key) ?? null, setProperty: (key, value) => { props.set(key, value); return properties; }, deleteProperty: key => props.delete(key) };
  const context = vm.createContext({
    console, Date: Clock,
    PropertiesService: { getScriptProperties: () => properties },
    CacheService: { getScriptCache: () => ({ get: key => cache.get(key), put: (key, value) => cache.set(key, value) }) },
    LockService: { getScriptLock: () => ({ tryLock: () => { if (held) return false; held = true; return true; }, releaseLock: () => { held = false; } }) },
    Utilities: { computeHmacSha256Signature: (message, key) => [...createHmac('sha256', key).update(message).digest()].map(x => x > 127 ? x - 256 : x), getUuid: () => randomBytes(16).toString('hex'), base64Encode: bytes => Buffer.from(bytes).toString('base64') },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: raw => ({ setMimeType: () => JSON.parse(raw) }) },
    SpreadsheetApp: { create: name => new Book(name), openById: id => { if (!sheets.has(id)) throw new Error('Libro QA inexistente'); return sheets.get(id); }, flush() {} },
    DriveApp: { getFolderById: id => { if (!folders.has(id)) folders.set(id, folder('ARCHIVO 2026')); return folders.get(id); }, getFileById: id => { if (!files.has(id)) throw new Error('Archivo QA inexistente'); return files.get(id); } },
    ScriptApp: { getProjectTriggers: () => [], newTrigger: () => { const b = { timeBased: () => b, everyMinutes: () => b, everyHours: () => b, create() {} }; return b; }, getOAuthToken: () => 'QA_ONLY' },
    UrlFetchApp: { fetch: url => {
      const id = url.match(/\/files\/([^/]+)\//)[1], book = sheets.get(id); stats.exports++;
      exports.push({ name: book.name, sheets: book.tabs.map(s => ({ name: s.name, values: copy(s.values), charts: copy(s.charts) })) });
      const blob = { name: 'qa.xlsx', setName(name) { this.name = name; return this; }, getName() { return this.name; }, getBytes: () => [81, 65] };
      return { getResponseCode: () => 200, getBlob: () => blob };
    } },
    Sheets: { Spreadsheets: {
      get: id => { stats.metadataReads++; return { sheets: sheets.get(id).tabs.map(s => ({ properties: { title: s.name, sheetId: s.id, gridProperties: { rowCount: s.rows, columnCount: s.cols } } })) }; },
      Values: { batchGet: (id, options) => { stats.batchReads++; return { valueRanges: options.ranges.map(range => { const name = range.match(/^'([^']+)'!/)[1], sheet = sheets.get(id).getSheetByName(name); if (!sheet) throw new Error('Hoja QA ausente'); return { values: copy(sheet.values) }; }) }; } },
      batchUpdate: (body, id) => {
        if (!held) throw new Error('Escritura operativa sin lock');
        stats.batchWrites++;
        const book = sheets.get(id);
        for (const r of body.requests) {
          if (r.appendDimension) { const d = r.appendDimension, s = book.tabs.find(s => s.id === d.sheetId); if (d.dimension === 'ROWS') s.rows += d.length; else s.cols += d.length; continue; }
          const u = r.updateCells, s = book.tabs.find(s => s.id === u.range.sheetId), g = u.range;
          for (let i = g.startRowIndex; i < g.endRowIndex; i++) {
            const values = u.rows[i - g.startRowIndex]?.values || [];
            const row = s.values[i] ||= [];
            for (let j = g.startColumnIndex; j < g.endColumnIndex; j++) { const value = values[j - g.startColumnIndex]?.userEnteredValue; row[j] = value?.numberValue ?? value?.stringValue ?? ''; stats.writtenCells++; }
          }
          while (s.values.length && s.values.at(-1).every(v => v === '')) s.values.pop();
        }
      }
    } }
  });
  vm.runInContext(sourceOverride, context);
  props.set('APPS_SCRIPT_SECRET', env.APPS_SCRIPT_SECRET);
  const passwords = { ProfesorGYM: 'QA_Profesor_1234', Administrador: 'QA_Admin_1234' };
  function request(action, data = {}) {
    const payload = JSON.stringify({ action, data }), nonce = randomBytes(16).toString('hex');
    const envelope = { payload, timestamp: clock, nonce, signature: createHmac('sha256', env.APPS_SCRIPT_SECRET).update(`${clock}.${nonce}.${payload}`).digest('hex') };
    return context.doPost({ postData: { contents: JSON.stringify(envelope) } });
  }
  function invoke(action, data) {
    const result = request(action, data);
    if (!result.ok) { const e = new Error(result.error); e.status = result.status; throw e; }
    return result.data;
  }
  invoke('initialize', { accounts: Object.fromEntries(Object.entries(passwords).map(([user, p]) => [user, hashPassword(p)])) });
  return { context, env, props, passwords, stats, exports, files, sheets, request, invoke, setTime: value => { clock = new Date(value).getTime(); }, now: () => new Date(clock), operational: () => sheets.get(props.get('MONTH_' + props.get('CURRENT_PERIOD'))) };
}
