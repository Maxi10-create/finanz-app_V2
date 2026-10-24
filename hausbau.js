// Hausbau: private module for the house project of Maximilian and Ingrid Harder.
// The server only sends `data.hausbau` to its owner, so for everyone else this
// module stays hidden. Building costs never enter the monthly cost calculation;
// only loan payments are handed to app.js as virtual fixed costs.
(() => {
  "use strict";

  const PEOPLE = { max: "Maximilian", ingrid: "Ingrid" };
  const UNITS = { max: "Wohnung Maximilian", ingrid: "Wohnung Ingrid", shared: "Gemeinsam" };
  const STATUS = { angebot: "Angebot", beauftragt: "Beauftragt", bezahlt: "Bezahlt" };
  const FUNDING = { eigenmittel: "Eigenmittel", kredit: "Kredit", foerderung: "Förderung" };
  const LOAN_TYPES = { bank: "Bankkredit", foerderdarlehen: "Förderdarlehen", zuschuss: "Zuschuss" };
  const EVENT_TYPES = {
    auszahlung: "Auszahlung",
    sondertilgung: "Sondertilgung",
    zinsanpassung: "Zinsanpassung (neuer Zinssatz)",
    ratenaenderung: "Ratenänderung (neue Rate)",
    gebuehr: "Gebühr",
    saldo_bank: "Saldo laut Bank",
    zuschuss: "Zuschuss erhalten"
  };
  const DEFAULT_AREA = { max: 95, ingrid: 84 };
  // Same budget blocks as the Umbau Hintersun 8 cockpit, so both show the same numbers.
  const DEFAULT_CATEGORIES = {
    "Abbruch & Rohbau": ["Abbruch", "Baumeister/Maurer", "Dach", "Fenster & Türen", "Fassade & Dämmung"],
    "Wohnung A (EG)": ["Ausbau", "Bad", "Böden", "Elektro", "Sanitär"],
    "Wohnung B (OG+DG)": ["Ausbau", "Bad", "Böden", "Elektro", "Sanitär"],
    "Carport & Außenanlagen": ["Carport", "Zufahrt", "Garten", "Zaun"],
    "Planung & Technik": ["Architekt", "Statik", "Haustechnik-Planung", "Heizung/Wärmepumpe", "Photovoltaik", "Elektro"],
    "Innenausbau & Küche": ["Küche", "Innentüren", "Malerarbeiten", "Böden", "Stiegen"],
    "Bürokratie & Gebühren": ["Administration", "Gemeinde & Genehmigung", "Notar & Grundbuch", "Gebühren", "Bauversicherung"]
  };
  const MAX_LOAN_MONTHS = 600;

  let activeSection = "overview";
  let skeletonBuilt = false;
  const editing = {};

  /* ---- bridge to app.js ---------------------------------------------- */

  const app = () => window.FinanceApp;
  const esc = (value) => app().escapeHtml(value);
  const eur = (value) => app().currency(value);
  const num = (value) => {
    const parsed = Number(String(value ?? "").replace(",", "."));
    return Number.isFinite(parsed) ? parsed : 0;
  };
  const round2 = (value) => Math.round(value * 100) / 100;
  const monthKey = (value) => String(value || "").slice(0, 7);
  const thisMonth = () => app().currentMonth();
  const monthLabel = (month) => (month ? `${month.slice(5, 7)}/${month.slice(0, 4)}` : "—");

  function addMonths(month, count) {
    const [year, mon] = month.split("-").map(Number);
    const date = new Date(year, mon - 1 + count, 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function data() {
    return app()?.data?.hausbau || null;
  }

  function alive(rows) {
    return (rows || []).filter((row) => String(row.is_deleted || "").toLowerCase() !== "ja");
  }

  function project() {
    return alive(data()?.project)[0] || {};
  }

  function areaShareMax() {
    const p = project();
    const areaMax = num(p.area_max) || DEFAULT_AREA.max;
    const areaIngrid = num(p.area_ingrid) || DEFAULT_AREA.ingrid;
    return round2(areaMax / (areaMax + areaIngrid) * 100);
  }

  /* ---- allocation keys ------------------------------------------------- */

  function allocationKeys() {
    const builtIn = [
      { id: "MAX", name: "Nur Maximilian", share_max: 100 },
      { id: "INGRID", name: "Nur Ingrid", share_max: 0 },
      { id: "AREA", name: `Nutzfläche (${areaShareMax().toFixed(1)} / ${(100 - areaShareMax()).toFixed(1)})`, share_max: areaShareMax() },
      { id: "HALF", name: "50 / 50", share_max: 50 }
    ];
    const custom = alive(data()?.keys).map((key) => ({
      id: key.id,
      name: `${key.name} (${num(key.share_max).toFixed(1)} / ${(100 - num(key.share_max)).toFixed(1)})`,
      share_max: num(key.share_max),
      custom: true
    }));
    return builtIn.concat(custom, [{ id: "CUSTOM", name: "Individuell (Prozent unten)", share_max: null }]);
  }

  function defaultKeyForUnit(unit) {
    if (unit === "max") return "MAX";
    if (unit === "ingrid") return "INGRID";
    return "AREA";
  }

  /* ---- expenses & Ingrid balance ---------------------------------------- */

  function expenses() {
    return alive(data()?.expenses).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  function expenseShares(row) {
    const amount = num(row.amount);
    const shareMax = row.share_max === "" || row.share_max == null ? 100 : num(row.share_max);
    const max = amount * shareMax / 100;
    return { amount, max, ingrid: amount - max, shareMax };
  }

  function isPaid(row) {
    return !row.status || row.status === "bezahlt";
  }

  function grants() {
    return alive(data()?.loans).filter((loan) => loan.loan_type === "zuschuss");
  }

  function grantReceived(loan) {
    const received = alive(data()?.loanEvents)
      .filter((event) => event.loan_id === loan.id && ["auszahlung", "zuschuss"].includes(event.event_type))
      .reduce((sum, event) => sum + num(event.amount), 0);
    return received;
  }

  /** Positive: Ingrid owes Maximilian. Negative: Maximilian owes Ingrid. */
  function ingridBalance() {
    const lines = [];
    let balance = 0;
    expenses().filter(isPaid).forEach((row) => {
      const shares = expenseShares(row);
      const effect = row.paid_by === "ingrid" ? -shares.max : shares.ingrid;
      if (!effect) return;
      balance += effect;
      lines.push({ date: row.date, text: `${row.title} (${PEOPLE[row.paid_by] || "?"} bezahlt)`, effect });
    });
    alive(data()?.settlements).forEach((row) => {
      const effect = row.from_person === "ingrid" ? -num(row.amount) : num(row.amount);
      balance += effect;
      lines.push({ date: row.date, text: `Ausgleich von ${PEOPLE[row.from_person] || "?"}${row.note ? ` – ${row.note}` : ""}`, effect });
    });
    grants().forEach((loan) => {
      const ingridShare = (100 - (loan.share_max === "" ? 100 : num(loan.share_max))) / 100;
      const effect = -grantReceived(loan) * ingridShare;
      if (!effect) return;
      balance += effect;
      lines.push({ date: "", text: `Anteil Ingrid an ${loan.title} (von Maximilian erhalten)`, effect });
    });
    lines.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    return { balance: round2(balance), lines };
  }

  /* ---- loans ----------------------------------------------------------- */

  function creditLoans() {
    return alive(data()?.loans).filter((loan) => loan.loan_type !== "zuschuss");
  }

  function loanEvents(loanId) {
    return alive(data()?.loanEvents)
      .filter((event) => event.loan_id === loanId)
      .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  /**
   * Month-by-month plan of a loan: payouts, interest on the drawn balance,
   * commitment fee on the undrawn rest, interest-only months before the first
   * rate, annuity afterwards. "Saldo laut Bank" resets the balance to the bank's figure.
   */
  // Schedules are needed for every month of every chart, so compute each once per data load.
  let scheduleCache = { source: null, byLoan: new Map() };

  function loanSchedule(loan, extra = null) {
    if (extra) return computeLoanSchedule(loan, extra);
    if (scheduleCache.source !== data()) scheduleCache = { source: data(), byLoan: new Map() };
    if (!scheduleCache.byLoan.has(loan.id)) scheduleCache.byLoan.set(loan.id, computeLoanSchedule(loan));
    return scheduleCache.byLoan.get(loan.id);
  }

  function computeLoanSchedule(loan, extra = null) {
    const events = loanEvents(loan.id);
    const amount = num(loan.amount);
    const firstRate = monthKey(loan.first_rate_month);
    const payouts = events.filter((event) => event.event_type === "auszahlung");
    const eventMonths = events.map((event) => monthKey(event.date)).filter(Boolean);
    const startCandidates = eventMonths.concat(firstRate ? [firstRate] : []);
    if (!startCandidates.length) startCandidates.push(thisMonth());
    const start = startCandidates.sort()[0];
    const assumeFullPayout = !payouts.length;

    let rate = num(loan.interest_rate);
    let monthlyRate = num(loan.monthly_rate);
    let balance = 0;
    let drawn = 0;
    const rows = [];

    for (let index = 0; index < MAX_LOAN_MONTHS; index += 1) {
      const month = addMonths(start, index);
      const inMonth = events.filter((event) => monthKey(event.date) === month);
      let payout = 0;
      let extraRepayment = 0;
      let fees = 0;
      let grant = 0;
      let bankBalance = null;
      inMonth.forEach((event) => {
        const value = num(event.amount);
        if (event.event_type === "auszahlung") payout += value;
        if (event.event_type === "sondertilgung") extraRepayment += value;
        if (event.event_type === "gebuehr") fees += value;
        if (event.event_type === "zuschuss") grant += value;
        if (event.event_type === "zinsanpassung" && event.interest_rate !== "") rate = num(event.interest_rate);
        if (event.event_type === "ratenaenderung" && event.monthly_rate !== "") monthlyRate = num(event.monthly_rate);
        if (event.event_type === "saldo_bank") bankBalance = value;
      });
      if (assumeFullPayout && index === 0) payout = amount;
      if (extra && extra.month === month) extraRepayment += extra.amount;

      balance += payout;
      drawn += payout;
      const interest = round2(balance * rate / 100 / 12);
      const freeMonths = num(loan.commitment_free_months);
      const commitmentFee = index >= freeMonths
        ? round2(Math.max(0, amount - drawn) * num(loan.commitment_fee_rate) / 100 / 12)
        : 0;
      const repaying = firstRate && month >= firstRate;
      let payment = interest;
      let principal = 0;
      if (repaying) {
        payment = Math.min(monthlyRate, round2(balance + interest));
        principal = round2(payment - interest);
      }
      balance = round2(balance - principal - extraRepayment);
      if (bankBalance !== null) balance = bankBalance;
      if (balance < 0) balance = 0;

      rows.push({
        month,
        payout,
        interest,
        commitmentFee,
        principal,
        payment,
        extraRepayment,
        fees,
        grant,
        rate,
        repaying,
        balance,
        drawn,
        cost: round2(payment + commitmentFee + fees - grant)
      });

      const projecting = month >= thisMonth();
      if (repaying && balance <= 0.005) break;
      if (projecting && !firstRate && index > 0) break; // no rate known: nothing to project
      if (projecting && repaying && monthlyRate <= interest) break; // rate does not cover interest
    }
    return rows;
  }

  function loanSummary(loan) {
    const rows = loanSchedule(loan);
    const now = thisMonth();
    const past = rows.filter((row) => row.month <= now);
    const future = rows.filter((row) => row.month > now);
    const current = past[past.length - 1] || { balance: 0, drawn: 0, payment: 0, cost: 0 };
    const fixedUntil = monthKey(loan.fixed_until);
    const atFixedEnd = fixedUntil ? rows.filter((row) => row.month <= fixedUntil).pop() : null;
    const last = rows[rows.length - 1];
    const paidOff = last && last.balance <= 0.005;
    return {
      rows,
      balance: current.balance,
      drawn: current.drawn,
      available: Math.max(0, num(loan.amount) - current.drawn),
      interestPaid: past.reduce((sum, row) => sum + row.interest, 0),
      principalPaid: past.reduce((sum, row) => sum + row.principal + row.extraRepayment, 0),
      interestRemaining: future.reduce((sum, row) => sum + row.interest, 0),
      payoffMonth: paidOff ? last.month : null,
      remainingMonths: paidOff ? future.length : null,
      balanceAtFixedEnd: atFixedEnd ? atFixedEnd.balance : null,
      currentCost: (rows.find((row) => row.month === now) || {}).cost || 0
    };
  }

  function whatIf(loan, extraAmount) {
    const base = loanSchedule(loan);
    const changed = loanSchedule(loan, { month: thisMonth(), amount: extraAmount });
    const interest = (rows) => rows.filter((row) => row.month >= thisMonth()).reduce((sum, row) => sum + row.interest, 0);
    return {
      monthsSaved: base.length - changed.length,
      interestSaved: round2(interest(base) - interest(changed)),
      payoffMonth: changed[changed.length - 1]?.month
    };
  }

  /** Virtual fixed costs for app.js: only loan costs, never building costs. */
  function loanFixedCostRows(month) {
    if (!data()) return [];
    return creditLoans().map((loan) => {
      const row = loanSchedule(loan).find((entry) => entry.month === month);
      const share = loan.share_max === "" || loan.share_max == null ? 100 : num(loan.share_max);
      const cost = row ? round2(row.cost * share / 100) : 0;
      if (!cost) return null;
      return {
        id: `HB_${loan.id}`,
        title: `${loan.title}${row.repaying ? "" : " (Bauzeitzinsen)"}`,
        main_category: "Wohnen",
        sub_category: row.repaying ? "Kreditrate" : "Bauzeitzinsen",
        amount: cost,
        frequency: "monatlich",
        owner_user: app().currentUserName(),
        split_enabled: "nein",
        _virtual: true
      };
    }).filter(Boolean);
  }

  /** Subsidy conditions due within this many days show up as a reminder. */
  const CONDITION_REMINDER_DAYS = 60;

  function dueConditions() {
    const today = app().todayDate();
    const limit = new Date();
    limit.setDate(limit.getDate() + CONDITION_REMINDER_DAYS);
    const limitKey = `${limit.getFullYear()}-${String(limit.getMonth() + 1).padStart(2, "0")}-${String(limit.getDate()).padStart(2, "0")}`;
    return alive(data()?.loans)
      .filter((loan) => loan.conditions && loan.conditions_due && loan.conditions_due <= limitKey)
      .map((loan) => ({ loan, overdue: loan.conditions_due < today }));
  }

  function conditionsRow(loan) {
    if (!loan.conditions) return "";
    const overdue = loan.conditions_due && loan.conditions_due < app().todayDate();
    return `<tr><td>Auflagen</td><td class="num${overdue ? " hb-overdue" : ""}">${esc(loan.conditions)}${loan.conditions_due ? ` · bis ${esc(app().formatGermanDate(loan.conditions_due))}` : ""}</td></tr>`;
  }

  /** This month's loan payment and the part of it that repays debt (builds wealth). */
  function currentLoanSplit() {
    const month = thisMonth();
    return creditLoans().reduce((total, loan) => {
      const row = loanSchedule(loan).find((entry) => entry.month === month);
      const share = (loan.share_max === "" || loan.share_max == null ? 100 : num(loan.share_max)) / 100;
      if (!row) return total;
      total.cost += row.cost * share;
      total.principal += row.principal * share;
      return total;
    }, { cost: 0, principal: 0 });
  }

  function openExpenseForm() {
    if (!data()) return;
    activeSection = "expenses";
    showSection();
    resetForm("expense");
    const form = formFor("expense");
    form?.scrollIntoView({ behavior: "smooth", block: "start" });
    form?.elements.title?.focus({ preventScroll: true });
  }

  /* ---- categories ------------------------------------------------------- */

  function categoryMap() {
    const map = {};
    Object.keys(DEFAULT_CATEGORIES).forEach((main) => { map[main] = DEFAULT_CATEGORIES[main].slice(); });
    alive(data()?.categories).forEach((row) => {
      map[row.main_category] = map[row.main_category] || [];
      if (row.sub_category && !map[row.main_category].includes(row.sub_category)) {
        map[row.main_category].push(row.sub_category);
      }
    });
    return map;
  }

  /* ---- rendering helpers ---------------------------------------------- */

  const options = (map, selected = "", empty = "") =>
    (empty ? `<option value="">${esc(empty)}</option>` : "") +
    Object.keys(map).map((key) => `<option value="${esc(key)}"${key === selected ? " selected" : ""}>${esc(map[key])}</option>`).join("");

  const listOptions = (list, selected = "", empty = "") =>
    (empty ? `<option value="">${esc(empty)}</option>` : "") +
    list.map((value) => `<option value="${esc(value)}"${value === selected ? " selected" : ""}>${esc(value)}</option>`).join("");

  function setOptions(select, html) {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = html;
    if ([...select.options].some((option) => option.value === previous)) select.value = previous;
  }

  const empty = (cols, text = "Noch keine Einträge") =>
    `<tr><td colspan="${cols}" class="table-empty">${esc(text)}</td></tr>`;

  const rowActions = (entity, id) => `
    <div class="table-actions">
      <button type="button" class="btn btn-ghost btn-xs" data-hb-edit="${esc(entity)}" data-id="${esc(id)}">Bearbeiten</button>
      <button type="button" class="btn btn-ghost btn-xs" data-hb-delete="${esc(entity)}" data-id="${esc(id)}">Löschen</button>
    </div>`;

  const hero = (label, value, sub, id = "") => `
    <div class="hero-card">
      <div class="hero-label">${esc(label)}</div>
      <div class="hero-value"${id ? ` id="${id}"` : ""}>${esc(value)}</div>
      <div class="hero-sub">${esc(sub)}</div>
    </div>`;

  const field = (label, input, cls = "") => `<label${cls ? ` class="${cls}"` : ""}>${esc(label)}${input}</label>`;

  const formButtons = (entity, text) => `
    <div class="full actions-row">
      <button class="btn btn-primary" type="submit">${esc(text)}</button>
      <button class="btn btn-ghost js-hb-cancel" type="button" data-entity="${entity}" style="display:none;">Bearbeitung abbrechen</button>
    </div>`;

  /* ---- skeleton (built once, so typing is never lost on re-render) ------ */

  function buildSkeleton(root) {
    root.innerHTML = `
      <section class="card">
        <div class="card-header">
          <div>
            <h2 id="hbTitle">Hausbau</h2>
            <p>Nur für dich sichtbar. Baukosten zählen nicht zu den Monatskosten, nur die Kreditraten.</p>
          </div>
        </div>
        <div class="hb-subnav" id="hbSubnav">
          <button type="button" class="btn btn-ghost btn-xs hb-tab active" data-hb-section="overview">Übersicht</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="expenses">Ausgaben</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="ingrid">Aufteilung Ingrid</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="loans">Kredit &amp; Förderung</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="settings">Einstellungen</button>
        </div>
      </section>

      <div class="hb-section" data-section="overview">
        <div class="hero-grid" id="hbOverviewHero"></div>
        <section class="card">
          <div class="card-header"><div><h2>Offene Posten</h2><p>Angebote und beauftragte Leistungen, nach Fälligkeit</p></div></div>
          <div class="table-scroll"><table class="data-table" id="hbOpenTable">
            <thead><tr><th>Fällig</th><th>Position</th><th>Firma</th><th>Status</th><th class="num">Betrag</th><th class="num">Dein Anteil</th><th>Aktion</th></tr></thead>
            <tbody></tbody></table></div>
        </section>
        <div class="chart-grid">
          <section class="card">
            <div class="card-header"><div><h2>Kosten nach Gewerk</h2><p>Anteil Maximilian und Ingrid</p></div></div>
            <canvas id="hbCategoryChart"></canvas>
          </section>
          <section class="card">
            <div class="card-header"><div><h2>Verlauf</h2><p>Kumulierte Baukosten pro Monat</p></div></div>
            <canvas id="hbTimelineChart"></canvas>
          </section>
        </div>
        <div class="table-grid">
          <section class="card">
            <div class="card-header"><div><h2>Gewerke</h2><p>Bezahlt und offen, mit Aufteilung</p></div></div>
            <div class="table-scroll"><table class="data-table" id="hbCategoryTable">
              <thead><tr><th>Gewerk</th><th class="num">Gesamt</th><th class="num">Maximilian</th><th class="num">Ingrid</th><th class="num">Offen</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
          <section class="card">
            <div class="card-header"><div><h2>Finanzierung &amp; Bauteile</h2><p>Woher das Geld kommt und wofür</p></div></div>
            <div class="table-scroll"><table class="data-table" id="hbFundingTable">
              <thead><tr><th>Position</th><th class="num">Betrag</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
        </div>
        <section class="card">
          <div class="card-header"><div><h2>Größte Firmen</h2><p>Summe aller Rechnungen pro Firma</p></div></div>
          <div class="table-scroll"><table class="data-table" id="hbVendorTable">
            <thead><tr><th>Firma</th><th class="num">Rechnungen</th><th class="num">Summe</th></tr></thead>
            <tbody></tbody></table></div>
        </section>
      </div>

      <div class="hb-section" data-section="expenses" hidden>
        <section class="card">
          <div class="card-header"><div><h2>Hausbau-Ausgabe</h2><p id="hbExpenseMode">Neue Ausgabe</p></div></div>
          <form class="form-grid compact-form" data-entity="expense" id="hbExpenseForm">
            <input type="hidden" name="id" />
            ${field("Datum", `<input type="date" name="date" required />`)}
            ${field("Titel", `<input type="text" name="title" required placeholder="z. B. Elektroinstallation 1. Teilrechnung" />`)}
            ${field("Gewerk", `<select name="main_category" id="hbExpenseMain"></select>`)}
            ${field("Unterkategorie", `<select name="sub_category" id="hbExpenseSub"></select>`)}
            ${field("Bauteil", `<select name="unit" id="hbExpenseUnit">${options(UNITS, "shared")}</select>`)}
            ${field("Aufteilung", `<select name="allocation_key" id="hbExpenseKey"></select>`)}
            ${field("Anteil Maximilian (%)", `<input type="number" name="share_max" id="hbExpenseShare" min="0" max="100" step="any" />`)}
            ${field("Betrag (€)", `<input type="number" name="amount" step="0.01" min="0" required />`)}
            ${field("Status", `<select name="status">${options(STATUS, "bezahlt")}</select>`)}
            ${field("Bezahlt von", `<select name="paid_by" id="hbExpensePaidBy">${options(PEOPLE, "max")}</select>`)}
            ${field("Bezahlt aus", `<select name="funding_source" id="hbExpenseFunding">${options(FUNDING, "eigenmittel")}</select>`)}
            ${field("Kredit / Förderung", `<select name="loan_id" id="hbExpenseLoan"></select>`)}
            ${field("Firma", `<input type="text" name="vendor" list="hbVendorList" />`)}
            ${field("Rechnungsnummer", `<input type="text" name="invoice_no" />`)}
            ${field("Fällig am", `<input type="date" name="due_date" />`)}
            ${field("Notiz", `<textarea name="note" rows="2"></textarea>`, "full")}
            <datalist id="hbVendorList"></datalist>
            ${formButtons("expense", "Ausgabe speichern")}
          </form>
        </section>
        <section class="card">
          <div class="card-header"><div><h2>Alle Ausgaben</h2><p id="hbExpenseCount"></p></div></div>
          <div class="form-grid compact-form">
            ${field("Gewerk", `<select id="hbFilterMain"></select>`)}
            ${field("Bauteil", `<select id="hbFilterUnit">${options(UNITS, "", "Alle Bauteile")}</select>`)}
            ${field("Status", `<select id="hbFilterStatus">${options(STATUS, "", "Alle")}</select>`)}
            ${field("Bezahlt von", `<select id="hbFilterPaidBy">${options(PEOPLE, "", "Alle")}</select>`)}
            ${field("Suche", `<input type="search" id="hbFilterText" placeholder="Titel, Firma, Rechnung" />`)}
          </div>
          <div class="table-scroll"><table class="data-table" id="hbExpenseTable">
            <thead><tr><th>Datum</th><th>Titel</th><th>Gewerk</th><th>Bauteil</th><th class="num">Betrag</th><th class="num">Maximilian</th><th class="num">Ingrid</th><th>Status</th><th>Bezahlt</th><th>Aktion</th></tr></thead>
            <tbody></tbody></table></div>
        </section>
      </div>

      <div class="hb-section" data-section="ingrid" hidden>
        <div class="hero-grid" id="hbIngridHero"></div>
        <div class="two-col">
          <section class="card">
            <div class="card-header"><div><h2>Ausgleichszahlung</h2><p id="hbSettlementMode">Neue Zahlung zwischen dir und Ingrid</p></div></div>
            <form class="form-grid compact-form" data-entity="settlement">
              <input type="hidden" name="id" />
              ${field("Datum", `<input type="date" name="date" required />`)}
              ${field("Gezahlt von", `<select name="from_person">${options({ ingrid: "Ingrid an Maximilian", max: "Maximilian an Ingrid" }, "ingrid")}</select>`)}
              ${field("Betrag (€)", `<input type="number" name="amount" step="0.01" min="0" required />`)}
              ${field("Notiz", `<input type="text" name="note" />`)}
              ${formButtons("settlement", "Zahlung speichern")}
            </form>
            <div class="table-scroll"><table class="data-table" id="hbSettlementTable">
              <thead><tr><th>Datum</th><th>Richtung</th><th class="num">Betrag</th><th>Aktion</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
          <section class="card">
            <div class="card-header">
              <div><h2>Abrechnung Ingrid</h2><p>Alle Positionen, die den Saldo bewegen</p></div>
              <button type="button" class="btn btn-ghost btn-xs" id="hbPrintStatement">Abrechnung drucken</button>
            </div>
            <div class="table-scroll"><table class="data-table" id="hbBalanceTable">
              <thead><tr><th>Datum</th><th>Position</th><th class="num">Wirkung</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
        </div>
      </div>

      <div class="hb-section" data-section="loans" hidden>
        <div class="hero-grid" id="hbLoanHero"></div>
        <div id="hbLoanCards"></div>
        <div class="two-col">
          <section class="card">
            <div class="card-header"><div><h2>Kredit / Förderung</h2><p id="hbLoanMode">Neuer Kredit, Förderdarlehen oder Zuschuss</p></div></div>
            <form class="form-grid compact-form" data-entity="loan">
              <input type="hidden" name="id" />
              ${field("Bezeichnung", `<input type="text" name="title" required placeholder="z. B. Wohnbaukredit Bank" />`)}
              ${field("Art", `<select name="loan_type">${options(LOAN_TYPES, "bank")}</select>`)}
              ${field("Bank / Förderstelle", `<input type="text" name="lender" />`)}
              ${field("Betrag (€)", `<input type="number" name="amount" step="0.01" min="0" required />`)}
              ${field("Sollzins (% p. a.)", `<input type="number" name="interest_rate" step="0.001" min="0" />`)}
              ${field("Zinsart", `<select name="rate_type">${options({ fix: "Fix", variabel: "Variabel" }, "fix")}</select>`)}
              ${field("Zinsbindung bis (Monat)", `<input type="month" name="fixed_until" />`)}
              ${field("Laufzeit (Monate)", `<input type="number" name="term_months" min="0" step="1" />`)}
              ${field("Monatliche Rate (€)", `<input type="number" name="monthly_rate" step="0.01" min="0" />`)}
              ${field("Erste Rate (Monat)", `<input type="month" name="first_rate_month" />`)}
              ${field("Bereitstellungsprovision (% p. a.)", `<input type="number" name="commitment_fee_rate" step="0.01" min="0" />`)}
              ${field("Provisionsfreie Monate", `<input type="number" name="commitment_free_months" min="0" step="1" />`)}
              ${field("Dein Anteil (%)", `<input type="number" name="share_max" min="0" max="100" step="any" placeholder="100" />`)}
              ${field("Notiz", `<input type="text" name="note" />`)}
              ${field("Förderauflagen / Nachweise", `<input type="text" name="conditions" placeholder="z. B. Endabrechnung, Hauptwohnsitz-Nachweis" />`)}
              ${field("Frist für Auflagen", `<input type="date" name="conditions_due" />`)}
              <p class="field-help full">Bei einem Zuschuss für das gemeinsame Projekt trägt „Dein Anteil“ z. B. den Nutzflächen-Anteil. Der Rest gehört Ingrid und erscheint in ihrer Abrechnung.</p>
              ${formButtons("loan", "Speichern")}
            </form>
          </section>
          <section class="card">
            <div class="card-header"><div><h2>Bewegung</h2><p id="hbLoanEventMode">Auszahlung, Sondertilgung, Zinsänderung …</p></div></div>
            <form class="form-grid compact-form" data-entity="loanEvent">
              <input type="hidden" name="id" />
              ${field("Kredit / Förderung", `<select name="loan_id" id="hbEventLoan" required></select>`)}
              ${field("Datum", `<input type="date" name="date" required />`)}
              ${field("Art", `<select name="event_type">${options(EVENT_TYPES, "auszahlung")}</select>`)}
              ${field("Betrag (€)", `<input type="number" name="amount" step="0.01" />`)}
              ${field("Neuer Zinssatz (% p. a.)", `<input type="number" name="interest_rate" step="0.001" min="0" />`)}
              ${field("Neue Rate (€)", `<input type="number" name="monthly_rate" step="0.01" min="0" />`)}
              ${field("Notiz", `<input type="text" name="note" />`, "full")}
              <p class="field-help full">Ohne erfasste Auszahlung wird der volle Betrag im ersten Monat angenommen. „Saldo laut Bank“ setzt die Restschuld auf den Wert der Bank.</p>
              ${formButtons("loanEvent", "Bewegung speichern")}
            </form>
            <div class="table-scroll"><table class="data-table" id="hbEventTable">
              <thead><tr><th>Datum</th><th>Kredit</th><th>Art</th><th class="num">Betrag</th><th>Aktion</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
        </div>
      </div>

      <div class="hb-section" data-section="settings" hidden>
        <div class="two-col">
          <section class="card">
            <div class="card-header"><div><h2>Projekt</h2><p>Budget und Nutzflächen</p></div></div>
            <form class="form-grid compact-form" data-entity="project" id="hbProjectForm">
              <input type="hidden" name="id" />
              ${field("Projektname", `<input type="text" name="title" required placeholder="z. B. Haus Musterweg" />`)}
              ${field("Status", `<select name="status">${options({ planung: "Planung", bau: "Bau", fertig: "Fertig" }, "planung")}</select>`)}
              ${field("Gesamtbudget (€)", `<input type="number" name="total_budget" step="0.01" min="0" />`)}
              ${field("Budget Maximilian (€)", `<input type="number" name="budget_max" step="0.01" min="0" />`)}
              ${field("Budget Ingrid (€)", `<input type="number" name="budget_ingrid" step="0.01" min="0" />`)}
              ${field("Nutzfläche Maximilian (m²)", `<input type="number" name="area_max" step="0.01" min="0" placeholder="95" />`)}
              ${field("Nutzfläche Ingrid (m²)", `<input type="number" name="area_ingrid" step="0.01" min="0" placeholder="84" />`)}
              ${field("Baustart", `<input type="date" name="start_date" />`)}
              ${field("Fertigstellung", `<input type="date" name="end_date" />`)}
              ${field("Notiz", `<input type="text" name="note" />`)}
              <div class="full actions-row"><button class="btn btn-primary" type="submit">Projekt speichern</button></div>
            </form>
          </section>
          <section class="card">
            <div class="card-header"><div><h2>Aufteilungsschlüssel</h2><p id="hbKeyMode">Eigener Schlüssel mit frei wählbaren Prozenten</p></div></div>
            <form class="form-grid compact-form" data-entity="key">
              <input type="hidden" name="id" />
              ${field("Name", `<input type="text" name="name" required placeholder="z. B. Grundstück lt. Grundbuch" />`)}
              ${field("Anteil Maximilian (%)", `<input type="number" name="share_max" min="0" max="100" step="any" required />`)}
              ${field("Grundlage", `<input type="text" name="basis" placeholder="z. B. Kaufvertrag" />`)}
              ${field("Notiz", `<input type="text" name="note" />`)}
              ${formButtons("key", "Schlüssel speichern")}
            </form>
            <div class="table-scroll"><table class="data-table" id="hbKeyTable">
              <thead><tr><th>Schlüssel</th><th class="num">Maximilian</th><th class="num">Ingrid</th><th>Aktion</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
        </div>
        <section class="card">
          <div class="card-header"><div><h2>Eigene Kategorien</h2><p>Ergänzen die Standard-Gewerke</p></div></div>
          <form class="form-grid compact-form" data-entity="category">
            <input type="hidden" name="id" />
            ${field("Gewerk", `<input type="text" name="main_category" required list="hbMainList" />`)}
            ${field("Unterkategorie", `<input type="text" name="sub_category" />`)}
            <datalist id="hbMainList"></datalist>
            ${formButtons("category", "Kategorie speichern")}
          </form>
          <div class="table-scroll"><table class="data-table" id="hbCategoryAdminTable">
            <thead><tr><th>Gewerk</th><th>Unterkategorie</th><th>Aktion</th></tr></thead>
            <tbody></tbody></table></div>
        </section>
      </div>`;
    bindEvents(root);
    skeletonBuilt = true;
  }

  /* ---- events ----------------------------------------------------------- */

  function formFor(entity) {
    return document.querySelector(`#hausbauRoot form[data-entity="${entity}"]`);
  }

  function bindEvents(root) {
    root.addEventListener("click", (event) => {
      const sectionBtn = event.target.closest("[data-hb-section]");
      if (sectionBtn) {
        activeSection = sectionBtn.dataset.hbSection;
        showSection();
        return;
      }
      const editBtn = event.target.closest("[data-hb-edit]");
      if (editBtn) {
        startEdit(editBtn.dataset.hbEdit, editBtn.dataset.id);
        return;
      }
      const deleteBtn = event.target.closest("[data-hb-delete]");
      if (deleteBtn) {
        removeRecord(deleteBtn.dataset.hbDelete, deleteBtn.dataset.id);
        return;
      }
      const cancelBtn = event.target.closest(".js-hb-cancel");
      if (cancelBtn) {
        resetForm(cancelBtn.dataset.entity);
        return;
      }
      if (event.target.closest("#hbPrintStatement")) {
        printStatement();
        return;
      }
      const whatIfBtn = event.target.closest("[data-hb-whatif]");
      if (whatIfBtn) {
        const loan = creditLoans().find((row) => row.id === whatIfBtn.dataset.hbWhatif);
        const input = document.getElementById(`hbWhatIf_${loan?.id}`);
        const out = document.getElementById(`hbWhatIfOut_${loan?.id}`);
        const amount = num(input?.value);
        if (!loan || !out) return;
        if (amount <= 0) {
          out.textContent = "Bitte einen Betrag eingeben.";
          return;
        }
        const result = whatIf(loan, amount);
        out.textContent = result.monthsSaved > 0 || result.interestSaved > 0
          ? `Sondertilgung ${eur(amount)} jetzt: ${result.monthsSaved} Monate früher fertig (${monthLabel(result.payoffMonth)}), ${eur(result.interestSaved)} Zinsen gespart.`
          : "Für diesen Kredit ist keine Tilgungsphase mit Rate hinterlegt.";
      }
    });

    root.addEventListener("submit", (event) => {
      const form = event.target.closest("form[data-entity]");
      if (!form) return;
      event.preventDefault();
      saveForm(form);
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      if (target.id === "hbExpenseMain") fillExpenseSubcategories();
      if (target.id === "hbExpenseUnit") {
        document.getElementById("hbExpenseKey").value = defaultKeyForUnit(target.value);
        applyKeyToShare();
      }
      if (target.id === "hbExpenseKey") applyKeyToShare();
      if (target.id === "hbExpenseShare") document.getElementById("hbExpenseKey").value = "CUSTOM";
      if (target.id === "hbExpensePaidBy" || target.id === "hbExpenseFunding") updateFundingFields();
      if (target.id && target.id.startsWith("hbFilter")) renderExpenseTable();
    });
    root.addEventListener("input", (event) => {
      if (event.target.id === "hbFilterText") renderExpenseTable();
    });
  }

  function showSection() {
    document.querySelectorAll("#hbSubnav [data-hb-section]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.hbSection === activeSection);
    });
    document.querySelectorAll("#hausbauRoot .hb-section").forEach((section) => {
      section.hidden = section.dataset.section !== activeSection;
    });
    requestAnimationFrame(() => {
      ["hbCategoryChart", "hbTimelineChart"].concat(creditLoans().map((loan) => `hbLoanChart_${loan.id}`))
        .forEach((name) => app().state.charts[name]?.resize?.());
    });
  }

  function applyKeyToShare() {
    const keyId = document.getElementById("hbExpenseKey").value;
    const key = allocationKeys().find((entry) => entry.id === keyId);
    const share = document.getElementById("hbExpenseShare");
    if (key && key.share_max !== null) share.value = key.share_max;
  }

  function updateFundingFields() {
    const form = formFor("expense");
    const paidByIngrid = form.elements.paid_by.value === "ingrid";
    const funding = form.elements.funding_source;
    funding.disabled = paidByIngrid;
    const needsLoan = !paidByIngrid && ["kredit", "foerderung"].includes(funding.value);
    form.elements.loan_id.disabled = !needsLoan;
  }

  function fillExpenseSubcategories(selected = "") {
    const main = document.getElementById("hbExpenseMain").value;
    setOptions(document.getElementById("hbExpenseSub"), listOptions(categoryMap()[main] || [], selected, "—"));
    if (selected) document.getElementById("hbExpenseSub").value = selected;
  }

  function formValues(form) {
    const values = {};
    [...form.elements].forEach((element) => {
      if (!element.name || element.disabled) return;
      values[element.name] = element.value;
    });
    return values;
  }

  async function saveForm(form) {
    const entity = form.dataset.entity;
    const record = formValues(form);
    if (entity === "expense") {
      if (record.paid_by === "ingrid") {
        record.funding_source = "";
        record.loan_id = "";
      }
      if (record.share_max === "") {
        record.share_max = allocationKeys().find((key) => key.id === record.allocation_key)?.share_max ?? 100;
      }
    }
    if (entity === "project" && !record.id) delete record.id;
    if (!record.id) delete record.id;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      app().clearMessage();
      const result = await app().apiPost("hausbauSave", { entity, record });
      resetForm(entity);
      await app().refreshAfterWrite(result);
      app().showMessage(record.id ? "Hausbau-Eintrag aktualisiert." : "Hausbau-Eintrag gespeichert.", "success");
    } catch (error) {
      app().showMessage(error.message || "Speichern fehlgeschlagen.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  async function removeRecord(entity, id) {
    if (!window.confirm("Diesen Hausbau-Eintrag wirklich löschen?")) return;
    try {
      const result = await app().apiPost("hausbauDelete", { entity, id });
      if (editing[entity] === id) resetForm(entity);
      await app().refreshAfterWrite(result);
      app().showMessage("Eintrag gelöscht.", "success");
    } catch (error) {
      app().showMessage(error.message || "Löschen fehlgeschlagen.", "error");
    }
  }

  const ENTITY_ROWS = {
    expense: () => data()?.expenses,
    settlement: () => data()?.settlements,
    loan: () => data()?.loans,
    loanEvent: () => data()?.loanEvents,
    key: () => data()?.keys,
    category: () => data()?.categories
  };

  function startEdit(entity, id) {
    const record = alive(ENTITY_ROWS[entity]?.()).find((row) => row.id === id);
    const form = formFor(entity);
    if (!record || !form) return;
    if (entity === "expense") {
      form.elements.main_category.value = record.main_category || "";
      fillExpenseSubcategories(record.sub_category || "");
    }
    [...form.elements].forEach((element) => {
      if (!element.name || !(element.name in record)) return;
      if (entity === "expense" && element.name === "sub_category") return;
      element.value = record[element.name] ?? "";
    });
    if (entity === "expense") updateFundingFields();
    editing[entity] = id;
    form.querySelector(".js-hb-cancel")?.style.removeProperty("display");
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function resetForm(entity) {
    const form = formFor(entity);
    if (!form) return;
    editing[entity] = null;
    if (entity === "project") {
      fillProjectForm();
      return;
    }
    form.reset();
    if (form.elements.id) form.elements.id.value = "";
    if (form.elements.date) form.elements.date.value = app().todayDate();
    form.querySelector(".js-hb-cancel")?.style.setProperty("display", "none");
    if (entity === "expense") {
      fillExpenseSubcategories();
      document.getElementById("hbExpenseKey").value = defaultKeyForUnit(form.elements.unit.value);
      applyKeyToShare();
      updateFundingFields();
    }
  }

  function fillProjectForm() {
    const form = formFor("project");
    const p = project();
    [...form.elements].forEach((element) => {
      if (element.name) element.value = p[element.name] ?? (element.tagName === "SELECT" ? element.options[0]?.value : "");
    });
  }

  /* ---- render ----------------------------------------------------------- */

  /** Cheap, runs on every data load: shows or hides the tab and the dashboard card. */
  function sync() {
    const nav = document.querySelector('.nav-btn[data-tab="hausbau"]');
    const panel = document.getElementById("panel-hausbau");
    const dashboardCard = document.getElementById("hausbauDashboardCard");
    const visible = !!data();
    nav?.classList.toggle("is-hidden", !visible);
    if (dashboardCard) dashboardCard.hidden = !visible;
    const quickAdd = document.querySelector('#quickAddSelect option[data-hausbau]');
    if (quickAdd) quickAdd.hidden = !visible;
    if (!visible && panel?.classList.contains("active")) {
      document.querySelector('.nav-btn[data-tab="dashboard"]')?.click();
    }
    return visible;
  }

  function render() {
    if (!sync()) return;
    const root = document.getElementById("hausbauRoot");
    if (!root) return;
    if (!skeletonBuilt) {
      buildSkeleton(root);
      resetForm("expense");
      ["settlement", "loanEvent"].forEach(resetForm);
    }
    if (!editing.project) fillProjectForm();
    setText("hbTitle", project().title ? `Hausbau – ${project().title}` : "Hausbau");
    refreshSelects();
    renderOverview();
    renderExpenseTable();
    renderIngrid();
    renderLoans();
    renderSettings();
    showSection();
  }

  function setText(id, text) {
    const element = document.getElementById(id);
    if (element) element.textContent = text;
  }

  function refreshSelects() {
    const cats = categoryMap();
    const mains = Object.keys(cats);
    setOptions(document.getElementById("hbExpenseMain"), listOptions(mains, "", "—"));
    if (!document.getElementById("hbExpenseSub").options.length) fillExpenseSubcategories();
    setOptions(document.getElementById("hbFilterMain"), listOptions(mains, "", "Alle Gewerke"));
    const keySelect = document.getElementById("hbExpenseKey");
    setOptions(keySelect, allocationKeys().map((key) => `<option value="${esc(key.id)}">${esc(key.name)}</option>`).join(""));
    const allLoans = alive(data()?.loans);
    const loanOptions = allLoans.map((loan) => `<option value="${esc(loan.id)}">${esc(loan.title)} (${esc(LOAN_TYPES[loan.loan_type] || "")})</option>`).join("");
    setOptions(document.getElementById("hbExpenseLoan"), `<option value="">—</option>${loanOptions}`);
    setOptions(document.getElementById("hbEventLoan"), loanOptions || `<option value="">Zuerst einen Kredit anlegen</option>`);
    const vendors = [...new Set(expenses().map((row) => row.vendor).filter(Boolean))].sort();
    document.getElementById("hbVendorList").innerHTML = vendors.map((vendor) => `<option value="${esc(vendor)}"></option>`).join("");
    document.getElementById("hbMainList").innerHTML = mains.map((main) => `<option value="${esc(main)}"></option>`).join("");
  }

  function renderOverview() {
    const p = project();
    const rows = expenses();
    const sum = (list, pick) => list.reduce((total, row) => total + pick(row), 0);
    const paid = rows.filter(isPaid);
    const open = rows.filter((row) => !isPaid(row));
    const total = sum(rows, (row) => num(row.amount));
    const paidTotal = sum(paid, (row) => num(row.amount));
    const maxTotal = sum(rows, (row) => expenseShares(row).max);
    const ingridTotal = sum(rows, (row) => expenseShares(row).ingrid);
    const budget = num(p.total_budget);
    const restBudget = budget - total;
    document.getElementById("hbOverviewHero").innerHTML = [
      hero("Bezahlt", eur(paidTotal), `${paid.length} Rechnungen`),
      hero("Offen / beauftragt", eur(total - paidTotal), `${open.length} Positionen`),
      hero("Budget", budget ? eur(budget) : "—", budget ? `${restBudget >= 0 ? "Rest" : "Überschritten"}: ${eur(Math.abs(restBudget))} (${(total / budget * 100).toFixed(1)} % verplant)` : "In den Einstellungen festlegen"),
      hero("Dein Anteil", eur(maxTotal), num(p.budget_max) ? `Budget ${eur(num(p.budget_max))}` : "inkl. offener Positionen"),
      hero("Anteil Ingrid", eur(ingridTotal), num(p.budget_ingrid) ? `Budget ${eur(num(p.budget_ingrid))}` : "inkl. offener Positionen")
    ].join("");

    const today = app().todayDate();
    const openRows = open.slice().sort((a, b) => String(a.due_date || "9999").localeCompare(String(b.due_date || "9999")));
    document.querySelector("#hbOpenTable tbody").innerHTML = openRows.length
      ? openRows.map((row) => {
          const overdue = row.due_date && row.due_date < today;
          return `<tr>
            <td class="${overdue ? "hb-overdue" : ""}">${row.due_date ? esc(app().formatGermanDate(row.due_date)) : "—"}${overdue ? " (überfällig)" : ""}</td>
            <td>${esc(row.title)}</td>
            <td>${esc(row.vendor || "—")}</td>
            <td><span class="pill">${esc(STATUS[row.status] || "")}</span></td>
            <td class="num">${eur(num(row.amount))}</td>
            <td class="num">${eur(expenseShares(row).max)}</td>
            <td>${rowActions("expense", row.id)}</td>
          </tr>`;
        }).join("")
      : empty(7, "Keine offenen Posten");

    const byCategory = new Map();
    rows.forEach((row) => {
      const key = row.main_category || "Ohne Gewerk";
      const entry = byCategory.get(key) || { total: 0, max: 0, ingrid: 0, open: 0 };
      const shares = expenseShares(row);
      entry.total += shares.amount;
      entry.max += shares.max;
      entry.ingrid += shares.ingrid;
      if (!isPaid(row)) entry.open += shares.amount;
      byCategory.set(key, entry);
    });
    const categories = [...byCategory.entries()].sort((a, b) => b[1].total - a[1].total);
    document.querySelector("#hbCategoryTable tbody").innerHTML = categories.length
      ? categories.map(([name, entry]) => `<tr><td>${esc(name)}</td><td class="num">${eur(entry.total)}</td><td class="num">${eur(entry.max)}</td><td class="num">${eur(entry.ingrid)}</td><td class="num">${eur(entry.open)}</td></tr>`).join("")
      : empty(5);

    const funding = { eigenmittel: 0, kredit: 0, foerderung: 0 };
    let ingridDirect = 0;
    paid.forEach((row) => {
      if (row.paid_by === "ingrid") ingridDirect += num(row.amount);
      else funding[row.funding_source || "eigenmittel"] += num(row.amount);
    });
    const units = { max: 0, ingrid: 0, shared: 0 };
    rows.forEach((row) => { units[row.unit || "shared"] += num(row.amount); });
    const fundingRows = [
      ["Maximilian aus Eigenmitteln", funding.eigenmittel],
      ["Maximilian aus Kredit", funding.kredit],
      ["Maximilian aus Förderung", funding.foerderung],
      ["Direkt von Ingrid bezahlt", ingridDirect],
      ["Wohnung Maximilian (Bauteil)", units.max],
      ["Wohnung Ingrid (Bauteil)", units.ingrid],
      ["Gemeinsame Teile (Bauteil)", units.shared]
    ];
    document.querySelector("#hbFundingTable tbody").innerHTML =
      fundingRows.map(([label, value]) => `<tr><td>${esc(label)}</td><td class="num">${eur(value)}</td></tr>`).join("");

    const vendors = new Map();
    rows.filter((row) => row.vendor).forEach((row) => {
      const entry = vendors.get(row.vendor) || { count: 0, total: 0 };
      entry.count += 1;
      entry.total += num(row.amount);
      vendors.set(row.vendor, entry);
    });
    const topVendors = [...vendors.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 10);
    document.querySelector("#hbVendorTable tbody").innerHTML = topVendors.length
      ? topVendors.map(([vendor, entry]) => `<tr><td>${esc(vendor)}</td><td class="num">${entry.count}</td><td class="num">${eur(entry.total)}</td></tr>`).join("")
      : empty(3, "Noch keine Firmen erfasst");

    app().ensureChart("hbCategoryChart", "hbCategoryChart", {
      type: "bar",
      data: {
        labels: categories.map(([name]) => name),
        datasets: [
          { label: "Maximilian", data: categories.map(([, entry]) => round2(entry.max)), backgroundColor: "#4f8cff", stack: "a" },
          { label: "Ingrid", data: categories.map(([, entry]) => round2(entry.ingrid)), backgroundColor: "#f2a65a", stack: "a" }
        ]
      },
      options: { indexAxis: "y", scales: { x: { stacked: true }, y: { stacked: true } } }
    });

    const months = [...new Set(rows.map((row) => monthKey(row.date)).filter(Boolean))].sort();
    let running = 0;
    let runningPaid = 0;
    const cumulative = months.map((month) => {
      running += sum(rows.filter((row) => monthKey(row.date) === month), (row) => num(row.amount));
      return round2(running);
    });
    const cumulativePaid = months.map((month) => {
      runningPaid += sum(paid.filter((row) => monthKey(row.date) === month), (row) => num(row.amount));
      return round2(runningPaid);
    });
    app().ensureChart("hbTimelineChart", "hbTimelineChart", {
      type: "line",
      data: {
        labels: months.map(monthLabel),
        datasets: [
          { label: "Gesamt (inkl. offen)", data: cumulative, borderColor: "#8fa4c8" },
          { label: "Bezahlt", data: cumulativePaid, borderColor: "#4f8cff" }
        ].concat(budget ? [{ label: "Budget", data: months.map(() => budget), borderColor: "#e5484d", borderDash: [6, 4], pointRadius: 0 }] : [])
      }
    });
  }

  function renderExpenseTable() {
    const filters = {
      main: document.getElementById("hbFilterMain")?.value || "",
      unit: document.getElementById("hbFilterUnit")?.value || "",
      status: document.getElementById("hbFilterStatus")?.value || "",
      paidBy: document.getElementById("hbFilterPaidBy")?.value || "",
      text: (document.getElementById("hbFilterText")?.value || "").trim().toLowerCase()
    };
    const rows = expenses().filter((row) =>
      (!filters.main || row.main_category === filters.main) &&
      (!filters.unit || row.unit === filters.unit) &&
      (!filters.status || (row.status || "bezahlt") === filters.status) &&
      (!filters.paidBy || row.paid_by === filters.paidBy) &&
      (!filters.text || [row.title, row.vendor, row.invoice_no, row.note].join(" ").toLowerCase().includes(filters.text))
    );
    const total = rows.reduce((sum, row) => sum + num(row.amount), 0);
    setText("hbExpenseCount", `${rows.length} Einträge · ${eur(total)}`);
    document.querySelector("#hbExpenseTable tbody").innerHTML = rows.length
      ? rows.map((row) => {
          const shares = expenseShares(row);
          const source = row.paid_by === "ingrid" ? "Ingrid" : `Maximilian · ${FUNDING[row.funding_source] || "Eigenmittel"}`;
          return `<tr>
            <td>${esc(app().formatGermanDate(row.date))}</td>
            <td>${esc(row.title)}${row.vendor ? `<div class="text-muted">${esc(row.vendor)}${row.invoice_no ? ` · ${esc(row.invoice_no)}` : ""}</div>` : ""}</td>
            <td>${esc(row.main_category || "—")}${row.sub_category ? `<div class="text-muted">${esc(row.sub_category)}</div>` : ""}</td>
            <td>${esc(UNITS[row.unit] || "—")}</td>
            <td class="num">${eur(shares.amount)}</td>
            <td class="num">${eur(shares.max)}</td>
            <td class="num">${eur(shares.ingrid)}</td>
            <td><span class="pill">${esc(STATUS[row.status] || "Bezahlt")}</span></td>
            <td>${esc(source)}</td>
            <td>${rowActions("expense", row.id)}</td>
          </tr>`;
        }).join("")
      : empty(10);
  }

  function renderIngrid() {
    const { balance, lines } = ingridBalance();
    const text = balance > 0.005
      ? ["Ingrid schuldet dir", eur(balance)]
      : balance < -0.005
        ? ["Du schuldest Ingrid", eur(-balance)]
        : ["Ausgeglichen", eur(0)];
    const rows = expenses();
    const ingridCost = rows.filter(isPaid).reduce((sum, row) => sum + expenseShares(row).ingrid, 0);
    const ingridPaid = rows.filter((row) => isPaid(row) && row.paid_by === "ingrid").reduce((sum, row) => sum + num(row.amount), 0);
    document.getElementById("hbIngridHero").innerHTML = [
      hero(text[0], text[1], "inkl. Ausgleichszahlungen"),
      hero("Ingrids Anteil (bezahlt)", eur(ingridCost), "laut Aufteilung"),
      hero("Von Ingrid direkt bezahlt", eur(ingridPaid), "Rechnungen")
    ].join("");
    document.querySelector("#hbBalanceTable tbody").innerHTML = lines.length
      ? lines.map((line) => `<tr><td>${esc(line.date ? app().formatGermanDate(line.date) : "—")}</td><td>${esc(line.text)}</td><td class="num ${line.effect > 0 ? "text-success" : "text-danger"}">${eur(line.effect)}</td></tr>`).join("")
      : empty(3);
    const settlements = alive(data()?.settlements).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    document.querySelector("#hbSettlementTable tbody").innerHTML = settlements.length
      ? settlements.map((row) => `<tr><td>${esc(app().formatGermanDate(row.date))}</td><td>${row.from_person === "ingrid" ? "Ingrid → Maximilian" : "Maximilian → Ingrid"}</td><td class="num">${eur(num(row.amount))}</td><td>${rowActions("settlement", row.id)}</td></tr>`).join("")
      : empty(4);
  }

  function renderLoans() {
    const loans = creditLoans();
    const summaries = loans.map((loan) => ({ loan, summary: loanSummary(loan) }));
    const totalBalance = summaries.reduce((sum, entry) => sum + entry.summary.balance, 0);
    const currentCost = loanFixedCostRows(thisMonth()).reduce((sum, row) => sum + row.amount, 0);
    const interestPaid = summaries.reduce((sum, entry) => sum + entry.summary.interestPaid, 0);
    const principalPaid = summaries.reduce((sum, entry) => sum + entry.summary.principalPaid, 0);
    const grantTotal = grants().reduce((sum, loan) => sum + grantReceived(loan), 0);
    document.getElementById("hbLoanHero").innerHTML = [
      hero("Offene Restschuld", eur(totalBalance), `${loans.length} Kredit(e)`),
      hero("Monatliche Belastung", eur(currentCost), `zählt zu deinen Fixkosten · davon Tilgung ${eur(currentLoanSplit().principal)} (Vermögensaufbau)`),
      hero("Bisher getilgt", eur(principalPaid), `Zinsen bisher ${eur(interestPaid)}`),
      hero("Zuschüsse erhalten", eur(grantTotal), `${grants().length} Zuschuss/Zuschüsse`)
    ].join("");

    const cards = document.getElementById("hbLoanCards");
    cards.innerHTML = summaries.map(({ loan, summary }) => `
      <section class="card">
        <div class="card-header">
          <div>
            <h2>${esc(loan.title)}</h2>
            <p>${esc(LOAN_TYPES[loan.loan_type] || "")}${loan.lender ? ` · ${esc(loan.lender)}` : ""} · ${esc(num(loan.interest_rate).toFixed(3))} % ${esc(loan.rate_type === "variabel" ? "variabel" : "fix")}${loan.fixed_until ? ` bis ${monthLabel(monthKey(loan.fixed_until))}` : ""}</p>
          </div>
          ${rowActions("loan", loan.id)}
        </div>
        <div class="table-scroll"><table class="data-table"><tbody>
          <tr><td>Restschuld heute</td><td class="num">${eur(summary.balance)}</td></tr>
          <tr><td>Ausbezahlt / noch abrufbar</td><td class="num">${eur(summary.drawn)} / ${eur(summary.available)}</td></tr>
          <tr><td>Monatliche Belastung (dieser Monat)</td><td class="num">${eur(summary.currentCost)}</td></tr>
          <tr><td>Getilgt bisher / Zinsen bisher</td><td class="num">${eur(summary.principalPaid)} / ${eur(summary.interestPaid)}</td></tr>
          <tr><td>Restschuld Ende Zinsbindung</td><td class="num">${summary.balanceAtFixedEnd === null ? "—" : eur(summary.balanceAtFixedEnd)}</td></tr>
          <tr><td>Abbezahlt / Restlaufzeit</td><td class="num">${summary.payoffMonth ? `${monthLabel(summary.payoffMonth)} · ${summary.remainingMonths} Monate` : "Erste Rate und Rate hinterlegen"}</td></tr>
          <tr><td>Zinsen bis Laufzeitende (Plan)</td><td class="num">${eur(summary.interestRemaining)}</td></tr>
          ${conditionsRow(loan)}
        </tbody></table></div>
        <canvas id="hbLoanChart_${esc(loan.id)}"></canvas>
        <div class="form-grid compact-form">
          ${field("Was wäre wenn: Sondertilgung jetzt (€)", `<input type="number" id="hbWhatIf_${esc(loan.id)}" min="0" step="100" />`)}
          <div class="actions-row"><button type="button" class="btn btn-ghost" data-hb-whatif="${esc(loan.id)}">Berechnen</button></div>
          <p class="field-help full" id="hbWhatIfOut_${esc(loan.id)}"></p>
        </div>
      </section>`).join("") + grants().map((loan) => `
      <section class="card">
        <div class="card-header">
          <div><h2>${esc(loan.title)}</h2><p>Zuschuss${loan.lender ? ` · ${esc(loan.lender)}` : ""} · dein Anteil ${esc((loan.share_max === "" ? 100 : num(loan.share_max)).toFixed(1))} %</p></div>
          ${rowActions("loan", loan.id)}
        </div>
        <div class="table-scroll"><table class="data-table"><tbody>
          <tr><td>Zugesagt</td><td class="num">${eur(num(loan.amount))}</td></tr>
          <tr><td>Erhalten</td><td class="num">${eur(grantReceived(loan))}</td></tr>
          ${conditionsRow(loan)}
        </tbody></table></div>
      </section>`).join("");

    summaries.forEach(({ loan, summary }) => {
      const rows = summary.rows.filter((row, index) => index % (summary.rows.length > 120 ? 3 : 1) === 0 || row.month === thisMonth());
      app().ensureChart(`hbLoanChart_${loan.id}`, `hbLoanChart_${loan.id}`, {
        type: "line",
        data: {
          labels: rows.map((row) => monthLabel(row.month)),
          datasets: [
            { label: "Restschuld", data: rows.map((row) => row.balance), borderColor: "#4f8cff", yAxisID: "y" },
            { label: "Zinsanteil", data: rows.map((row) => row.interest), borderColor: "#e5484d", yAxisID: "y1" },
            { label: "Tilgungsanteil", data: rows.map((row) => row.principal), borderColor: "#30a46c", yAxisID: "y1" }
          ]
        },
        options: { scales: { y: { position: "left" }, y1: { position: "right", grid: { drawOnChartArea: false } } } }
      });
    });

    const loansById = new Map(alive(data()?.loans).map((loan) => [loan.id, loan]));
    const events = alive(data()?.loanEvents).sort((a, b) => String(b.date).localeCompare(String(a.date)));
    document.querySelector("#hbEventTable tbody").innerHTML = events.length
      ? events.map((event) => {
          const extra = event.event_type === "zinsanpassung"
            ? `${num(event.interest_rate).toFixed(3)} %`
            : event.event_type === "ratenaenderung" ? eur(num(event.monthly_rate)) : eur(num(event.amount));
          return `<tr><td>${esc(app().formatGermanDate(event.date))}</td><td>${esc(loansById.get(event.loan_id)?.title || "—")}</td><td>${esc(EVENT_TYPES[event.event_type] || event.event_type)}</td><td class="num">${esc(extra)}</td><td>${rowActions("loanEvent", event.id)}</td></tr>`;
        }).join("")
      : empty(5);
  }

  function renderSettings() {
    const keys = alive(data()?.keys);
    document.querySelector("#hbKeyTable tbody").innerHTML =
      [
        ["Nur Maximilian", 100, null],
        ["Nur Ingrid", 0, null],
        [`Nutzfläche (${num(project().area_max) || DEFAULT_AREA.max} / ${num(project().area_ingrid) || DEFAULT_AREA.ingrid} m²)`, areaShareMax(), null],
        ["50 / 50", 50, null]
      ].map(([name, share]) => `<tr><td>${esc(name)} <span class="text-muted">(Standard)</span></td><td class="num">${share.toFixed(1)} %</td><td class="num">${(100 - share).toFixed(1)} %</td><td></td></tr>`).join("") +
      keys.map((key) => `<tr><td>${esc(key.name)}${key.basis ? `<div class="text-muted">${esc(key.basis)}</div>` : ""}</td><td class="num">${num(key.share_max).toFixed(1)} %</td><td class="num">${(100 - num(key.share_max)).toFixed(1)} %</td><td>${rowActions("key", key.id)}</td></tr>`).join("");
    const categories = alive(data()?.categories);
    document.querySelector("#hbCategoryAdminTable tbody").innerHTML = categories.length
      ? categories.map((row) => `<tr><td>${esc(row.main_category)}</td><td>${esc(row.sub_category || "—")}</td><td>${rowActions("category", row.id)}</td></tr>`).join("")
      : empty(3, "Nur Standard-Gewerke in Verwendung");
  }

  function renderDashboardCard() {
    const card = document.getElementById("hausbauDashboardCard");
    if (!card || !data()) return;
    const rows = expenses();
    const total = rows.reduce((sum, row) => sum + num(row.amount), 0);
    const mine = rows.reduce((sum, row) => sum + expenseShares(row).max, 0);
    const budget = num(project().total_budget);
    const balance = creditLoans().reduce((sum, loan) => sum + loanSummary(loan).balance, 0);
    const ingrid = ingridBalance().balance;
    const split = currentLoanSplit();
    const reminders = dueConditions();
    card.innerHTML = `
      <div class="card-header">
        <div><h2>Hausbau</h2><p>Separat, nicht in den Monatskosten enthalten (nur die Kreditrate zählt)</p></div>
      </div>
      <div class="hero-grid">
        ${hero("Baukosten gesamt", eur(total), budget ? `von ${eur(budget)} Budget` : "kein Budget hinterlegt")}
        ${hero("Dein Anteil", eur(mine), "inkl. offener Positionen")}
        ${hero("Offene Restschuld", eur(balance), "deine Kredite")}
        ${hero(ingrid >= 0 ? "Ingrid schuldet dir" : "Du schuldest Ingrid", eur(Math.abs(ingrid)), "Ausgleichssaldo")}
        ${hero("Kreditrate diesen Monat", eur(split.cost), `davon Tilgung ${eur(split.principal)} = Vermögensaufbau`)}
      </div>
      ${reminders.length ? `<div class="alert warning">${reminders.map(({ loan, overdue }) => `${overdue ? "Überfällig" : "Bald fällig"}: ${esc(loan.title)} – ${esc(loan.conditions)} bis ${esc(app().formatGermanDate(loan.conditions_due))}`).join("<br>")}</div>` : ""}`;
  }

  /* ---- statement for Ingrid (printed via the browser, free) -------------- */

  function printStatement() {
    const { balance, lines } = ingridBalance();
    const rows = expenses().filter((row) => expenseShares(row).ingrid > 0.005 || row.paid_by === "ingrid");
    const p = project();
    const win = window.open("", "_blank");
    if (!win) {
      app().showMessage("Bitte Pop-ups für diese Seite erlauben, um die Abrechnung zu drucken.", "warning");
      return;
    }
    const tableRows = rows.map((row) => {
      const shares = expenseShares(row);
      return `<tr><td>${esc(app().formatGermanDate(row.date))}</td><td>${esc(row.title)}${row.vendor ? ` (${esc(row.vendor)})` : ""}</td><td>${esc(row.main_category || "")}</td><td class="r">${eur(shares.amount)}</td><td class="r">${(100 - shares.shareMax).toFixed(1)} %</td><td class="r">${eur(shares.ingrid)}</td><td>${esc(PEOPLE[row.paid_by] || "")}</td><td>${esc(STATUS[row.status] || "Bezahlt")}</td></tr>`;
    }).join("");
    const balanceRows = lines.map((line) => `<tr><td>${esc(line.date ? app().formatGermanDate(line.date) : "")}</td><td>${esc(line.text)}</td><td class="r">${eur(line.effect)}</td></tr>`).join("");
    win.document.write(`<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Abrechnung Hausbau – Ingrid Harder</title>
      <style>body{font:12px/1.4 system-ui,sans-serif;color:#111;margin:24px}h1{font-size:18px}h2{font-size:14px;margin-top:24px}
      table{border-collapse:collapse;width:100%}td,th{border-bottom:1px solid #ddd;padding:4px 6px;text-align:left}.r{text-align:right}
      .total{font-size:15px;font-weight:700;margin-top:16px}</style></head><body>
      <h1>Abrechnung Hausbau${p.title ? ` – ${esc(p.title)}` : ""}</h1>
      <p>Ingrid Harder und Maximilian Hofer · Stand ${esc(app().formatGermanDate(app().todayDate()))}</p>
      <p class="total">${balance > 0.005 ? `Ingrid schuldet Maximilian ${eur(balance)}` : balance < -0.005 ? `Maximilian schuldet Ingrid ${eur(-balance)}` : "Ausgeglichen"}</p>
      <h2>Positionen mit Anteil Ingrid</h2>
      <table><thead><tr><th>Datum</th><th>Position</th><th>Gewerk</th><th class="r">Betrag</th><th class="r">Anteil</th><th class="r">Ingrid</th><th>Bezahlt von</th><th>Status</th></tr></thead><tbody>${tableRows}</tbody></table>
      <h2>Saldo-Entwicklung</h2>
      <table><thead><tr><th>Datum</th><th>Position</th><th class="r">Wirkung</th></tr></thead><tbody>${balanceRows}</tbody></table>
      <p>Positiv: zugunsten Maximilian. Negativ: zugunsten Ingrid.</p>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  window.Hausbau = { sync, render, renderDashboardCard, openExpenseForm, loanFixedCostRows, loanSchedule, ingridBalance, areaShareMax };
})();
