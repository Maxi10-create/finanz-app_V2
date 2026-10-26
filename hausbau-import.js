// Hausbau import: the finance app is the single place where house expenses are entered.
// It takes over (1) the payments recorded so far in the house dashboard (built in below,
// checked with Maximilian on 2026-10-25) and (2) Hausbau bookings that were entered as
// household expenses and therefore counted as monthly costs. Since 2026-10-26 there is no
// card any more: whatever is still open is done on its own after loading, with one message.
// The server skips anything whose source_id it already has, so a second run adds nothing.
(() => {
  "use strict";

  const PEOPLE = { "Maximilian Hofer": "max", "Ingrid Harder": "ingrid" };

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
  let dashboardRows = null;

  /** The dashboard payments as expense records (built on first use, the split keys need the app). */
  function plannedRows() {
    if (!dashboardRows) dashboardRows = DASHBOARD_PAYMENTS.map(fromPayment);
    return dashboardRows;
  }
  let busy = false;
  // A run that failed is not repeated in this session (no loop of failing requests).
  let failed = false;
  // Each row is tried once per session, so a row the server keeps differently cannot loop.
  const attempted = new Set();

  const app = () => window.FinanceApp;
  const hb = () => window.Hausbau;
  const cents = (value) => Math.round(Number(value || 0) * 100);
  const sameKey = (date, amount) => `${String(date || "").slice(0, 10)}|${cents(amount)}`;
  const alive = (rows) => (rows || []).filter((row) => String(row.is_deleted || "").toLowerCase() !== "ja");

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

  /**
   * Firm decides the Gewerk; vendor/trade mirror Firma/Gewerk. New rows get the standard split;
   * a credit or loan booked under fees moves to Finanzierungskosten (the loan is Maximilian's).
   */
  function withCategory(record, useRules = true) {
    const text = `${record.title || ""} ${record.hint || ""}`;
    let pick = hb().classify(record.vendor, record.trade, record.hint || record.title);
    const loanCost = pick.main === "Bürokratie & Gebühren" && /kredit|darlehen/i.test(text);
    if (loanCost) pick = { main: "Finanzierungskosten", sub: "Bank & Kreditnotar" };
    const rule = useRules || loanCost ? hb().defaultSplitKey(pick.main, pick.sub, text) : "";
    const split = hb().splitFields(rule);
    const out = { ...record, ...(split || {}), main_category: pick.main, sub_category: pick.sub, vendor: pick.sub, trade: pick.main };
    delete out.hint;
    return out;
  }

  /** Expenses taken over earlier whose Gewerk or Firma differ from what they should be now. */
  function staleExpenses() {
    const fields = ["main_category", "sub_category"];
    const planned = new Map(plannedRows().map((record) => [record.source_id, record]));
    return alive(hb().expenses()).filter((row) => row.source_id).map((row) => {
      const base = planned.get(row.source_id);
      const record = withCategory(base ? { ...row, ...base } : { ...row }, false);
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

  /** Loan costs booked as fees by hand (no source_id) belong to Finanzierungskosten as well. */
  function loanFeeExpenses() {
    return alive(hb().expenses()).filter((row) => !row.source_id && row.main_category === "Bürokratie & Gebühren" &&
      /kredit|darlehen/i.test(`${row.title} ${row.note || ""}`))
      .map((row) => ({ row, record: withCategory({ ...row, vendor: "", hint: row.title }), changed: ["main_category", "sub_category"] }));
  }

  /** All candidate rows with their duplicate state. */
  function candidates() {
    const existing = alive(hb().expenses());
    const bySource = new Set(existing.map((row) => row.source_id).filter(Boolean));
    const byAmount = new Map(existing.map((row) => [sameKey(row.date, row.amount), row]));
    const fromFile = new Map(plannedRows().map((record) => [sameKey(record.date, record.amount), record]));

    const stale = staleExpenses().concat(loanFeeExpenses());
    const staleIds = new Set(stale.map((entry) => entry.row.source_id));
    const rows = stale.map(({ row, record }) => ({ key: row.source_id || row.id, record, expense: row, state: "recat" }));
    plannedRows().forEach((raw) => {
      if (staleIds.has(raw.source_id)) return;
      const record = withCategory(raw);
      const twin = byAmount.get(sameKey(record.date, record.amount));
      // A payment of the same day and amount already exists: it was entered by hand, keep that one.
      if (bySource.has(record.source_id) || twin) return;
      rows.push({ key: record.source_id, record, state: "new" });
    });
    householdRows().forEach((tx) => {
      const record = withCategory(fromTransaction(tx));
      // Already recorded in the Hausbau: only remove it from the household.
      const twin = fromFile.get(sameKey(tx.date, tx.amount)) || byAmount.get(sameKey(tx.date, tx.amount));
      rows.push({ key: twin ? `remove:${tx.id}` : record.source_id, record, txId: tx.id, state: twin ? "removeOnly" : "move" });
    });
    // A household booking taken over although the dashboard already had the payment.
    const fromDashboard = new Set(existing.filter((row) => String(row.source_id || "").startsWith("dashboard:"))
      .map((row) => sameKey(row.date, row.amount)));
    existing.filter((row) => String(row.source_id || "").startsWith("haushalt:") && fromDashboard.has(sameKey(row.date, row.amount)))
      .forEach((row) => {
        const index = rows.findIndex((entry) => entry.key === row.source_id);
        if (index !== -1) rows.splice(index, 1);
        rows.push({ key: `double:${row.id}`, record: row, expenseId: row.id, state: "double" });
      });
    return rows.sort((a, b) => String(a.record.date).localeCompare(String(b.record.date)));
  }

  /** Takes over whatever is still open, without asking: the owner decided so on 2026-10-26. */
  async function finish() {
    if (busy || failed || !hb() || !app()?.data) return;
    const open = candidates().filter((row) => !attempted.has(row.key));
    if (!open.length) return;
    open.forEach((row) => attempted.add(row.key));
    busy = true;
    try {
      const updates = open.filter((row) => row.state === "recat");
      const records = open.filter((row) => ["new", "move"].includes(row.state)).map((row) => ({ ...row.record }));
      const moveTransactionIds = open.filter((row) => row.txId).map((row) => row.txId);
      const deleteExpenseIds = open.filter((row) => row.expenseId).map((row) => row.expenseId);
      let result = { imported: 0 };
      if (records.length || moveTransactionIds.length || deleteExpenseIds.length) {
        result = await app().apiPost("hausbauImport", { records, moveTransactionIds, deleteExpenseIds });
      }
      for (const row of updates) {
        const r = row.record;
        const changes = {};
        ["main_category", "sub_category", "vendor", "trade"].forEach((field) => { if (r[field]) changes[field] = r[field]; });
        if (r.main_category === "Finanzierungskosten") Object.assign(changes, { unit: r.unit, allocation_key: r.allocation_key, share_max: r.share_max });
        result = { ...(await hb().saveExpenseFields(row.expense, changes)), imported: result.imported, moved: result.moved, removed: result.removed };
      }
      const parts = [
        result.imported ? `${result.imported} übernommen` : "",
        result.moved ? `${result.moved} Hausbau-Buchungen aus dem Haushalt in den Hausbau verschoben` : "",
        result.removed ? `${result.removed} doppelte gelöscht` : "",
        updates.length ? `${updates.length} Gewerk/Firma angepasst` : ""
      ].filter(Boolean);
      await app().refreshAfterWrite(result);
      if (parts.length) app().showMessage(`Hausbau-Zahlungen abgeglichen: ${parts.join(", ")}.`, "success");
    } catch (error) {
      failed = true;
      app().showMessage(`Hausbau-Abgleich fehlgeschlagen: ${error.message}. Beim nächsten Laden wird es erneut versucht.`, "error");
    } finally {
      busy = false;
    }
  }

  window.HausbauImport = { finish };
})();
