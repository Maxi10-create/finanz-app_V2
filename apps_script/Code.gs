const API_VERSION = 'v7-2026-07-17-household-tasks-calendar';

const PERSON_A = 'Maximilian Hofer';
const PERSON_B = 'Jana March';
const ASSIGNED_BOTH = 'beide';

const SHEETS = {
  INCOME: 'Income',
  TRANSACTIONS: 'Household_Transactions',
  TRIPS: 'Trips',
  TRIP_EXPENSES: 'Trip_Expenses',
  CATEGORIES: 'Categories',
  FIXED_COSTS: 'Fixed_Costs',
  TASKS: 'Household_Tasks'
};

const SCHEMAS = {
  [SHEETS.INCOME]: [
    'id', 'date', 'month_key', 'income_type', 'amount', 'note',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'owner_user', 'is_deleted'
  ],

  [SHEETS.TRANSACTIONS]: [
    'id', 'date', 'month_key', 'module', 'booking_type', 'counterparty',
    'title', 'main_category', 'sub_category', 'amount', 'paid_by',
    'split_enabled', 'split_percent', 'payment_type', 'status', 'note',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'owner_user',
    'visible_to_other', 'is_deleted'
  ],

  [SHEETS.TRIPS]: [
    'trip_id', 'title', 'destination', 'description', 'start_date', 'end_date',
    'days', 'planned_budget', 'status', 'travel_with', 'note',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'owner_user', 'is_deleted'
  ],

  [SHEETS.TRIP_EXPENSES]: [
    'id', 'trip_id', 'date', 'month_key', 'title', 'main_category',
    'sub_category', 'amount', 'paid_by', 'split_enabled', 'split_percent',
    'status', 'note', 'created_at', 'updated_at', 'created_by', 'updated_by',
    'owner_user', 'is_deleted'
  ],

  [SHEETS.CATEGORIES]: [
    'id', 'module', 'main_category', 'sub_category', 'visible_to_other',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'owner_user', 'is_deleted'
  ],

  [SHEETS.FIXED_COSTS]: [
    'id', 'title', 'main_category', 'sub_category', 'amount', 'frequency',
    'start_month', 'end_month', 'paid_by', 'split_enabled', 'split_percent',
    'visible_to_other', 'note', 'created_at', 'updated_at', 'created_by',
    'updated_by', 'owner_user', 'is_deleted'
  ],

  [SHEETS.TASKS]: [
    'id', 'title', 'description', 'assigned_to', 'recurrence_type',
    'recurrence_interval', 'weekdays', 'day_of_month', 'start_date', 'end_date',
    'due_time', 'status', 'note', 'calendar_sync', 'reminder_minutes',
    'calendar_id', 'calendar_event_id', 'calendar_event_type',
    'calendar_sync_last_at', 'calendar_sync_error',
    'created_at', 'updated_at', 'created_by', 'updated_by', 'owner_user', 'is_deleted'
  ]
};

const DATE_FIELDS = {
  date: true,
  start_date: true,
  end_date: true
};

const MONTH_FIELDS = {
  month_key: true,
  start_month: true,
  end_month: true
};

const TIMESTAMP_FIELDS = {
  created_at: true,
  updated_at: true,
  calendar_sync_last_at: true
};

const TIME_FIELDS = {
  due_time: true
};

const VALID_WEEKDAY_CODES = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

const WEEKDAY_ENUMS = {
  MO: CalendarApp.Weekday.MONDAY,
  TU: CalendarApp.Weekday.TUESDAY,
  WE: CalendarApp.Weekday.WEDNESDAY,
  TH: CalendarApp.Weekday.THURSDAY,
  FR: CalendarApp.Weekday.FRIDAY,
  SA: CalendarApp.Weekday.SATURDAY,
  SU: CalendarApp.Weekday.SUNDAY
};

/* ========================================================================== */
/* WEB APP                                                                    */
/* ========================================================================== */

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'getAll').toLowerCase();

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'API erreichbar',
        version: API_VERSION,
        time: new Date().toISOString()
      });
    }

    if (action === 'getall') {
      return jsonResponse({
        success: true,
        version: API_VERSION,
        data: getAllData_()
      });
    }

    return jsonResponse({
      success: false,
      version: API_VERSION,
      error: 'Unknown action: ' + action
    });
  } catch (err) {
    return errorResponse_(err);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').toLowerCase();
    const payload = body.payload || {};

    return withScriptLock_(function () {
      let result;

      switch (action) {
        case 'addincome':
          result = addIncome_(payload);
          break;
        case 'updateincome':
          result = updateIncome_(payload);
          break;
        case 'deleteincome':
          result = deleteStandardRecord_(SHEETS.INCOME, 'id', payload.id);
          break;

        case 'addtransaction':
          result = addTransaction_(payload);
          break;
        case 'updatetransaction':
          result = updateTransaction_(payload);
          break;
        case 'deletetransaction':
          result = deleteStandardRecord_(SHEETS.TRANSACTIONS, 'id', payload.id);
          break;

        case 'addtrip':
          result = addTrip_(payload);
          break;
        case 'updatetrip':
          result = updateTrip_(payload);
          break;
        case 'deletetrip':
          result = deleteStandardRecord_(SHEETS.TRIPS, 'trip_id', payload.trip_id);
          break;

        case 'addtripexpense':
          result = addTripExpense_(payload);
          break;
        case 'updatetripexpense':
          result = updateTripExpense_(payload);
          break;
        case 'deletetripexpense':
          result = deleteStandardRecord_(SHEETS.TRIP_EXPENSES, 'id', payload.id);
          break;

        case 'addcategory':
          result = addCategory_(payload);
          break;
        case 'updatecategory':
          result = updateCategory_(payload);
          break;
        case 'deletecategory':
          result = deleteStandardRecord_(SHEETS.CATEGORIES, 'id', payload.id);
          break;

        case 'addfixedcost':
          result = addFixedCost_(payload);
          break;
        case 'updatefixedcost':
          result = updateFixedCost_(payload);
          break;
        case 'deletefixedcost':
          result = deleteStandardRecord_(SHEETS.FIXED_COSTS, 'id', payload.id);
          break;

        case 'addtask':
          result = addTask_(payload);
          break;
        case 'updatetask':
          result = updateTask_(payload);
          break;
        case 'deletetask':
          result = deleteTask_(payload.id);
          break;

        default:
          return jsonResponse({
            success: false,
            version: API_VERSION,
            error: 'Unknown action: ' + action
          });
      }

      return jsonResponse(Object.assign({
        success: true,
        version: API_VERSION
      }, result || {}));
    });
  } catch (err) {
    return errorResponse_(err);
  }
}

function getAllData_() {
  return {
    income: readSheetObjects_(SHEETS.INCOME),
    transactions: readSheetObjects_(SHEETS.TRANSACTIONS),
    trips: readSheetObjects_(SHEETS.TRIPS),
    tripExpenses: readSheetObjects_(SHEETS.TRIP_EXPENSES),
    categories: readSheetObjects_(SHEETS.CATEGORIES),
    fixedCosts: readSheetObjects_(SHEETS.FIXED_COSTS),
    tasks: readSheetObjects_(SHEETS.TASKS)
  };
}

/* ========================================================================== */
/* SETUP                                                                      */
/* ========================================================================== */

/**
 * Einmal manuell im Apps-Script-Editor ausführen.
 * Erstellt fehlende Sheets, ergänzt fehlende Header und legt den Kalender an.
 */
function setupProject() {
  const spreadsheet = getSpreadsheet_();

  Object.keys(SCHEMAS).forEach(function (sheetName) {
    ensureSchema_(sheetName);
  });

  const calendar = getHouseholdCalendar_();

  Logger.log(JSON.stringify({
    success: true,
    spreadsheetId: spreadsheet.getId(),
    spreadsheetName: spreadsheet.getName(),
    calendarId: calendar.getId(),
    calendarName: calendar.getName(),
    version: API_VERSION
  }, null, 2));
}

/**
 * Kann manuell ausgeführt werden, um die Kalenderberechtigung zu testen.
 */
function testCalendarConnection() {
  const calendar = getHouseholdCalendar_();
  Logger.log('Kalender erreichbar: ' + calendar.getName() + ' (' + calendar.getId() + ')');
}

/* ========================================================================== */
/* CRUD: INCOME                                                               */
/* ========================================================================== */

function addIncome_(payload) {
  const record = normalizeIncomePayload_(payload, false);
  record.id = makeUniqueId_(SHEETS.INCOME, 'id', 'ROW');
  appendByHeaders_(SHEETS.INCOME, record);
  return { record: serializeObject_(record, SHEETS.INCOME) };
}

function updateIncome_(payload) {
  return updateStandardRecord_(
    SHEETS.INCOME,
    'id',
    payload.id,
    payload,
    normalizeIncomePayload_
  );
}

/* ========================================================================== */
/* CRUD: TRANSACTIONS                                                         */
/* ========================================================================== */

function addTransaction_(payload) {
  const record = normalizeTransactionPayload_(payload, false);
  record.id = makeUniqueId_(SHEETS.TRANSACTIONS, 'id', 'ROW');
  appendByHeaders_(SHEETS.TRANSACTIONS, record);
  return { record: serializeObject_(record, SHEETS.TRANSACTIONS) };
}

function updateTransaction_(payload) {
  return updateStandardRecord_(
    SHEETS.TRANSACTIONS,
    'id',
    payload.id,
    payload,
    normalizeTransactionPayload_
  );
}

/* ========================================================================== */
/* CRUD: TRIPS                                                                */
/* ========================================================================== */

function addTrip_(payload) {
  const record = normalizeTripPayload_(payload, false);
  record.trip_id = makeUniqueId_(SHEETS.TRIPS, 'trip_id', 'TRIP');
  appendByHeaders_(SHEETS.TRIPS, record);
  return { record: serializeObject_(record, SHEETS.TRIPS) };
}

function updateTrip_(payload) {
  return updateStandardRecord_(
    SHEETS.TRIPS,
    'trip_id',
    payload.trip_id,
    payload,
    normalizeTripPayload_
  );
}

/* ========================================================================== */
/* CRUD: TRIP EXPENSES                                                        */
/* ========================================================================== */

function addTripExpense_(payload) {
  const record = normalizeTripExpensePayload_(payload, false);
  record.id = makeUniqueId_(SHEETS.TRIP_EXPENSES, 'id', 'ROW');
  appendByHeaders_(SHEETS.TRIP_EXPENSES, record);
  return { record: serializeObject_(record, SHEETS.TRIP_EXPENSES) };
}

function updateTripExpense_(payload) {
  return updateStandardRecord_(
    SHEETS.TRIP_EXPENSES,
    'id',
    payload.id,
    payload,
    normalizeTripExpensePayload_
  );
}

/* ========================================================================== */
/* CRUD: CATEGORIES                                                           */
/* ========================================================================== */

function addCategory_(payload) {
  const record = normalizeCategoryPayload_(payload, false);
  record.id = makeUniqueId_(SHEETS.CATEGORIES, 'id', 'CAT');
  appendByHeaders_(SHEETS.CATEGORIES, record);
  return { record: serializeObject_(record, SHEETS.CATEGORIES) };
}

function updateCategory_(payload) {
  return updateStandardRecord_(
    SHEETS.CATEGORIES,
    'id',
    payload.id,
    payload,
    normalizeCategoryPayload_
  );
}

/* ========================================================================== */
/* CRUD: FIXED COSTS                                                          */
/* ========================================================================== */

function addFixedCost_(payload) {
  const record = normalizeFixedCostPayload_(payload, false);
  record.id = makeUniqueId_(SHEETS.FIXED_COSTS, 'id', 'ROW');
  appendByHeaders_(SHEETS.FIXED_COSTS, record);
  return { record: serializeObject_(record, SHEETS.FIXED_COSTS) };
}

function updateFixedCost_(payload) {
  return updateStandardRecord_(
    SHEETS.FIXED_COSTS,
    'id',
    payload.id,
    payload,
    normalizeFixedCostPayload_
  );
}

/* ========================================================================== */
/* CRUD: HOUSEHOLD TASKS                                                      */
/* ========================================================================== */

function addTask_(payload) {
  const record = normalizeTaskPayload_(payload, false);
  record.id = makeUniqueId_(SHEETS.TASKS, 'id', 'TASK');

  appendByHeaders_(SHEETS.TASKS, record);

  const calendarResult = syncTaskCalendarSafely_(record, null);
  const finalRecord = Object.assign({}, record, calendarResult.patch);

  if (Object.keys(calendarResult.patch).length) {
    updateObjectById_(SHEETS.TASKS, 'id', record.id, calendarResult.patch);
  }

  return {
    record: serializeObject_(finalRecord, SHEETS.TASKS),
    warning: calendarResult.warning || ''
  };
}

function updateTask_(payload) {
  assertRequiredId_(payload.id, 'Task-ID');

  const existing = getObjectById_(SHEETS.TASKS, 'id', payload.id);
  const merged = Object.assign({}, existing, payload, {
    id: existing.id,
    created_at: existing.created_at,
    created_by: existing.created_by,
    owner_user: existing.owner_user
  });
  const record = normalizeTaskPayload_(merged, true);

  updateObjectById_(SHEETS.TASKS, 'id', existing.id, record);

  const calendarResult = syncTaskCalendarSafely_(record, existing);
  const finalRecord = Object.assign({}, record, calendarResult.patch);

  if (Object.keys(calendarResult.patch).length) {
    updateObjectById_(SHEETS.TASKS, 'id', existing.id, calendarResult.patch);
  }

  return {
    record: serializeObject_(finalRecord, SHEETS.TASKS),
    warning: calendarResult.warning || ''
  };
}

function deleteTask_(idValue) {
  assertRequiredId_(idValue, 'Task-ID');

  const existing = getObjectById_(SHEETS.TASKS, 'id', idValue);
  const calendarResult = deleteTaskCalendarSafely_(existing);

  softDeleteById_(SHEETS.TASKS, 'id', idValue);

  return {
    deletedId: String(idValue),
    warning: calendarResult.warning || ''
  };
}

/* ========================================================================== */
/* GENERIC CRUD                                                               */
/* ========================================================================== */

function updateStandardRecord_(sheetName, idField, idValue, payload, normalizer) {
  assertRequiredId_(idValue, idField);

  const existing = getObjectById_(sheetName, idField, idValue);
  const merged = Object.assign({}, existing, payload);
  merged[idField] = existing[idField];
  merged.created_at = existing.created_at;
  merged.created_by = existing.created_by;
  merged.owner_user = existing.owner_user;

  const record = normalizer(merged, true);
  record[idField] = existing[idField];

  updateObjectById_(sheetName, idField, idValue, record);

  return {
    record: serializeObject_(record, sheetName)
  };
}

function deleteStandardRecord_(sheetName, idField, idValue) {
  assertRequiredId_(idValue, idField);
  softDeleteById_(sheetName, idField, idValue);

  return {
    deletedId: String(idValue)
  };
}

/* ========================================================================== */
/* NORMALIZATION                                                              */
/* ========================================================================== */

function normalizeIncomePayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.date = normalizeDateString_(obj.date);
  obj.month_key = obj.date ? normalizeMonthKey_(obj.date) : normalizeMonthKey_(obj.month_key);
  obj.income_type = String(obj.income_type || 'Verschiedenes').trim();
  obj.amount = toNumber_(obj.amount);
  obj.note = String(obj.note || '');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  assertRequired_(obj.date, 'Datum');
  assertNonNegativeNumber_(obj.amount, 'Betrag');

  return obj;
}

function normalizeTransactionPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.module = 'Haushalt';
  obj.date = normalizeDateString_(obj.date);
  obj.month_key = obj.date ? normalizeMonthKey_(obj.date) : normalizeMonthKey_(obj.month_key);
  obj.booking_type = String(obj.booking_type || 'expense').toLowerCase();
  obj.counterparty = normalizeCounterparty_(obj.counterparty);
  obj.title = String(obj.title || '').trim();
  obj.main_category = String(obj.main_category || '').trim();
  obj.sub_category = String(obj.sub_category || '').trim();
  obj.amount = toNumber_(obj.amount);
  obj.paid_by = normalizePersonName_(obj.paid_by || obj.owner_user);
  obj.split_enabled = normalizeYesNo_(obj.split_enabled, 'nein');
  obj.split_percent = clampPercent_(obj.split_percent, 100);
  obj.payment_type = String(obj.payment_type || '');
  obj.status = String(obj.status || 'bezahlt');
  obj.note = String(obj.note || '');
  obj.visible_to_other = normalizeYesNo_(obj.visible_to_other, 'ja');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  if (obj.booking_type === 'settlement') {
    obj.main_category = 'Verrechnung';
    obj.sub_category = 'Saldoausgleich';
    obj.split_enabled = 'nein';
    obj.split_percent = 100;
    obj.visible_to_other = 'ja';

    if (!obj.counterparty || obj.counterparty === '-') {
      obj.counterparty = obj.owner_user === PERSON_A ? PERSON_B : PERSON_A;
    }
  } else {
    obj.booking_type = 'expense';
    obj.counterparty = '-';
  }

  assertRequired_(obj.date, 'Datum');
  assertRequired_(obj.title, 'Beschreibung');
  assertNonNegativeNumber_(obj.amount, 'Betrag');
  assertKnownPerson_(obj.paid_by, 'Bezahlt von');

  return obj;
}

function normalizeTripPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.title = String(obj.title || '').trim();
  obj.destination = String(obj.destination || '').trim();
  obj.description = String(obj.description || '');
  obj.start_date = normalizeDateString_(obj.start_date);
  obj.end_date = normalizeDateString_(obj.end_date);
  obj.days = calculateDays_(obj.start_date, obj.end_date);
  obj.planned_budget = toNumber_(obj.planned_budget);
  obj.status = String(obj.status || 'Idee');
  obj.travel_with = normalizeTravelWith_(obj.travel_with);
  obj.note = String(obj.note || '');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  assertRequired_(obj.title, 'Titel');
  assertRequired_(obj.destination, 'Destination');
  assertRequired_(obj.start_date, 'Startdatum');
  assertRequired_(obj.end_date, 'Enddatum');
  assertDateRange_(obj.start_date, obj.end_date, 'Reisezeitraum');

  if (obj.planned_budget < 0) {
    throw new Error('Geplantes Budget darf nicht negativ sein.');
  }

  return obj;
}

function normalizeTripExpensePayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.trip_id = String(obj.trip_id || '').trim();
  obj.date = normalizeDateString_(obj.date);
  obj.month_key = obj.date ? normalizeMonthKey_(obj.date) : normalizeMonthKey_(obj.month_key);
  obj.title = String(obj.title || '').trim();
  obj.main_category = String(obj.main_category || '').trim();
  obj.sub_category = String(obj.sub_category || '').trim();
  obj.amount = toNumber_(obj.amount);
  obj.paid_by = normalizePersonName_(obj.paid_by || obj.owner_user);
  obj.split_enabled = normalizeYesNo_(obj.split_enabled, 'nein');
  obj.split_percent = clampPercent_(obj.split_percent, 100);
  obj.status = String(obj.status || 'bezahlt');
  obj.note = String(obj.note || '');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  assertRequired_(obj.trip_id, 'Reise');
  assertRequired_(obj.date, 'Datum');
  assertRequired_(obj.title, 'Beschreibung');
  assertNonNegativeNumber_(obj.amount, 'Betrag');
  assertKnownPerson_(obj.paid_by, 'Bezahlt von');

  if (!recordExists_(SHEETS.TRIPS, 'trip_id', obj.trip_id)) {
    throw new Error('Die ausgewählte Reise existiert nicht: ' + obj.trip_id);
  }

  return obj;
}

function normalizeCategoryPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.module = String(obj.module || 'Haushalt').trim();
  obj.main_category = String(obj.main_category || '').trim();
  obj.sub_category = String(obj.sub_category || '').trim();
  obj.visible_to_other = normalizeYesNo_(obj.visible_to_other, 'nein');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  assertRequired_(obj.main_category, 'Hauptkategorie');
  assertRequired_(obj.sub_category, 'Unterkategorie');

  return obj;
}

function normalizeFixedCostPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.title = String(obj.title || '').trim();
  obj.main_category = String(obj.main_category || '').trim();
  obj.sub_category = String(obj.sub_category || '').trim();
  obj.amount = toNumber_(obj.amount);
  obj.frequency = String(obj.frequency || 'monatlich').trim();
  obj.start_month = normalizeMonthKey_(obj.start_month);
  obj.end_month = normalizeMonthKey_(obj.end_month);
  obj.paid_by = normalizePersonName_(obj.paid_by || obj.owner_user);
  obj.split_enabled = normalizeYesNo_(obj.split_enabled, 'nein');
  obj.split_percent = clampPercent_(obj.split_percent, 100);
  obj.visible_to_other = normalizeYesNo_(obj.visible_to_other, 'nein');
  obj.note = String(obj.note || '');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  assertRequired_(obj.title, 'Titel');
  assertNonNegativeNumber_(obj.amount, 'Betrag');
  assertKnownPerson_(obj.paid_by, 'Bezahlt von');

  if (obj.start_month && obj.end_month && obj.end_month < obj.start_month) {
    throw new Error('Endmonat darf nicht vor dem Startmonat liegen.');
  }

  return obj;
}

function normalizeTaskPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  normalizeAuditFields_(obj, isUpdate, now);

  obj.title = String(obj.title || '').trim();
  obj.description = String(obj.description || '');
  obj.assigned_to = normalizeAssignedTo_(obj.assigned_to);
  obj.recurrence_type = normalizeRecurrenceType_(obj.recurrence_type);
  obj.recurrence_interval = Math.max(1, Math.floor(toNumber_(obj.recurrence_interval) || 1));
  obj.weekdays = normalizeWeekdays_(obj.weekdays);
  obj.day_of_month = normalizeDayOfMonth_(obj.day_of_month);
  obj.start_date = normalizeDateString_(obj.start_date);
  obj.end_date = normalizeDateString_(obj.end_date);
  obj.due_time = normalizeTimeString_(obj.due_time || getScriptProperty_('HOUSEHOLD_DEFAULT_TASK_TIME', '18:00'));
  obj.status = String(obj.status || 'active').toLowerCase() === 'inactive' ? 'inactive' : 'active';
  obj.note = String(obj.note || '');
  obj.calendar_sync = normalizeYesNo_(obj.calendar_sync, 'ja');
  obj.reminder_minutes = normalizeReminderMinutes_(obj.reminder_minutes);
  obj.calendar_id = String(obj.calendar_id || '');
  obj.calendar_event_id = String(obj.calendar_event_id || '');
  obj.calendar_event_type = String(obj.calendar_event_type || '');
  obj.calendar_sync_error = String(obj.calendar_sync_error || '');
  obj.is_deleted = normalizeYesNo_(obj.is_deleted, '');

  assertRequired_(obj.title, 'Aufgabentitel');
  assertRequired_(obj.start_date, 'Startdatum');
  assertDateRange_(obj.start_date, obj.end_date, 'Aufgabenzeitraum');

  if (obj.recurrence_type === 'weekly' && !obj.weekdays) {
    obj.weekdays = weekdayCodeForDate_(parseLocalDate_(obj.start_date));
  }

  if (obj.recurrence_type === 'monthly' && !obj.day_of_month) {
    obj.day_of_month = parseLocalDate_(obj.start_date).getDate();
  }

  if (obj.recurrence_type !== 'weekly') {
    obj.weekdays = '';
  }

  if (obj.recurrence_type !== 'monthly') {
    obj.day_of_month = '';
  }

  return obj;
}

function normalizeAuditFields_(obj, isUpdate, now) {
  const owner = normalizePersonName_(obj.owner_user || obj.created_by || obj.updated_by || PERSON_A);

  obj.owner_user = isKnownPerson_(owner) ? owner : PERSON_A;
  obj.created_by = normalizePersonName_(obj.created_by || obj.owner_user);
  obj.updated_by = normalizePersonName_(obj.updated_by || obj.owner_user);

  if (!isUpdate) {
    obj.created_at = normalizeTimestampValue_(obj.created_at) || now;
  }

  obj.updated_at = now;
}

/* ========================================================================== */
/* SHEET ACCESS                                                               */
/* ========================================================================== */

function getSpreadsheet_() {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;

  const propertyId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (propertyId) return SpreadsheetApp.openById(propertyId);

  throw new Error(
    'Kein gebundenes Spreadsheet gefunden. Bitte Apps Script direkt im Ziel-Sheet öffnen ' +
    'oder die Script Property SPREADSHEET_ID setzen.'
  );
}

/**
 * Ergänzt nur fehlende Header. Vorhandene Spalten werden nicht verschoben oder überschrieben.
 */
function ensureSchema_(sheetName) {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  const schema = SCHEMAS[sheetName];
  if (!schema) throw new Error('Kein Schema definiert für: ' + sheetName);

  const lastColumn = sheet.getLastColumn();

  if (lastColumn === 0) {
    sheet.getRange(1, 1, 1, schema.length).setValues([schema]);
    styleHeader_(sheet, schema.length);
    return {
      sheet: sheet,
      headers: schema.slice()
    };
  }

  let headers = sanitizeHeaders_(sheet.getRange(1, 1, 1, lastColumn).getValues()[0]);
  assertNoDuplicateHeaders_(sheetName, headers);

  const missing = schema.filter(function (field) {
    return headers.indexOf(field) === -1;
  });

  if (missing.length) {
    const startColumn = headers.length + 1;
    sheet.getRange(1, startColumn, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
    styleHeader_(sheet, headers.length);
  }

  return {
    sheet: sheet,
    headers: headers
  };
}

function styleHeader_(sheet, columnCount) {
  if (!columnCount) return;

  sheet.getRange(1, 1, 1, columnCount)
    .setFontWeight('bold')
    .setBackground('#1f3a63')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);
}

function readSheetObjects_(sheetName) {
  const schemaInfo = ensureSchema_(sheetName);
  const sheet = schemaInfo.sheet;
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) return [];

  const headers = sanitizeHeaders_(values[0]);
  const timeZone = getSpreadsheetTimeZone_();

  return values
    .slice(1)
    .filter(function (row) {
      return row.some(function (cell) {
        return cell !== '' && cell !== null;
      });
    })
    .map(function (row) {
      const obj = {};

      headers.forEach(function (header, index) {
        if (!header) return;
        obj[header] = serializeCell_(header, row[index], timeZone);
      });

      return obj;
    });
}

function appendByHeaders_(sheetName, payload) {
  const schemaInfo = ensureSchema_(sheetName);
  const sheet = schemaInfo.sheet;
  const headers = schemaInfo.headers;

  const row = headers.map(function (field) {
    return payload[field] !== undefined && payload[field] !== null ? payload[field] : '';
  });

  const rowNumber = Math.max(sheet.getLastRow() + 1, 2);
  sheet.getRange(rowNumber, 1, 1, row.length).setValues([row]);

  return {
    spreadsheetId: sheet.getParent().getId(),
    spreadsheetName: sheet.getParent().getName(),
    sheetName: sheet.getName(),
    rowWritten: rowNumber
  };
}

function updateObjectById_(sheetName, idField, idValue, payload) {
  const location = findUniqueRowById_(sheetName, idField, idValue);
  const sheet = location.sheet;
  const headers = location.headers;
  const rowNumber = location.rowNumber;

  const currentValues = sheet.getRange(rowNumber, 1, 1, headers.length).getValues()[0];
  const nextValues = currentValues.slice();

  headers.forEach(function (header, columnIndex) {
    if (!header) return;
    if (payload[header] !== undefined) {
      nextValues[columnIndex] = payload[header];
    }
  });

  const updatedAtIndex = headers.indexOf('updated_at');
  if (updatedAtIndex !== -1) {
    nextValues[updatedAtIndex] = new Date();
  }

  sheet.getRange(rowNumber, 1, 1, headers.length).setValues([nextValues]);
}

function softDeleteById_(sheetName, idField, idValue) {
  const location = findUniqueRowById_(sheetName, idField, idValue);
  const sheet = location.sheet;
  const headers = location.headers;
  const rowNumber = location.rowNumber;

  const deletedIndex = headers.indexOf('is_deleted');
  const updatedAtIndex = headers.indexOf('updated_at');

  if (deletedIndex === -1) {
    throw new Error('Spalte is_deleted fehlt in ' + sheetName);
  }

  sheet.getRange(rowNumber, deletedIndex + 1).setValue('ja');

  if (updatedAtIndex !== -1) {
    sheet.getRange(rowNumber, updatedAtIndex + 1).setValue(new Date());
  }
}

function getObjectById_(sheetName, idField, idValue) {
  const location = findUniqueRowById_(sheetName, idField, idValue);
  const row = location.sheet
    .getRange(location.rowNumber, 1, 1, location.headers.length)
    .getValues()[0];

  const timeZone = getSpreadsheetTimeZone_();
  const obj = {};

  location.headers.forEach(function (header, index) {
    if (!header) return;
    obj[header] = serializeCell_(header, row[index], timeZone);
  });

  return obj;
}

function findUniqueRowById_(sheetName, idField, idValue) {
  assertRequiredId_(idValue, idField);

  const schemaInfo = ensureSchema_(sheetName);
  const sheet = schemaInfo.sheet;
  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    throw new Error('Keine Daten in Sheet: ' + sheetName);
  }

  const headers = sanitizeHeaders_(values[0]);
  const idColumn = headers.indexOf(idField);

  if (idColumn === -1) {
    throw new Error('ID-Feld fehlt: ' + idField + ' in ' + sheetName);
  }

  const matches = [];

  for (let rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
    if (String(values[rowIndex][idColumn]) === String(idValue)) {
      matches.push(rowIndex + 1);
    }
  }

  if (!matches.length) {
    throw new Error('Datensatz nicht gefunden: ' + idValue + ' in ' + sheetName);
  }

  if (matches.length > 1) {
    throw new Error(
      'ID ist nicht eindeutig: ' + idValue + ' in ' + sheetName +
      '. Betroffene Zeilen: ' + matches.join(', ')
    );
  }

  return {
    sheet: sheet,
    headers: headers,
    rowNumber: matches[0]
  };
}

function recordExists_(sheetName, idField, idValue) {
  if (!idValue) return false;

  const schemaInfo = ensureSchema_(sheetName);
  const values = schemaInfo.sheet.getDataRange().getValues();
  if (values.length < 2) return false;

  const headers = sanitizeHeaders_(values[0]);
  const idColumn = headers.indexOf(idField);
  if (idColumn === -1) return false;

  return values.slice(1).some(function (row) {
    return String(row[idColumn]) === String(idValue);
  });
}

/* ========================================================================== */
/* GOOGLE CALENDAR SYNC                                                       */
/* ========================================================================== */

function syncTaskCalendarSafely_(task, previousTask) {
  try {
    return {
      patch: syncTaskCalendar_(task, previousTask),
      warning: ''
    };
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    Logger.log('Kalender-Synchronisierung fehlgeschlagen: ' + message);

    return {
      patch: {
        calendar_sync_last_at: new Date(),
        calendar_sync_error: message
      },
      warning: 'Aufgabe wurde gespeichert, Kalender-Synchronisierung ist jedoch fehlgeschlagen: ' + message
    };
  }
}

function deleteTaskCalendarSafely_(task) {
  try {
    deleteCalendarItemForTask_(task);
    return { warning: '' };
  } catch (err) {
    const message = String(err && err.message ? err.message : err);
    Logger.log('Kalendertermin konnte nicht gelöscht werden: ' + message);

    return {
      warning: 'Aufgabe wurde gelöscht, der Kalendertermin konnte jedoch nicht entfernt werden: ' + message
    };
  }
}

function syncTaskCalendar_(task, previousTask) {
  if (previousTask) {
    deleteCalendarItemForTask_(previousTask);
  } else if (task.calendar_event_id) {
    deleteCalendarItemForTask_(task);
  }

  if (!isCalendarSyncEnabled_() || task.calendar_sync !== 'ja' || task.status !== 'active' || task.is_deleted === 'ja') {
    return {
      calendar_id: '',
      calendar_event_id: '',
      calendar_event_type: '',
      calendar_sync_last_at: new Date(),
      calendar_sync_error: ''
    };
  }

  const calendar = getHouseholdCalendar_();
  const startDate = firstTaskOccurrenceDate_(task);
  const endDate = task.end_date ? parseLocalDate_(task.end_date) : null;

  if (endDate && startDate > endDate) {
    throw new Error('Für diese Aufgabe liegt kein Termin innerhalb des gewählten Zeitraums.');
  }

  const startTime = combineDateAndTime_(startDate, task.due_time);
  const durationMinutes = Math.max(
    5,
    Math.floor(toNumber_(getScriptProperty_('HOUSEHOLD_TASK_DURATION_MINUTES', '30')) || 30)
  );
  const endTime = new Date(startTime.getTime() + durationMinutes * 60000);
  const options = buildCalendarEventOptions_(task);

  let calendarItem;
  let eventType;

  if (task.recurrence_type === 'none') {
    calendarItem = calendar.createEvent(task.title, startTime, endTime, options);
    eventType = 'single';
  } else {
    const recurrence = buildTaskRecurrence_(task, endDate);
    calendarItem = calendar.createEventSeries(task.title, startTime, endTime, recurrence, options);
    eventType = 'series';
  }

  calendarItem.removeAllReminders();
  calendarItem.addPopupReminder(normalizeReminderMinutes_(task.reminder_minutes));

  if (typeof calendarItem.setTag === 'function') {
    calendarItem.setTag('household_task_id', task.id);
    calendarItem.setTag('assigned_to', task.assigned_to);
  }

  return {
    calendar_id: calendar.getId(),
    calendar_event_id: calendarItem.getId(),
    calendar_event_type: eventType,
    calendar_sync_last_at: new Date(),
    calendar_sync_error: ''
  };
}

function deleteCalendarItemForTask_(task) {
  if (!task || !task.calendar_event_id) return;

  const calendar = task.calendar_id
    ? CalendarApp.getCalendarById(task.calendar_id)
    : getHouseholdCalendar_();

  if (!calendar) return;

  if (String(task.calendar_event_type || '') === 'series') {
    const series = calendar.getEventSeriesById(task.calendar_event_id);
    if (series) series.deleteEventSeries();
    return;
  }

  const event = calendar.getEventById(task.calendar_event_id);
  if (event) event.deleteEvent();
}

function getHouseholdCalendar_() {
  const properties = PropertiesService.getScriptProperties();
  const configuredId = properties.getProperty('HOUSEHOLD_CALENDAR_ID');

  if (configuredId) {
    const configuredCalendar = CalendarApp.getCalendarById(configuredId);
    if (configuredCalendar) return configuredCalendar;
  }

  const calendarName = getScriptProperty_('HOUSEHOLD_CALENDAR_NAME', 'Haushaltsplan');
  const matches = CalendarApp.getCalendarsByName(calendarName);
  let calendar = matches && matches.length ? matches[0] : null;

  if (!calendar) {
    calendar = CalendarApp.createCalendar(calendarName);
    calendar.setDescription('Automatisch synchronisierte Aufgaben aus dem Finanz- und Haushaltsdashboard.');
  }

  properties.setProperty('HOUSEHOLD_CALENDAR_ID', calendar.getId());
  return calendar;
}

function buildCalendarEventOptions_(task) {
  const guests = getTaskGuestEmails_(task.assigned_to);
  const descriptionParts = [
    'Haushaltsaufgabe',
    'Zuständig: ' + assignedToLabel_(task.assigned_to),
    'Task-ID: ' + task.id
  ];

  if (task.description) descriptionParts.push('', task.description);
  if (task.note) descriptionParts.push('', 'Notiz: ' + task.note);

  const options = {
    description: descriptionParts.join('\n')
  };

  if (guests.length) {
    options.guests = guests.join(',');
    options.sendInvites = normalizeBoolean_(
      getScriptProperty_('HOUSEHOLD_SEND_INVITES', 'true'),
      true
    );
  }

  return options;
}

function getTaskGuestEmails_(assignedTo) {
  const maxEmail = String(getScriptProperty_('MAXIMILIAN_EMAIL', '') || '').trim();
  const janaEmail = String(getScriptProperty_('JANA_EMAIL', '') || '').trim();
  let emails = [];

  if (assignedTo === PERSON_A) {
    emails = [maxEmail];
  } else if (assignedTo === PERSON_B) {
    emails = [janaEmail];
  } else {
    emails = [maxEmail, janaEmail];
  }

  const unique = {};

  return emails.filter(function (email) {
    if (!email || email.indexOf('@') === -1) return false;
    const key = email.toLowerCase();
    if (unique[key]) return false;
    unique[key] = true;
    return true;
  });
}

function buildTaskRecurrence_(task, endDate) {
  let recurrence = CalendarApp.newRecurrence().setTimeZone(getAppTimeZone_());
  const interval = Math.max(1, Number(task.recurrence_interval || 1));
  let rule;

  if (task.recurrence_type === 'daily') {
    rule = recurrence.addDailyRule().interval(interval);
  } else if (task.recurrence_type === 'weekly') {
    const weekdays = normalizeWeekdaysArray_(task.weekdays).map(function (code) {
      return WEEKDAY_ENUMS[code];
    });

    rule = recurrence
      .addWeeklyRule()
      .onlyOnWeekdays(weekdays)
      .interval(interval);
  } else if (task.recurrence_type === 'monthly') {
    rule = recurrence
      .addMonthlyRule()
      .onlyOnMonthDay(Number(task.day_of_month))
      .interval(interval);
  } else {
    throw new Error('Nicht unterstützte Wiederholung: ' + task.recurrence_type);
  }

  if (endDate) {
    const untilDate = addDays_(endDate, 1);
    rule = rule.until(untilDate);
  }

  return rule;
}

function firstTaskOccurrenceDate_(task) {
  const startDate = parseLocalDate_(task.start_date);

  if (task.recurrence_type === 'weekly') {
    const weekdays = normalizeWeekdaysArray_(task.weekdays);

    for (let offset = 0; offset < 7; offset += 1) {
      const candidate = addDays_(startDate, offset);
      if (weekdays.indexOf(weekdayCodeForDate_(candidate)) !== -1) {
        return candidate;
      }
    }
  }

  if (task.recurrence_type === 'monthly') {
    const wantedDay = Number(task.day_of_month || startDate.getDate());
    let year = startDate.getFullYear();
    let month = startDate.getMonth();
    let candidate = validDateInMonth_(year, month, wantedDay);

    if (!candidate || candidate < startDate) {
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
      candidate = validDateInMonth_(year, month, wantedDay);
    }

    if (!candidate) {
      throw new Error('Der gewählte Monatstag existiert im ersten Wiederholungsmonat nicht.');
    }

    return candidate;
  }

  return startDate;
}

function validDateInMonth_(year, monthIndex, day) {
  const date = new Date(year, monthIndex, day);
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return date;
}

function combineDateAndTime_(date, timeValue) {
  const time = normalizeTimeString_(timeValue || '18:00');
  const parts = time.split(':').map(Number);

  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    parts[0] || 0,
    parts[1] || 0,
    0,
    0
  );
}

function isCalendarSyncEnabled_() {
  return normalizeBoolean_(getScriptProperty_('CALENDAR_SYNC_ENABLED', 'true'), true);
}

/* ========================================================================== */
/* SERIALIZATION                                                              */
/* ========================================================================== */

function serializeObject_(obj, sheetName) {
  const result = {};
  const timeZone = getSpreadsheetTimeZone_();
  const headers = SCHEMAS[sheetName] || Object.keys(obj || {});

  headers.forEach(function (field) {
    if (obj[field] === undefined) return;
    result[field] = serializeCell_(field, obj[field], timeZone);
  });

  return result;
}

function serializeCell_(field, value, timeZone) {
  if (value === null || value === undefined || value === '') return '';

  if (value instanceof Date) {
    if (DATE_FIELDS[field]) {
      return Utilities.formatDate(value, timeZone, 'yyyy-MM-dd');
    }

    if (MONTH_FIELDS[field]) {
      return Utilities.formatDate(value, timeZone, 'yyyy-MM');
    }

    if (TIME_FIELDS[field]) {
      return Utilities.formatDate(value, timeZone, 'HH:mm');
    }

    if (TIMESTAMP_FIELDS[field]) {
      return value.toISOString();
    }

    return value.toISOString();
  }

  if (DATE_FIELDS[field]) return normalizeDateString_(value);
  if (MONTH_FIELDS[field]) return normalizeMonthKey_(value);
  if (TIME_FIELDS[field]) return normalizeTimeString_(value);

  return value;
}

/* ========================================================================== */
/* ID MANAGEMENT                                                              */
/* ========================================================================== */

function makeUniqueId_(sheetName, idField, prefix) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const id = makeId_(prefix);
    if (!recordExists_(sheetName, idField, id)) return id;
  }

  throw new Error('Es konnte keine eindeutige ID erzeugt werden.');
}

function makeId_(prefix) {
  return prefix + '_' + Utilities.getUuid().replace(/-/g, '');
}

/* ========================================================================== */
/* VALIDATION AND NORMALIZATION HELPERS                                       */
/* ========================================================================== */

function sanitizeHeaders_(rawHeaders) {
  return rawHeaders.map(function (header) {
    return header == null ? '' : String(header).trim();
  });
}

function assertNoDuplicateHeaders_(sheetName, headers) {
  const seen = {};
  const duplicates = [];

  headers.forEach(function (header) {
    if (!header) return;
    if (seen[header]) duplicates.push(header);
    seen[header] = true;
  });

  if (duplicates.length) {
    throw new Error(
      'Doppelte Header in ' + sheetName + ': ' +
      Array.from(new Set(duplicates)).join(', ')
    );
  }
}

function normalizePersonName_(name) {
  const raw = String(name || '').trim();
  const lower = raw.toLowerCase();

  if (lower === 'maximilian hofer' || lower === 'hofer maximilian' || lower === 'macimilian hofer') {
    return PERSON_A;
  }

  if (lower === 'jana march') {
    return PERSON_B;
  }

  return raw;
}

function normalizeCounterparty_(value) {
  const raw = String(value || '-').trim();
  if (!raw || raw === '-') return '-';
  return normalizePersonName_(raw);
}

function normalizeTravelWith_(value) {
  const raw = String(value || 'allein').trim();
  const person = normalizePersonName_(raw);

  if (person === PERSON_A || person === PERSON_B) return person;

  const lower = raw.toLowerCase();
  if (lower === 'gemeinsam') return 'gemeinsam';
  if (lower === 'sonstige' || lower === 'sonstiges') return 'sonstige';
  return 'allein';
}

function normalizeAssignedTo_(value) {
  const raw = String(value || ASSIGNED_BOTH).trim();
  const person = normalizePersonName_(raw);

  if (person === PERSON_A || person === PERSON_B) return person;
  return ASSIGNED_BOTH;
}

function assignedToLabel_(value) {
  if (value === PERSON_A || value === PERSON_B) return value;
  return 'Beide';
}

function isKnownPerson_(value) {
  return value === PERSON_A || value === PERSON_B;
}

function assertKnownPerson_(value, label) {
  if (!isKnownPerson_(value)) {
    throw new Error((label || 'Nutzer') + ' muss ' + PERSON_A + ' oder ' + PERSON_B + ' sein.');
  }
}

function normalizeYesNo_(value, fallback) {
  if (value === true) return 'ja';
  if (value === false) return 'nein';

  const lower = String(value == null ? '' : value).trim().toLowerCase();

  if (['ja', 'yes', 'true', '1'].indexOf(lower) !== -1) return 'ja';
  if (['nein', 'no', 'false', '0'].indexOf(lower) !== -1) return 'nein';

  return fallback;
}

function normalizeBoolean_(value, fallback) {
  if (value === true || value === false) return value;

  const lower = String(value == null ? '' : value).trim().toLowerCase();
  if (['ja', 'yes', 'true', '1'].indexOf(lower) !== -1) return true;
  if (['nein', 'no', 'false', '0'].indexOf(lower) !== -1) return false;

  return fallback;
}

function normalizeRecurrenceType_(value) {
  const type = String(value || 'none').trim().toLowerCase();
  if (['none', 'daily', 'weekly', 'monthly'].indexOf(type) !== -1) return type;
  return 'none';
}

function normalizeWeekdays_(value) {
  return normalizeWeekdaysArray_(value).join(',');
}

function normalizeWeekdaysArray_(value) {
  let values;

  if (Array.isArray(value)) {
    values = value;
  } else {
    values = String(value || '').split(',');
  }

  const seen = {};

  return values
    .map(function (entry) {
      return String(entry || '').trim().toUpperCase();
    })
    .filter(function (code) {
      if (VALID_WEEKDAY_CODES.indexOf(code) === -1) return false;
      if (seen[code]) return false;
      seen[code] = true;
      return true;
    });
}

function normalizeDayOfMonth_(value) {
  if (value === '' || value === null || value === undefined) return '';
  const day = Math.floor(toNumber_(value));
  if (day < 1 || day > 31) {
    throw new Error('Tag im Monat muss zwischen 1 und 31 liegen.');
  }
  return day;
}

function normalizeReminderMinutes_(value) {
  const fallback = Math.floor(toNumber_(getScriptProperty_('HOUSEHOLD_REMINDER_MINUTES', '120')) || 120);
  const minutes = Math.floor(toNumber_(value) || fallback);
  return Math.min(40320, Math.max(5, minutes));
}

function normalizeDateString_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, getAppTimeZone_(), 'yyyy-MM-dd');
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (!match) return '';

  const normalized = match[1] + '-' + match[2] + '-' + match[3];
  const parsed = parseLocalDate_(normalized);

  if (!parsed) return '';
  return normalized;
}

function normalizeMonthKey_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, getAppTimeZone_(), 'yyyy-MM');
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})/);
  return match ? match[1] + '-' + match[2] : '';
}

function normalizeTimeString_(value) {
  if (!value) return '';

  if (value instanceof Date) {
    return Utilities.formatDate(value, getAppTimeZone_(), 'HH:mm');
  }

  const raw = String(value).trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})/);

  if (!match) return '';

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return '';

  return String(hours).padStart(2, '0') + ':' + String(minutes).padStart(2, '0');
}

function normalizeTimestampValue_(value) {
  if (!value) return '';
  if (value instanceof Date) return value;

  const date = new Date(value);
  return isNaN(date.getTime()) ? '' : date;
}

function parseLocalDate_(value) {
  const normalized = String(value || '').slice(0, 10);
  const parts = normalized.split('-').map(Number);

  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new Error('Ungültiges Datum: ' + value);
  }

  const date = new Date(parts[0], parts[1] - 1, parts[2]);

  if (
    date.getFullYear() !== parts[0] ||
    date.getMonth() !== parts[1] - 1 ||
    date.getDate() !== parts[2]
  ) {
    throw new Error('Ungültiges Datum: ' + value);
  }

  return date;
}

function calculateDays_(startDate, endDate) {
  if (!startDate || !endDate) return '';

  const startParts = String(startDate).slice(0, 10).split('-').map(Number);
  const endParts = String(endDate).slice(0, 10).split('-').map(Number);

  const start = Date.UTC(startParts[0], startParts[1] - 1, startParts[2]);
  const end = Date.UTC(endParts[0], endParts[1] - 1, endParts[2]);

  return Math.floor((end - start) / 86400000) + 1;
}

function assertDateRange_(startDate, endDate, label) {
  if (!startDate || !endDate) return;
  if (endDate < startDate) {
    throw new Error((label || 'Zeitraum') + ': Enddatum darf nicht vor dem Startdatum liegen.');
  }
}

function weekdayCodeForDate_(date) {
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][date.getDay()];
}

function addDays_(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function toNumber_(value) {
  if (typeof value === 'number') {
    return isFinite(value) ? value : 0;
  }

  const raw = String(value == null ? '' : value).trim().replace(/\s/g, '');
  if (!raw) return 0;

  let normalized = raw;

  if (raw.indexOf(',') !== -1 && raw.indexOf('.') !== -1) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  } else if (raw.indexOf(',') !== -1) {
    normalized = raw.replace(',', '.');
  }

  const number = Number(normalized);
  return isFinite(number) ? number : 0;
}

function clampPercent_(value, fallback) {
  const number = value === '' || value === null || value === undefined
    ? fallback
    : toNumber_(value);

  return Math.max(0, Math.min(100, number));
}

function assertRequired_(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new Error((label || 'Pflichtfeld') + ' fehlt.');
  }
}

function assertRequiredId_(value, label) {
  if (value === '' || value === null || value === undefined) {
    throw new Error((label || 'ID') + ' fehlt.');
  }
}

function assertNonNegativeNumber_(value, label) {
  if (typeof value !== 'number' || !isFinite(value)) {
    throw new Error((label || 'Wert') + ' ist keine gültige Zahl.');
  }

  if (value < 0) {
    throw new Error((label || 'Wert') + ' darf nicht negativ sein.');
  }
}

/* ========================================================================== */
/* GENERAL HELPERS                                                            */
/* ========================================================================== */

function withScriptLock_(callback) {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function getScriptProperty_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value === null || value === undefined || value === '' ? fallback : value;
}

function getSpreadsheetTimeZone_() {
  try {
    return getSpreadsheet_().getSpreadsheetTimeZone() || getAppTimeZone_();
  } catch (err) {
    return getAppTimeZone_();
  }
}

function getAppTimeZone_() {
  return Session.getScriptTimeZone() || 'Europe/Vienna';
}

function errorResponse_(err) {
  const message = String(err && err.message ? err.message : err);
  const stack = err && err.stack ? String(err.stack) : '';

  console.error(message);
  if (stack) console.error(stack);

  return jsonResponse({
    success: false,
    version: API_VERSION,
    error: message
  });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
