/* Añadir como archivo PruebaCierre.gs al proyecto existente y ejecutar
 * verificarCierreMensualAislado. No necesita implementar otra versión.
 * Conserva sus archivos en una carpeta PRUEBA_CIERRE_GIMNASIO_UNT.
 * Nunca inicializa cuentas, instala activadores ni cambia propiedades reales.
 * El motor copia funciones flow-3 y comprueba que coinciden con Código.gs, con
 * carpetas, propiedades y accesos a archivos aislados y vigilados.
 */
function verificarCierreMensualAislado() {
  function check(value, message) { if (!value) throw new Error('PRUEBA: ' + message); }
  check(GYM_REVISION === '2026-10-06-flow-3', 'Código.gs debe ser flow-3.');
  var realProps = PropertiesService.getScriptProperties();
  var productionPeriod = realProps.getProperty('CURRENT_PERIOD');
  check(/^\d{4}-\d{2}$/.test(productionPeriod || ''), 'Falta el periodo de producción.');
  var protectedKeys = ['CURRENT_PERIOD', 'GENERAL_CONFIG', 'ACCOUNTS_READY', 'ACCOUNT_ProfesorGYM', 'ACCOUNT_Administrador',
    'MONTH_' + productionPeriod, 'MONTH_READY_' + productionPeriod, 'ARCHIVED_' + productionPeriod, 'ARCHIVE_PENDING_ID_' + productionPeriod];
  var before = protectedKeys.map(function (key) { return realProps.getProperty(key); });
  function triggers() { return ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction() + ':' + String(t.getEventType()); }).sort().join('|'); }
  var originalTriggers = triggers(), prefix = 'QA_MONTHLY_' + Utilities.getUuid().replace(/-/g, '') + '_';
  var failMarker = true, engine, root, result;
  var validKey = /^(CURRENT_PERIOD|GENERAL_CONFIG|LAST_ROLLOVER_ERROR|MONTH_\d{4}-\d{2}|MONTH_READY_\d{4}-\d{2}|ARCHIVED_\d{4}-\d{2}|ARCHIVE_PENDING_ID_\d{4}-\d{2})$/;
  function propertyKey(key) { check(validKey.test(key), 'Acceso a una propiedad fuera de la prueba: ' + key); return prefix + key; }
  var qaProps = {
    getProperty: function (key) { return realProps.getProperty(propertyKey(key)); },
    setProperty: function (key, value) {
      var isolatedKey = propertyKey(key);
      if (failMarker && /^ARCHIVED_/.test(key)) { failMarker = false; throw new Error('QA_FALLO_MARCADOR'); }
      realProps.setProperty(isolatedKey, String(value)); return qaProps;
    },
    deleteProperty: function (key) { realProps.deleteProperty(propertyKey(key)); return qaProps; }
  };
  var sheetsAllowed = new Set(), filesAllowed = new Set(), folders = { database: null, reports: null };
  var qaSpreadsheet = {
    create: function (name) { var ss = SpreadsheetApp.create('PRUEBA_' + name); sheetsAllowed.add(ss.getId()); filesAllowed.add(ss.getId()); return ss; },
    openById: function (id) { check(sheetsAllowed.has(id), 'Intento de abrir un libro ajeno a la prueba.'); return SpreadsheetApp.openById(id); },
    flush: function () { SpreadsheetApp.flush(); }
  };
  var qaDriveApp = {
    getFolderById: function (id) { check(id === folders.database || id === folders.reports, 'Carpeta fuera de la prueba.'); return DriveApp.getFolderById(id); },
    getFileById: function (id) { check(filesAllowed.has(id), 'Archivo fuera de la prueba.'); return DriveApp.getFileById(id); }
  };
  var qaDrive = { Files: {
    generateIds: function (options) { var ids = Drive.Files.generateIds(options); ids.ids.forEach(function (id) { filesAllowed.add(id); }); return ids; },
    get: function (id, options) { check(filesAllowed.has(id), 'Consulta Drive fuera de la prueba.'); return Drive.Files.get(id, options); },
    create: function (metadata, blob, options) {
      check(filesAllowed.has(metadata.id), 'ID no reservado por la prueba.');
      check(metadata.parents.length === 1 && metadata.parents[0] === engine.reportFolder(previous).getId(), 'Destino del Excel fuera de la prueba.');
      return Drive.Files.create(metadata, blob, options);
    }
  } };
  // Compara las copias literales con las funciones vigentes antes de escribir.
  // No se importa ninguna función de cuentas, inicialización o API pública.
  var implementations = [gymSheetName_, gymConfig_, gymCreateMonth_, gymRead_, gymSafeCell_, gymWriteRows_, gymRows_, gymSave_,
    gymEnsureDashboardCharts_, gymAtomicWrite_, gymSubfolder_, gymReportFolder_, gymFinalFileResult_, gymRecoverFinal_, gymArchiveFinal_, gymExport_, procesarCambioMensual];
  function factory(GymDomain, GYM_FOLDERS, GYM_MONTHS, GYM_TABLES, gymProperties_, gymLock_, SpreadsheetApp, DriveApp, Drive) {
// BEGIN: copias literales flow-3, sin eval ni constructor dinámico.
function gymSheetName_(period) { return 'GIMNASIO_UNT_' + GYM_MONTHS[Number(period.slice(5)) - 1] + '_' + period.slice(0, 4); }
function gymConfig_() { return JSON.parse(gymProperties_().getProperty('GENERAL_CONFIG') || JSON.stringify(GymDomain.empty('2000-01').config)); }
function gymCreateMonth_(period) {
  var props = gymProperties_(), key = 'MONTH_' + period, id = props.getProperty(key);
  if (id && props.getProperty('MONTH_READY_' + period)) return SpreadsheetApp.openById(id);
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create(gymSheetName_(period));
  // Guardar el ID inmediatamente permite reintentar sin crear otro archivo.
  props.setProperty(key, ss.getId());
  ss.setSpreadsheetTimeZone('America/Lima');
  DriveApp.getFileById(ss.getId()).moveTo(DriveApp.getFolderById(GYM_FOLDERS.database));
  var first = ss.getSheets()[0]; if (!ss.getSheetByName('REGISTRADOS')) first.setName('REGISTRADOS');
  Object.keys(GYM_TABLES).forEach(function (key) {
    var table = GYM_TABLES[key], sheet = ss.getSheetByName(table.name) || ss.insertSheet(table.name);
    gymWriteRows_(sheet, table.headers, []);
    sheet.hideColumns(table.headers.length);
    if (table.name === 'ASISTENCIAS') sheet.hideColumns(7, 4);
    if (!['REGISTRADOS', 'ASISTENCIAS', 'CIERRES'].includes(table.name)) sheet.hideSheet();
  });
  ['CUPOS', 'CONFIGURACIÓN', 'DASHBOARD'].forEach(function (name) { if (!ss.getSheetByName(name)) ss.insertSheet(name); });
  gymSave_(GymDomain.empty(period, gymConfig_()), ss);
  gymEnsureDashboardCharts_(ss.getSheetByName('DASHBOARD'));
  props.setProperty('MONTH_READY_' + period, '1');
  return ss;
}
function gymRead_(ss, selectedKeys) {
  var state = GymDomain.empty(gymProperties_().getProperty('CURRENT_PERIOD'), gymConfig_());
  var keys = selectedKeys || Object.keys(GYM_TABLES), ranges = keys.map(function (key) {
    var table = GYM_TABLES[key]; return "'" + table.name + "'!A1:" + String.fromCharCode(64 + table.headers.length);
  });
  var names = keys.map(function (key) { return GYM_TABLES[key].name; });
  if (!selectedKeys) { names = names.concat(['CUPOS', 'CONFIGURACIÓN', 'DASHBOARD']); ranges = ranges.concat(["'CUPOS'!A1:G", "'CONFIGURACIÓN'!A1:B", "'DASHBOARD'!A1:C"]); }
  var result;
  try { result = Sheets.Spreadsheets.Values.batchGet(ss.getId(), { ranges: ranges, valueRenderOption: 'UNFORMATTED_VALUE' }); }
  catch (_) { GymDomain.fail('No se pudo leer el mes. Verifica las hojas y Google Sheets API.', 503); }
  var persisted = {};
  names.forEach(function (name, i) { persisted[name] = (result.valueRanges[i] || {}).values || []; });
  keys.forEach(function (key) {
    var table = GYM_TABLES[key], rows = persisted[table.name];
    if (!rows[0] || rows[0][table.headers.length - 1] !== 'JSON_INTERNO') GymDomain.fail('Estructura inválida de ' + table.name + '.', 503);
    state[key] = rows.slice(1).filter(function (r) { return r[table.headers.length - 1]; }).map(function (r) { return JSON.parse(r[table.headers.length - 1]); });
  });
  Object.defineProperty(state, '_persisted', { value: persisted, enumerable: false });
  return state;
}
function gymSafeCell_(value) { return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value; }
function gymWriteRows_(sheet, headers, rows) {
  var values = [headers].concat(rows).map(function (r) { return r.map(gymSafeCell_); });
  if (values.length > sheet.getMaxRows()) sheet.insertRowsAfter(sheet.getMaxRows(), values.length - sheet.getMaxRows());
  if (headers.length > sheet.getMaxColumns()) sheet.insertColumnsAfter(sheet.getMaxColumns(), headers.length - sheet.getMaxColumns());
  sheet.clearContents();
  sheet.getRange(1, 1, values.length, headers.length).setNumberFormat('@').setValues(values);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setBackground('#041d37').setFontColor('#ffffff').setFontWeight('bold');
  sheet.autoResizeColumns(1, Math.min(headers.length, 13));
}
function gymRows_(state, key, now) {
  var studentByCode = new Map(state.students.map(function (s) { return [s.code, s]; }));
  var active = GymDomain.activeReservations(state, now || new Date());
  return state[key].map(function (row) {
    var student = studentByCode.get(row.code) || {}, base;
    if (key === 'students') {
      var slots = active.filter(function (r) { return r.code === row.code; }).sort(function (a, b) { return a.day - b.day; });
      base = [row.code, row.fullName, row.faculty, row.career, row.cycle];
      for (var i = 0; i < 3; i++) base.push(slots[i] ? GymDomain.DAYS[slots[i].day] : '', slots[i] ? slots[i].start + '–' + GymDomain.blockFor(slots[i].start).end : '');
      base.push(row.absences, row.status);
    } else if (key === 'reservations') { var block = GymDomain.blockFor(row.start); base = [row.code, GymDomain.DAYS[row.day], row.start, block.end, block.shift, row.from, row.until]; }
    else if (key === 'attendance') base = [row.date, row.code, student.fullName || '', student.faculty || '', student.career || '', student.cycle || '', row.timestamp, row.method, row.start + '–' + row.end];
    else if (key === 'absences') base = [row.date, row.code, student.fullName || '', row.start, row.shift, row.status];
    else if (key === 'closures') base = [row.date, row.shift, row.closed ? 'CERRADO' : 'ABIERTO', row.reason, row.actor, row.timestamp];
    else base = [row.action, row.actor, row.timestamp, row.detail];
    return base.concat(JSON.stringify(row));
  });
}
function gymSave_(state, ss) {
  var now = new Date(); GymDomain.recalculate(state, now);
  var writes = Object.keys(GYM_TABLES).map(function (key) { var table = GYM_TABLES[key]; return { name: table.name, headers: table.headers, rows: gymRows_(state, key, now) }; });
  var slots = GymDomain.occupancy(state);
  writes.push({ name: 'CUPOS', headers: ['Día', 'Inicio', 'Fin', 'Turno', 'Ocupados', 'Disponibles', 'Aforo'], rows: slots.map(function (s) { return [s.dayName, s.start, s.end, s.shift, s.occupied, s.available, state.config.capacity]; }) });
  writes.push({ name: 'CONFIGURACIÓN', headers: ['Clave', 'Valor'], rows: [['Periodo', state.period], ['Zona horaria', 'America/Lima'], ['Días', state.config.days.map(function (d) { return GymDomain.DAYS[d]; }).join(', ')], ['Aforo', 20], ['Límite de faltas', 3], ['Inscripciones', state.config.enabled ? 'ABIERTAS' : 'CERRADAS'], ['Código', state.config.codePattern]] });
  var dash = GymDomain.dashboard(state, now, 'TODO', true);
  var dashboardRows = [['Periodo', state.period, ''], ['Inscritos', dash.registered, ''], ['Asistencias', dash.attendance, ''], ['Faltas', dash.absences, ''], ['Bloqueados', dash.blocked, ''], ['Asistencia sobre sesiones finalizadas aplicables (%)', dash.attendanceRate, ''], ['', '', ''], ['Horario', 'Reservas', 'Asistencias']];
  dashboardRows = dashboardRows.concat(dash.byBlock.map(function (b) { return [b.start + '–' + b.end, b.occupied, b.attendance]; }));
  dashboardRows.push(['', '', ''], ['Día', 'Asistencias', '']);
  GymDomain.DAYS.forEach(function (name, day) { var item = dash.byDay.find(function (d) { return d.day === day; }); dashboardRows.push([name, item ? item.attendance : 0, '']); });
  dashboardRows.push(['', '', ''], ['Turno', 'Asistencias', '']);
  dashboardRows = dashboardRows.concat(dash.byShift.map(function (s) { return [s.shift, s.attendance, '']; }));
  writes.push({ name: 'DASHBOARD', headers: ['Indicador', 'Valor', 'Asistencias'], rows: dashboardRows });
  writes.forEach(function (write) { write.previousRows = state._persisted && state._persisted[write.name]; });
  gymAtomicWrite_(ss, writes);
}
function gymEnsureDashboardCharts_(sheet) {
  var titles = ['Reservas y asistencia por horario', 'Asistencia por día', 'Comparación mañana / tarde'];
  // Sustituir únicamente los tres gráficos de la app; conservar los ajenos.
  sheet.getCharts().forEach(function (chart) { if (titles.includes(chart.getOptions().get('title'))) sheet.removeChart(chart); });
  sheet.insertChart(sheet.newChart().asColumnChart().addRange(sheet.getRange(9, 1, GymDomain.BLOCKS.length + 1, 3)).setPosition(1, 5, 0, 0).setOption('title', titles[0]).setOption('colors', ['#f5c52b', '#041d37']).build());
  sheet.insertChart(sheet.newChart().asColumnChart().addRange(sheet.getRange(20, 1, 8, 2)).setPosition(20, 5, 0, 0).setOption('title', titles[1]).setOption('colors', ['#041d37']).build());
  sheet.insertChart(sheet.newChart().asColumnChart().addRange(sheet.getRange(29, 1, 3, 2)).setPosition(39, 5, 0, 0).setOption('title', titles[2]).setOption('colors', ['#f5c52b']).build());
}
function gymAtomicWrite_(ss, writes) {
  // Una sola petición batchUpdate: Google aplica todos los cambios o ninguno.
  // Evita dejar REGISTRADOS guardado y HORARIOS sin guardar ante un fallo.
  var requests = [], metadata;
  writes.forEach(function (write) {
    var values = [write.headers].concat(write.rows), previous = write.previousRows || [], first = 0;
    function equal(a, b) { return write.headers.every(function (_, i) { return (a[i] == null ? '' : a[i]) === (b[i] == null ? '' : b[i]); }); }
    while (first < values.length && first < previous.length && equal(values[first], previous[first])) first++;
    if (first === values.length && first === previous.length) return;
    if (!metadata) metadata = Sheets.Spreadsheets.get(ss.getId(), { fields: 'sheets.properties' }).sheets;
    var info = metadata.find(function (s) { return write.name ? s.properties.title === write.name : s.properties.sheetId === write.sheet.getSheetId(); });
    if (!info) GymDomain.fail('Falta una hoja operativa. No alteres la estructura.', 503);
    var id = info.properties.sheetId, grid = info.properties.gridProperties;
    var rowCount = Math.max(previous.length, values.length);
    if (rowCount > grid.rowCount) requests.push({ appendDimension: { sheetId: id, dimension: 'ROWS', length: rowCount - grid.rowCount } });
    if (write.headers.length > grid.columnCount) requests.push({ appendDimension: { sheetId: id, dimension: 'COLUMNS', length: write.headers.length - grid.columnCount } });
    requests.push({ updateCells: { range: { sheetId: id, startRowIndex: first, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: write.headers.length }, rows: values.slice(first).map(function (row) { return { values: row.map(function (value) { return { userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value == null ? '' : value) } }; }) }; }), fields: 'userEnteredValue' } });
  });
  if (!requests.length) return;
  try { Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId()); }
  catch (_) { GymDomain.fail('No se pudo confirmar el guardado. Revisa el registro antes de repetir la operación y verifica que Google Sheets API esté habilitada.', 502); }
}
function gymSubfolder_(parent, name) { var list = parent.getFoldersByName(name); return list.hasNext() ? list.next() : parent.createFolder(name); }
function gymReportFolder_(period) {
  var root = DriveApp.getFolderById(GYM_FOLDERS.reports);
  // La carpeta entregada se llama ARCHIVO 2026; ese año no se anida de nuevo.
  var year = period.slice(0, 4), yearFolder = root.getName() === 'ARCHIVO ' + year ? root : gymSubfolder_(root, year);
  return gymSubfolder_(yearFolder, GYM_MONTHS[Number(period.slice(5)) - 1]);
}
function gymFinalFileResult_(file, id, period) {
  if (file.id !== id || file.trashed || file.mimeType !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || !Number.isFinite(Number(file.size)) || Number(file.size) <= 0 || !file.appProperties || file.appProperties.gymPeriod !== period || file.appProperties.gymKind !== 'MONTH_FINAL') {
    GymDomain.fail('El archivo mensual reservado no es válido o fue alterado. Revisa Drive; el periodo se conserva.', 502);
  }
  return { fileId: id, filename: file.name, driveUrl: file.webViewLink || 'https://drive.google.com/file/d/' + id + '/view' };
}
function gymRecoverFinal_(period) {
  var id = gymProperties_().getProperty('ARCHIVE_PENDING_ID_' + period), file;
  if (!id) return null;
  try { file = Drive.Files.get(id, { fields: 'id,name,mimeType,size,trashed,appProperties,webViewLink' }); }
  catch (_) { return null; } // No declarar archivado si no se puede comprobar.
  return gymFinalFileResult_(file, id, period);
}
function gymArchiveFinal_(period, blob) {
  var props = gymProperties_(), key = 'ARCHIVE_PENDING_ID_' + period, id = props.getProperty(key);
  if (!id) {
    id = Drive.Files.generateIds({ count: 1, space: 'drive', type: 'files' }).ids[0];
    // Guardar antes de crear: un timeout/reintento usará SIEMPRE el mismo ID.
    props.setProperty(key, id);
  }
  var recovered = gymRecoverFinal_(period);
  if (recovered) return recovered;
  var file;
  try {
    file = Drive.Files.create({ id: id, name: blob.getName(), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', parents: [gymReportFolder_(period).getId()], appProperties: { gymKind: 'MONTH_FINAL', gymPeriod: period } }, blob, { fields: 'id,name,mimeType,size,trashed,appProperties,webViewLink' });
  } catch (error) {
    // El upload pudo completarse aunque se perdiera su respuesta. Drive no
    // permite crear dos archivos con el ID pre-generado, incluso ante un 409.
    recovered = gymRecoverFinal_(period);
    if (recovered) return recovered;
    throw error;
  }
  return gymFinalFileResult_(file, id, period);
}
function gymExport_(state, shift, archive, finalReport) {
  if (!['TODO', 'MANANA', 'TARDE'].includes(shift)) GymDomain.fail('Turno inválido.');
  var now = finalReport ? new Date(GymDomain.instant(GymDomain.nextPeriod(state.period) + '-01', '00:00')) : new Date();
  GymDomain.recalculate(state, now);
  var dash = GymDomain.dashboard(state, now, shift), codes = new Set(state.reservations.filter(function (r) { return shift === 'TODO' || GymDomain.blockFor(r.start).shift === shift; }).map(function (r) { return r.code; }));
  var filtered = Object.assign({}, state, {
    students: state.students.filter(function (s) { return codes.has(s.code); }),
    reservations: state.reservations.filter(function (r) { return shift === 'TODO' || GymDomain.blockFor(r.start).shift === shift; }),
    attendance: state.attendance.filter(function (a) { return shift === 'TODO' || a.shift === shift; }),
    absences: state.absences.filter(function (a) { return shift === 'TODO' || a.shift === shift; }),
    closures: state.closures.filter(function (c) { return shift === 'TODO' || c.shift === 'TODO' || c.shift === shift; })
  });
  var stem = finalReport ? gymSheetName_(state.period) : 'GIMNASIO_UNT_CORTE_' + GymDomain.lima(now).date.slice(8) + '_' + GYM_MONTHS[Number(state.period.slice(5)) - 1] + '_' + state.period.slice(0, 4) + (shift === 'TODO' ? '' : '_' + shift);
  var temp = SpreadsheetApp.create('TEMP_REPORTE_' + Utilities.getUuid());
  try {
    var overview = temp.getSheets()[0]; overview.setName('ANÁLISIS');
    gymWriteRows_(overview, ['Indicador', 'Valor'], [['Periodo', state.period], ['Alcance', shift], ['Inscritos', dash.registered], ['Asistencias', dash.attendance], ['Faltas', dash.absences], ['Bloqueados', dash.blocked], ['Asistencia de sesiones finalizadas (%)', dash.attendanceRate], ['Fecha de corte', GymDomain.lima(now).date]]);
    ['students', 'attendance', 'absences', 'closures', 'reservations'].forEach(function (key) {
      var table = GYM_TABLES[key], sheet = temp.insertSheet(table.name);
      gymWriteRows_(sheet, table.headers.slice(0, -1), gymRows_(filtered, key, now).map(function (r) { return r.slice(0, -1); }));
    });
    var charts = temp.insertSheet('GRÁFICOS');
    gymWriteRows_(charts, ['Horario', 'Reservas', 'Asistencias'], dash.byBlock.map(function (b) { return [b.start + '–' + b.end, b.occupied, b.attendance]; }));
    charts.getRange(2, 2, Math.max(1, dash.byBlock.length), 2).setNumberFormat('0');
    var dayStart = dash.byBlock.length + 4;
    charts.getRange(dayStart, 1, dash.byDay.length + 1, 2).setValues([['Día', 'Asistencias']].concat(dash.byDay.map(function (d) { return [d.label, d.attendance]; })));
    charts.insertChart(charts.newChart().asColumnChart().addRange(charts.getRange(1, 1, dash.byBlock.length + 1, 3)).setPosition(1, 5, 0, 0).setOption('title', 'Reservas y asistencia por horario').setOption('colors', ['#f5c52b', '#041d37']).build());
    charts.insertChart(charts.newChart().asColumnChart().addRange(charts.getRange(dayStart, 1, dash.byDay.length + 1, 2)).setPosition(20, 5, 0, 0).setOption('title', 'Asistencia por día').setOption('colors', ['#041d37']).build());
    var shiftStart = dayStart + dash.byDay.length + 3;
    charts.getRange(shiftStart, 1, 3, 2).setValues([['Turno', 'Asistencias']].concat(dash.byShift.map(function (s) { return [s.shift, s.attendance]; })));
    charts.insertChart(charts.newChart().asColumnChart().addRange(charts.getRange(shiftStart, 1, 3, 2)).setPosition(39, 5, 0, 0).setOption('title', 'Comparación mañana / tarde').setOption('colors', ['#f5c52b']).build());
    SpreadsheetApp.flush();
    var response = UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/' + temp.getId() + '/export?mimeType=application%2Fvnd.openxmlformats-officedocument.spreadsheetml.sheet', { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
    if (response.getResponseCode() !== 200) GymDomain.fail('Google no pudo exportar el Excel. El periodo y sus datos se conservan.', 502);
    var blob = response.getBlob().setName(stem + '.xlsx'), file = null;
    if (finalReport) return gymArchiveFinal_(state.period, blob);
    if (archive) file = gymReportFolder_(state.period).createFile(blob);
    if (blob.getBytes().length > 2800000) {
      if (file) return { driveUrl: file.getUrl(), filename: blob.getName(), large: true };
      GymDomain.fail('El Excel supera el tamaño de descarga de esta API. Usa «Guardar copia en Drive» y descárgalo desde allí.', 413);
    }
    return { filename: blob.getName(), base64: Utilities.base64Encode(blob.getBytes()), driveUrl: file ? file.getUrl() : null };
  } finally { DriveApp.getFileById(temp.getId()).setTrashed(true); }
}
function procesarCambioMensual() {
  return gymLock_(function () {
    var props = gymProperties_(), current = props.getProperty('CURRENT_PERIOD'), target = GymDomain.lima(new Date()).period;
    if (!current || current >= target) return;
    // Un mes por ejecución; recupera meses omitidos sin saltar reportes.
    var ss = SpreadsheetApp.openById(props.getProperty('MONTH_' + current)), state = gymRead_(ss);
    state.period = current;
    GymDomain.recalculate(state, new Date(GymDomain.instant(GymDomain.nextPeriod(current) + '-01', '00:00')));
    gymSave_(state, ss);
    var archived = props.getProperty('ARCHIVED_' + current);
    if (!archived) {
      var report = gymRecoverFinal_(current) || gymExport_(state, 'TODO', true, true);
      props.setProperty('ARCHIVED_' + current, report.fileId);
    }
    var next = GymDomain.nextPeriod(current); gymCreateMonth_(next);
    props.setProperty('CURRENT_PERIOD', next);
    props.deleteProperty('LAST_ROLLOVER_ERROR');
    return { closed: current, opened: next };
  });
}
// END: copias literales.
    var copied = [gymSheetName_, gymConfig_, gymCreateMonth_, gymRead_, gymSafeCell_, gymWriteRows_, gymRows_, gymSave_, gymEnsureDashboardCharts_, gymAtomicWrite_, gymSubfolder_, gymReportFolder_, gymFinalFileResult_, gymRecoverFinal_, gymArchiveFinal_, gymExport_, procesarCambioMensual];
    var exportCount = 0, originalExport = gymExport_;
    gymExport_ = function () { exportCount++; return originalExport.apply(null, arguments); };
    return { createMonth: gymCreateMonth_, read: gymRead_, save: gymSave_, close: procesarCambioMensual, reportFolder: gymReportFolder_,
      exportCount: function () { return exportCount; }, matchesSource: function (originals) { return originals.every(function (fn, i) { return fn.toString().replace(/\s+/g, '') === copied[i].toString().replace(/\s+/g, ''); }); } };
  }
  var expected = GymDomain.lima(new Date()).period;
  var date = new Date(expected + '-01T12:00:00Z'); date.setUTCMonth(date.getUTCMonth() - 1);
  var previous = date.toISOString().slice(0, 7);
  function isolatedLock(fn) {
    var lock = LockService.getUserLock(); check(lock.tryLock(5000), 'Otra prueba aislada está en curso.');
    try { return fn(); } finally { lock.releaseLock(); }
  }
  engine = factory(GymDomain, folders, JSON.parse(JSON.stringify(GYM_MONTHS)), JSON.parse(JSON.stringify(GYM_TABLES)), function () { return qaProps; }, isolatedLock, qaSpreadsheet, qaDriveApp, qaDrive);
  check(engine.matchesSource(implementations), 'Las funciones de Código.gs no coinciden con la prueba flow-3.');
  try {
    root = DriveApp.createFolder('PRUEBA_CIERRE_GIMNASIO_UNT_' + prefix.slice(11, -1));
    folders.database = root.createFolder('BASE_DE_PRUEBA').getId(); folders.reports = root.createFolder('ARCHIVO_DE_PRUEBA').getId();
    check(folders.database !== GYM_FOLDERS.database && folders.reports !== GYM_FOLDERS.reports, 'La prueba no está aislada.');
    var config = { days: [1, 2, 3, 4, 5], capacity: 20, maxAbsences: 3, enabled: true, codePattern: '^[0-9]{10}$' };
    qaProps.setProperty('CURRENT_PERIOD', previous); qaProps.setProperty('GENERAL_CONFIG', JSON.stringify(config));
    var oldSheet = engine.createMonth(previous), state = GymDomain.empty(previous, config);
    var firstMonday = new Date(previous + '-01T12:00:00Z');
    while (firstMonday.getUTCDay() !== 1) firstMonday.setUTCDate(firstMonday.getUTCDate() + 1);
    var codes = ['9000000001', '9000000002'];
    codes.forEach(function (code, i) {
      GymDomain.register(state, { code: code, names: 'Alumno Ficticio ' + (i + 1), surnames: 'PRUEBA NO REAL', faculty: 'QA', career: 'QA', cycle: 1, method: 'CARNET', slots: [{ day: 1, start: '08:00' }] }, new Date(previous + '-01T07:00:00-05:00'));
    });
    GymDomain.attend(state, { code: codes[0], method: 'CARNET' }, new Date(firstMonday.toISOString().slice(0, 10) + 'T08:15:00-05:00'));
    var holiday = new Date(firstMonday); holiday.setUTCDate(holiday.getUTCDate() + 7);
    GymDomain.closure(state, { date: holiday.toISOString().slice(0, 10), shift: 'MANANA', closed: true, reason: 'CIERRE FICTICIO QA' }, 'QA', new Date(previous + '-01T07:00:00-05:00'));
    engine.save(state, oldSheet);
    try { engine.close(); throw new Error('No se reprodujo el fallo esperado.'); }
    catch (error) { check(error.message === 'QA_FALLO_MARCADOR', 'El cierre falló por otro motivo: ' + error.message); }
    check(qaProps.getProperty('CURRENT_PERIOD') === previous, 'El mes avanzó antes de confirmar el archivo.');
    var reserved = qaProps.getProperty('ARCHIVE_PENDING_ID_' + previous);
    check(reserved && !qaProps.getProperty('ARCHIVED_' + previous), 'No se conservó el ID pendiente.');
    var closed = engine.close();
    check(closed.closed === previous && closed.opened === expected, 'El cierre no abrió el siguiente mes.');
    check(qaProps.getProperty('ARCHIVED_' + previous) === reserved, 'El reintento usó otro archivo.');
    engine.close(); check(engine.exportCount() === 1, 'El reintento repitió la exportación.');
    var list = engine.reportFolder(previous).getFilesByType('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'), count = 0;
    while (list.hasNext()) { var file = list.next(); check(file.getId() === reserved, 'Se creó un Excel duplicado.'); count++; }
    check(count === 1, 'Debe existir exactamente un Excel final.');
    var archive = qaDriveApp.getFileById(reserved), parts = Utilities.unzip(archive.getBlob().setContentType('application/zip'));
    var workbook = parts.find(function (p) { return p.getName() === 'xl/workbook.xml'; });
    check(workbook && /REGISTRADOS/.test(workbook.getDataAsString()) && /ASISTENCIAS/.test(workbook.getDataAsString()), 'El XLSX no contiene las hojas esperadas.');
    var texts = parts.filter(function (p) { return /^xl\/.*\.xml$/.test(p.getName()); }).map(function (p) { return p.getDataAsString(); }).join('\n');
    check(codes.every(function (code) { return texts.includes(code); }), 'El XLSX perdió los códigos ficticios.');
    var oldState = engine.read(oldSheet); oldState.period = previous;
    check(oldState.students.length === 2 && oldState.attendance.length === 1 && oldState.closures.length === 1, 'Se perdió el historial del mes cerrado.');
    var nextSheet = qaSpreadsheet.openById(qaProps.getProperty('MONTH_' + expected)), nextState = engine.read(nextSheet);
    ['students', 'reservations', 'attendance', 'absences', 'closures', 'audit'].forEach(function (key) { check(nextState[key].length === 0, 'El nuevo mes contiene ' + key + '.'); });
    result = { ok: true, revision: GYM_REVISION, testClosed: previous, testOpened: expected, fictitiousStudents: 2, attendanceRows: 1,
      archiveCopies: count, exportCount: engine.exportCount(), markerFailureRecovered: true, xlsxOpened: true, newMonthEmpty: true,
      testFolderUrl: root.getUrl(), archiveUrl: archive.getUrl(), closedSheetUrl: oldSheet.getUrl(), newSheetUrl: nextSheet.getUrl() };
  } finally {
    check(protectedKeys.every(function (key, i) { return realProps.getProperty(key) === before[i]; }), 'Cambió una propiedad protegida de producción.');
    check(triggers() === originalTriggers, 'Cambió la configuración de activadores.');
    if (root && !result) console.log('La prueba quedó incompleta; sus archivos están en ' + root.getUrl());
  }
  result.productionUnchanged = true; result.passwordChanges = 0; result.triggerConfigurationUnchanged = true;
  console.log(JSON.stringify(result));
  return result;
}
