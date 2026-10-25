// Hausbau import: the finance app is the single place where house expenses are entered.
// This card takes over (1) the payments recorded so far in the house dashboard (built in
// below, checked with Maximilian on 2026-10-25) and (2) Hausbau bookings that were entered
// as household expenses and therefore counted as monthly costs.
// The server skips anything whose source_id it already has, so a second run adds nothing.
(() => {
  "use strict";

  const PEOPLE = { "Maximilian Hofer": "max", "Ingrid Harder": "ingrid" };
  const ORIGIN = { dashboard: "Hausbau-Dashboard", haushalt: "Haushaltsbuchung" };

  // Payments of the house dashboard up to 2026-10-25, ids as in its data/zahlungen.json.
  const DASHBOARD_PAYMENTS = [
    { id: "z001", datum: "2026-02-24", betrag: 16, firma: "Gemeinde", split: "ja", bezahlt_von: "Maximilian Hofer", beschreibung: "Stempelmarke" },
    { id: "z002", datum: "2026-02-24", betrag: 100, firma: "Gemeinde", split: "ja", bezahlt_von: "Ingrid Harder", beschreibung: "Sekretariatsgebühren Durchführungsplan" },
    { id: "z003", datum: "2026-03-09", betrag: 32, firma: "Gemeinde", split: "ja", bezahlt_von: "Maximilian Hofer", beschreibung: "2x Stempelmarke" },
    { id: "z004", datum: "2026-03-10", betrag: 250, firma: "Gemeinde", split: "ja", bezahlt_von: "Maximilian Hofer", beschreibung: "Sekretariatsgebühren Einreichprojekt" },
    { id: "z005", datum: "2026-04-22", betrag: 253.76, firma: "PSP STP GmbH", split: "W1", bezahlt_von: "Ingrid Harder", beschreibung: "1. Termin Beratung (16.03.2026)", steuerbonus: "ristrutturazione" },
    { id: "z006", datum: "2026-04-22", betrag: 22204, firma: "Arch. Klement", split: "ja", bezahlt_von: "Ingrid Harder", beschreibung: "Einreichplanung (17.03.2026)", steuerbonus: "ristrutturazione" },
    { id: "z007", datum: "2026-06-08", betrag: 16, firma: "Gemeinde", split: "ja", bezahlt_von: "Ingrid Harder", beschreibung: "Stempelmarke" },
    { id: "z008", datum: "2026-07-24", betrag: 4063.6, firma: "Notarin", split: "W2", bezahlt_von: "Maximilian Hofer", beschreibung: "Schenkungsvertrag" },
    { id: "z009", datum: "2026-07-30", betrag: 16, firma: "Gemeinde", split: "ja", bezahlt_von: "Maximilian Hofer", beschreibung: "Stempelmarke" },
    { id: "z014", datum: "2026-08-06", betrag: 3323.17, firma: "Gemeinde", split: "ja", bezahlt_von: "Maximilian Hofer", beschreibung: "Erschließungsgebühren" },
    { id: "z010", datum: "2026-09-08", betrag: 16, firma: "Gemeinde", split: "ja", bezahlt_von: "Ingrid Harder", beschreibung: "Stempelmarke" },
    { id: "z011", datum: "2026-09-14", betrag: 850, firma: "Notarin", split: "W2", bezahlt_von: "Maximilian Hofer", beschreibung: "Verpflichtungserklärung" },
    { id: "z012", datum: "2026-09-14", betrag: 384.3, firma: "Studio E-Plan GZFB GmbH", split: "W1", bezahlt_von: "Ingrid Harder", beschreibung: "Blitzschutzberechnung", steuerbonus: "ecobonus" },
    { id: "z013", datum: "2026-10-06", betrag: 16, firma: "Gemeinde", split: "prozent", anteil_w1: 50, bezahlt_von: "Maximilian Hofer", beschreibung: "Stempelmarke" }
  ];
  // Once the standard splits were applied in this browser, later split changes are the owner's own.
  const REVIEW_KEY = "nomia.hausbauSplitsReviewed";
  const REVIEW_VERSION = "2026-10-25";
  const UPDATE_FIELDS = ["date", "title", "paid_by", "main_category", "sub_category", "allocation_key", "share_max"];
  const FIELD_NAMES = { date: "Datum", title: "Titel", paid_by: "bezahlt von", main_category: "Gewerk", sub_category: "Firma", allocation_key: "Aufteilung", share_max: "Aufteilung" };

  let dashboardRows = null;

  /** The dashboard payments as expense records (built on first use, the split keys need the app). */
  function plannedRows() {
    if (!dashboardRows) dashboardRows = DASHBOARD_PAYMENTS.map(fromPayment);
    return dashboardRows;
  }
  let busy = false;
  let lastSummary = "";
  const unchecked = new Set();
  // Gewerk and Firma picked per row; rows are rebuilt on every render, so they live here by key.
  const overrides = {};
  // Split key picked per row (PROMILLE, HALF, MAX, INGRID or an own key).
  const splitPicks = {};

  const app = () => window.FinanceApp;
  const hb = () => window.Hausbau;
  const esc = (value) => app().escapeHtml(value);
  const cents = (value) => Math.round(Number(value || 0) * 100);
  const sameKey = (date, amount) => `${String(date || "").slice(0, 10)}|${cents(amount)}`;
  const alive = (rows) => (rows || []).filter((row) => String(row.is_deleted || "").toLowerCase() !== "ja");

  function root() {
    return document.getElementById("hbImportCard");
  }

  /** Split of the dashboard ('ja' = Tausendstel, W1 = Ingrid, W2 = Maximilian, prozent = anteil_w1). */
  function shareFor(payment) {
    if (payment.split === "W1") return { unit: "ingrid", allocation_key: "INGRID", share_max: 0 };
    if (payment.split === "W2") return { unit: "max", allocation_key: "MAX", share_max: 100 };
    if (payment.split === "prozent") {
      const shareMax = 100 - Math.min(100, Math.max(0, Number(payment.anteil_w1) || 0));
      return { unit: "shared", allocation_key: shareMax === 50 ? "HALF" : "CUSTOM", share_max: shareMax };
    }
    return { unit: "shared", allocation_key: "PROMILLE", share_max: hb().promilleShareMax() };
  }

  function splitLabel(record) {
    const share = Number(record.share_max);
    if (record.allocation_key === "PROMILLE") return "Tausendstel";
    if (share === 100) return "nur Maximilian";
    if (share === 0) return "nur Ingrid";
    return `${share} / ${Math.round((100 - share) * 100) / 100}`;
  }

  function fromPayment(payment) {
    return {
      source_id: `dashboard:${payment.id}`,
      date: payment.datum,
      title: payment.beschreibung || payment.gewerk || "Zahlung",
      ...shareFor(payment),
      // Original names; withCategory() turns them into Gewerk and Firma.
      vendor: payment.firma || "",
      trade: payment.gewerk || "",
      tax_bonus: payment.steuerbonus || "keine",
      amount: Number(payment.betrag) || 0,
      status: "bezahlt",
      paid_by: PEOPLE[payment.bezahlt_von] || "max",
      funding_source: PEOPLE[payment.bezahlt_von] === "ingrid" ? "" : "eigenmittel",
      note: `aus dem Hausbau-Dashboard (${payment.id})`
    };
  }

  function fromTransaction(row) {
    return {
      source_id: `haushalt:${row.id}`,
      date: row.date,
      title: row.title || row.sub_category || "Hausbau",
      unit: "shared",
      allocation_key: "PROMILLE",
      share_max: hb().promilleShareMax(),
      vendor: "",
      trade: "",
      hint: [row.title, row.sub_category, row.note].join(" "),
      tax_bonus: "keine",
      amount: Number(row.amount) || 0,
      status: "bezahlt",
      paid_by: "max",
      funding_source: "eigenmittel",
      note: [row.note, `übernommen aus Haushaltsbuchung ${row.id}`].filter(Boolean).join(" · ")
    };
  }

  function splitsReviewed() {
    try { return localStorage.getItem(REVIEW_KEY) === REVIEW_VERSION; } catch { return false; }
  }

  /**
   * Firm decides the Gewerk; a pick in the table wins. vendor/trade mirror Firma/Gewerk.
   * The split follows the standard rules unless a split was picked in the table.
   */
  function withCategory(key, record, useRules = true) {
    const pick = overrides[key] || hb().classify(record.vendor, record.trade, record.hint || record.title);
    const rule = useRules ? hb().defaultSplitKey(pick.main, pick.sub, `${record.title || ""} ${record.hint || ""}`) : "";
    const split = hb().splitFields(splitPicks[key] || rule);
    const out = { ...record, ...(split || {}), main_category: pick.main, sub_category: pick.sub, vendor: pick.sub, trade: pick.main };
    delete out.hint;
    return out;
  }

  /**
   * Expenses taken over earlier that differ from what they should be now: Gewerk or Firma
   * always, and until the review ran once, also date, title, payer and split.
   */
  function staleExpenses() {
    const review = !splitsReviewed();
    const fields = review ? UPDATE_FIELDS : ["main_category", "sub_category"];
    const planned = new Map(plannedRows().map((record) => [record.source_id, record]));
    return alive(hb().expenses()).filter((row) => row.source_id).map((row) => {
      const base = planned.get(row.source_id);
      const record = withCategory(row.source_id, base ? { ...row, ...base } : { ...row }, review);
      const changed = fields.filter((field) => {
        const want = record[field];
        if (want === "" || want == null) return false;
        if (field === "share_max") return Math.abs(Number(want) - Number(row[field])) > 0.01;
        return String(row[field] ?? "").slice(0, field === "date" ? 10 : undefined) !== String(want);
      });
      return changed.length ? { row, record, changed } : null;
    }).filter(Boolean);
  }

  /** Hausbau bookings the owner entered as household expenses (they count as monthly costs there). */
  function householdRows() {
    const me = app().currentUserName();
    return alive(app().data.transactions).filter((row) =>
      String(row.booking_type || "expense").toLowerCase() !== "settlement" &&
      String(row.main_category || "").trim().toLowerCase() === "hausbau" &&
      String(row.owner_user || "").trim() === me
    );
  }

  /** All candidate rows with their duplicate state; checked state survives re-renders by key. */
  function candidates() {
    const existing = alive(hb().expenses());
    const bySource = new Set(existing.map((row) => row.source_id).filter(Boolean));
    const byAmount = new Map(existing.map((row) => [sameKey(row.date, row.amount), row]));
    const fromFile = new Map(plannedRows().map((record) => [sameKey(record.date, record.amount), record]));

    const stale = staleExpenses();
    const staleIds = new Set(stale.map((entry) => entry.row.source_id));
    const rows = stale.map(({ row, record, changed }) => ({
      key: row.source_id,
      origin: String(row.source_id).split(":")[0],
      record,
      expense: row,
      state: "recat",
      twin: `neu: ${[...new Set(changed.map((field) => FIELD_NAMES[field]))].join(", ")}`
    }));
    plannedRows().forEach((raw) => {
      if (staleIds.has(raw.source_id)) return;
      const record = withCategory(raw.source_id, raw);
      const twin = byAmount.get(sameKey(record.date, record.amount));
      if (bySource.has(record.source_id)) rows.push({ key: record.source_id, origin: "dashboard", record, state: "done" });
      else if (twin) rows.push({ key: record.source_id, origin: "dashboard", record, state: "twin", twin: twin.title });
      else rows.push({ key: record.source_id, origin: "dashboard", record, state: "new" });
    });
    householdRows().forEach((tx) => {
      const record = withCategory(`haushalt:${tx.id}`, fromTransaction(tx));
      // Already recorded elsewhere: only remove it from the household, unless the dashboard twin is deselected.
      const fileTwin = fromFile.get(sameKey(tx.date, tx.amount));
      const twin = (fileTwin && !unchecked.has(fileTwin.source_id) ? fileTwin : null) || byAmount.get(sameKey(tx.date, tx.amount));
      rows.push({
        key: twin ? `remove:${tx.id}` : record.source_id,
        origin: "haushalt",
        record,
        txId: tx.id,
        state: twin ? "removeOnly" : "move",
        twin: twin ? `schon erfasst als „${twin.title}“, wird aus dem Haushalt entfernt` : ""
      });
    });
    // A household booking taken over although the dashboard already had the payment.
    const fromDashboard = new Set(existing.filter((row) => String(row.source_id || "").startsWith("dashboard:"))
      .map((row) => sameKey(row.date, row.amount)));
    existing.filter((row) => String(row.source_id || "").startsWith("haushalt:") && fromDashboard.has(sameKey(row.date, row.amount)))
      .forEach((row) => {
        const index = rows.findIndex((entry) => entry.key === row.source_id);
        if (index !== -1) rows.splice(index, 1);
        rows.push({ key: `double:${row.id}`, origin: "haushalt", record: row, expenseId: row.id, state: "double", twin: "kommt schon aus dem Dashboard" });
      });
    return rows.sort((a, b) => String(a.record.date).localeCompare(String(b.record.date)));
  }

  const STATE_TEXT = {
    new: ["neu", "cm-move"],
    recat: ["wird angepasst", "cm-check"],
    double: ["doppelt, löschen", "cm-warn"],
    move: ["wird verschoben", "cm-move"],
    removeOnly: ["nur entfernen", "cm-check"],
    twin: ["Betrag schon da", "cm-warn"],
    done: ["schon übernommen", ""]
  };

  function isChecked(row) {
    if (row.state === "done") return false;
    if (row.state === "twin") return unchecked.has(`+${row.key}`);
    return !unchecked.has(row.key);
  }

  function setChecked(row, value) {
    if (row.state === "twin") {
      if (value) unchecked.add(`+${row.key}`);
      else unchecked.delete(`+${row.key}`);
      return;
    }
    if (value) unchecked.delete(row.key);
    else unchecked.add(row.key);
  }

  function hasDashboardImport() {
    return alive(hb()?.expenses?.()).some((row) => String(row.source_id || "").startsWith("dashboard:"));
  }

  function render() {
    const card = root();
    if (!card || !hb()) return;
    const rows = candidates();
    const open = rows.filter((row) => row.state !== "done");
    card.hidden = !open.length && hasDashboardImport() && !lastSummary;
    if (card.hidden) return;

    if (!card.dataset.built) {
      card.dataset.built = "1";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <h2>Hausbau-Ausgaben übernehmen</h2>
            <p>Ab jetzt trägst du Hausbau-Ausgaben nur noch hier ein; das Hausbau-Dashboard zeigt sie nur an. Hier übernimmst du die bisherigen Zahlungen und die Hausbau-Buchungen aus dem Haushalt, jeweils mit Gewerk, Firma und Aufteilung. Die Aufteilung kannst du hier und später in der Liste je Zahlung ändern. Hausbau-Kosten zählen nicht zu den Monatskosten.</p>
          </div>
        </div>
        <div class="actions-row">
          <button class="btn btn-primary" type="button" data-hi="run">Ausgewählte übernehmen</button>
        </div>
        <p class="cm-summary" data-hi="summary"></p>
        <div class="table-scroll">
          <table class="data-table" data-hi="table">
            <thead><tr><th></th><th>Datum</th><th>Ausgabe</th><th class="num">Betrag</th><th>Aufteilung</th><th>Bezahlt von</th><th>Status</th><th>Gewerk</th><th>Firma / Instanz</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>`;
      card.addEventListener("change", onChange);
      card.addEventListener("click", (event) => {
        if (event.target.closest('[data-hi="run"]')) run();
      });
    }

    const map = hb().categoryMap();
    const blocks = Object.keys(map);
    const blockOptions = (selected) => blocks.map((block) =>
      `<option value="${esc(block)}"${block === selected ? " selected" : ""}>${esc(block)}</option>`).join("");
    const firms = [].concat(...blocks.map((block) => map[block]));
    const chosen = open.filter(isChecked);
    const total = chosen.filter((row) => ["new", "move", "twin"].includes(row.state)).reduce((sum, row) => sum + Number(row.record.amount || 0), 0);
    const summary = card.querySelector('[data-hi="summary"]');
    summary.textContent = lastSummary || `Ausgewählt: ${chosen.length} Einträge, davon neu ${app().currency(total)}.`;
    card.querySelector('[data-hi="run"]').disabled = busy || !chosen.length;
    card.querySelector('[data-hi="table"]').hidden = !rows.length;
    card.querySelector("tbody").innerHTML = rows.map((row) => {
      const r = row.record;
      const [text, tone] = STATE_TEXT[row.state];
      const sendsRecord = row.state !== "removeOnly" && row.state !== "double";
      return `<tr>
        <td><input type="checkbox" data-hi-key="${esc(row.key)}"${isChecked(row) ? " checked" : ""}${row.state === "done" || busy ? " disabled" : ""} aria-label="übernehmen" /></td>
        <td>${esc(app().formatGermanDate(r.date))}</td>
        <td>${esc(r.title)}<div class="text-muted">${esc([ORIGIN[row.origin], r.trade, r.vendor].filter(Boolean).join(" · "))}</div></td>
        <td class="num">${app().currency(r.amount)}</td>
        <td>${sendsRecord && row.state !== "done"
          ? `<select data-hi-split="${esc(row.key)}"${busy ? " disabled" : ""}>${splitOptions(r)}</select>`
          : esc(splitLabel(r))}</td>
        <td>${r.paid_by === "ingrid" ? "Ingrid" : "Maximilian"}</td>
        <td><span class="pill ${tone}">${esc(text)}</span>${row.twin ? `<div class="text-muted">${esc(row.twin)}</div>` : ""}</td>
        ${sendsRecord && row.state !== "done"
          ? `<td><select data-hi-block="${esc(row.key)}"${busy ? " disabled" : ""}>${blockOptions(r.main_category)}</select></td>
             <td><input type="text" list="hiFirmList" data-hi-firm="${esc(row.key)}" value="${esc(r.sub_category)}"${busy ? " disabled" : ""} /></td>`
          : `<td>${esc(r.main_category)}</td><td>${esc(r.sub_category || "—")}</td>`}
      </tr>`;
    }).join("") + `<datalist id="hiFirmList">${firms.map((firm) => `<option value="${esc(firm)}"></option>`).join("")}</datalist>`;
  }

  function splitOptions(record) {
    const keys = hb().allocationKeys().filter((key) => key.id !== "CUSTOM");
    const current = keys.find((key) => key.id === record.allocation_key && Math.abs(Number(key.share_max) - Number(record.share_max)) < 0.01);
    const own = current ? "" : `<option value="" selected>${esc(splitLabel(record))}</option>`;
    return own + keys.map((key) => `<option value="${esc(key.id)}"${current?.id === key.id ? " selected" : ""}>${esc(key.name)}</option>`).join("");
  }

  function findRow(key) {
    return candidates().find((row) => row.key === key);
  }

  function onChange(event) {
    const box = event.target.closest("[data-hi-key]");
    if (box) {
      const row = findRow(box.dataset.hiKey);
      if (row) setChecked(row, box.checked);
      lastSummary = "";
      render();
      return;
    }
    const block = event.target.closest("[data-hi-block]");
    if (block) {
      const key = block.dataset.hiBlock;
      const sub = findRow(key)?.record.sub_category || "";
      // A firm that belongs to another Gewerk does not move along.
      const owner = hb().gewerkOfFirm(sub);
      overrides[key] = { main: block.value, sub: !owner || owner === block.value ? sub : "" };
      lastSummary = "";
      render();
      return;
    }
    const split = event.target.closest("[data-hi-split]");
    if (split) {
      if (split.value) splitPicks[split.dataset.hiSplit] = split.value;
      lastSummary = "";
      render();
      return;
    }
    const firm = event.target.closest("[data-hi-firm]");
    if (firm) {
      const key = firm.dataset.hiFirm;
      const sub = firm.value.trim();
      overrides[key] = { main: hb().gewerkOfFirm(sub) || findRow(key)?.record.main_category, sub };
      lastSummary = "";
      render();
    }
  }

  async function run() {
    if (busy) return;
    // The household rows must match the sheet as it is now (ids may have been repaired).
    busy = true;
    render();
    try {
      await window.loadAll?.({ silentSuccess: true });
    } finally {
      busy = false;
    }
    const chosen = candidates().filter((row) => row.state !== "done" && isChecked(row));
    if (!chosen.length) { render(); return; }
    const updates = chosen.filter((row) => row.state === "recat");
    const records = chosen.filter((row) => !["removeOnly", "double", "recat"].includes(row.state)).map((row) => ({ ...row.record }));
    const moveTransactionIds = chosen.filter((row) => row.txId).map((row) => row.txId);
    const deleteExpenseIds = chosen.filter((row) => row.expenseId).map((row) => row.expenseId);
    const total = chosen.filter((row) => ["new", "move", "twin"].includes(row.state)).reduce((sum, row) => sum + Number(row.record.amount || 0), 0);
    const question = [
      records.length ? `${records.length} Ausgaben (${app().currency(total)}) in den Hausbau übernehmen` : "",
      updates.length ? `${updates.length} Ausgaben anpassen` : "",
      moveTransactionIds.length ? `${moveTransactionIds.length} Hausbau-Buchungen aus dem Haushalt entfernen` : "",
      deleteExpenseIds.length ? `${deleteExpenseIds.length} doppelte Hausbau-Ausgaben löschen` : ""
    ].filter(Boolean).join(" und ");
    if (!window.confirm(`${question}?`)) return;

    busy = true;
    render();
    try {
      let result = { imported: 0 };
      if (records.length || moveTransactionIds.length || deleteExpenseIds.length) {
        result = await app().apiPost("hausbauImport", { records, moveTransactionIds, deleteExpenseIds });
      }
      for (const row of updates) {
        const r = row.record;
        const changes = {};
        ["date", "title", "paid_by", "main_category", "sub_category", "vendor", "trade", "unit", "allocation_key", "share_max"]
          .forEach((field) => { if (r[field] !== "" && r[field] != null) changes[field] = r[field]; });
        result = { ...(await hb().saveExpenseFields(row.expense, changes)), imported: result.imported, skipped: result.skipped, moved: result.moved, removed: result.removed };
      }
      try { localStorage.setItem(REVIEW_KEY, REVIEW_VERSION); } catch { /* private mode: the review shows again */ }
      lastSummary = `Fertig: ${result.imported || 0} übernommen` +
        (updates.length ? `, ${updates.length} angepasst` : "") +
        (result.skipped ? `, ${result.skipped} waren schon da` : "") +
        (result.moved ? `, ${result.moved} aus dem Haushalt entfernt` : "") +
        (result.removed ? `, ${result.removed} doppelte gelöscht` : "") + ".";
      await app().refreshAfterWrite(result);
      app().showMessage(lastSummary, "success");
    } catch (error) {
      app().showMessage(`Übernahme fehlgeschlagen: ${error.message}. Nochmal starten ist sicher, schon Übernommenes wird übersprungen.`, "error");
    } finally {
      busy = false;
      render();
    }
  }

  window.HausbauImport = { render };
})();
