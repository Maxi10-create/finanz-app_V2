/* ========================================================================== */
/* KATEGORIEN NEU ORDNEN                                                      */
/*                                                                            */
/* Moves every booking, fixed cost and trip expense to the new category tree. */
/* - categoryinventory: lists every category that is really used, with a      */
/*   suggested new name (unknown ones stay as they are)                       */
/* - categorymigrate: copies the whole spreadsheet as a backup, renames the   */
/*   categories, checks that row counts and amounts per month are unchanged   */
/*   and every used category exists, and restores the old values otherwise    */
/* Only the owner (same person as for Hausbau) may run it.                    */
/* ========================================================================== */

/** New household tree. Main categories not listed here (e.g. Kosten Arbeit) stay as they are. */
function categoryTree_() {
  return [
    { main: 'Wohnen', shared: true, subs: ['Miete', 'Betriebskosten', 'Strom', 'Heizung/Gas', 'Internet & TV/ORF', 'Haushaltsversicherung', 'Instandhaltung', 'Sonstiges'] },
    { main: 'Lebensmittel & Haushalt', shared: true, subs: ['Supermarkt', 'Getränke', 'Drogerie', 'Haushaltsbedarf', 'Sonstiges'] },
    { main: 'Mobilität', subs: ['Leasing/Kredit', 'Treibstoff/Laden', 'Versicherung & Steuer', 'Service & Reifen', 'Vignette/Maut/Parken', 'Öffis & Bahn', 'Sonstiges'] },
    { main: 'Versicherungen', subs: ['Kranken-/Zusatzversicherung', 'Haftpflicht & Rechtsschutz', 'Unfall', 'Leben/Ableben', 'Sonstiges'] },
    { main: 'Gesundheit & Pflege', subs: ['Arzt & Therapie', 'Apotheke', 'Zahnarzt & Brille', 'Friseur & Körperpflege', 'Sport & Fitness', 'Sonstiges'] },
    { main: 'Abos & Kommunikation', subs: ['Handy', 'Streaming', 'Software & Cloud', 'Zeitungen & Mitgliedschaften', 'Sonstiges'] },
    { main: 'Essen & Ausgehen', subs: ['Restaurant', 'Lieferservice', 'Café & Bar', 'Kantine & Snacks', 'Sonstiges'] },
    { main: 'Freizeit & Hobby', subs: ['Hobbys', 'Kultur & Events', 'Ausflüge', 'Bücher & Medien', 'Sonstiges'] },
    { main: 'Shopping', subs: ['Kleidung & Schuhe', 'Elektronik', 'Einrichtung & Deko', 'Sonstiges'] },
    { main: 'Geschenke & Spenden', subs: ['Geschenke', 'Feiern & Anlässe', 'Spenden', 'Sonstiges'] },
    { main: 'Finanzen & Gebühren', subs: ['Bankgebühren', 'Steuern & Abgaben', 'Zinsen', 'Strafen', 'Sonstiges'] },
    { main: 'Sonstiges', subs: ['Unvorhergesehenes', 'Nicht zuordenbar'] }
  ];
}

/** Keyword rules, checked in order against "main sub" (sub first, then main). */
function categoryRules_() {
  return [
    // Wohnen keeps its name; only the subcategory is tidied up.
    [/miete/, 'Wohnen', 'Miete'],
    [/betriebskost/, 'Wohnen', 'Betriebskosten'],
    [/strom/, 'Wohnen', 'Strom'],
    [/heiz|\bgas\b|fernwärme|pellets/, 'Wohnen', 'Heizung/Gas'],
    [/internet|wlan|\btv\b|orf|gis\b|rundfunk/, 'Wohnen', 'Internet & TV/ORF'],
    [/haushaltsversicherung|eigenheimversicherung/, 'Wohnen', 'Haushaltsversicherung'],
    [/reparatur|instandhalt|handwerker/, 'Wohnen', 'Instandhaltung'],

    [/lebensmittel|supermarkt|einkauf|billa|hofer|spar\b|lidl|penny|merkur/, 'Lebensmittel & Haushalt', 'Supermarkt'],
    [/getränk/, 'Lebensmittel & Haushalt', 'Getränke'],
    [/drogerie|\bdm\b|bipa|müller/, 'Lebensmittel & Haushalt', 'Drogerie'],
    [/haushaltsbedarf|putzmittel|reinigung/, 'Lebensmittel & Haushalt', 'Haushaltsbedarf'],

    [/lieferservice|lieferando|mjam|foodora/, 'Essen & Ausgehen', 'Lieferservice'],
    [/restaurant|essen gehen|auswärts/, 'Essen & Ausgehen', 'Restaurant'],
    [/café|cafe|kaffee|\bbar\b|lokal|ausgehen|fortgehen/, 'Essen & Ausgehen', 'Café & Bar'],
    [/kantine|snack|mittagessen/, 'Essen & Ausgehen', 'Kantine & Snacks'],

    [/leasing|autokredit/, 'Mobilität', 'Leasing/Kredit'],
    [/tank|sprit|treibstoff|benzin|diesel|ladestation|aufladen/, 'Mobilität', 'Treibstoff/Laden'],
    [/kfz|autoversicherung|versicherung auto|motorbezogen/, 'Mobilität', 'Versicherung & Steuer'],
    [/autoservice|werkstatt|reifen|pickerl/, 'Mobilität', 'Service & Reifen'],
    [/vignette|maut|\bpark/, 'Mobilität', 'Vignette/Maut/Parken'],
    [/öffi|oeffi|bahn|\bzug|öbb|klimaticket|wiener linien|\bbus\b/, 'Mobilität', 'Öffis & Bahn'],

    [/krankenversicherung|krankenkasse|zusatzversicherung/, 'Versicherungen', 'Kranken-/Zusatzversicherung'],
    [/haftpflicht|rechtsschutz/, 'Versicherungen', 'Haftpflicht & Rechtsschutz'],
    [/unfall/, 'Versicherungen', 'Unfall'],
    [/lebensversicherung|ableben/, 'Versicherungen', 'Leben/Ableben'],

    [/(?<!zahn)arzt|therap|physio/, 'Gesundheit & Pflege', 'Arzt & Therapie'],
    [/apothek|medikament/, 'Gesundheit & Pflege', 'Apotheke'],
    [/zahn|brille|kontaktlinse/, 'Gesundheit & Pflege', 'Zahnarzt & Brille'],
    [/friseur|frisör|kosmetik|körperpflege|pflege/, 'Gesundheit & Pflege', 'Friseur & Körperpflege'],
    [/fitness|sport|gym/, 'Gesundheit & Pflege', 'Sport & Fitness'],

    [/handy|mobilfunk|telefon/, 'Abos & Kommunikation', 'Handy'],
    [/streaming|netflix|spotify|disney|youtube|prime/, 'Abos & Kommunikation', 'Streaming'],
    [/software|cloud|icloud|app\b|apps\b/, 'Abos & Kommunikation', 'Software & Cloud'],
    [/zeitung|magazin|mitglied|verein/, 'Abos & Kommunikation', 'Zeitungen & Mitgliedschaften'],

    [/kino|konzert|theater|kultur|event|festival/, 'Freizeit & Hobby', 'Kultur & Events'],
    [/ausflug|ausflüge/, 'Freizeit & Hobby', 'Ausflüge'],
    [/buch|bücher|medien/, 'Freizeit & Hobby', 'Bücher & Medien'],
    [/hobby|hobbys|freizeit/, 'Freizeit & Hobby', 'Hobbys'],

    [/kleidung|schuhe|mode|gewand/, 'Shopping', 'Kleidung & Schuhe'],
    [/elektronik|technik|computer|laptop/, 'Shopping', 'Elektronik'],
    [/einrichtung|möbel|deko/, 'Shopping', 'Einrichtung & Deko'],
    [/shopping/, 'Shopping', 'Sonstiges'],

    [/geschenk/, 'Geschenke & Spenden', 'Geschenke'],
    [/feier|geburtstag|hochzeit|party/, 'Geschenke & Spenden', 'Feiern & Anlässe'],
    [/spende/, 'Geschenke & Spenden', 'Spenden'],

    [/bankgebühr|kontoführung|bank/, 'Finanzen & Gebühren', 'Bankgebühren'],
    [/steuer|abgabe/, 'Finanzen & Gebühren', 'Steuern & Abgaben'],
    [/zinsen/, 'Finanzen & Gebühren', 'Zinsen'],
    [/strafe|strafzettel|organmandat/, 'Finanzen & Gebühren', 'Strafen']
  ];
}

/** Main categories that keep their name and subcategories. */
function categoryIsKept_(module, main) {
  const m = String(main || '').toLowerCase();
  return module === 'Urlaub' ||
    m.indexOf('arbeit') !== -1 ||
    m.indexOf('mapact') !== -1 ||
    m === 'kaution' ||
    /spar|invest|vorsorge|depot|etf|aktie/.test(m) ||
    m.indexOf('hausbau') !== -1;
}

/** Main category names of the old tree that map onto a new main when no rule matches the sub. */
function categoryMainAliases_() {
  return {
    'wohnen': 'Wohnen',
    'alltag': 'Lebensmittel & Haushalt',
    'lebensmittel': 'Lebensmittel & Haushalt',
    'haushalt': 'Lebensmittel & Haushalt',
    'mobilität': 'Mobilität',
    'auto': 'Mobilität',
    'versicherung': 'Versicherungen',
    'versicherungen': 'Versicherungen',
    'gesundheit': 'Gesundheit & Pflege',
    'abos': 'Abos & Kommunikation',
    'kommunikation': 'Abos & Kommunikation',
    'freizeit': 'Freizeit & Hobby',
    'shopping': 'Shopping',
    'kleidung': 'Shopping',
    'geschenke': 'Geschenke & Spenden',
    'finanzen': 'Finanzen & Gebühren',
    'sonstiges': 'Sonstiges'
  };
}

/** Suggestion for one used category: { main, sub, rule } (rule '' = stays as it is). */
function suggestCategory_(module, main, sub) {
  const keep = { main: main, sub: sub, rule: '' };
  if (categoryIsKept_(module, main)) return keep;
  // Already part of the new tree (e.g. after a first run): nothing to do.
  const inTree = categoryTree_().some(function (group) {
    return group.main === main && group.subs.indexOf(sub) !== -1;
  });
  if (inTree) return keep;
  // Rent deposits are not costs; keep them where the housing view expects them.
  if (/kaution/i.test(sub)) return keep;

  const subText = String(sub || '').toLowerCase();
  const mainText = String(main || '').toLowerCase();
  const rules = categoryRules_();
  for (let i = 0; i < rules.length; i++) {
    if (rules[i][0].test(subText)) {
      // Inside Wohnen only Wohnen rules apply, so "Wohnen > Versicherung" stays housing.
      if (mainText === 'wohnen' && rules[i][1] !== 'Wohnen') continue;
      return { main: rules[i][1], sub: rules[i][2], rule: 'sub' };
    }
  }
  const alias = categoryMainAliases_()[mainText];
  if (alias) {
    return { main: alias, sub: sub, rule: alias === main ? '' : 'main' };
  }
  for (let j = 0; j < rules.length; j++) {
    if (rules[j][0].test(mainText)) {
      return { main: rules[j][1], sub: sub, rule: 'main' };
    }
  }
  return keep;
}

function categoryKey_(module, main, sub) {
  return [module, main, sub].join('|');
}

/** The sheets whose rows carry a category. Fixed costs have no module column and belong to Haushalt. */
function categorySheets_() {
  return [
    { sheet: SHEETS.TRANSACTIONS, label: 'Buchungen', defaultModule: 'Haushalt' },
    { sheet: SHEETS.FIXED_COSTS, label: 'Fixkosten', defaultModule: 'Haushalt' },
    { sheet: SHEETS.TRIP_EXPENSES, label: 'Urlaubsausgaben', defaultModule: 'Urlaub' },
    { sheet: SHEETS.CATEGORIES, label: 'Kategorien', defaultModule: 'Haushalt' }
  ];
}

function readCategoryTable_(def) {
  const sheet = ensureSchema_(def.sheet).sheet;
  const values = sheet.getDataRange().getValues();
  const headers = sanitizeHeaders_(values[0] || []);
  const col = function (name) { return headers.indexOf(name); };
  return {
    def: def,
    sheet: sheet,
    values: values,
    module: col('module'),
    main: col('main_category'),
    sub: col('sub_category'),
    amount: col('amount'),
    month: col('month_key'),
    deleted: col('is_deleted')
  };
}

function rowModule_(table, row) {
  return (table.module !== -1 && String(row[table.module] || '').trim()) || table.def.defaultModule;
}

function rowIsDeleted_(table, row) {
  return table.deleted !== -1 && String(row[table.deleted] || '').toLowerCase() === 'ja';
}

/** Every used (module, main, sub) with counts and amounts, plus the suggested new name. */
function categoryInventory_() {
  const used = {};
  categorySheets_().forEach(function (def) {
    const table = readCategoryTable_(def);
    table.values.slice(1).forEach(function (row) {
      if (rowIsDeleted_(table, row)) return;
      const main = String(row[table.main] || '').trim();
      const sub = table.sub === -1 ? '' : String(row[table.sub] || '').trim();
      if (!main && !sub) return;
      const module = rowModule_(table, row);
      const key = categoryKey_(module, main, sub);
      if (!used[key]) {
        const suggestion = suggestCategory_(module, main, sub);
        used[key] = {
          module: module, main_category: main, sub_category: sub,
          new_main: suggestion.main, new_sub: suggestion.sub, rule: suggestion.rule,
          bookings: 0, fixed_costs: 0, trip_expenses: 0, amount: 0, in_category_list: false
        };
      }
      const entry = used[key];
      if (def.sheet === SHEETS.CATEGORIES) {
        entry.in_category_list = true;
        return;
      }
      if (def.sheet === SHEETS.TRANSACTIONS) entry.bookings++;
      if (def.sheet === SHEETS.FIXED_COSTS) entry.fixed_costs++;
      if (def.sheet === SHEETS.TRIP_EXPENSES) entry.trip_expenses++;
      entry.amount += toNumber_(row[table.amount]) || 0;
    });
  });
  const rows = Object.keys(used).map(function (k) { return used[k]; });
  rows.sort(function (a, b) {
    return (a.module + a.main_category + a.sub_category).localeCompare(b.module + b.main_category + b.sub_category, 'de');
  });
  return { categories: rows, tree: categoryTree_() };
}

/** Row count and amount per sheet and month, to prove that nothing was lost. */
function categoryFingerprint_() {
  const out = {};
  categorySheets_().forEach(function (def) {
    if (def.sheet === SHEETS.CATEGORIES) return;
    const table = readCategoryTable_(def);
    table.values.slice(1).forEach(function (row) {
      if (rowIsDeleted_(table, row)) return;
      const month = table.month === -1 ? '-' : String(normalizeMonthKey_(row[table.month]) || '-');
      const key = def.sheet + '|' + month;
      out[key] = out[key] || { rows: 0, cents: 0 };
      out[key].rows++;
      out[key].cents += Math.round((toNumber_(row[table.amount]) || 0) * 100);
    });
  });
  return out;
}

/**
 * payload.mapping = [{ module, main_category, sub_category, new_main, new_sub }].
 * Without a mapping the suggestions from categoryInventory_ are used.
 */
function migrateCategories_(payload, auth) {
  const inventory = categoryInventory_().categories;
  const mapping = {};
  const input = Array.isArray(payload.mapping) ? payload.mapping : inventory;
  input.forEach(function (m) {
    const main = String(m.new_main || '').trim();
    const sub = String(m.new_sub || '').trim();
    if (!main) return;
    mapping[categoryKey_(m.module, String(m.main_category || '').trim(), String(m.sub_category || '').trim())] = { main: main, sub: sub };
  });

  const before = categoryFingerprint_();
  const spreadsheet = getSpreadsheet_();
  const stamp = Utilities.formatDate(new Date(), getSpreadsheetTimeZone_(), 'yyyy-MM-dd HH:mm');
  const backup = spreadsheet.copy(spreadsheet.getName() + ' – Sicherung vor Kategorie-Umstellung ' + stamp);

  const tables = categorySheets_().map(readCategoryTable_);
  const originals = [];
  let changedRows = 0;

  try {
    tables.forEach(function (table) {
      if (table.main === -1 || table.values.length < 2) return;
      const rows = table.values.slice(1);
      const oldMain = rows.map(function (r) { return [r[table.main]]; });
      const oldSub = table.sub === -1 ? null : rows.map(function (r) { return [r[table.sub]]; });
      let changed = false;
      const newMain = [];
      const newSub = [];
      rows.forEach(function (row, i) {
        const main = String(row[table.main] || '').trim();
        const sub = table.sub === -1 ? '' : String(row[table.sub] || '').trim();
        const target = mapping[categoryKey_(rowModule_(table, row), main, sub)];
        if (target && (target.main !== main || target.sub !== sub)) {
          newMain.push([target.main]);
          newSub.push([target.sub]);
          changed = true;
          if (!rowIsDeleted_(table, row)) changedRows++;
        } else {
          newMain.push(oldMain[i]);
          newSub.push(oldSub ? oldSub[i] : ['']);
        }
      });
      if (!changed) return;
      originals.push({ table: table, oldMain: oldMain, oldSub: oldSub });
      table.sheet.getRange(2, table.main + 1, rows.length, 1).setValues(newMain);
      if (oldSub) table.sheet.getRange(2, table.sub + 1, rows.length, 1).setValues(newSub);
    });

    const addedCategories = completeCategoryList_(auth);
    const removedDuplicates = dedupeCategoryList_();
    SpreadsheetApp.flush();

    const after = categoryFingerprint_();
    const problems = [];
    Object.keys(before).concat(Object.keys(after)).forEach(function (key) {
      const a = before[key] || { rows: 0, cents: 0 };
      const b = after[key] || { rows: 0, cents: 0 };
      if (a.rows !== b.rows || a.cents !== b.cents) problems.push(key);
    });
    const missing = categoryInventory_().categories.filter(function (c) {
      return !c.in_category_list;
    });
    if (problems.length || missing.length) {
      throw new Error(
        'Prüfung fehlgeschlagen (' +
        (problems.length ? 'Abweichung bei ' + problems.slice(0, 3).join(', ') : missing.length + ' Kategorien fehlen in der Liste') +
        '). Alles wurde zurückgesetzt.'
      );
    }

    return {
      migration: {
        changedRows: changedRows,
        addedCategories: addedCategories,
        removedDuplicates: removedDuplicates,
        backupName: backup.getName(),
        backupUrl: backup.getUrl()
      }
    };
  } catch (err) {
    originals.forEach(function (o) {
      const n = o.oldMain.length;
      o.table.sheet.getRange(2, o.table.main + 1, n, 1).setValues(o.oldMain);
      if (o.oldSub) o.table.sheet.getRange(2, o.table.sub + 1, n, 1).setValues(o.oldSub);
    });
    SpreadsheetApp.flush();
    throw err;
  }
}

/** Adds the new tree and every category that is used but missing in the Categories sheet. */
function completeCategoryList_(auth) {
  const existing = {};
  readSheetObjects_(SHEETS.CATEGORIES).forEach(function (row) {
    if (String(row.is_deleted || '').toLowerCase() === 'ja') return;
    existing[categoryKey_(row.module || 'Haushalt', row.main_category, row.sub_category)] = true;
  });
  const owner = normalizePersonName_(auth.user.display_name);
  const wanted = [];
  categoryTree_().forEach(function (group) {
    group.subs.forEach(function (sub) {
      wanted.push({ module: 'Haushalt', main: group.main, sub: sub, shared: !!group.shared });
    });
  });
  categoryInventory_().categories.forEach(function (c) {
    if (!c.in_category_list) {
      wanted.push({ module: c.module, main: c.main_category, sub: c.sub_category || 'Sonstiges', shared: false });
    }
  });
  let added = 0;
  wanted.forEach(function (w) {
    const key = categoryKey_(w.module, w.main, w.sub);
    if (existing[key]) return;
    existing[key] = true;
    addCategory_({
      module: w.module,
      main_category: w.main,
      sub_category: w.sub,
      visible_to_other: w.shared ? 'ja' : 'nein',
      owner_user: owner,
      created_by: owner,
      updated_by: owner
    });
    added++;
  });
  return added;
}

/** After renaming, two category rows can name the same category; keep the first. */
function dedupeCategoryList_() {
  const seen = {};
  let removed = 0;
  readSheetObjects_(SHEETS.CATEGORIES).forEach(function (row) {
    if (String(row.is_deleted || '').toLowerCase() === 'ja') return;
    const key = categoryKey_(row.module || 'Haushalt', row.main_category, row.sub_category) + '|' + normalizePersonName_(row.owner_user);
    if (seen[key]) {
      softDeleteById_(SHEETS.CATEGORIES, 'id', row.id);
      removed++;
    } else {
      seen[key] = true;
    }
  });
  return removed;
}
