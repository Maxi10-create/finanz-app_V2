// Hausbau import: the finance app is the single place where house expenses are entered.
// This card takes over (1) the payments recorded so far in the house dashboard
// (data/zahlungen.json of the Hintersun 8 project) and (2) Hausbau bookings that were
// entered as household expenses and therefore counted as monthly costs.
// The server skips anything whose source_id it already has, so a second run adds nothing.
(() => {
  "use strict";

  const PEOPLE = { "Maximilian Hofer": "max", "Ingrid Harder": "ingrid" };
  const ORIGIN = { dashboard: "Hausbau-Dashboard", haushalt: "Haushaltsbuchung" };

  let dashboardRows = [];
  let fileName = "";
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

  /** Firm decides the Gewerk; a pick in the table wins. vendor/trade mirror Firma/Gewerk. */
  function withCategory(key, record) {
    const pick = overrides[key] || hb().classify(record.vendor, record.trade, record.hint || record.title);
    const split = splitPicks[key] ? hb().splitFields(splitPicks[key]) : null;
    const out = { ...record, ...(split || {}), main_category: pick.main, sub_category: pick.sub, vendor: pick.sub, trade: pick.main };
    delete out.hint;
    return out;
  }

  /** Expenses taken over earlier whose Gewerk or Firma no longer follow the firm list. */
  function staleExpenses() {
    return alive(hb().expenses()).filter((row) => row.source_id).map((row) => {
      const record = withCategory(row.source_id, { ...row });
      return record.main_category !== row.main_category || (record.sub_category && record.sub_category !== row.sub_category)
        ? { row, record }
        : null;
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
    const fromFile = new Map(dashboardRows.map((record) => [sameKey(record.date, record.amount), record]));

    const stale = staleExpenses();
    const staleIds = new Set(stale.map((entry) => entry.row.source_id));
    const rows = stale.map(({ row, record }) => ({
      key: row.source_id,
      origin: String(row.source_id).split(":")[0],
      record,
      state: "recat",
      twin: `bisher ${[row.main_category, row.sub_category].filter(Boolean).join(" · ")}`
    }));
    dashboardRows.forEach((raw) => {
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
    recat: ["Gewerk/Firma neu", "cm-check"],
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
            <p>Ab jetzt trägst du Hausbau-Ausgaben nur noch hier ein; das Hausbau-Dashboard zeigt sie nur an. Hier übernimmst du die Zahlungen aus dem Dashboard (Datei <code>data/zahlungen.json</code> im Hausbau-Ordner) und die Hausbau-Buchungen aus dem Haushalt, jeweils mit Gewerk und Firma. Hausbau-Kosten zählen nicht zu den Monatskosten.</p>
          </div>
        </div>
        <div class="actions-row">
          <label class="btn btn-ghost">zahlungen.json wählen<input type="file" accept=".json,application/json" data-hi="file" class="sr-only" /></label>
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
    summary.textContent = lastSummary || (dashboardRows.length
      ? `${fileName}: ${dashboardRows.length} Zahlungen gelesen. Ausgewählt: ${chosen.length} Einträge, ${app().currency(total)}.`
      : `Noch keine Datei gewählt.${open.length ? ` ${open.length} Hausbau-Buchungen aus dem Haushalt warten auf die Übernahme.` : ""}`);
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
    const file = event.target.closest('[data-hi="file"]');
    if (file) {
      readFile(file.files?.[0]);
      file.value = "";
      return;
    }
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

  async function readFile(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const list = Array.isArray(parsed) ? parsed : parsed?.zahlungen;
      if (!Array.isArray(list)) throw new Error("In der Datei steht keine Liste „zahlungen“.");
      const rows = list
        .filter((payment) => payment && payment.id && payment.datum && Number(payment.betrag) > 0)
        .map(fromPayment);
      if (!rows.length) throw new Error("Die Datei enthält keine Zahlungen.");
      dashboardRows = rows;
      fileName = file.name;
      lastSummary = "";
      render();
    } catch (error) {
      app().showMessage(`Datei nicht lesbar: ${error.message}`, "error");
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
    const records = chosen.filter((row) => row.state !== "removeOnly" && row.state !== "double").map((row) => ({ ...row.record }));
    const moveTransactionIds = chosen.filter((row) => row.txId).map((row) => row.txId);
    const deleteExpenseIds = chosen.filter((row) => row.expenseId).map((row) => row.expenseId);
    const total = chosen.filter((row) => ["new", "move", "twin"].includes(row.state)).reduce((sum, row) => sum + Number(row.record.amount || 0), 0);
    const question = [
      records.length ? `${records.length} Ausgaben (${app().currency(total)}) in den Hausbau übernehmen oder Gewerk/Firma anpassen` : "",
      moveTransactionIds.length ? `${moveTransactionIds.length} Hausbau-Buchungen aus dem Haushalt entfernen` : "",
      deleteExpenseIds.length ? `${deleteExpenseIds.length} doppelte Hausbau-Ausgaben löschen` : ""
    ].filter(Boolean).join(" und ");
    if (!window.confirm(`${question}?`)) return;

    busy = true;
    render();
    try {
      const result = await app().apiPost("hausbauImport", { records, moveTransactionIds, deleteExpenseIds });
      lastSummary = `Fertig: ${result.imported} übernommen` +
        (result.updated ? `, ${result.updated} mit neuem Gewerk/Firma` : "") +
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
