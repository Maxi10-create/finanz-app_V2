// Hausbau: private module for the house project of Maximilian and Ingrid Harder.
// The server only sends `data.hausbau` to its owner, so for everyone else this
// module stays hidden. Building costs never enter the monthly cost calculation;
// only loan payments are handed to app.js as virtual fixed costs.
(() => {
  "use strict";

  const PEOPLE = { max: "Maximilian", ingrid: "Ingrid" };
  const STATUS = { angebot: "Angebot", beauftragt: "Beauftragt", bezahlt: "Bezahlt" };
  const LOAN_TYPES = { bank: "Bankkredit", foerderdarlehen: "Förderdarlehen", zuschuss: "Zuschuss" };
  const EVENT_TYPES = {
    auszahlung: "Auszahlung",
    sondertilgung: "Sondertilgung",
    zinsanpassung: "Zinsanpassung (neuer Zinssatz)",
    ratenaenderung: "Rate (gilt ab diesem Monat)",
    gebuehr: "Gebühr",
    saldo_bank: "Saldo laut Bank",
    zuschuss: "Zuschuss erhalten"
  };
  const DEFAULT_AREA = { max: 95, ingrid: 84 };
  // Tausendstel from the Kostenschlüssel of the house dashboard (W2 = Maximilian, W1 = Ingrid).
  const PROMILLE = { max: 534, ingrid: 466 };
  const TAX_BONUS = { keine: "keiner", ristrutturazione: "Ristrutturazione", ecobonus: "Ecobonus", mobili: "Bonus Mobili" };
  // Category = Gewerk, sub category = Firma or Instanz. Every firm belongs to exactly one
  // Gewerk; the Gewerke follow the Kostenübersicht of the Hintersun 8 project.
  const DEFAULT_CATEGORIES = {
    "Bürokratie & Gebühren": ["Gemeinde", "Notarin", "Stadtwerke", "Grundbuch & Kataster", "Agentur der Einnahmen", "ITAS Versicherung"],
    "Architekt": ["Arch. Stefan Klement"],
    "Statik": ["Dipl.-Ing. Manuel Troger"],
    "Technikerspesen": ["Dr. Ing. Diego Consalvo", "Studio E-Plan GZFB GmbH"],
    "Steuerberater": ["PSP STP GmbH"],
    "Baumeister": ["Deltedesco & Söhne GmbH", "Salcher Bau GmbH", "Widmannbau GmbH"],
    "Zimmerer": ["Bodner Florian GmbH", "Holzbau Brugger", "Oberrauch GmbH", "Silgoner GmbH"],
    "Spengler": ["Bauspenglerei Dorfmann GmbH"],
    "Fenster": ["Südtirol Fenster GmbH", "TipTop Fenster GmbH", "Wolf Fenster AG"],
    "Beschattung": ["Rollmark GmbH"],
    "Schlosser": ["Günther Gamper", "Kreithner KG", "Plosemetal"],
    "Elektriker": ["Elektro Stampfl & Brunner GmbH"],
    "Hydrauliker": ["Thaler KG"],
    "Klimagerät": [],
    "Sanitärobjekte (Material)": ["Innerhofer AG", "Sanitär Heinze GmbH"],
    "Fliesen/Bodenbeläge": ["Peintner Fliesen GmbH"],
    "Maler": ["Malerbetrieb Rogen Martin"],
    "Küche": ["Resch Möbel GmbH", "Stampfl Manfred & Co. KG"],
    "Dachbegrünung/Carport": ["Rasenfix GmbH"],
    "Garten/Außenanlagen": [],
    "Finanzierungskosten": ["Bank & Kreditnotar"]
  };
  // Names used elsewhere (dashboard, bookings) for the same firm or office.
  const FIRM_ALIASES = [
    [/klement/i, "Arch. Stefan Klement"],
    [/consalvo/i, "Dr. Ing. Diego Consalvo"],
    [/troger/i, "Dipl.-Ing. Manuel Troger"],
    [/\bpsp\b/i, "PSP STP GmbH"],
    [/stadtwerk|baustrom/i, "Stadtwerke"],
    [/grundbuch|kataster/i, "Grundbuch & Kataster"],
    [/agentur der einnahmen|registersteuer/i, "Agentur der Einnahmen"],
    [/gemeinde|stempelmarke|sekretariatsgeb/i, "Gemeinde"],
    [/kredit|darlehen|bankspes/i, "Bank & Kreditnotar"],
    [/notar/i, "Notarin"],
    [/e-?plan/i, "Studio E-Plan GZFB GmbH"],
    [/itas|haftpflicht/i, "ITAS Versicherung"]
  ];
  // Standard split for new expenses, by Gewerk; every expense can still be changed one by one.
  const SPLIT_RULES = [
    [(main, sub, text) => /schenkung/i.test(text), "MAX"],
    [(main, sub, text) => /haftpflicht|versicherung/i.test(`${sub} ${text}`), "MAX"],
    [(main) => main === "Bürokratie & Gebühren", "HALF"],
    [(main) => main === "Technikerspesen", "PROMILLE"],
    [(main) => main === "Finanzierungskosten", "MAX"]
  ];
  const MAX_LOAN_MONTHS = 600;

  let activeSection = "overview";
  // "max": Maximilian's part of everything; "all": the whole house with Ingrid's part.
  let overviewScope = "max";
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

  function promilleShareMax() {
    return round2(PROMILLE.max / (PROMILLE.max + PROMILLE.ingrid) * 100);
  }

  /* ---- allocation keys ------------------------------------------------- */

  function allocationKeys() {
    const builtIn = [
      { id: "MAX", name: "Nur Maximilian", share_max: 100 },
      { id: "INGRID", name: "Nur Ingrid", share_max: 0 },
      { id: "PROMILLE", name: `Tausendstel (${PROMILLE.max} / ${PROMILLE.ingrid})`, share_max: promilleShareMax() },
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
    return "PROMILLE";
  }

  /* ---- expenses & Ingrid balance ---------------------------------------- */

  function expenses() {
    return alive(data()?.expenses).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  }

  /** Orders of the house app, one per Gewerk (Soll gross, split, status). */
  function orders() {
    return alive(data()?.orders);
  }

  function orderFor(main) {
    return orders().find((order) => order.gewerk === main) || null;
  }

  /** Split fields of an order: its own key, or its share as an individual split. */
  function orderSplit(order) {
    if (!order || order.share_max === "" || order.share_max == null) return null;
    const keyed = order.allocation_key ? splitFields(order.allocation_key) : null;
    if (keyed) return keyed;
    const share = num(order.share_max);
    return { unit: share >= 100 ? "max" : share <= 0 ? "ingrid" : "shared", allocation_key: "CUSTOM", share_max: share };
  }

  /** Paid so far per Gewerk. */
  function paidByGewerk() {
    const sums = {};
    expenses().filter(isPaid).forEach((row) => {
      sums[row.main_category] = (sums[row.main_category] || 0) + num(row.amount);
    });
    return sums;
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

  function openExpenseForm(prefill) {
    if (!data()) return;
    if (!skeletonBuilt) render();
    resetForm("expense");
    const form = formFor("expense");
    if (form && prefill?.main) {
      form.elements.main_category.value = prefill.main;
      fillExpenseSubcategories();
      applyOrderToForm();
      if (prefill.sub) form.elements.sub_category.value = prefill.sub;
      applyDefaultSplit();
    }
    showExpenseDialog();
    form?.elements[prefill?.main ? "title" : "main_category"]?.focus();
  }

  /* ---- categories ------------------------------------------------------- */

  /** Gewerk -> firms: defaults, own categories and every Gewerk/Firma pair already booked. */
  function categoryMap() {
    const map = {};
    const firmOwner = {};
    const add = (main, sub) => {
      if (!main) return;
      map[main] = map[main] || [];
      if (!sub || firmOwner[sub.toLowerCase()]) return;
      firmOwner[sub.toLowerCase()] = main;
      map[main].push(sub);
    };
    Object.keys(DEFAULT_CATEGORIES).forEach((main) => {
      add(main);
      DEFAULT_CATEGORIES[main].forEach((sub) => add(main, sub));
    });
    orders().forEach((row) => add(row.gewerk, row.firma));
    alive(data()?.categories).forEach((row) => add(row.main_category, row.sub_category));
    alive(data()?.expenses).forEach((row) => add(row.main_category, row.sub_category));
    return map;
  }

  /** The Gewerk a firm belongs to, or "" for a firm nobody has booked yet. */
  function gewerkOfFirm(firm) {
    const wanted = String(firm || "").trim().toLowerCase();
    if (!wanted) return "";
    const map = categoryMap();
    return Object.keys(map).find((main) => map[main].some((sub) => sub.toLowerCase() === wanted)) || "";
  }

  /**
   * Gewerk and Firma for a payment described by firm, trade and text (dashboard rows,
   * household bookings). The firm decides the Gewerk; the trade is only a fallback.
   */
  function classify(firm = "", trade = "", text = "") {
    const name = String(firm || "").trim();
    let sub = gewerkOfFirm(name) ? name : "";
    if (!sub) {
      const hit = FIRM_ALIASES.find(([pattern]) => pattern.test(name)) ||
        (!name ? FIRM_ALIASES.find(([pattern]) => pattern.test(text)) : null);
      if (hit) sub = hit[1];
    }
    if (sub) return { main: gewerkOfFirm(sub) || "Bürokratie & Gebühren", sub };
    const map = categoryMap();
    const main = Object.keys(map).find((key) => key.toLowerCase() === String(trade || "").trim().toLowerCase());
    return { main: main || "Bürokratie & Gebühren", sub: name };
  }

  /** Split key the rules suggest for a Gewerk, firm and title, or "" when no rule applies. */
  function defaultSplitKey(main = "", sub = "", text = "") {
    const rule = SPLIT_RULES.find(([test]) => test(String(main), String(sub), String(text)));
    return rule ? rule[1] : "";
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
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="orders">Aufträge</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="expenses">Zahlungen</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="ingrid">Ingrid</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab" data-hb-section="loans">Finanzierung</button>
          <button type="button" class="btn btn-ghost btn-xs hb-tab hb-tab-gear" data-hb-section="settings" aria-label="Einstellungen" title="Einstellungen">⚙</button>
        </div>
      </section>

      <div class="hb-section" data-section="overview">
        <div class="hb-scope" role="group" aria-label="Ansicht">
          <button type="button" class="hb-scope-btn active" data-hb-scope="max">Mein Anteil</button>
          <button type="button" class="hb-scope-btn" data-hb-scope="all">Gesamt mit Ingrid</button>
        </div>
        <div class="hb-big" id="hbOverviewHero"></div>
        <section class="card hb-fund">
          <div class="card-header"><div><h2>Reicht mein Geld?</h2><p id="hbFundNote"></p></div></div>
          <div class="hb-fundbar" id="hbFundBar" role="img" aria-label="Deckung deines offenen Anteils"></div>
          <ul class="hb-legend" id="hbFundLegend"></ul>
        </section>
        <div class="chart-grid">
          <section class="card">
            <div class="card-header"><div><h2>Meine Gewerke</h2><p id="hbGewerkInfo">Dein Anteil am Soll, bezahlt</p></div></div>
            <div id="hbGewerkList"></div>
          </section>
          <section class="card">
            <div class="card-header">
              <div><h2>Letzte Zahlungen</h2><p>Alle Zahlungen im Reiter Zahlungen</p></div>
              <button type="button" class="btn btn-primary btn-xs" data-hb-new-payment>+ Zahlung</button>
            </div>
            <div class="table-scroll"><table class="data-table" id="hbRecentTable">
              <thead><tr><th>Datum</th><th>Zahlung</th><th class="num">Betrag</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
        </div>
      </div>

      <div class="hb-section" data-section="orders" hidden>
        <section class="card">
          <div class="card-header"><div><h2>Aufträge</h2><p id="hbOrderInfo"></p></div></div>
          <div class="table-scroll"><table class="data-table" id="hbOrderTable">
            <thead><tr><th>Gewerk · Firma</th><th>Status</th><th class="num">Soll</th><th class="num">Bezahlt</th><th class="num">Rest</th><th>Fortschritt</th><th>Aufteilung</th><th></th></tr></thead>
            <tbody></tbody><tfoot></tfoot></table></div>
        </section>
      </div>

      <div class="hb-section" data-section="expenses" hidden>
        <section class="card">
          <div class="card-header">
            <div><h2>Zahlungen</h2><p id="hbExpenseCount"></p></div>
            <button type="button" class="btn btn-primary btn-xs" data-hb-new-payment>+ Zahlung</button>
          </div>
          <div class="form-grid compact-form">
            ${field("Gewerk", `<select id="hbFilterMain"></select>`)}
            ${field("Bezahlt von", `<select id="hbFilterPaidBy">${options(PEOPLE, "", "Alle")}</select>`)}
            ${field("Suche", `<input type="search" id="hbFilterText" placeholder="Titel, Firma, Rechnung" />`)}
          </div>
          <p class="text-muted">Neueste zuerst. Die Aufteilung kannst du direkt in der Liste ändern, sie wird sofort gespeichert.</p>
          <div class="table-scroll"><table class="data-table" id="hbExpenseTable">
            <thead><tr><th>Datum</th><th>Zahlung</th><th>Gewerk · Firma</th><th>Aufteilung</th><th class="num">Betrag</th><th class="num">Maximilian</th><th class="num">Ingrid</th><th>Bezahlt von</th><th>Aktion</th></tr></thead>
            <tbody></tbody></table></div>
        </section>
        <dialog class="hb-dialog" id="hbExpenseDialog" aria-labelledby="hbExpenseMode">
          <form class="form-grid compact-form" data-entity="expense" id="hbExpenseForm">
            <div class="full hb-dialog-head">
              <h2 id="hbExpenseMode">Neue Zahlung</h2>
              <button type="button" class="btn btn-ghost btn-xs js-hb-close" aria-label="Schließen">✕</button>
            </div>
            <input type="hidden" name="id" />
            <input type="hidden" name="unit" id="hbExpenseUnit" value="shared" />
            <input type="hidden" name="status" value="bezahlt" />
            ${field("Auftrag", `<select name="main_category" id="hbExpenseMain" required></select>`, "full")}
            ${field("Firma / Instanz", `<input type="text" name="sub_category" id="hbExpenseSub" list="hbFirmList" required autocomplete="off" placeholder="z. B. Gemeinde, Baumeister-Firma" />`)}
            ${field("Datum", `<input type="date" name="date" required />`)}
            ${field("Was wurde bezahlt", `<input type="text" name="title" required placeholder="z. B. 2. Teilrechnung" />`)}
            ${field("Betrag (€)", `<input type="number" name="amount" step="0.01" min="0" required />`)}
            ${field("Bezahlt von", `<select name="paid_by" id="hbExpensePaidBy">${options(PEOPLE, "max")}</select>`)}
            ${field("Aufteilung", `<select name="allocation_key" id="hbExpenseKey"></select>`)}
            <label id="hbShareField" hidden>Anteil Maximilian (%)<input type="number" name="share_max" id="hbExpenseShare" min="0" max="100" step="any" /></label>
            ${field("Steuerbonus", `<select name="tax_bonus" id="hbExpenseTax">${options(TAX_BONUS, "keine")}</select>`)}
            <p class="field-help full" id="hbExpenseSollHint"></p>
            <details class="full hb-more">
              <summary>Rechnungsnummer und Notiz</summary>
              <div class="form-grid compact-form">
                ${field("Rechnungsnummer", `<input type="text" name="invoice_no" />`)}
                ${field("Notiz", `<input type="text" name="note" />`)}
              </div>
            </details>
            <datalist id="hbFirmList"></datalist>
            <div class="full actions-row">
              <button class="btn btn-primary" type="submit">Zahlung speichern</button>
              <button class="btn btn-ghost js-hb-close" type="button">Abbrechen</button>
            </div>
          </form>
        </dialog>
      </div>

      <div class="hb-section" data-section="ingrid" hidden>
        <div class="hero-grid" id="hbIngridHero"></div>
        <div class="two-col">
          <section class="card">
            <div class="card-header">
              <div><h2>Abrechnung Ingrid</h2><p>Alle Positionen, die den Saldo bewegen</p></div>
              <button type="button" class="btn btn-ghost btn-xs" id="hbPrintStatement">Abrechnung drucken</button>
            </div>
            <div class="table-scroll"><table class="data-table" id="hbBalanceTable">
              <thead><tr><th>Datum</th><th>Position</th><th class="num">Wirkung</th></tr></thead>
              <tbody></tbody></table></div>
          </section>
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
        </div>
      </div>

      <div class="hb-section" data-section="loans" hidden>
        <div class="hero-grid" id="hbFinanceHero"></div>
        <section class="card">
          <div class="card-header"><div><h2>Woher das Geld kommt</h2><p id="hbFinanceInfo">Nur dein Anteil. Ingrids Kosten werden nur mitgeführt.</p></div></div>
          <div class="table-scroll"><table class="data-table" id="hbPotTable">
            <thead><tr><th>Topf</th><th class="num">Verfügbar</th><th class="num">Wird gebraucht</th><th>Auslastung</th><th class="num">Bleibt</th></tr></thead>
            <tbody></tbody></table></div>
          <div class="table-scroll"><table class="data-table" id="hbAccountTable"><tbody></tbody></table></div>
          <p class="field-help">Reihenfolge: zuerst Eigenmittel, dann das zinsbegünstigte Darlehen, dann die Förderung, das zweite Darlehen erst, wenn alles andere aufgebraucht ist. Die Rücklage bleibt immer stehen. Das ist eine Rechnung nach deinen Vorgaben, keine Finanzberatung.</p>
        </section>
        <div id="hbLoanCards"></div>
        <details class="card hb-more" id="hbFinanceSetup">
          <summary>Kontostand und Finanzierung eintragen</summary>
          <form class="form-grid compact-form" data-entity="finance" id="hbFinanceForm">
            ${field("Kontostand (€)", `<input type="number" name="account_balance" step="0.01" required />`)}
            ${field("Stand am", `<input type="date" name="account_date" required />`)}
            ${field("Davon Darlehen auf dem Konto (€)", `<input type="number" name="loan_on_account" step="0.01" min="0" />`)}
            ${field("Rücklage, bleibt immer (€)", `<input type="number" name="reserve" step="0.01" min="0" />`)}
            ${field("Förderung erwartet (€)", `<input type="number" name="grant_amount" step="0.01" min="0" />`)}
            ${field("Förderung erwartet ab (Monat)", `<input type="month" name="grant_month" />`)}
            ${field("Zweites Darlehen, falls nötig (€)", `<input type="number" name="second_loan" step="0.01" min="0" />`)}
            <p class="field-help full">Den Kontostand trägst du einmal ein. Ab dann rechnet Nomia selbst weiter: deine Einnahmen und Ausgaben im Haushalt, deine Hausbau-Zahlungen und Ausgleichszahlungen mit Ingrid. Du kannst ihn jederzeit neu eintragen.</p>
            <div class="full actions-row"><button class="btn btn-primary" type="submit">Speichern</button></div>
          </form>
        </details>
        <details class="card hb-more">
          <summary>Kredite und Förderungen bearbeiten</summary>
          <div class="two-col">
            <section>
              <h3 id="hbLoanMode">Neuer Kredit, Förderdarlehen oder Zuschuss</h3>
              <form class="form-grid compact-form" data-entity="loan">
                <input type="hidden" name="id" />
                ${field("Bezeichnung", `<input type="text" name="title" required placeholder="z. B. Zinsbegünstigtes Darlehen" />`)}
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
                <p class="field-help full">Mit Rate und erster Rate zählt der Kredit jeden Monat automatisch zu deinen Fixkosten.</p>
                ${formButtons("loan", "Speichern")}
              </form>
            </section>
            <section>
              <h3 id="hbLoanEventMode">Bewegung: Auszahlung, Sondertilgung, Zinsänderung …</h3>
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
        </details>
      </div>

      <div class="hb-section" data-section="settings" hidden>
        <div class="two-col">
          <section class="card">
            <div class="card-header"><div><h2>Projekt</h2><p>Name und Nutzflächen</p></div></div>
            <form class="form-grid compact-form" data-entity="project" id="hbProjectForm">
              <input type="hidden" name="id" />
              ${field("Projektname", `<input type="text" name="title" required placeholder="z. B. Hintersun 8" />`)}
              ${field("Status", `<select name="status">${options({ planung: "Planung", bau: "Bau", fertig: "Fertig" }, "planung")}</select>`)}
              ${field("Nutzfläche Maximilian (m²)", `<input type="number" name="area_max" step="0.01" min="0" placeholder="95" />`)}
              ${field("Nutzfläche Ingrid (m²)", `<input type="number" name="area_ingrid" step="0.01" min="0" placeholder="84" />`)}
              ${field("Baustart", `<input type="date" name="start_date" />`)}
              ${field("Fertigstellung", `<input type="date" name="end_date" />`)}
              ${field("Notiz", `<input type="text" name="note" />`, "full")}
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
          <div class="card-header"><div><h2>Gewerke und Firmen</h2><p>Jede Firma gehört zu genau einem Gewerk. Die Aufträge bringen ihre Firmen selbst mit.</p></div></div>
          <form class="form-grid compact-form" data-entity="category">
            <input type="hidden" name="id" />
            ${field("Gewerk", `<input type="text" name="main_category" required list="hbMainList" />`)}
            ${field("Firma / Instanz", `<input type="text" name="sub_category" />`)}
            <datalist id="hbMainList"></datalist>
            ${formButtons("category", "Kategorie speichern")}
          </form>
          <div class="table-scroll"><table class="data-table" id="hbCategoryAdminTable">
            <thead><tr><th>Gewerk</th><th>Firma / Instanz</th><th>Aktion</th></tr></thead>
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
      const scopeBtn = event.target.closest("[data-hb-scope]");
      if (scopeBtn) {
        overviewScope = scopeBtn.dataset.hbScope;
        renderOverview();
        return;
      }
      if (event.target.closest("[data-hb-new-payment]")) {
        openExpenseForm();
        return;
      }
      if (event.target.closest(".js-hb-close")) {
        closeExpenseDialog();
        return;
      }
      const payBtn = event.target.closest("[data-hb-order-pay]");
      if (payBtn) {
        const order = orderFor(payBtn.dataset.hbOrderPay);
        openExpenseForm({ main: payBtn.dataset.hbOrderPay, sub: order?.firma || "" });
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
      const rateForm = event.target.closest("form[data-hb-rate]");
      if (rateForm) {
        event.preventDefault();
        saveRate(rateForm);
        return;
      }
      const form = event.target.closest("form[data-entity]");
      if (!form) return;
      event.preventDefault();
      saveForm(form);
    });

    root.addEventListener("change", (event) => {
      const target = event.target;
      const rateForm = target.closest("form[data-hb-rate]");
      if (rateForm && target.name === "month") {
        const loan = creditLoans().find((row) => row.id === rateForm.dataset.hbRate);
        const known = loan ? rateFor(loan, target.value) : null;
        if (known !== null) rateForm.elements.rate.value = known;
        return;
      }
      if (target.id === "hbExpenseMain") {
        fillExpenseSubcategories();
        applyOrderToForm();
      }
      if (target.id === "hbExpenseSub") syncGewerkToFirm();
      if (["hbExpenseMain", "hbExpenseSub"].includes(target.id) || (target.name === "title" && target.closest('form[data-entity="expense"]'))) applyDefaultSplit();
      if (target.id === "hbExpenseKey") applyKeyToShare();
      if (target.id === "hbExpenseShare") document.getElementById("hbExpenseKey").value = "CUSTOM";
      if (target.id === "hbExpenseMain") showSollHint();
      if (target.id && target.id.startsWith("hbFilter")) renderExpenseTable();
      if (target.dataset?.hbSplit) saveSplit(target);
    });
    root.addEventListener("input", (event) => {
      if (event.target.id === "hbFilterText") renderExpenseTable();
      if (event.target.id === "hbExpenseSub") syncGewerkToFirm();
      if (event.target.name === "amount" && event.target.closest('form[data-entity="expense"]')) showSollHint();
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
      ["hbTimelineChart"].concat(creditLoans().map((loan) => `hbLoanChart_${loan.id}`))
        .forEach((name) => app().state.charts[name]?.resize?.());
    });
  }

  /** The key sets share and Bauteil; the percent field only shows for an individual split. */
  function applyKeyToShare() {
    const keyId = document.getElementById("hbExpenseKey").value;
    const key = allocationKeys().find((entry) => entry.id === keyId);
    const share = document.getElementById("hbExpenseShare");
    if (key && key.share_max !== null) share.value = key.share_max;
    document.getElementById("hbExpenseUnit").value = keyId === "MAX" ? "max" : keyId === "INGRID" ? "ingrid" : "shared";
    document.getElementById("hbShareField").hidden = keyId !== "CUSTOM";
  }

  /** A new payment on an order takes its firm and tax bonus. */
  function applyOrderToForm() {
    if (editing.expense) return;
    const form = formFor("expense");
    const order = orderFor(form.elements.main_category.value);
    if (!order) return;
    if (order.firma) form.elements.sub_category.value = order.firma;
    if (order.tax_bonus && TAX_BONUS[order.tax_bonus]) form.elements.tax_bonus.value = order.tax_bonus;
  }

  /** Under the form: what is left of the order's Soll after this payment. */
  function showSollHint() {
    const form = formFor("expense");
    const hint = document.getElementById("hbExpenseSollHint");
    if (!form || !hint) return;
    const main = form.elements.main_category.value;
    const order = orderFor(main);
    if (!order || !(num(order.soll) > 0)) {
      hint.textContent = main && !order ? "Für dieses Gewerk gibt es noch kein Soll aus der Hausbau-App." : "";
      hint.classList.remove("hb-over");
      return;
    }
    const before = expenses().filter((row) => isPaid(row) && row.main_category === main && row.id !== form.elements.id.value)
      .reduce((sum, row) => sum + num(row.amount), 0);
    const rest = num(order.soll) - before - num(form.elements.amount.value);
    hint.textContent = rest >= -0.005
      ? `Soll ${eur(num(order.soll))}, schon bezahlt ${eur(before)}. Nach dieser Zahlung offen: ${eur(rest)}.`
      : `Soll ${eur(num(order.soll))}, schon bezahlt ${eur(before)}. Mit dieser Zahlung ${eur(-rest)} über dem Soll.`;
    hint.classList.toggle("hb-over", rest < -0.005);
  }

  function expenseDialog() {
    return document.getElementById("hbExpenseDialog");
  }

  function showExpenseDialog() {
    const dialog = expenseDialog();
    if (!dialog) return;
    if (typeof dialog.showModal === "function") {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
    showSollHint();
  }

  function closeExpenseDialog() {
    resetForm("expense");
    const dialog = expenseDialog();
    if (dialog?.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }

  /** Firm suggestions: the firms of the chosen Gewerk first, then all others. */
  function fillExpenseSubcategories() {
    const map = categoryMap();
    const main = document.getElementById("hbExpenseMain").value;
    const firms = (map[main] || []).concat(...Object.keys(map).filter((key) => key !== main).map((key) => map[key]));
    const list = document.getElementById("hbFirmList");
    if (list) list.innerHTML = firms.map((firm) => `<option value="${esc(firm)}">${esc(gewerkOfFirm(firm))}</option>`).join("");
  }

  /** New expenses start with the split the rules suggest; an expense being edited keeps its own. */
  function applyDefaultSplit() {
    if (editing.expense) return;
    const form = formFor("expense");
    const main = form.elements.main_category.value;
    // The house app's split for its order wins over the rules.
    const fields = orderSplit(orderFor(main)) ||
      splitFields(defaultSplitKey(main, form.elements.sub_category.value, form.elements.title.value));
    if (!fields) return;
    form.elements.unit.value = fields.unit;
    document.getElementById("hbExpenseKey").value = fields.allocation_key;
    applyKeyToShare();
    if (fields.allocation_key === "CUSTOM") document.getElementById("hbExpenseShare").value = fields.share_max;
  }

  /** A known firm always books on its own Gewerk. */
  function syncGewerkToFirm() {
    const main = gewerkOfFirm(document.getElementById("hbExpenseSub").value);
    const select = document.getElementById("hbExpenseMain");
    if (main && select.value !== main) {
      select.value = main;
      fillExpenseSubcategories();
    }
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
      record.status = "bezahlt";
      record.sub_category = String(record.sub_category || "").trim();
      const owner = gewerkOfFirm(record.sub_category);
      const order = orderFor(record.main_category);
      const ordered = order && order.firma && order.firma === record.sub_category;
      if (owner && owner !== record.main_category && !ordered) {
        app().showMessage(`${record.sub_category} gehört zum Gewerk ${owner}. Bitte dieses Gewerk wählen.`, "error");
        return;
      }
      record.vendor = record.sub_category;
      record.trade = record.main_category;
      // Payments should stay within the house app's Soll; a supplement is still possible.
      if (order && num(order.soll) > 0) {
        const before = expenses().filter((row) => isPaid(row) && row.main_category === record.main_category && row.id !== record.id)
          .reduce((sum, row) => sum + num(row.amount), 0);
        const over = before + num(record.amount) - num(order.soll);
        if (over > 0.005 && !window.confirm(`${record.main_category}: Diese Zahlung überschreitet das Soll von ${eur(order.soll)} um ${eur(over)}. Trotzdem speichern?`)) return;
      }
      if (record.share_max === "") {
        record.share_max = allocationKeys().find((key) => key.id === record.allocation_key)?.share_max ?? 100;
      }
    }
    if (entity === "finance") {
      // The financing plan lives on the project row, next to name and areas.
      const current = project();
      Object.assign(record, { id: current.id || "", title: current.title || "Hintersun 8" });
    }
    if (entity === "project" && !record.id) delete record.id;
    if (!record.id) delete record.id;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      app().clearMessage();
      const result = await app().apiPost("hausbauSave", { entity: entity === "finance" ? "project" : entity, record });
      if (entity === "expense") closeExpenseDialog();
      else resetForm(entity);
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
      fillExpenseSubcategories();
    }
    [...form.elements].forEach((element) => {
      if (!element.name || !(element.name in record)) return;
      element.value = record[element.name] ?? "";
    });
    if (entity === "expense" && !form.elements.sub_category.value) form.elements.sub_category.value = record.vendor || "";
    editing[entity] = id;
    if (entity === "expense") {
      const keyed = allocationKeys().some((key) => key.id === record.allocation_key);
      if (!keyed) form.elements.allocation_key.value = "CUSTOM";
      document.getElementById("hbShareField").hidden = form.elements.allocation_key.value !== "CUSTOM";
      setText("hbExpenseMode", "Zahlung bearbeiten");
      showExpenseDialog();
      return;
    }
    form.querySelector(".js-hb-cancel")?.style.removeProperty("display");
    if (entity === "loan" || entity === "loanEvent") form.closest("details")?.setAttribute("open", "");
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
    if (entity === "finance") {
      fillFinanceForm();
      return;
    }
    form.reset();
    if (form.elements.id) form.elements.id.value = "";
    if (form.elements.date) form.elements.date.value = app().todayDate();
    form.querySelector(".js-hb-cancel")?.style.setProperty("display", "none");
    if (entity === "expense") {
      fillExpenseSubcategories();
      document.getElementById("hbExpenseKey").value = defaultKeyForUnit("shared");
      applyKeyToShare();
      setText("hbExpenseMode", "Neue Zahlung");
      setText("hbExpenseSollHint", "");
    }
  }

  function fillProjectForm() {
    const form = formFor("project");
    const p = project();
    [...form.elements].forEach((element) => {
      if (element.name) element.value = p[element.name] ?? (element.tagName === "SELECT" ? element.options[0]?.value : "");
    });
  }

  /** Defaults Maximilian gave for his financing plan; the balance itself he enters once. */
  const FINANCE_DEFAULTS = { reserve: 10000, loan_on_account: 250000, grant_amount: 28000, grant_month: "2028-04", second_loan: 180000 };

  function fillFinanceForm() {
    const form = formFor("finance");
    if (!form) return;
    const p = project();
    [...form.elements].forEach((element) => {
      if (!element.name) return;
      const value = p[element.name];
      element.value = value !== "" && value != null ? String(value).slice(0, element.type === "month" ? 7 : element.type === "date" ? 10 : undefined)
        : element.name === "account_date" ? app().todayDate() : FINANCE_DEFAULTS[element.name] ?? "";
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
    // Payments still to take over (household Hausbau bookings, old dashboard rows) are done on their own.
    if (visible) setTimeout(() => window.HausbauImport?.finish(), 0);
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
      expenseDialog()?.addEventListener("close", () => resetForm("expense"));
    }
    if (!editing.project) fillProjectForm();
    if (!document.getElementById("hbFinanceForm")?.contains(document.activeElement)) fillFinanceForm();
    setText("hbTitle", project().title ? `Hausbau – ${project().title}` : "Hausbau");
    refreshSelects();
    renderOverview();
    renderOrders();
    renderExpenseTable();
    renderIngrid();
    renderLoans();
    renderFinance();
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
    // Orders first, labelled with their firm; then the other Gewerke.
    const ordered = orders().map((order) => order.gewerk);
    const mainOptions = (list) => list.map((main) => {
      const order = orderFor(main);
      return `<option value="${esc(main)}">${esc(order?.firma ? `${main} · ${order.firma}` : main)}</option>`;
    }).join("");
    setOptions(document.getElementById("hbExpenseMain"), `<option value="">Auftrag wählen</option>` +
      (ordered.length ? `<optgroup label="Aufträge">${mainOptions(ordered)}</optgroup><optgroup label="Weitere Gewerke">${mainOptions(mains.filter((main) => !ordered.includes(main)))}</optgroup>` : mainOptions(mains)));
    fillExpenseSubcategories();
    setOptions(document.getElementById("hbFilterMain"), listOptions(mains, "", "Alle Gewerke"));
    const keySelect = document.getElementById("hbExpenseKey");
    setOptions(keySelect, allocationKeys().map((key) => `<option value="${esc(key.id)}">${esc(key.name)}</option>`).join(""));
    const allLoans = alive(data()?.loans);
    const loanOptions = allLoans.map((loan) => `<option value="${esc(loan.id)}">${esc(loan.title)} (${esc(LOAN_TYPES[loan.loan_type] || "")})</option>`).join("");
    setOptions(document.getElementById("hbEventLoan"), loanOptions || `<option value="">Zuerst einen Kredit anlegen</option>`);
    document.getElementById("hbMainList").innerHTML = mains.map((main) => `<option value="${esc(main)}"></option>`).join("");
  }

  /** Soll and rest over the orders with a Soll; Maximilian's part of the rest follows each order's split. */
  function orderTotals() {
    const paid = paidByGewerk();
    const totals = { soll: 0, paidOnSoll: 0, rest: 0, restMax: 0, withoutSoll: 0 };
    orders().forEach((order) => {
      const soll = num(order.soll);
      if (!(soll > 0)) {
        totals.withoutSoll += 1;
        return;
      }
      const bezahlt = paid[order.gewerk] || 0;
      const open = Math.max(0, soll - bezahlt);
      const share = order.share_max === "" || order.share_max == null ? 100 : num(order.share_max);
      totals.soll += soll;
      totals.paidOnSoll += Math.min(soll, bezahlt);
      totals.rest += open;
      totals.restMax += open * share / 100;
    });
    return totals;
  }

  /** Paid amounts with a tax bonus, Maximilian's part, per bonus. */
  function taxBonusShares() {
    const byBonus = {};
    expenses().filter(isPaid).forEach((row) => {
      if (!row.tax_bonus || row.tax_bonus === "keine") return;
      byBonus[row.tax_bonus] = (byBonus[row.tax_bonus] || 0) + expenseShares(row).max;
    });
    return { byBonus, total: Object.values(byBonus).reduce((sum, value) => sum + value, 0) };
  }

  /** Paid and open amounts of one Gewerk, for the house or for Maximilian's part only. */
  function gewerkRows(mine) {
    const paid = {};
    expenses().filter(isPaid).forEach((row) => {
      const key = row.main_category || "";
      paid[key] = (paid[key] || 0) + (mine ? expenseShares(row).max : num(row.amount));
    });
    const list = orders().filter((order) => num(order.soll) > 0).map((order) => {
      const share = order.share_max === "" || order.share_max == null ? 100 : num(order.share_max);
      const soll = mine ? num(order.soll) * share / 100 : num(order.soll);
      return { main: order.gewerk, firm: order.firma || "", soll, paid: paid[order.gewerk] || 0 };
    });
    const known = new Set(list.map((entry) => entry.main));
    Object.keys(paid).filter((main) => main && !known.has(main) && paid[main]).forEach((main) => {
      list.push({ main, firm: "ohne Auftrag", soll: 0, paid: paid[main] });
    });
    return list.sort((a, b) => (b.soll || b.paid) - (a.soll || a.paid));
  }

  function renderOverview() {
    const mine = overviewScope === "max";
    document.querySelectorAll("[data-hb-scope]").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.hbScope === overviewScope);
      btn.setAttribute("aria-pressed", String(btn.dataset.hbScope === overviewScope));
    });
    const rows = expenses().filter(isPaid);
    const sum = (list, pick) => list.reduce((total, row) => total + pick(row), 0);
    const paidTotal = sum(rows, (row) => num(row.amount));
    const paidMax = sum(rows, (row) => expenseShares(row).max);
    const totals = orderTotals();
    const plan = financePlan();
    const loans = creditLoans().map((loan) => loanSummary(loan));
    const debt = loans.reduce((total, summary) => total + summary.balance, 0);
    const drawn = loans.reduce((total, summary) => total + summary.drawn, 0);
    const repaid = loans.reduce((total, summary) => total + summary.principalPaid, 0);
    const pct = (value, of) => (of > 0 ? Math.min(100, value / of * 100) : 0);

    const big = mine
      ? [hero("Mein Anteil am ganzen Bau", eur(paidMax + plan.need), `bezahlt ${eur(paidMax)} · noch offen ${eur(plan.need)}`)]
      : [hero("Gesamtkosten", eur(paidTotal + totals.rest), `Soll ${eur(totals.soll)} · bezahlt ${eur(paidTotal)}`)];
    big.push(`<div class="hero-card">
        <div class="hero-label">Kredit noch abzuzahlen</div>
        <div class="hero-value">${eur(debt)}</div>
        <div class="hb-progress" role="img" aria-label="${Math.round(pct(repaid, drawn))} % getilgt"><span style="width:${pct(repaid, drawn).toFixed(1)}%"></span></div>
        <div class="hero-sub">${eur(repaid)} getilgt von ${eur(drawn)}</div>
      </div>`);
    big.push(plan.hasBalance
      ? hero("Frei auf dem Konto", eur(plan.usable), `nach ${eur(plan.reserve)} Rücklage · Stand ${app().formatGermanDate(plan.since)}`)
      : hero("Frei auf dem Konto", "—", "Kontostand unter Finanzierung eintragen"));
    document.getElementById("hbOverviewHero").innerHTML = big.join("");

    // Where the money for the open part comes from, in Maximilian's order.
    const fundBar = document.getElementById("hbFundBar");
    const legend = document.getElementById("hbFundLegend");
    const colors = ["#5fd3a6", "#4f9df0", "#ffbe3d", "#f4a3c4"];
    if (plan.hasBalance && plan.need > 0) {
      fundBar.innerHTML = plan.pots.map((pot, index) => {
        const width = pct(pot.used, plan.need);
        return width > 0 ? `<span style="width:${width.toFixed(2)}%;background:${colors[index]}" title="${esc(pot.name)}"></span>` : "";
      }).join("");
      legend.innerHTML = plan.pots.map((pot, index) => `<li><span class="hb-dot" style="background:${colors[index]}"></span>${esc(pot.name)}<span class="hb-legend-val">${eur(pot.used)}</span></li>`).join("");
      setText("hbFundNote", plan.uncovered > 0.005
        ? `Auch mit allem bleiben ${eur(plan.uncovered)} ungedeckt.`
        : `Lücke bis zur Förderung ${eur(plan.gapBeforeGrant)}, zweites Darlehen ${eur(plan.secondNeeded)}.`);
    } else {
      fundBar.innerHTML = "";
      legend.innerHTML = "";
      setText("hbFundNote", plan.hasBalance ? "Kein offener Anteil mit Soll." : "Kontostand unter Finanzierung eintragen, dann rechnet Nomia die Töpfe.");
    }

    const gewerke = gewerkRows(mine);
    setText("hbGewerkInfo", mine ? "Dein Anteil am Soll, bezahlt" : "Soll gesamt, bezahlt");
    document.getElementById("hbGewerkList").innerHTML = gewerke.length
      ? gewerke.map((entry) => `<div class="hb-gewerk">
          <div class="hb-gewerk-head"><span class="hb-gewerk-name">${esc(entry.main)}<span class="text-muted"> · ${esc(entry.firm)}</span></span>
          <span class="num">${entry.soll ? `${eur(entry.paid)} von ${eur(entry.soll)}` : `${eur(entry.paid)} bezahlt`}</span></div>
          <div class="hb-progress${entry.soll && entry.paid > entry.soll + 0.005 ? " is-over" : ""}" role="img" aria-label="${Math.round(pct(entry.paid, entry.soll))} % bezahlt"><span style="width:${pct(entry.paid, entry.soll).toFixed(1)}%"></span></div>
        </div>`).join("")
      : `<p class="text-muted">Noch keine Gewerke.</p>`;

    const months = [...new Set(rows.map((row) => monthKey(row.date)).filter(Boolean))].sort();
    let running = 0;
    const cumulative = months.map((month) => {
      running += sum(rows.filter((row) => monthKey(row.date) === month), (row) => (mine ? expenseShares(row).max : num(row.amount)));
      return round2(running);
    });
    app().ensureChart("hbTimelineChart", "hbTimelineChart", {
      type: "line",
      data: {
        labels: months.map(monthLabel),
        datasets: [{ label: mine ? "Dein Anteil bezahlt" : "Bezahlt", data: cumulative, borderColor: "#5fd3a6" }]
      }
    });

    document.querySelector("#hbRecentTable tbody").innerHTML = rows.length
      ? rows.slice(0, 6).map((row) => `<tr>
          <td>${esc(app().formatGermanDate(row.date))}</td>
          <td>${esc(row.title)}<div class="text-muted">${esc([row.main_category, row.sub_category].filter(Boolean).join(" · "))}</div></td>
          <td class="num">${eur(num(row.amount))}</td>
        </tr>`).join("")
      : empty(3, "Noch keine Zahlungen");
  }

  /** Split picker for one expense; a share no key matches stays as "Individuell". */
  function splitSelect(row) {
    const keys = allocationKeys().filter((key) => key.id !== "CUSTOM");
    const current = keys.find((key) => key.id === row.allocation_key && Math.abs(num(key.share_max) - num(row.share_max)) < 0.01);
    const share = num(row.share_max);
    const own = current ? "" : `<option value="" selected>Individuell (${share.toFixed(1)} / ${(100 - share).toFixed(1)})</option>`;
    return `<select class="hb-split" data-hb-split="${esc(row.id)}" aria-label="Aufteilung">${own}${keys
      .map((key) => `<option value="${esc(key.id)}"${current?.id === key.id ? " selected" : ""}>${esc(key.name)}</option>`).join("")}</select>`;
  }

  /** Unit, key and share of a split key (MAX / INGRID book on the own flat). */
  function splitFields(keyId) {
    const key = allocationKeys().find((entry) => entry.id === keyId);
    if (!key || key.share_max === null) return null;
    return { unit: keyId === "MAX" ? "max" : keyId === "INGRID" ? "ingrid" : "shared", allocation_key: key.id, share_max: key.share_max };
  }

  /** Fields of a payment as the form sends them; the server keeps every other column. */
  const EXPENSE_FIELDS = ["date", "title", "sub_category", "main_category", "unit", "allocation_key", "share_max",
    "amount", "status", "paid_by", "tax_bonus", "invoice_no", "note"];

  /** Saves an existing expense with some fields changed (works before the tab was ever opened). */
  function saveExpenseFields(row, changes) {
    const record = {};
    EXPENSE_FIELDS.forEach((name) => { if (name in row) record[name] = row[name] ?? ""; });
    Object.assign(record, changes, { id: row.id });
    return app().apiPost("hausbauSave", { entity: "expense", record });
  }

  async function saveSplit(select) {
    const row = expenses().find((entry) => entry.id === select.dataset.hbSplit);
    const fields = splitFields(select.value);
    if (!row || !fields) return;
    select.disabled = true;
    try {
      const result = await saveExpenseFields(row, fields);
      await app().refreshAfterWrite(result);
      app().showMessage(`Aufteilung für „${row.title}“ gespeichert.`, "success");
    } catch (error) {
      app().showMessage(error.message || "Speichern fehlgeschlagen.", "error");
      select.disabled = false;
    }
  }

  /** One row per Gewerk: the house app's orders, plus Gewerke that only have payments (no Soll). */
  function renderOrders() {
    const table = document.getElementById("hbOrderTable");
    if (!table) return;
    const paid = paidByGewerk();
    const list = orders().map((order) => ({ order, main: order.gewerk }));
    const known = new Set(list.map((entry) => entry.main));
    Object.keys(paid).filter((main) => main && !known.has(main)).sort()
      .forEach((main) => list.push({ order: null, main }));
    const keys = allocationKeys();
    const splitText = (order) => {
      if (!order || order.share_max === "") return "—";
      const key = keys.find((entry) => entry.id === order.allocation_key);
      return key ? key.name : `Max ${num(order.share_max).toLocaleString("de-DE", { maximumFractionDigits: 1 })} %`;
    };
    let sumSoll = 0;
    let sumPaid = 0;
    let sumRest = 0;
    table.querySelector("tbody").innerHTML = list.map(({ order, main }) => {
      const soll = order && order.soll !== "" ? num(order.soll) : null;
      const bezahlt = paid[main] || 0;
      sumPaid += bezahlt;
      if (soll !== null) sumSoll += soll;
      const rest = soll === null ? null : soll - bezahlt;
      if (rest !== null) sumRest += Math.max(0, rest);
      const pct = soll ? Math.min(100, bezahlt / soll * 100) : 0;
      const over = rest !== null && rest < -0.005;
      const status = !order ? "ohne Soll" : order.status === "vergeben" ? "vergeben" : "geplant";
      const firm = order?.firma || (order?.is_estimate === "ja" ? "Schätzung" : "");
      return `<tr>
        <td>${esc(main)}<div class="text-muted">${esc(firm || "—")}</div></td>
        <td><span class="pill ${status === "vergeben" ? "cm-check" : ""}">${esc(status)}</span></td>
        <td class="num">${soll === null ? "—" : eur(soll)}</td>
        <td class="num">${eur(bezahlt)}</td>
        <td class="num${over ? " hb-over" : ""}">${rest === null ? "—" : over ? `+${eur(-rest)} über Soll` : eur(rest)}</td>
        <td>${soll ? `<div class="hb-progress${over ? " is-over" : ""}" role="img" aria-label="${Math.round(bezahlt / soll * 100)} % bezahlt"><span style="width:${pct.toFixed(1)}%"></span></div>` : ""}</td>
        <td>${esc(splitText(order))}</td>
        <td><button type="button" class="btn btn-ghost btn-xs" data-hb-order-pay="${esc(main)}">+ Zahlung</button></td>
      </tr>`;
    }).join("") || `<tr><td colspan="8" class="text-muted">Noch keine Aufträge.</td></tr>`;
    table.querySelector("tfoot").innerHTML = list.length
      ? `<tr><td>Summe</td><td></td><td class="num">${eur(sumSoll)}</td><td class="num">${eur(sumPaid)}</td><td class="num">${eur(sumRest)}</td><td></td><td></td><td></td></tr>`
      : "";
    const synced = orders().map((order) => String(order.synced_at || "")).sort().pop();
    setText("hbOrderInfo", orders().length
      ? `Aus der Hausbau-App, Stand ${app().formatGermanDate(synced.slice(0, 10))}. Soll brutto, so wie bezahlt wird. Ändern nur in der Hausbau-App.`
      : "Die Aufträge kommen automatisch aus der Hausbau-App, sobald sie mit Nomia verbunden ist.");
  }

  function renderExpenseTable() {
    const filters = {
      main: document.getElementById("hbFilterMain")?.value || "",
      paidBy: document.getElementById("hbFilterPaidBy")?.value || "",
      text: (document.getElementById("hbFilterText")?.value || "").trim().toLowerCase()
    };
    const rows = expenses().filter((row) =>
      (!filters.main || row.main_category === filters.main) &&
      (!filters.paidBy || row.paid_by === filters.paidBy) &&
      (!filters.text || [row.title, row.vendor, row.sub_category, row.main_category, row.invoice_no, row.note].join(" ").toLowerCase().includes(filters.text))
    );
    const total = rows.reduce((sum, row) => sum + num(row.amount), 0);
    setText("hbExpenseCount", `${rows.length} Zahlungen · ${eur(total)}`);
    document.querySelector("#hbExpenseTable tbody").innerHTML = rows.length
      ? rows.map((row) => {
          const shares = expenseShares(row);
          const open = isPaid(row) ? "" : ` <span class="pill">${esc(STATUS[row.status] || "")}</span>`;
          return `<tr>
            <td>${esc(app().formatGermanDate(row.date))}</td>
            <td>${esc(row.title)}${open}${row.invoice_no ? `<div class="text-muted">${esc(row.invoice_no)}</div>` : ""}</td>
            <td>${esc(row.main_category || "—")}${row.sub_category ? `<div class="text-muted">${esc(row.sub_category)}</div>` : ""}</td>
            <td>${splitSelect(row)}</td>
            <td class="num">${eur(shares.amount)}</td>
            <td class="num">${eur(shares.max)}</td>
            <td class="num">${eur(shares.ingrid)}</td>
            <td>${esc(PEOPLE[row.paid_by] || "Maximilian")}</td>
            <td>${rowActions("expense", row.id)}</td>
          </tr>`;
        }).join("")
      : empty(9, "Noch keine Zahlungen");
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
          <tr><td>Getilgt</td><td>${summary.drawn > 0 ? `<div class="hb-progress" role="img" aria-label="${Math.round(summary.principalPaid / summary.drawn * 100)} % getilgt"><span style="width:${Math.min(100, summary.principalPaid / summary.drawn * 100).toFixed(1)}%"></span></div><div class="text-muted">${eur(summary.principalPaid)} von ${eur(summary.drawn)}</div>` : "—"}</td></tr>
          <tr><td>Restschuld heute</td><td class="num">${eur(summary.balance)}</td></tr>
          <tr><td>Ausbezahlt / noch abrufbar</td><td class="num">${eur(summary.drawn)} / ${eur(summary.available)}</td></tr>
          <tr><td>Monatliche Belastung (dieser Monat)</td><td class="num">${eur(summary.currentCost)}</td></tr>
          <tr><td>Getilgt bisher / Zinsen bisher</td><td class="num">${eur(summary.principalPaid)} / ${eur(summary.interestPaid)}</td></tr>
          <tr><td>Restschuld Ende Zinsbindung</td><td class="num">${summary.balanceAtFixedEnd === null ? "—" : eur(summary.balanceAtFixedEnd)}</td></tr>
          <tr><td>Abbezahlt / Restlaufzeit</td><td class="num">${summary.payoffMonth ? `${monthLabel(summary.payoffMonth)} · ${summary.remainingMonths} Monate` : "Erste Rate und Rate hinterlegen"}</td></tr>
          <tr><td>Zinsen bis Laufzeitende (Plan)</td><td class="num">${eur(summary.interestRemaining)}</td></tr>
          ${conditionsRow(loan)}
        </tbody></table></div>
        ${loan.first_rate_month ? `
        <form class="form-grid compact-form hb-rate-form" data-hb-rate="${esc(loan.id)}">
          ${field("Monat", `<input type="month" name="month" value="${esc(thisMonth())}" required />`)}
          ${field("Rate laut Bank (€)", `<input type="number" name="rate" step="0.01" min="0" required value="${esc(rateFor(loan, thisMonth()) ?? "")}" />`)}
          <div class="actions-row"><button class="btn btn-primary" type="submit">Rate speichern</button></div>
          <p class="field-help full">Jeden Monat die tatsächliche Rate eintragen. Sie zählt in diesem Monat zu deinen Fixkosten und gilt als Schätzung für die nächsten Monate.</p>
        </form>
        ${rateHistory(loan, summary)}` : ""}
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

  /**
   * Maximilian's financing, in his order: Eigenmittel, the loan already on the account, the
   * grant, the second loan last. The balance he entered once is carried on with what Nomia
   * knows since that day: the household month by month (income minus his share of all costs,
   * loan rates included), his Hausbau payments and the settlements with Ingrid.
   */
  function financePlan() {
    const p = project();
    const valueOr = (name) => (p[name] === "" || p[name] == null ? FINANCE_DEFAULTS[name] : num(p[name]));
    const since = String(p.account_date || "").slice(0, 10);
    const hasBalance = p.account_balance !== "" && p.account_balance != null && !!since;
    const after = (row) => String(row.date || "").slice(0, 10) > since;
    const firstMonth = hasBalance ? addMonths(monthKey(since), 1) : "";
    let household = 0;
    if (hasBalance) {
      for (let month = firstMonth; month <= thisMonth(); month = addMonths(month, 1)) household += num(app().monthAvailable?.(month));
    }
    const hausbauPaid = hasBalance
      ? expenses().filter((row) => isPaid(row) && row.paid_by !== "ingrid" && after(row)).reduce((sum, row) => sum + num(row.amount), 0)
      : 0;
    const settled = hasBalance
      ? alive(data()?.settlements).filter(after).reduce((sum, row) => sum + (row.from_person === "ingrid" ? num(row.amount) : -num(row.amount)), 0)
      : 0;
    // Everything Ingrid and Maximilian owe each other, from the first booking on: what she still owes
    // him is money to come, what he owes her is money to go. Settlements are already in this sum.
    const openWithIngrid = hasBalance
      ? round2(ingridBalance().lines.filter((line) => line.date).reduce((sum, line) => sum + line.effect, 0))
      : 0;
    const start = num(p.account_balance);
    // Settlements after the date are cash not yet in the balance; the sum above already has them as debts.
    const balance = round2(start + household - hausbauPaid + openWithIngrid + settled);
    const reserve = valueOr("reserve");
    const usable = Math.max(0, balance - reserve);
    const loanLeft = Math.min(valueOr("loan_on_account"), usable);
    const grantMonth = monthKey(p.grant_month) || FINANCE_DEFAULTS.grant_month;
    const need = round2(orderTotals().restMax);
    const pots = [
      { name: "Eigenmittel", note: "Kontostand ohne Darlehen und Rücklage", available: usable - loanLeft },
      { name: "Zinsbegünstigtes Darlehen", note: "noch nicht verbraucht, liegt auf dem Konto", available: loanLeft },
      { name: "Förderung", note: `erwartet ab ${monthLabel(grantMonth)}`, available: valueOr("grant_amount") },
      { name: "Zweites Darlehen", note: "nur wenn alles andere aufgebraucht ist", available: valueOr("second_loan") }
    ];
    let remaining = need;
    pots.forEach((pot) => {
      pot.used = Math.min(pot.available, remaining);
      pot.left = pot.available - pot.used;
      remaining -= pot.used;
    });
    return {
      hasBalance, since, firstMonth, start, household, hausbauPaid, settled, openWithIngrid, balance, reserve, usable, loanLeft,
      grantMonth, need, pots,
      gapBeforeGrant: Math.max(0, need - usable),
      secondNeeded: pots[3].used,
      uncovered: Math.max(0, remaining)
    };
  }

  /** The rate entered for a month (event "Rate"), or null. */
  function rateFor(loan, month) {
    const event = loanEvents(loan.id).filter((row) => row.event_type === "ratenaenderung" && monthKey(row.date) === month).pop();
    return event ? num(event.monthly_rate) : null;
  }

  /** Rates month by month since the first rate: entered ones and estimated ones. */
  function rateHistory(loan, summary) {
    const rows = summary.rows.filter((row) => row.repaying && row.month <= thisMonth()).slice(-24).reverse();
    if (!rows.length) return "";
    return `<div class="table-scroll"><table class="data-table hb-rate-table">
      <thead><tr><th>Monat</th><th class="num">Rate</th><th class="num">Zinsen</th><th class="num">Tilgung</th><th class="num">Restschuld</th><th></th></tr></thead>
      <tbody>${rows.map((row) => {
        const entered = rateFor(loan, row.month) !== null;
        return `<tr><td>${monthLabel(row.month)}</td><td class="num">${eur(row.payment)}</td><td class="num">${eur(row.interest)}</td><td class="num">${eur(row.principal)}</td><td class="num">${eur(row.balance)}</td><td class="text-muted">${entered ? "eingetragen" : "geschätzt"}</td></tr>`;
      }).join("")}</tbody></table></div>`;
  }

  /** Saves the bank's rate for one month; a second entry for the same month replaces the first. */
  async function saveRate(form) {
    const loanId = form.dataset.hbRate;
    const month = form.elements.month.value;
    const rate = num(form.elements.rate.value);
    if (!month || !(rate > 0)) return;
    const existing = loanEvents(loanId).filter((row) => row.event_type === "ratenaenderung" && monthKey(row.date) === month).pop();
    const record = { loan_id: loanId, date: `${month}-01`, event_type: "ratenaenderung", monthly_rate: rate, amount: "", note: "Rate laut Bank" };
    if (existing) record.id = existing.id;
    const button = form.querySelector('button[type="submit"]');
    if (button) button.disabled = true;
    try {
      const result = await app().apiPost("hausbauSave", { entity: "loanEvent", record });
      await app().refreshAfterWrite(result);
      app().showMessage(`Rate ${monthLabel(month)}: ${eur(rate)} gespeichert.`, "success");
    } catch (error) {
      app().showMessage(error.message || "Speichern fehlgeschlagen.", "error");
    } finally {
      if (button) button.disabled = false;
    }
  }

  function renderFinance() {
    const plan = financePlan();
    const split = currentLoanSplit();
    const hasLoan = creditLoans().length > 0;
    document.getElementById("hbFinanceHero").innerHTML = [
      hero("Kontostand heute", plan.hasBalance ? eur(plan.balance) : "—", plan.hasBalance
        ? `gerechnet ab ${eur(plan.start)} am ${app().formatGermanDate(plan.since)}`
        : "unten einmal eintragen"),
      hero("Frei verfügbar", plan.hasBalance ? eur(plan.usable) : "—", `Rücklage ${eur(plan.reserve)} bleibt stehen`),
      hero("Dein offener Anteil", eur(plan.need), "Rest aller Aufträge mit Soll"),
      hero("Lücke bis zur Förderung", plan.hasBalance ? eur(plan.gapBeforeGrant) : "—", plan.gapBeforeGrant > 0.005
        ? `bis ${monthLabel(plan.grantMonth)} zu überbrücken`
        : "keine, das Geld auf dem Konto reicht"),
      hero("Zweites Darlehen nötig", plan.hasBalance ? eur(plan.secondNeeded) : "—", plan.uncovered > 0.005
        ? `${eur(plan.uncovered)} sind auch damit nicht gedeckt`
        : plan.secondNeeded > 0.005 ? "nach Eigenmitteln, Darlehen und Förderung" : "nach heutigem Stand nicht"),
      hero("Kreditrate diesen Monat", eur(split.cost), hasLoan ? `zählt zu deinen Fixkosten · davon Tilgung ${eur(split.principal)}` : "Kredit unten anlegen, dann zählt die Rate zu den Fixkosten")
    ].join("");

    const bar = (used, available) => {
      const pct = available > 0 ? Math.min(100, used / available * 100) : 0;
      return available > 0 ? `<div class="hb-progress" role="img" aria-label="${Math.round(pct)} % gebraucht"><span style="width:${pct.toFixed(1)}%"></span></div>` : "";
    };
    document.querySelector("#hbPotTable tbody").innerHTML = plan.pots.map((pot, index) => `<tr>
        <td>${esc(pot.name)}<div class="text-muted">${esc(pot.note)}</div></td>
        <td class="num">${plan.hasBalance || index > 1 ? eur(pot.available) : "—"}</td>
        <td class="num">${eur(pot.used)}</td>
        <td>${bar(pot.used, pot.available)}</td>
        <td class="num">${eur(pot.left)}</td>
      </tr>`).join("") + (plan.uncovered > 0.005
        ? `<tr><td class="hb-over">Nicht gedeckt</td><td></td><td class="num hb-over">${eur(plan.uncovered)}</td><td></td><td></td></tr>`
        : "");

    const lines = plan.hasBalance ? [
      [`Kontostand am ${app().formatGermanDate(plan.since)}`, plan.start],
      [plan.firstMonth <= thisMonth() ? `Haushalt ${monthLabel(plan.firstMonth)} bis ${monthLabel(thisMonth())}: Einnahmen minus deine Ausgaben` : "Haushalt: ab nächstem Monat eingerechnet", plan.household],
      ["Deine Hausbau-Zahlungen seit dem Stichtag", -plan.hausbauPaid],
      [plan.openWithIngrid >= 0 ? "Ingrid schuldet dir (offen)" : "Du schuldest Ingrid (offen)", plan.openWithIngrid],
      ["Ausgleich mit Ingrid seit dem Stichtag", plan.settled],
      ["Kontostand heute (gerechnet)", plan.balance, true],
      ["Rücklage, bleibt immer", -plan.reserve],
      ["Davon Darlehen, noch nicht verbraucht", -plan.loanLeft],
      ["Eigenmittel frei", plan.pots[0].available, true]
    ] : [];
    document.querySelector("#hbAccountTable tbody").innerHTML = lines
      .map(([label, value, strong]) => `<tr${strong ? ' class="hb-total"' : ""}><td>${esc(label)}</td><td class="num">${eur(value)}</td></tr>`).join("");
    setText("hbFinanceInfo", plan.hasBalance
      ? "Nur dein Anteil. Ingrids Kosten werden nur mitgeführt."
      : "Trag unten einmal deinen Kontostand ein, dann rechnet Nomia die Töpfe aus. Nur dein Anteil, Ingrids Kosten werden nur mitgeführt.");
    const setup = document.getElementById("hbFinanceSetup");
    if (setup && !plan.hasBalance) setup.open = true;
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
      : empty(3, "Nur die Standard-Gewerke in Verwendung");
  }

  function renderDashboardCard() {
    const card = document.getElementById("hausbauDashboardCard");
    if (!card || !data()) return;
    const paid = expenses().filter(isPaid);
    const paidTotal = paid.reduce((sum, row) => sum + num(row.amount), 0);
    const totals = orderTotals();
    const plan = financePlan();
    const ingrid = ingridBalance().balance;
    const split = currentLoanSplit();
    const reminders = dueConditions();
    const pct = totals.soll ? Math.min(100, totals.paidOnSoll / totals.soll * 100) : 0;
    card.innerHTML = `
      <div class="card-header">
        <div><h2>Hausbau</h2><p>Separat, nicht in den Monatskosten enthalten (nur die Kreditrate zählt)</p></div>
        <button type="button" class="btn btn-ghost btn-xs" data-hb-open>Öffnen</button>
      </div>
      ${totals.soll ? `<div class="hb-progress hb-progress-lg" role="img" aria-label="${Math.round(pct)} % vom Soll bezahlt"><span style="width:${pct.toFixed(1)}%"></span></div>
      <p class="text-muted">${eur(paidTotal)} von ${eur(totals.soll)} bezahlt, offen ${eur(totals.rest)}</p>` : ""}
      <div class="hero-grid">
        ${hero("Bezahlt", eur(paidTotal), totals.soll ? `Soll ${eur(totals.soll)}` : `${paid.length} Zahlungen`)}
        ${hero("Dein offener Anteil", eur(plan.need), "Rest der Aufträge")}
        ${hero(plan.hasBalance ? "Frei auf dem Konto" : "Kontostand", plan.hasBalance ? eur(plan.usable) : "—", plan.hasBalance
          ? (plan.gapBeforeGrant > 0.005 ? `Lücke bis zur Förderung ${eur(plan.gapBeforeGrant)}` : `Rücklage ${eur(plan.reserve)} bleibt`)
          : "im Hausbau unter Finanzierung eintragen")}
        ${hero(ingrid >= 0 ? "Ingrid schuldet dir" : "Du schuldest Ingrid", eur(Math.abs(ingrid)), "Ausgleichssaldo")}
        ${hero("Kreditrate diesen Monat", eur(split.cost), `davon Tilgung ${eur(split.principal)}`)}
      </div>
      ${reminders.length ? `<div class="alert warning">${reminders.map(({ loan, overdue }) => `${overdue ? "Überfällig" : "Bald fällig"}: ${esc(loan.title)} – ${esc(loan.conditions)} bis ${esc(app().formatGermanDate(loan.conditions_due))}`).join("<br>")}</div>` : ""}`;
    card.querySelector("[data-hb-open]")?.addEventListener("click", () => document.querySelector('.nav-btn[data-tab="hausbau"]')?.click());
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

  window.Hausbau = {
    sync, render, renderDashboardCard, openExpenseForm, loanFixedCostRows, loanSchedule, ingridBalance,
    areaShareMax, promilleShareMax, categoryMap, classify, gewerkOfFirm, allocationKeys, splitFields, expenses,
    defaultSplitKey, saveExpenseFields
  };
})();
