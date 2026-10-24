/* ========================================================================== */
/* HAUSBAU                                                                    */
/*                                                                            */
/* Private module for the house project of Maximilian and Ingrid Harder.      */
/* - only the owner's session (and the read-only backend token) gets the data */
/* - building costs live in their own sheets, so they never reach the        */
/*   monthly cost calculation; only loan payments are added there (client)    */
/* Sheets and columns are defined in SCHEMAS (Code.gs).                       */
/* ========================================================================== */

// A function, not a constant: Apps Script may load this file before Code.gs defines SHEETS.
function hausbauEntities_() {
  return {
  project: { sheet: SHEETS.BUILD_PROJECT, prefix: 'BPRJ' },
  expense: { sheet: SHEETS.BUILD_EXPENSES, prefix: 'BEXP' },
  category: { sheet: SHEETS.BUILD_CATEGORIES, prefix: 'BCAT' },
  key: { sheet: SHEETS.BUILD_KEYS, prefix: 'BKEY' },
  settlement: { sheet: SHEETS.BUILD_SETTLEMENTS, prefix: 'BSET' },
  loan: { sheet: SHEETS.LOANS, prefix: 'LOAN' },
  loanEvent: { sheet: SHEETS.LOAN_EVENTS, prefix: 'LEVT' }
  };
}

const HAUSBAU_NUMBER_FIELDS = {
  total_budget: true, budget_max: true, budget_ingrid: true,
  area_max: true, area_ingrid: true, amount: true, share_max: true,
  sort_order: true, interest_rate: true, term_months: true,
  monthly_rate: true, commitment_fee_rate: true, commitment_free_months: true
};

const HAUSBAU_ENUMS = {
  unit: ['max', 'ingrid', 'shared'],
  status: ['angebot', 'beauftragt', 'bezahlt', 'planung', 'bau', 'fertig'],
  paid_by: ['max', 'ingrid'],
  from_person: ['max', 'ingrid'],
  funding_source: ['eigenmittel', 'kredit', 'foerderung'],
  tax_bonus: ['keine', 'ristrutturazione', 'ecobonus', 'mobili'],
  loan_type: ['bank', 'foerderdarlehen', 'zuschuss'],
  rate_type: ['fix', 'variabel'],
  event_type: ['auszahlung', 'sondertilgung', 'zinsanpassung', 'ratenaenderung', 'gebuehr', 'saldo_bank', 'zuschuss']
};

/** Display name of the only user who may see Hausbau. Script property HAUSBAU_OWNER overrides it. */
function hausbauOwnerName_() {
  return normalizePersonName_(getScriptProperty_('HAUSBAU_OWNER', PERSON_A));
}

function canSeeHausbau_(auth) {
  if (!auth) return false;
  if (auth.kind === 'service') return true;
  if (auth.kind !== 'user' || !auth.user) return false;
  // Login names are typed by hand in the Security menu ("Maximilian Hofer", "Hofer Maximilian",
  // "Maximilian" ...), so match on the first name as well as the exact name.
  const owner = hausbauOwnerName_();
  const name = normalizePersonName_(auth.user.display_name);
  const firstName = owner.split(' ')[0].toLowerCase();
  return name === owner ||
    String(auth.user.display_name || '').toLowerCase().split(/\s+/).indexOf(firstName) !== -1 ||
    String(auth.user.user_key || '').toLowerCase() === firstName;
}

function assertHausbauAccess_(auth) {
  // The read-only backend token is already limited to getAll in doPost.
  // Not 'unauthorized': that word logs the client out, which a normal user must not trigger here.
  if (!canSeeHausbau_(auth) || auth.kind !== 'user') {
    throw new Error('Kein Zugriff auf diesen Bereich.');
  }
}

/** Removes the Hausbau block for everyone except its owner and the read-only backend. */
function dataForAuth_(auth, data) {
  if (canSeeHausbau_(auth)) return data;
  const copy = Object.assign({}, data);
  delete copy.hausbau;
  return copy;
}

function getHausbauData_() {
  return {
    project: readSheetObjects_(SHEETS.BUILD_PROJECT),
    expenses: readSheetObjects_(SHEETS.BUILD_EXPENSES),
    categories: readSheetObjects_(SHEETS.BUILD_CATEGORIES),
    keys: readSheetObjects_(SHEETS.BUILD_KEYS),
    settlements: readSheetObjects_(SHEETS.BUILD_SETTLEMENTS),
    loans: readSheetObjects_(SHEETS.LOANS),
    loanEvents: readSheetObjects_(SHEETS.LOAN_EVENTS)
  };
}

/* ---- write ---------------------------------------------------------------- */

function hausbauEntity_(name) {
  const entity = hausbauEntities_()[String(name || '')];
  if (!entity) throw new Error('Unbekannter Hausbau-Typ: ' + name);
  return entity;
}

/** payload = { entity, record }. Creates the record without id, updates it with id. */
function saveHausbauRecord_(payload, auth) {
  const entity = hausbauEntity_(payload.entity);
  const input = payload.record || {};
  const userName = normalizePersonName_(auth.user.display_name);
  const isUpdate = !!input.id;

  let base = {};
  if (isUpdate) {
    base = getObjectById_(entity.sheet, 'id', input.id);
  }

  const record = normalizeHausbauRecord_(
    payload.entity,
    Object.assign({}, base, input),
    isUpdate,
    userName
  );

  if (isUpdate) {
    record.id = base.id;
    record.created_at = base.created_at;
    record.created_by = base.created_by;
    updateObjectById_(entity.sheet, 'id', record.id, record);
  } else {
    record.id = makeUniqueId_(entity.sheet, 'id', entity.prefix);
    appendByHeaders_(entity.sheet, record);
  }

  return { record: serializeObject_(record, entity.sheet) };
}

/** payload = { entity, id }. Soft delete, like the other finance sheets. */
function deleteHausbauRecord_(payload) {
  const entity = hausbauEntity_(payload.entity);
  assertRequiredId_(payload.id, 'id');
  softDeleteById_(entity.sheet, 'id', payload.id);
  return { deletedId: String(payload.id) };
}

/**
 * payload = { records: [expense, ...], moveTransactionIds: [id, ...] }.
 * Takes over payments from the house dashboard and Hausbau bookings that were entered as
 * household expenses, in one locked request. A record whose source_id is already in
 * Build_Expenses is skipped, so running the import twice adds nothing.
 * Every record is checked before the first row is written.
 */
function importHausbauExpenses_(payload, auth) {
  const userName = normalizePersonName_(auth.user.display_name);
  const sheet = SHEETS.BUILD_EXPENSES;
  const known = {};
  readSheetObjects_(sheet).forEach(function (row) {
    if (row.source_id && String(row.is_deleted || '').toLowerCase() !== 'ja') known[row.source_id] = true;
  });

  const records = (payload.records || []).map(function (input) {
    const record = normalizeHausbauRecord_('expense', Object.assign({}, input, { id: '' }), false, userName);
    if (!record.source_id) throw new Error('Import ohne Herkunft: ' + record.title);
    return record;
  });

  // Only Hausbau bookings may be removed from the household this way.
  const moveIds = (payload.moveTransactionIds || []).map(String);
  if (moveIds.length) {
    const hausbauTx = {};
    readSheetObjects_(SHEETS.TRANSACTIONS).forEach(function (row) {
      if (String(row.main_category || '').trim().toLowerCase() === 'hausbau') hausbauTx[String(row.id)] = true;
    });
    moveIds.forEach(function (id) {
      if (!hausbauTx[id]) throw new Error('Keine Hausbau-Buchung: ' + id);
    });
  }

  let imported = 0;
  let skipped = 0;
  records.forEach(function (record) {
    if (known[record.source_id]) {
      skipped++;
      return;
    }
    record.id = makeUniqueId_(sheet, 'id', hausbauEntity_('expense').prefix);
    appendByHeaders_(sheet, record);
    known[record.source_id] = true;
    imported++;
  });

  moveIds.forEach(function (id) {
    softDeleteById_(SHEETS.TRANSACTIONS, 'id', id);
  });

  return { imported: imported, skipped: skipped, moved: moveIds.length };
}

function normalizeHausbauRecord_(entityName, input, isUpdate, userName) {
  const sheet = hausbauEntity_(entityName).sheet;
  const obj = {};
  const now = new Date();

  SCHEMAS[sheet].forEach(function (field) {
    let value = input[field];
    if (HAUSBAU_NUMBER_FIELDS[field]) {
      value = value === '' || value == null ? '' : toNumber_(value);
    } else if (DATE_FIELDS[field]) {
      value = normalizeDateString_(value);
    } else if (MONTH_FIELDS[field]) {
      value = normalizeMonthKey_(value);
    } else if (HAUSBAU_ENUMS[field]) {
      value = String(value == null ? '' : value).trim().toLowerCase();
      if (value && HAUSBAU_ENUMS[field].indexOf(value) === -1) {
        throw new Error('Ungültiger Wert für ' + field + ': ' + value);
      }
    } else {
      value = value == null ? '' : String(value).trim();
    }
    obj[field] = value;
  });

  if (obj.date && SCHEMAS[sheet].indexOf('month_key') !== -1) {
    obj.month_key = normalizeMonthKey_(obj.date);
  }
  if (obj.share_max !== '') {
    obj.share_max = clampPercent_(obj.share_max);
  }
  if (obj.amount !== '' && obj.amount < 0 && entityName !== 'loanEvent') {
    throw new Error('Betrag darf nicht negativ sein.');
  }

  const required = {
    project: ['title'],
    expense: ['date', 'title', 'amount', 'unit', 'paid_by'],
    category: ['main_category'],
    key: ['name', 'share_max'],
    settlement: ['date', 'from_person', 'amount'],
    loan: ['title', 'loan_type', 'amount'],
    loanEvent: ['loan_id', 'date', 'event_type']
  }[entityName] || [];
  const labels = {
    title: 'Titel', date: 'Datum', amount: 'Betrag', unit: 'Bauteil', paid_by: 'Bezahlt von',
    main_category: 'Hauptkategorie', name: 'Name', share_max: 'Anteil Maximilian',
    from_person: 'Zahlende Person', loan_type: 'Art', loan_id: 'Kredit', event_type: 'Art der Bewegung'
  };
  required.forEach(function (field) {
    assertRequired_(obj[field] === 0 ? '0' : obj[field], labels[field] || field);
  });

  if (entityName === 'loanEvent' && !recordExists_(SHEETS.LOANS, 'id', obj.loan_id)) {
    throw new Error('Kredit nicht gefunden: ' + obj.loan_id);
  }

  obj.is_deleted = '';
  obj.updated_at = now;
  obj.updated_by = userName;
  if (!isUpdate) {
    obj.created_at = now;
    obj.created_by = userName;
  }
  return obj;
}
