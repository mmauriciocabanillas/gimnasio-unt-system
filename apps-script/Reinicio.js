/* Uso manual desde el editor, DESPUÉS de borrar el operativo anterior en Drive.
 * No borra archivos ni registros existentes, no cambia cuentas ni activadores.
 * No se expone como acción de la aplicación web. */
function prepararInicioLimpioDesdeEditor() {
  return gymLock_(function () {
    var props = gymProperties_(), period = GymDomain.lima(new Date()).period;
    gymAccount_('ProfesorGYM'); gymAccount_('Administrador');
    if (!props.getProperty('APPS_SCRIPT_SECRET')) GymDomain.fail('Falta la clave de conexión.', 503);
    DriveApp.getFolderById(GYM_FOLDERS.database).getName();
    DriveApp.getFolderById(GYM_FOLDERS.reports).getName();
    var key = 'MONTH_' + period, id = props.getProperty(key), file, ss;
    if (id) {
      try { file = Drive.Files.get(id, { fields: 'id,trashed,mimeType,parents' }); }
      catch (error) {
        // No interpretar errores de permisos, cuotas o red como una eliminación.
        if (Number(error.status || error.code) !== 404 && !/File not found:/i.test(String(error.message))) throw error;
      }
      if (file && !file.trashed) {
        if (file.mimeType !== 'application/vnd.google-apps.spreadsheet' || !file.parents || !file.parents.includes(GYM_FOLDERS.database)) GymDomain.fail('El operativo no pertenece a la carpeta de base de datos. No se modificó.', 409);
        ss = SpreadsheetApp.openById(id);
        Object.keys(GYM_TABLES).forEach(function (name) {
          var tab = ss.getSheetByName(GYM_TABLES[name].name);
          if (tab && tab.getLastRow() > 1) GymDomain.fail('El operativo todavía contiene registros. Bórralo de Drive antes de preparar el inicio limpio.', 409);
        });
      }
    }
    if (!ss) props.deleteProperty(key);
    props.deleteProperty('MONTH_READY_' + period);
    var config = gymConfig_();
    config.enabled = true; config.capacity = 20; config.maxAbsences = 3; config.codePattern = '^[0-9]{10}$';
    props.setProperty('GENERAL_CONFIG', JSON.stringify(config));
    if (ss) ['CUPOS', 'CONFIGURACIÓN', 'DASHBOARD'].forEach(function (name) {
      var tab = ss.getSheetByName(name); if (tab) tab.clearContents();
    });
    // Guardado inmediato del ID: un reintento reutiliza el mismo libro.
    ss = gymCreateMonth_(period);
    props.setProperty('CURRENT_PERIOD', period);
    Object.keys(props.getProperties()).forEach(function (name) {
      if (/^QA_MONTHLY_/.test(name) || /^RATE_V1_/.test(name) || name === 'LAST_ROLLOVER_ERROR' || /^(ARCHIVED_|ARCHIVE_PENDING_ID_)\d{4}-\d{2}$/.test(name) || /^MONTH_(READY_)?\d{4}-\d{2}$/.test(name) && name !== key && name !== 'MONTH_READY_' + period) props.deleteProperty(name);
    });
    var result = { ok: true, period: period, sheetUrl: ss.getUrl(), students: 0, attendance: 0, absences: 0, closures: 0, enabled: true, accountsUnchanged: true };
    console.log(JSON.stringify(result));
    return result;
  });
}
