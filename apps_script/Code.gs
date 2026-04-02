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
    const action = (e && e.parameter && e.parameter.action) || 'getAll';

    if (action === 'ping') {
      return jsonResponse({ success: true, message: 'API erreichbar' });
    }

    if (action === 'getAll') {
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
    const action = body.action;
    const payload = body.payload || {};

    if (action === 'addIncome') {
      appendObject_(SHEETS.INCOME, payload, ['id','date','month_key','income_type','amount','note','created_at','updated_at','created_by','updated_by','owner_user']);
      return jsonResponse({ success: true });
    }

    if (action === 'addTransaction') {
      payload.module = 'Haushalt';
      appendObject_(SHEETS.TRANSACTIONS, payload, ['id','date','month_key','module','title','main_category','sub_category','amount','paid_by','assigned_to','split_type','split_max','split_other','other_person','payment_type','status','note','created_at','updated_at','created_by','updated_by','owner_user']);
      return jsonResponse({ success: true });
    }

    if (action === 'addTrip') {
      payload.trip_id = payload.trip_id || makeId_('TRIP');
      payload.days = calculateDays_(payload.start_date, payload.end_date);
      appendObject_(SHEETS.TRIPS, payload, ['trip_id','title','destination','description','start_date','end_date','days','planned_budget','status','travel_with','note','created_at','updated_at','created_by','updated_by','owner_user']);
      return jsonResponse({ success: true });
    }

    if (action === 'addTripExpense') {
      appendObject_(SHEETS.TRIP_EXPENSES, payload, ['id','trip_id','date','month_key','title','main_category','sub_category','amount','paid_by','assigned_to','split_type','split_max','split_other','other_person','status','note','created_at','updated_at','created_by','updated_by','owner_user']);
      return jsonResponse({ success: true });
    }

    if (action === 'addCategory') {
      appendObject_(SHEETS.CATEGORIES, payload, ['id','module','main_category','sub_category','is_default','active','sort_order','created_at','updated_at','created_by','updated_by','owner_user']);
      return jsonResponse({ success: true });
    }

    if (action === 'addFixedCost') {
      appendObject_(SHEETS.FIXED_COSTS, payload, ['id','title','main_category','sub_category','amount','frequency','start_month','end_month','paid_by','assigned_to','split_type','split_max','split_other','other_person','active','note','created_at','updated_at','created_by','updated_by','owner_user']);
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
  const headers = values[0];
  return values.slice(1).filter((row) => row.some((cell) => cell !== '')).map((row) => {
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = row[index];
    });
    return obj;
  });
}

function appendObject_(sheetName, payload, fieldOrder) {
  const sheet = getSpreadsheet_().getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet fehlt: ' + sheetName);

  const obj = Object.assign({}, payload);
  obj.id = obj.id || makeId_('ROW');
  obj.created_at = obj.created_at || new Date();
  obj.updated_at = new Date();
  if (obj.date && !obj.month_key) obj.month_key = String(obj.date).slice(0, 7);
  if (obj.other_person == null || obj.other_person === '') obj.other_person = OTHER_PERSON;

  const row = fieldOrder.map((field) => obj[field] != null ? obj[field] : '');
  sheet.appendRow(row);
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
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
