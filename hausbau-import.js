// Hausbau import: the finance app is the single place where house expenses are entered.
// This card takes over (1) the payments recorded so far in the house dashboard
// (data/zahlungen.json of the Hintersun 8 project) and (2) Hausbau bookings that were
// entered as household expenses and therefore counted as monthly costs.
// The server skips anything whose source_id it already has, so a second run adds nothing.
(() => {
  "use strict";

  const PEOPLE = { "Maximilian Hofer": "max", "Ingrid Harder": "ingrid" };
  const ORIGIN = { dashboard: "Hausbau-Dashboard", haushalt: "Haushaltsbuchung" };

  // Dashboard trade (Gewerk) -> budget block and sub category of the finance app.
  const TRADE_RULES = [
    [/gemeinde/i, "Bürokratie & Gebühren", "Gemeinde & Genehmigung", "firma"],
    [/notar/i, "Bürokratie & Gebühren", "Notar & Grundbuch", "firma"],
    [/rechtsberatung|notar/i, "Bürokratie & Gebühren", "Notar & Grundbuch"],
    [/versicherung/i, "Bürokratie & Gebühren", "Bauversicherung"],
    [/planung|architekt/i, "Planung & Technik", "Architekt"],
    [/statik/i, "Planung & Technik", "Statik"],
    [/elektr|blitz/i, "Planung & Technik", "Elektro"],
    [/heizung|sanit|lüftung|hydraulik|wärmepumpe/i, "Planung & Technik", "Heizung/Wärmepumpe"],
    [/photovoltaik|\bpv\b/i, "Planung & Technik", "Photovoltaik"],
    [/abbruch/i, "Abbruch & Rohbau", "Abbruch"],
    [/baumeister|maurer/i, "Abbruch & Rohbau", "Baumeister/Maurer"],
    [/dachbegr|carport/i, "Carport & Außenanlagen", "Carport"],
    [/dach|spengler|zimmerer/i, "Abbruch & Rohbau", "Dach"],
    [/fenster|tür/i, "Abbruch & Rohbau", "Fenster & Türen"],
    [/fassade|dämm|putz/i, "Abbruch & Rohbau", "Fassade & Dämmung"],
    [/garten|außen|zaun|pflaster/i, "Carport & Außenanlagen", "Garten"],
    [/küche/i, "Innenausbau & Küche", "Küche"],
    [/tischler/i, "Innenausbau & Küche", "Innentüren"],
    [/maler/i, "Innenausbau & Küche", "Malerarbeiten"],
    [/boden|fliesen|parkett/i, "Innenausbau & Küche", "Böden"],
    [/stiege/i, "Innenausbau & Küche", "Stiegen"]
  ];
  const FALLBACK_BLOCK = "Bürokratie & Gebühren";

  let dashboardRows = [];
  let fileName = "";
  let busy = false;
  let lastSummary = "";
  const unchecked = new Set();
  // Budget block chosen for household rows (they are rebuilt from the transactions on every render).
  const blockOverrides = {};

  const app = () => window.FinanceApp;
  const hb = () => window.Hausbau;
  const esc = (value) => app().escapeHtml(value);
  const cents = (value) => Math.round(Number(value || 0) * 100);
  const sameKey = (date, amount) => `${String(date || "").slice(0, 10)}|${cents(amount)}`;
  const alive = (rows) => (rows || []).filter((row) => String(row.is_deleted || "").toLowerCase() !== "ja");

  function root() {
    return document.getElementById("hbImportCard");
  }

  function blockFor(gewerk, firma) {
    for (const [pattern, main, sub, field] of TRADE_RULES) {
      if (pattern.test(field === "firma" ? firma : gewerk)) return { main, sub };
    }
    return { main: FALLBACK_BLOCK, sub: "" };
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
    const block = blockFor(payment.gewerk || "", payment.firma || "");
    return {
      source_id: `dashboard:${payment.id}`,
      date: payment.datum,
      title: payment.beschreibung || payment.gewerk || "Zahlung",
      main_category: block.main,
      sub_category: block.sub,
      ...shareFor(payment),
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
      main_category: FALLBACK_BLOCK,
      sub_category: "Administration",
      unit: "shared",
      allocation_key: "PROMILLE",
      share_max: hb().promilleShareMax(),
      vendor: "",
      trade: "Planung & Genehmigung",
      tax_bonus: "keine",
      amount: Number(row.amount) || 0,
      status: "bezahlt",
      paid_by: "max",
      funding_source: "eigenmittel",
      note: [row.note, `übernommen aus Haushaltsbuchung ${row.id}`].filter(Boolean).join(" · ")
    };
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

    const rows = dashboardRows.map((record) => {
      const twin = byAmount.get(sameKey(record.date, record.amount));
      if (bySource.has(record.source_id)) return { key: record.source_id, origin: "dashboard", record, state: "done" };
      if (twin) return { key: record.source_id, origin: "dashboard", record, state: "twin", twin: twin.title };
      return { key: record.source_id, origin: "dashboard", record, state: "new" };
    });
    householdRows().forEach((tx) => {
      const record = fromTransaction(tx);
      if (blockOverrides[record.source_id]) {
        record.main_category = blockOverrides[record.source_id];
        if (!(hb().categoryMap()[record.main_category] || []).includes(record.sub_category)) record.sub_category = "";
      }
      // Already recorded elsewhere: only remove it from the household, unless the dashboard twin is deselected.
      const fileTwin = fromFile.get(sameKey(tx.date, tx.amount));
      const twin = (fileTwin && !unchecked.has(fileTwin.source_id) ? fileTwin : null) || byAmount.get(sameKey(tx.date, tx.amount));
      rows.push({
        key: record.source_id,
        origin: "haushalt",
        record,
        txId: tx.id,
        state: twin ? "removeOnly" : "move",
        twin: twin?.title
      });
    });
    return rows.sort((a, b) => String(a.record.date).localeCompare(String(b.record.date)));
  }

  const STATE_TEXT = {
    new: ["neu", "cm-move"],
    move: ["wird verschoben", "cm-move"],
    removeOnly: ["schon erfasst, nur aus Haushalt entfernen", "cm-check"],
    twin: ["gleicher Betrag am selben Tag schon vorhanden", "cm-warn"],
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
            <p>Ab jetzt trägst du Hausbau-Ausgaben nur noch hier ein; das Hausbau-Dashboard zeigt sie nur an. Hier übernimmst du einmalig die Zahlungen aus dem Dashboard (Datei <code>data/zahlungen.json</code> im Hausbau-Ordner) und die Hausbau-Buchungen aus dem Haushalt. Hausbau-Kosten zählen nicht zu den Monatskosten.</p>
          </div>
        </div>
        <div class="actions-row">
          <label class="btn btn-ghost">zahlungen.json wählen<input type="file" accept=".json,application/json" data-hi="file" class="sr-only" /></label>
          <button class="btn btn-primary" type="button" data-hi="run">Ausgewählte übernehmen</button>
        </div>
        <p class="cm-summary" data-hi="summary"></p>
        <div class="table-scroll">
          <table class="data-table" data-hi="table">
            <thead><tr><th></th><th>Datum</th><th>Ausgabe</th><th class="num">Betrag</th><th>Aufteilung</th><th>Bezahlt von</th><th>Status</th><th>Budgetblock</th></tr></thead>
            <tbody></tbody>
          </table>
        </div>`;
      card.addEventListener("change", onChange);
      card.addEventListener("click", (event) => {
        if (event.target.closest('[data-hi="run"]')) run();
      });
    }

    const blocks = Object.keys(hb().categoryMap());
    const blockOptions = (selected) => blocks.map((block) =>
      `<option value="${esc(block)}"${block === selected ? " selected" : ""}>${esc(block)}</option>`).join("");
    const chosen = open.filter(isChecked);
    const total = chosen.filter((row) => row.state !== "removeOnly").reduce((sum, row) => sum + row.record.amount, 0);
    const summary = card.querySelector('[data-hi="summary"]');
    summary.textContent = lastSummary || (dashboardRows.length
      ? `${fileName}: ${dashboardRows.length} Zahlungen gelesen. Ausgewählt: ${chosen.length} Einträge, ${app().currency(total)}.`
      : `Noch keine Datei gewählt.${open.length ? ` ${open.length} Hausbau-Buchungen aus dem Haushalt warten auf die Übernahme.` : ""}`);
    card.querySelector('[data-hi="run"]').disabled = busy || !chosen.length;
    card.querySelector('[data-hi="table"]').hidden = !rows.length;
    card.querySelector("tbody").innerHTML = rows.map((row) => {
      const r = row.record;
      const [text, tone] = STATE_TEXT[row.state];
      const sendsRecord = row.state !== "removeOnly";
      return `<tr>
        <td><input type="checkbox" data-hi-key="${esc(row.key)}"${isChecked(row) ? " checked" : ""}${row.state === "done" || busy ? " disabled" : ""} aria-label="übernehmen" /></td>
        <td>${esc(app().formatGermanDate(r.date))}</td>
        <td>${esc(r.title)}<div class="text-muted">${esc([ORIGIN[row.origin], r.trade, r.vendor].filter(Boolean).join(" · "))}</div></td>
        <td class="num">${app().currency(r.amount)}</td>
        <td>${esc(splitLabel(r))}</td>
        <td>${r.paid_by === "ingrid" ? "Ingrid" : "Maximilian"}</td>
        <td><span class="pill ${tone}">${esc(text)}</span>${row.twin ? `<div class="text-muted">${esc(row.twin)}</div>` : ""}</td>
        <td>${sendsRecord && row.state !== "done"
          ? `<select data-hi-block="${esc(row.key)}"${busy ? " disabled" : ""}>${blockOptions(r.main_category)}</select>`
          : esc(r.main_category)}</td>
      </tr>`;
    }).join("");
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
    if (!block) return;
    const record = dashboardRows.find((entry) => entry.source_id === block.dataset.hiBlock);
    if (!record) {
      blockOverrides[block.dataset.hiBlock] = block.value;
      return;
    }
    record.main_category = block.value;
    if (!(hb().categoryMap()[block.value] || []).includes(record.sub_category)) record.sub_category = "";
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
    const chosen = candidates().filter((row) => row.state !== "done" && isChecked(row));
    if (!chosen.length) return;
    const records = chosen.filter((row) => row.state !== "removeOnly").map((row) => ({ ...row.record }));
    const moveTransactionIds = chosen.filter((row) => row.txId).map((row) => row.txId);
    const total = records.reduce((sum, record) => sum + record.amount, 0);
    const question = [
      records.length ? `${records.length} Ausgaben (${app().currency(total)}) in den Hausbau übernehmen` : "",
      moveTransactionIds.length ? `${moveTransactionIds.length} Hausbau-Buchungen aus dem Haushalt entfernen` : ""
    ].filter(Boolean).join(" und ");
    if (!window.confirm(`${question}?`)) return;

    busy = true;
    render();
    try {
      const result = await app().apiPost("hausbauImport", { records, moveTransactionIds });
      lastSummary = `Fertig: ${result.imported} übernommen` +
        (result.skipped ? `, ${result.skipped} waren schon da` : "") +
        (result.moved ? `, ${result.moved} aus dem Haushalt entfernt` : "") + ".";
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
