const API_VERSION = 'v3-2026-04-03-header-safe';

const USER_NAME = 'Hofer Maximilian';
const OTHER_PERSON = 'Jana March';

const SHEETS = {
  INCOME: 'Income',
  TRANSACTIONS: 'Household_Transactions',
  TRIPS: 'Trips',
  TRIP_EXPENSES: 'Trip_Expenses',
  CATEGORIES: 'Categories',
  FIXED_COSTS: 'Fixed_Costs'
};

const SCHEMAS = {
  [SHEETS.INCOME]: [
    'id','date','month_key','income_type','amount','note',
    'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
  ],
  [SHEETS.TRANSACTIONS]: [
    'id','date','month_key','module','title','main_category','sub_category','amount',
    'paid_by','split_percent','payment_type','status','note',
    'created_at','updated_at','created_by','updated_by','owner_user','visible_to_other','is_deleted'
  ],
  [SHEETS.TRIPS]: [
    'trip_id','title','destination','description','start_date','end_date','days',
    'planned_budget','status','travel_with','note',
    'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
  ],
  [SHEETS.TRIP_EXPENSES]: [
    'id','trip_id','date','month_key','title','main_category','sub_category','amount',
    'paid_by','split_percent','status','note',
    'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
  ],
  [SHEETS.CATEGORIES]: [
    'id','module','main_category','sub_category','visible_to_other',
    'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
  ],
  [SHEETS.FIXED_COSTS]: [
    'id','title','main_category','sub_category','amount','frequency','start_month','end_month',
    'paid_by','split_percent','visible_to_other','note',
    'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
  ]
};

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'getAll').toLowerCase();

    if (action === 'ping') {
      return jsonResponse({
        success: true,
        message: 'API erreichbar',
        version: API_VERSION
      });
    }

    if (action === 'getall') {
      return jsonResponse({
        success: true,
        version: API_VERSION,
        data: {
          income: readSheetObjects_(SHEETS.INCOME),
          transactions: readSheetObjects_(SHEETS.TRANSACTIONS),
          trips: readSheetObjects_(SHEETS.TRIPS),
          tripExpenses: readSheetObjects_(SHEETS.TRIP_EXPENSES),
          categories: readSheetObjects_(SHEETS.CATEGORIES),
          fixedCosts: readSheetObjects_(SHEETS.FIXED_COSTS)
        }
      });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '').toLowerCase();
    const payload = body.payload || {};

    if (action === 'addincome') {
      appendObjectByHeaders_(SHEETS.INCOME, normalizeIncomePayload_(payload));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'addtransaction') {
      appendObjectByHeaders_(SHEETS.TRANSACTIONS, normalizeTransactionPayload_(payload));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'addtrip') {
      appendObjectByHeaders_(SHEETS.TRIPS, normalizeTripPayload_(payload));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'addtripexpense') {
      appendObjectByHeaders_(SHEETS.TRIP_EXPENSES, normalizeTripExpensePayload_(payload));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'addcategory') {
      appendObjectByHeaders_(SHEETS.CATEGORIES, normalizeCategoryPayload_(payload));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'addfixedcost') {
      appendObjectByHeaders_(SHEETS.FIXED_COSTS, normalizeFixedCostPayload_(payload));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'updateincome') {
      updateObjectById_(SHEETS.INCOME, 'id', payload.id, normalizeIncomePayload_(payload, true));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'updatetransaction') {
      updateObjectById_(SHEETS.TRANSACTIONS, 'id', payload.id, normalizeTransactionPayload_(payload, true));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'updatetrip') {
      updateObjectById_(SHEETS.TRIPS, 'trip_id', payload.trip_id, normalizeTripPayload_(payload, true));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'updatetripexpense') {
      updateObjectById_(SHEETS.TRIP_EXPENSES, 'id', payload.id, normalizeTripExpensePayload_(payload, true));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'updatecategory') {
      updateObjectById_(SHEETS.CATEGORIES, 'id', payload.id, normalizeCategoryPayload_(payload, true));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'updatefixedcost') {
      updateObjectById_(SHEETS.FIXED_COSTS, 'id', payload.id, normalizeFixedCostPayload_(payload, true));
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'deleteincome') {
      softDeleteById_(SHEETS.INCOME, 'id', payload.id);
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'deletetransaction') {
      softDeleteById_(SHEETS.TRANSACTIONS, 'id', payload.id);
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'deletetrip') {
      softDeleteById_(SHEETS.TRIPS, 'trip_id', payload.trip_id);
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'deletetripexpense') {
      softDeleteById_(SHEETS.TRIP_EXPENSES, 'id', payload.id);
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'deletecategory') {
      softDeleteById_(SHEETS.CATEGORIES, 'id', payload.id);
      return jsonResponse({ success: true, version: API_VERSION });
    }

    if (action === 'deletefixedcost') {
      softDeleteById_(SHEETS.FIXED_COSTS, 'id', payload.id);
      return jsonResponse({ success: true, version: API_VERSION });
    }

    return jsonResponse({ success: false, error: 'Unknown action: ' + action });
  } catch (err) {
    return jsonResponse({ success: false, error: String(err) });
  }
}

function getSpreadsheet_() {
  const bound = SpreadsheetApp.getActiveSpreadsheet();
  if (bound) return bound;

  const propertyId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (propertyId) return SpreadsheetApp.openById(propertyId);

  throw new Error('Kein gebundenes Spreadsheet gefunden. Bitte dieses Apps-Script direkt über Erweiterungen > Apps Script im Ziel-Sheet öffnen und deployen.');
}

function readSheetObjects_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  const headers = sanitizeHeaders_(values[0]);

  return values
    .slice(1)
    .filter((row) => row.some((cell) => cell !== ''))
    .map((row) => {
      const obj = {};
      headers.forEach((header, index) => {
        if (!header) return;
        obj[header] = row[index];
      });
      return obj;
    });
}

function appendObjectByHeaders_(sheetName, payload) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const headers = sanitizeHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  const row = headers.map((header) => {
    if (!header) return '';
    return payload[header] != null ? payload[header] : '';
  });

  sheet.appendRow(row);
}

function updateObjectById_(sheetName, idField, idValue, payload) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Keine Daten in Sheet: ' + sheetName);

  const headers = sanitizeHeaders_(values[0]);
  const idCol = headers.indexOf(idField);
  if (idCol === -1) throw new Error('ID-Feld fehlt: ' + idField);

  const rowIndex = values.findIndex((row, idx) => idx > 0 && String(row[idCol]) === String(idValue));
  if (rowIndex === -1) throw new Error('Datensatz nicht gefunden: ' + idValue);

  headers.forEach((header, colIndex) => {
    if (!header) return;
    if (payload[header] !== undefined) {
      sheet.getRange(rowIndex + 1, colIndex + 1).setValue(payload[header]);
    }
  });

  const updatedAtCol = headers.indexOf('updated_at');
  if (updatedAtCol !== -1) {
    sheet.getRange(rowIndex + 1, updatedAtCol + 1).setValue(new Date());
  }
}

function softDeleteById_(sheetName, idField, idValue) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Keine Daten in Sheet: ' + sheetName);

  const headers = sanitizeHeaders_(values[0]);
  const idCol = headers.indexOf(idField);
  const deletedCol = headers.indexOf('is_deleted');
  const updatedAtCol = headers.indexOf('updated_at');

  if (idCol === -1) throw new Error('ID-Feld fehlt: ' + idField);
  if (deletedCol === -1) throw new Error('Spalte is_deleted fehlt in ' + sheetName);

  const rowIndex = values.findIndex((row, idx) => idx > 0 && String(row[idCol]) === String(idValue));
  if (rowIndex === -1) throw new Error('Datensatz nicht gefunden: ' + idValue);

  sheet.getRange(rowIndex + 1, deletedCol + 1).setValue('ja');

  if (updatedAtCol !== -1) {
    sheet.getRange(rowIndex + 1, updatedAtCol + 1).setValue(new Date());
  }
}

function sanitizeHeaders_(rawHeaders) {
  return rawHeaders.map((h) => (h == null ? '' : String(h).trim()));
}

function ensureSchema_(sheetName) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const actual = sanitizeHeaders_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]).filter(Boolean);
  const expected = SCHEMAS[sheetName] || [];

  const missing = expected.filter((h) => !actual.includes(h));
  if (missing.length) {
    throw new Error('Fehlende Header in ' + sheetName + ': ' + missing.join(', '));
  }
}

function normalizeIncomePayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  if (!isUpdate) {
    obj.id = obj.id || makeId_('ROW');
    obj.created_at = obj.created_at || now;
  }

  obj.updated_at = now;
  if (obj.date && !obj.month_key) obj.month_key = normalizeMonthKey_(obj.date);
  if (obj.is_deleted == null) obj.is_deleted = '';
  return obj;
}

function normalizeTransactionPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  obj.module = 'Haushalt';

  if (!isUpdate) {
    obj.id = obj.id || makeId_('ROW');
    obj.created_at = obj.created_at || now;
  }

  obj.updated_at = now;
  if (obj.date && !obj.month_key) obj.month_key = normalizeMonthKey_(obj.date);

  if (obj.split_percent == null || obj.split_percent === '') obj.split_percent = '50';
  if (obj.visible_to_other == null || obj.visible_to_other === '') obj.visible_to_other = 'ja';
  if (obj.payment_type == null) obj.payment_type = '';
  if (obj.status == null) obj.status = '';
  if (obj.note == null) obj.note = '';
  if (obj.is_deleted == null) obj.is_deleted = '';

  return obj;
}

function normalizeTripPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  if (!isUpdate) {
    obj.trip_id = obj.trip_id || makeId_('TRIP');
    obj.created_at = obj.created_at || now;
  }

  obj.updated_at = now;
  obj.days = calculateDays_(obj.start_date, obj.end_date);
  if (obj.note == null) obj.note = '';
  if (obj.is_deleted == null) obj.is_deleted = '';

  return obj;
}

function normalizeTripExpensePayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  if (!isUpdate) {
    obj.id = obj.id || makeId_('ROW');
    obj.created_at = obj.created_at || now;
  }

  obj.updated_at = now;
  if (obj.date && !obj.month_key) obj.month_key = normalizeMonthKey_(obj.date);
  if (obj.split_percent == null || obj.split_percent === '') obj.split_percent = '50';
  if (obj.status == null) obj.status = '';
  if (obj.note == null) obj.note = '';
  if (obj.is_deleted == null) obj.is_deleted = '';

  return obj;
}

function normalizeCategoryPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  if (!isUpdate) {
    obj.id = obj.id || makeId_('CAT');
    obj.created_at = obj.created_at || now;
  }

  obj.updated_at = now;
  if (obj.visible_to_other == null || obj.visible_to_other === '') obj.visible_to_other = 'nein';
  if (obj.is_deleted == null) obj.is_deleted = '';

  return obj;
}

function normalizeFixedCostPayload_(payload, isUpdate) {
  const obj = Object.assign({}, payload);
  const now = new Date();

  if (!isUpdate) {
    obj.id = obj.id || makeId_('ROW');
    obj.created_at = obj.created_at || now;
  }

  obj.updated_at = now;
  if (obj.split_percent == null || obj.split_percent === '') obj.split_percent = '50';
  if (obj.visible_to_other == null || obj.visible_to_other === '') obj.visible_to_other = 'nein';
  if (obj.note == null) obj.note = '';
  if (obj.is_deleted == null) obj.is_deleted = '';

  return obj;
}

function normalizeMonthKey_(value) {
  const s = String(value || '');
  return s.slice(0, 7);
}

function calculateDays_(startDate, endDate) {
  if (!startDate || !endDate) return '';
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
}

function makeId_(prefix) {
  return prefix + '_' + new Date().getTime();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
