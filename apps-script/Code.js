/* Todos los accesos web pasan por la API de Vercel con una firma privada. */
var GYM_FOLDERS = {
  database: '1S34HRZq7u6pE6fSX3SfxClpOBNh5561f',
  reports: '1Sb7_aVAIRwzgSx0IWK-LIok9tJPG5qqw'
};
var GYM_MONTHS = ['ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'];
var GYM_TABLES = {
  students: { name: 'REGISTRADOS', headers: ['Código', 'Alumno', 'Facultad', 'Carrera', 'Ciclo', 'Día 1', 'Hora 1', 'Día 2', 'Hora 2', 'Día 3', 'Hora 3', 'Faltas', 'Estado', 'JSON_INTERNO'] },
  reservations: { name: 'HORARIOS', headers: ['Código', 'Día', 'Inicio', 'Fin', 'Turno', 'Vigente desde', 'Vigente hasta', 'JSON_INTERNO'] },
  attendance: { name: 'ASISTENCIAS', headers: ['Fecha', 'Código', 'Alumno', 'Facultad', 'Carrera', 'Ciclo', 'Timestamp', 'Método', 'Horario', 'JSON_INTERNO'] },
  absences: { name: 'FALTAS', headers: ['Fecha', 'Código', 'Alumno', 'Inicio', 'Turno', 'Estado', 'JSON_INTERNO'] },
  closures: { name: 'CIERRES', headers: ['Fecha', 'Turno', 'Estado', 'Motivo', 'Cuenta', 'Timestamp', 'JSON_INTERNO'] },
  audit: { name: 'AUDITORIA', headers: ['Acción', 'Cuenta', 'Timestamp', 'Detalle', 'JSON_INTERNO'] }
};
function gymProperties_() { return PropertiesService.getScriptProperties(); }
function gymJson_(body) { return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(ContentService.MimeType.JSON); }
function gymLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(25000)) GymDomain.fail('Hay otra operación en curso. Intenta nuevamente.', 409);
  try { return fn(); } finally { lock.releaseLock(); }
}
function gymVerify_(envelope) {
  var secret = gymProperties_().getProperty('APPS_SCRIPT_SECRET');
  if (!secret || !envelope || typeof envelope.payload !== 'string' || Math.abs(Date.now() - Number(envelope.timestamp)) > 120000 || !/^[a-f0-9]{32}$/.test(envelope.nonce || '')) GymDomain.fail('Solicitud no autorizada.', 401);
  var bytes = Utilities.computeHmacSha256Signature(envelope.timestamp + '.' + envelope.nonce + '.' + envelope.payload, secret);
  var expected = bytes.map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('');
  if (expected !== envelope.signature) GymDomain.fail('Solicitud no autorizada.', 401);
  var cache = CacheService.getScriptCache();
  if (cache.get('nonce_' + envelope.nonce)) GymDomain.fail('Solicitud repetida.', 409);
  cache.put('nonce_' + envelope.nonce, '1', 240);
  return JSON.parse(envelope.payload);
}
function doGet() { return gymJson_({ ok: false, status: 405, error: 'Este endpoint solo admite solicitudes firmadas del servidor.' }); }
function doPost(e) {
  try {
    if (!e || !e.postData || e.postData.contents.length > 150000) GymDomain.fail('Solicitud inválida.');
    var result = gymLock_(function () {
      var request = gymVerify_(JSON.parse(e.postData.contents));
      return gymDispatch_(request.action, request.data || {});
    });
    return gymJson_({ ok: true, data: result });
  } catch (error) { return gymJson_({ ok: false, status: error.status || 500, error: error.status ? error.message : 'No se pudo completar la operación de Google. Revisa Ejecuciones en Apps Script.' }); }
}
function gymSheetName_(period) { return 'GIMNASIO_UNT_' + GYM_MONTHS[Number(period.slice(5)) - 1] + '_' + period.slice(0, 4); }
function gymConfig_() { return JSON.parse(gymProperties_().getProperty('GENERAL_CONFIG') || JSON.stringify(GymDomain.empty('2000-01').config)); }
function gymAccount_(user) {
  if (!['ProfesorGYM', 'Administrador'].includes(user)) GymDomain.fail('Cuenta inválida.', 401);
  var raw = gymProperties_().getProperty('ACCOUNT_' + user);
  if (!raw) GymDomain.fail('Las cuentas aún no están inicializadas.', 503);
  return JSON.parse(raw);
}
function gymActor_(data) {
  var account = gymAccount_(data.actor);
  if (account.version !== data.version) GymDomain.fail('La sesión venció. Vuelve a ingresar.', 401);
  return data.actor;
}
function gymInitialize_(data) {
  var props = gymProperties_();
  if (!props.getProperty('ACCOUNTS_READY')) {
    ['ProfesorGYM', 'Administrador'].forEach(function (user) {
      var hash = data.accounts && data.accounts[user];
      if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(hash || '')) GymDomain.fail('Faltan los hashes iniciales de las cuentas.');
    });
    ['ProfesorGYM', 'Administrador'].forEach(function (user) { props.setProperty('ACCOUNT_' + user, JSON.stringify({ hash: data.accounts[user], version: 1 })); });
    props.setProperty('ACCOUNTS_READY', '1');
  }
  // Verificar acceso a AMBAS carpetas antes de crear el operativo.
  DriveApp.getFolderById(GYM_FOLDERS.database).getName();
  DriveApp.getFolderById(GYM_FOLDERS.reports).getName();
  var period = props.getProperty('CURRENT_PERIOD') || GymDomain.lima(new Date()).period;
  gymCreateMonth_(period);
  props.setProperty('CURRENT_PERIOD', period);
  instalarActivadores();
  return { period: period, sheetUrl: SpreadsheetApp.openById(props.getProperty('MONTH_' + period)).getUrl(), enabled: gymConfig_().enabled };
}
// Ejecutar desde el editor solo despues de inicializar las cuentas mediante setup.
// Sin el catch de doPost, el editor muestra el error real y permite autorizar servicios.
function inicializarDesdeEditor() {
  var result = gymInitialize_({});
  console.log(JSON.stringify(result));
  return result;
}
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
    if (!['REGISTRADOS', 'ASISTENCIAS', 'CIERRES'].includes(table.name)) sheet.hideSheet();
  });
  ['CUPOS', 'CONFIGURACIÓN', 'DASHBOARD'].forEach(function (name) { if (!ss.getSheetByName(name)) ss.insertSheet(name); });
  gymSave_(GymDomain.empty(period, gymConfig_()), ss);
  gymEnsureDashboardCharts_(ss.getSheetByName('DASHBOARD'));
  props.setProperty('MONTH_READY_' + period, '1');
  return ss;
}
function gymRead_(ss) {
  var state = GymDomain.empty(gymProperties_().getProperty('CURRENT_PERIOD'), gymConfig_());
  Object.keys(GYM_TABLES).forEach(function (key) {
    var table = GYM_TABLES[key], sheet = ss.getSheetByName(table.name);
    if (!sheet) GymDomain.fail('Falta la hoja ' + table.name + '. No alteres la estructura operativa.', 503);
    state[key] = sheet.getLastRow() < 2 ? [] : sheet.getRange(2, table.headers.length, sheet.getLastRow() - 1, 1).getValues().filter(function (r) { return r[0]; }).map(function (r) { return JSON.parse(r[0]); });
  });
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
function gymRows_(state, key) {
  return state[key].map(function (row) {
    var student = state.students.find(function (s) { return s.code === row.code; }) || {}, base;
    if (key === 'students') {
      var slots = state.reservations.filter(function (r) { return r.code === row.code && !r.until; }).sort(function (a, b) { return a.day - b.day; });
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
  GymDomain.recalculate(state, new Date());
  var writes = Object.keys(GYM_TABLES).map(function (key) { var table = GYM_TABLES[key]; return { sheet: ss.getSheetByName(table.name), headers: table.headers, rows: gymRows_(state, key) }; });
  var slots = GymDomain.occupancy(state);
  writes.push({ sheet: ss.getSheetByName('CUPOS'), headers: ['Día', 'Inicio', 'Fin', 'Turno', 'Ocupados', 'Disponibles', 'Aforo'], rows: slots.map(function (s) { return [s.dayName, s.start, s.end, s.shift, s.occupied, s.available, state.config.capacity]; }) });
  writes.push({ sheet: ss.getSheetByName('CONFIGURACIÓN'), headers: ['Clave', 'Valor'], rows: [['Periodo', state.period], ['Zona horaria', 'America/Lima'], ['Días', state.config.days.map(function (d) { return GymDomain.DAYS[d]; }).join(', ')], ['Aforo', 20], ['Límite de faltas', 3], ['Inscripciones', state.config.enabled ? 'ABIERTAS' : 'CERRADAS'], ['Código', state.config.codePattern]] });
  var dash = GymDomain.dashboard(state, new Date(), 'TODO');
  var dashboardRows = [['Periodo', state.period, ''], ['Inscritos', dash.registered, ''], ['Asistencias', dash.attendance, ''], ['Faltas', dash.absences, ''], ['Bloqueados', dash.blocked, ''], ['Asistencia sobre sesiones finalizadas aplicables (%)', dash.attendanceRate, ''], ['', '', ''], ['Horario', 'Reservas', 'Asistencias']];
  dashboardRows = dashboardRows.concat(dash.byBlock.map(function (b) { return [b.start + '–' + b.end, b.occupied, b.attendance]; }));
  dashboardRows.push(['', '', ''], ['Día', 'Asistencias', '']);
  GymDomain.DAYS.forEach(function (name, day) { var item = dash.byDay.find(function (d) { return d.day === day; }); dashboardRows.push([name, item ? item.attendance : 0, '']); });
  dashboardRows.push(['', '', ''], ['Turno', 'Asistencias', '']);
  dashboardRows = dashboardRows.concat(dash.byShift.map(function (s) { return [s.shift, s.attendance, '']; }));
  writes.push({ sheet: ss.getSheetByName('DASHBOARD'), headers: ['Indicador', 'Valor', 'Asistencias'], rows: dashboardRows });
  gymAtomicWrite_(ss, writes);
  ss.getSheetByName('ASISTENCIAS').hideColumns(7, 4);
  SpreadsheetApp.flush();
}
function gymEnsureDashboardCharts_(sheet) {
  if (sheet.getCharts().length) return;
  sheet.insertChart(sheet.newChart().asColumnChart().addRange(sheet.getRange(9, 1, 9, 3)).setPosition(1, 5, 0, 0).setOption('title', 'Reservas y asistencia por horario').setOption('colors', ['#f5c52b', '#041d37']).build());
  sheet.insertChart(sheet.newChart().asColumnChart().addRange(sheet.getRange(19, 1, 8, 2)).setPosition(20, 5, 0, 0).setOption('title', 'Asistencia por día').setOption('colors', ['#041d37']).build());
  sheet.insertChart(sheet.newChart().asColumnChart().addRange(sheet.getRange(28, 1, 3, 2)).setPosition(39, 5, 0, 0).setOption('title', 'Comparación mañana / tarde').setOption('colors', ['#f5c52b']).build());
}
function gymAtomicWrite_(ss, writes) {
  // Una sola petición batchUpdate: Google aplica todos los cambios o ninguno.
  // Evita dejar REGISTRADOS guardado y HORARIOS sin guardar ante un fallo.
  var requests = [];
  writes.forEach(function (write) {
    var sheet = write.sheet, values = [write.headers].concat(write.rows), id = sheet.getSheetId();
    var rowCount = Math.max(sheet.getLastRow(), values.length);
    if (rowCount > sheet.getMaxRows()) requests.push({ appendDimension: { sheetId: id, dimension: 'ROWS', length: rowCount - sheet.getMaxRows() } });
    if (write.headers.length > sheet.getMaxColumns()) requests.push({ appendDimension: { sheetId: id, dimension: 'COLUMNS', length: write.headers.length - sheet.getMaxColumns() } });
    requests.push({ updateCells: { range: { sheetId: id, startRowIndex: 0, endRowIndex: rowCount, startColumnIndex: 0, endColumnIndex: write.headers.length }, rows: values.map(function (row) { return { values: row.map(function (value) { return { userEnteredValue: typeof value === 'number' ? { numberValue: value } : { stringValue: String(value == null ? '' : value) } }; }) }; }), fields: 'userEnteredValue' } });
  });
  try { Sheets.Spreadsheets.batchUpdate({ requests: requests }, ss.getId()); }
  catch (_) { GymDomain.fail('No se pudo confirmar el guardado. Revisa el registro antes de repetir la operación y verifica que Google Sheets API esté habilitada.', 502); }
}
function gymOperational_() {
  var props = gymProperties_(), period = props.getProperty('CURRENT_PERIOD');
  if (!period) GymDomain.fail('El sistema aún no se ha inicializado.', 503);
  // No exportar/rotar desde cada petición pública: el activador hace el cierre.
  if (period !== GymDomain.lima(new Date()).period) GymDomain.fail('El cierre mensual está pendiente. Revisa la automatización.', 503);
  var ss = SpreadsheetApp.openById(props.getProperty('MONTH_' + period));
  return { sheet: ss, state: gymRead_(ss) };
}
function gymDispatch_(action, data) {
  var props = gymProperties_();
  if (action === 'initialize') return gymInitialize_(data);
  if (action === 'account.get') return gymAccount_(data.user);
  if (action === 'account.change') {
    gymActor_(data);
    if (!/^scrypt\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(data.hash || '')) GymDomain.fail('Hash inválido.');
    var old = gymAccount_(data.actor);
    props.setProperty('ACCOUNT_' + data.actor, JSON.stringify({ hash: data.hash, version: old.version + 1 }));
    return { version: old.version + 1 };
  }
  var operational = gymOperational_(), state = operational.state, ss = operational.sheet, now = new Date(), result;
  if (action === 'public.config') return { period: state.period, today: GymDomain.lima(now).date, enabled: state.config.enabled, days: state.config.days, capacity: state.config.capacity, slots: GymDomain.occupancy(state) };
  if (action === 'register') result = GymDomain.register(state, data, now);
  else if (action === 'attend') result = GymDomain.attend(state, data, now);
  else {
    var actor = gymActor_(data);
    if (action === 'panel') {
      return { dashboard: GymDomain.dashboard(state, now, data.shift), students: state.students.map(function (s) { return Object.assign({}, s, { slots: state.reservations.filter(function (r) { return r.code === s.code && !r.until; }) }); }), attendance: state.attendance, absences: state.absences, closures: state.closures, config: state.config, sheetUrl: ss.getUrl() };
    }
    if (action === 'closure') result = GymDomain.closure(state, data, actor, now);
    else if (action === 'schedule') result = GymDomain.changeSchedule(state, data, actor, now);
    else if (action === 'configure') result = GymDomain.configure(state, data, actor, now);
    else if (action === 'export') return gymExport_(state, data.shift || 'TODO', Boolean(data.archive), false);
    else GymDomain.fail('Operación desconocida.', 404);
  }
  GymDomain.recalculate(state, now); gymSave_(state, ss);
  if (action === 'configure') props.setProperty('GENERAL_CONFIG', JSON.stringify(state.config));
  return result;
}
function gymSubfolder_(parent, name) { var list = parent.getFoldersByName(name); return list.hasNext() ? list.next() : parent.createFolder(name); }
function gymReportFolder_(period) {
  var root = DriveApp.getFolderById(GYM_FOLDERS.reports);
  // La carpeta entregada se llama ARCHIVO 2026; ese año no se anida de nuevo.
  var year = period.slice(0, 4), yearFolder = root.getName() === 'ARCHIVO ' + year ? root : gymSubfolder_(root, year);
  return gymSubfolder_(yearFolder, GYM_MONTHS[Number(period.slice(5)) - 1]);
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
      gymWriteRows_(sheet, table.headers.slice(0, -1), gymRows_(filtered, key).map(function (r) { return r.slice(0, -1); }));
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
    if (archive) file = gymReportFolder_(state.period).createFile(blob);
    if (finalReport) return { fileId: file.getId(), driveUrl: file.getUrl(), filename: blob.getName() };
    if (blob.getBytes().length > 2800000) {
      if (file) return { driveUrl: file.getUrl(), filename: blob.getName(), large: true };
      GymDomain.fail('El Excel supera el tamaño de descarga de esta API. Usa «Guardar copia en Drive» y descárgalo desde allí.', 413);
    }
    return { filename: blob.getName(), base64: Utilities.base64Encode(blob.getBytes()), driveUrl: file ? file.getUrl() : null };
  } finally { DriveApp.getFileById(temp.getId()).setTrashed(true); }
}
function instalarActivadores() {
  // Idempotente: no borra activadores ajenos al sistema.
  var handlers = ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); });
  if (!handlers.includes('procesarFaltas')) ScriptApp.newTrigger('procesarFaltas').timeBased().everyMinutes(15).create();
  if (!handlers.includes('procesarCambioMensual')) ScriptApp.newTrigger('procesarCambioMensual').timeBased().everyHours(1).create();
}
function procesarFaltas() {
  return gymLock_(function () {
    if (!gymProperties_().getProperty('CURRENT_PERIOD')) return;
    if (gymProperties_().getProperty('CURRENT_PERIOD') !== GymDomain.lima(new Date()).period) return;
    var o = gymOperational_(); GymDomain.recalculate(o.state, new Date()); gymSave_(o.state, o.sheet);
  });
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
      var report = gymExport_(state, 'TODO', true, true);
      props.setProperty('ARCHIVED_' + current, report.fileId);
    }
    var next = GymDomain.nextPeriod(current); gymCreateMonth_(next);
    props.setProperty('CURRENT_PERIOD', next);
    props.deleteProperty('LAST_ROLLOVER_ERROR');
    return { closed: current, opened: next };
  });
}
