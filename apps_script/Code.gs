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

function doGet(e) {
  try {
    const action = String((e && e.parameter && e.parameter.action) || 'getAll').toLowerCase();

    if (action === 'ping') {
      return jsonResponse({ success: true, message: 'API erreichbar' });
    }

    if (action === 'getall') {
      return jsonResponse({
        success: true,
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
      appendObject_(SHEETS.INCOME, payload, [
        'id','date','month_key','income_type','amount','note',
        'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'addingtransaction' || action === 'addtransaction') {
      payload.module = 'Haushalt';
      appendObject_(SHEETS.TRANSACTIONS, payload, [
        'id','date','month_key','module','title','main_category','sub_category','amount',
        'paid_by','split_percent','payment_type','status','note',
        'created_at','updated_at','created_by','updated_by','owner_user','visible_to_other','is_deleted'
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'addtrip') {
      payload.trip_id = payload.trip_id || makeId_('TRIP');
      payload.days = calculateDays_(payload.start_date, payload.end_date);
      appendObject_(SHEETS.TRIPS, payload, [
        'trip_id','title','destination','description','start_date','end_date','days',
        'planned_budget','status','travel_with','note',
        'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'addtripexpense') {
      appendObject_(SHEETS.TRIP_EXPENSES, payload, [
        'id','trip_id','date','month_key','title','main_category','sub_category','amount',
        'paid_by','split_percent','status','note',
        'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'addcategory') {
      appendObject_(SHEETS.CATEGORIES, payload, [
        'id','module','main_category','sub_category','visible_to_other',
        'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'addfixedcost') {
      appendObject_(SHEETS.FIXED_COSTS, payload, [
        'id','title','main_category','sub_category','amount','frequency','start_month','end_month',
        'paid_by','split_percent','visible_to_other','note',
        'created_at','updated_at','created_by','updated_by','owner_user','is_deleted'
      ]);
      return jsonResponse({ success: true });
    }

    if (action === 'updateincome') {
      updateObjectById_(SHEETS.INCOME, 'id', payload.id, payload);
      return jsonResponse({ success: true });
    }

    if (action === 'updatetransaction') {
      updateObjectById_(SHEETS.TRANSACTIONS, 'id', payload.id, payload);
      return jsonResponse({ success: true });
    }

    if (action === 'updatetrip') {
      updateObjectById_(SHEETS.TRIPS, 'trip_id', payload.trip_id, payload);
      return jsonResponse({ success: true });
    }

    if (action === 'updatetripexpense') {
      updateObjectById_(SHEETS.TRIP_EXPENSES, 'id', payload.id, payload);
      return jsonResponse({ success: true });
    }

    if (action === 'updatecategory') {
      updateObjectById_(SHEETS.CATEGORIES, 'id', payload.id, payload);
      return jsonResponse({ success: true });
    }

    if (action === 'updatefixedcost') {
      updateObjectById_(SHEETS.FIXED_COSTS, 'id', payload.id, payload);
      return jsonResponse({ success: true });
    }

    if (action === 'deleteincome') {
      softDeleteById_(SHEETS.INCOME, 'id', payload.id);
      return jsonResponse({ success: true });
    }

    if (action === 'deletetransaction') {
      softDeleteById_(SHEETS.TRANSACTIONS, 'id', payload.id);
      return jsonResponse({ success: true });
    }

    if (action === 'deletetrip') {
      softDeleteById_(SHEETS.TRIPS, 'trip_id', payload.trip_id);
      return jsonResponse({ success: true });
    }

    if (action === 'deletetripexpense') {
      softDeleteById_(SHEETS.TRIP_EXPENSES, 'id', payload.id);
      return jsonResponse({ success: true });
    }

    if (action === 'deletecategory') {
      softDeleteById_(SHEETS.CATEGORIES, 'id', payload.id);
      return jsonResponse({ success: true });
    }

    if (action === 'deletefixedcost') {
      softDeleteById_(SHEETS.FIXED_COSTS, 'id', payload.id);
      return jsonResponse({ success: true });
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

  const rawHeaders = values[0];
  const headers = rawHeaders.map((h) => (h == null ? '' : String(h).trim()));

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

function appendObject_(sheetName, payload, fieldOrder) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const obj = Object.assign({}, payload);

  if (!obj.id && fieldOrder.includes('id')) {
    obj.id = makeId_('ROW');
  }
  if (!obj.trip_id && fieldOrder.includes('trip_id')) {
    obj.trip_id = makeId_('TRIP');
  }

  obj.created_at = obj.created_at || new Date();
  obj.updated_at = new Date();

  if (obj.date && !obj.month_key) {
    obj.month_key = String(obj.date).slice(0, 7);
  }

  if (obj.visible_to_other == null || obj.visible_to_other === '') {
    obj.visible_to_other = 'nein';
  }

  if (obj.is_deleted == null || obj.is_deleted === '') {
    obj.is_deleted = '';
  }

  const row = fieldOrder.map((field) => obj[field] != null ? obj[field] : '');
  sheet.appendRow(row);
}

function updateObjectById_(sheetName, idField, idValue, payload) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const values = sheet.getDataRange().getValues();
  if (values.length < 2) throw new Error('Keine Daten in Sheet: ' + sheetName);

  const headers = values[0].map((h) => (h == null ? '' : String(h).trim()));
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

  const headers = values[0].map((h) => (h == null ? '' : String(h).trim()));
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
