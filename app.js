(() => {
  const DEFAULT_START_MONTH = "2026-01";
  const DEFAULT_RANGE_MONTHS = 12;

  const PERSON_A = "Maximilian Hofer";
  const PERSON_B = "Jana March";

  const state = {
    activeApiBaseUrl: null,
    charts: {},
    initializedUi: false,
    data: {
      income: [],
      transactions: [],
      trips: [],
      tripExpenses: [],
      categories: [],
      fixedCosts: []
    }
  };

  const els = {
    tabs: document.getElementById("tabs"),
    filterStartMonth: document.getElementById("filterStartMonth"),
    filterAnalysisMonth: document.getElementById("filterAnalysisMonth"),
    filterMainCategory: document.getElementById("filterMainCategory"),
    rangeMonths: document.getElementById("rangeMonths"),
    chartMode: document.getElementById("chartMode"),
    compositionMode: document.getElementById("compositionMode"),
    reloadBtn: document.getElementById("reloadBtn"),
    syncStatus: document.getElementById("syncStatus"),
    messageBox: document.getElementById("messageBox"),

    kpiGrid: document.getElementById("kpiGrid"),
    monthlySummary: document.getElementById("monthlySummary"),
    insightList: document.getElementById("insightList"),

    categoryTableBody: document.querySelector("#categoryTable tbody"),
    transactionsTableBody: document.querySelector("#transactionsTable tbody"),
    tripsTableBody: document.querySelector("#tripsTable tbody"),
    tripExpensesTableBody: document.querySelector("#tripExpensesTable tbody"),
    categoriesTableBody: document.querySelector("#categoriesTable tbody"),
    fixedCostsTableBody: document.querySelector("#fixedCostsTable tbody"),
    incomeTableBody: document.querySelector("#incomeTable tbody"),

    monthOverviewTableBody: document.querySelector("#monthOverviewTable tbody"),
    rangeOverviewTableBody: document.querySelector("#rangeOverviewTable tbody"),
    categoryCompareTableBody: document.querySelector("#categoryCompareTable tbody"),

    heroAvailable: document.getElementById("heroAvailable"),
    heroAvailableSub: document.getElementById("heroAvailableSub"),
    heroFixedCosts: document.getElementById("heroFixedCosts"),
    heroFixedCostsSub: document.getElementById("heroFixedCostsSub"),
    heroPeerBalance: document.getElementById("heroPeerBalance"),
    heroPeerLabel: document.getElementById("heroPeerLabel"),

    bookingMainCategory: document.getElementById("bookingMainCategory"),
    bookingSubCategory: document.getElementById("bookingSubCategory"),
    tripMainCategory: document.getElementById("tripMainCategory"),
    tripSubCategory: document.getElementById("tripSubCategory"),
    fixedMainCategory: document.getElementById("fixedMainCategory"),
    fixedSubCategory: document.getElementById("fixedSubCategory"),
    tripExpenseTripId: document.getElementById("tripExpenseTripId"),

    transactionForm: document.getElementById("transactionForm"),
    tripForm: document.getElementById("tripForm"),
    tripExpenseForm: document.getElementById("tripExpenseForm"),
    categoryForm: document.getElementById("categoryForm"),
    fixedCostForm: document.getElementById("fixedCostForm"),
    incomeForm: document.getElementById("incomeForm"),

    bookingFormModeLabel: document.getElementById("bookingFormModeLabel"),
    tripFormModeLabel: document.getElementById("tripFormModeLabel"),
    tripExpenseFormModeLabel: document.getElementById("tripExpenseFormModeLabel"),
    categoryFormModeLabel: document.getElementById("categoryFormModeLabel"),
    fixedCostFormModeLabel: document.getElementById("fixedCostFormModeLabel"),
    incomeFormModeLabel: document.getElementById("incomeFormModeLabel"),

    transactionSubmitBtn: document.getElementById("transactionSubmitBtn"),
    tripSubmitBtn: document.getElementById("tripSubmitBtn"),
    tripExpenseSubmitBtn: document.getElementById("tripExpenseSubmitBtn"),
    categorySubmitBtn: document.getElementById("categorySubmitBtn"),
    fixedCostSubmitBtn: document.getElementById("fixedCostSubmitBtn"),
    incomeSubmitBtn: document.getElementById("incomeSubmitBtn"),

    transactionCancelEditBtn: document.getElementById("transactionCancelEditBtn"),
    tripCancelEditBtn: document.getElementById("tripCancelEditBtn"),
    tripExpenseCancelEditBtn: document.getElementById("tripExpenseCancelEditBtn"),
    categoryCancelEditBtn: document.getElementById("categoryCancelEditBtn"),
    fixedCostCancelEditBtn: document.getElementById("fixedCostCancelEditBtn"),
    incomeCancelEditBtn: document.getElementById("incomeCancelEditBtn"),

    fixedCompositionLabel: document.getElementById("fixedCompositionLabel"),
    variableCompositionLabel: document.getElementById("variableCompositionLabel"),

    bookingType: document.getElementById("bookingType"),
    transactionCounterparty: document.getElementById("transactionCounterparty"),
    transactionSplitEnabled: document.getElementById("transactionSplitEnabled"),
    transactionSplitPercent: document.getElementById("transactionSplitPercent"),

    housingRangeMonths: document.getElementById("housingRangeMonths"),
    housingDisplayMode: document.getElementById("housingDisplayMode"),
    housingMonthTotal: document.getElementById("housingMonthTotal"),
    housingAverageTotal: document.getElementById("housingAverageTotal"),
    housingCategoryCount: document.getElementById("housingCategoryCount"),
    housingMonthTableBody: document.querySelector("#housingMonthTable tbody"),
    housingAverageTableBody: document.querySelector("#housingAverageTable tbody"),

    vacationAnalysisSelect: document.getElementById("vacationAnalysisSelect"),
    vacationTotalCost: document.getElementById("vacationTotalCost"),
    vacationCostPerDay: document.getElementById("vacationCostPerDay"),
    vacationTripCount: document.getElementById("vacationTripCount"),
    vacationKpiTableBody: document.querySelector("#vacationKpiTable tbody"),
    vacationDaysTableBody: document.querySelector("#vacationDaysTable tbody")
  };

  const editState = {
    transaction: null,
    trip: null,
    tripExpense: null,
    category: null,
    fixedCost: null,
    income: null
  };

  const currency = (value) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: CONFIG.DEFAULT_CURRENCY || "EUR"
    }).format(Number(value || 0));

  const percent = (value) => `${Number(value || 0).toFixed(1)} %`;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[m]));

  const currentMonth = () => new Date().toISOString().slice(0, 7);
  const monthFromDate = (value) => String(value || "").slice(0, 7);
  const normalizeDateOnly = (value) => String(value || "").slice(0, 10);

  function toPercent(value, income) {
    return income > 0 ? (Number(value || 0) / Number(income || 0)) * 100 : 0;
  }

  function normalizePersonName(name) {
    const raw = String(name || "").trim().toLowerCase();
    if (raw === "maximilian hofer" || raw === "hofer maximilian") return PERSON_A;
    if (raw === "jana march") return PERSON_B;
    return String(name || "").trim();
  }

  function currentUser() {
    return typeof getActiveUser === "function" ? getActiveUser() : null;
  }

  function currentUserName() {
    const raw = currentUser()?.displayName || CONFIG.USER_NAME || PERSON_A;
    return normalizePersonName(raw);
  }

  function otherUserName() {
    return currentUserName() === PERSON_B ? PERSON_A : PERSON_B;
  }

  function normalizeRecordNames(record) {
    const obj = { ...record };
    if ("owner_user" in obj) obj.owner_user = normalizePersonName(obj.owner_user);
    if ("paid_by" in obj) obj.paid_by = normalizePersonName(obj.paid_by);
    if ("counterparty" in obj) obj.counterparty = obj.counterparty === "-" ? "-" : normalizePersonName(obj.counterparty);
    if ("created_by" in obj) obj.created_by = normalizePersonName(obj.created_by);
    if ("updated_by" in obj) obj.updated_by = normalizePersonName(obj.updated_by);
    return obj;
  }

  function isPercentMode() {
    return (els.chartMode?.value || "currency") === "percent";
  }

  function selectedStartMonth() {
    return els.filterStartMonth?.value || DEFAULT_START_MONTH;
  }

  function selectedAnalysisMonth() {
    return els.filterAnalysisMonth?.value || currentMonth();
  }

  function housingDisplayMode() {
    return els.housingDisplayMode?.value || "currency";
  }

  function housingRangeMonths() {
    return Number(els.housingRangeMonths?.value || 12);
  }

  function showMessage(text, type = "error") {
    if (!els.messageBox) return;
    els.messageBox.innerHTML = `<div class="alert ${type}">${escapeHtml(text)}</div>`;
  }

  function clearMessage() {
    if (!els.messageBox) return;
    els.messageBox.innerHTML = "";
  }

  function withClientKeys(raw) {
    return {
      income: (raw.income || []).map((row, idx) => ({ ...normalizeRecordNames(row), _clientKey: `income_${idx}_${row.id || ""}` })),
      transactions: (raw.transactions || []).map((row, idx) => ({ ...normalizeRecordNames(row), _clientKey: `transaction_${idx}_${row.id || ""}` })),
      trips: (raw.trips || []).map((row, idx) => ({ ...normalizeRecordNames(row), _clientKey: `trip_${idx}_${row.trip_id || ""}` })),
      tripExpenses: (raw.tripExpenses || []).map((row, idx) => ({ ...normalizeRecordNames(row), _clientKey: `tripExpense_${idx}_${row.id || ""}` })),
      categories: (raw.categories || []).map((row, idx) => ({ ...normalizeRecordNames(row), _clientKey: `category_${idx}_${row.id || ""}` })),
      fixedCosts: (raw.fixedCosts || []).map((row, idx) => ({ ...normalizeRecordNames(row), _clientKey: `fixedCost_${idx}_${row.id || ""}` }))
    };
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
  }

  async function resolveApiBaseUrl() {
    if (state.activeApiBaseUrl) return state.activeApiBaseUrl;

    for (const baseUrl of CONFIG.API_BASE_URLS || []) {
      try {
        const result = await fetchJson(`${baseUrl}?action=getAll`);
        if (result && result.success) {
          state.activeApiBaseUrl = baseUrl;
          return baseUrl;
        }
      } catch (error) {
        console.warn("API Test fehlgeschlagen:", baseUrl, error);
      }
    }

    throw new Error("Keine funktionierende Apps-Script-URL gefunden. Bitte Deployment prüfen.");
  }

  async function apiGet(action) {
    const baseUrl = await resolveApiBaseUrl();
    const result = await fetchJson(`${baseUrl}?action=${encodeURIComponent(action)}`);
    if (!result.success) throw new Error(result.error || "Unbekannter Backend-Fehler");
    return result;
  }

  async function apiPost(action, payload) {
    const baseUrl = await resolveApiBaseUrl();
    const result = await fetchJson(baseUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload })
    });
    if (!result.success) throw new Error(result.error || "Unbekannter Backend-Fehler");
    return result;
  }

  function setDefaultMonth() {
    if (els.filterStartMonth && !els.filterStartMonth.value) {
      els.filterStartMonth.value = DEFAULT_START_MONTH;
    }
    if (els.filterAnalysisMonth && !els.filterAnalysisMonth.value) {
      els.filterAnalysisMonth.value = currentMonth();
    }
    if (els.rangeMonths && !els.rangeMonths.value) {
      els.rangeMonths.value = String(DEFAULT_RANGE_MONTHS);
    }
    if (els.housingRangeMonths && !els.housingRangeMonths.value) {
      els.housingRangeMonths.value = "12";
    }

    const today = new Date().toISOString().slice(0, 10);
    const transactionDate = els.transactionForm?.querySelector('input[name="date"]');
    const tripExpenseDate = els.tripExpenseForm?.querySelector('input[name="date"]');
    const incomeDate = els.incomeForm?.querySelector('input[name="date"]');

    if (transactionDate && !transactionDate.value) transactionDate.value = today;
    if (tripExpenseDate && !tripExpenseDate.value) tripExpenseDate.value = today;
    if (incomeDate && !incomeDate.value) incomeDate.value = today;
  }

  function monthRange() {
    const count = Number(els.rangeMonths?.value || DEFAULT_RANGE_MONTHS);
    const months = [];
    const [startYear, startMonth] = selectedStartMonth().split("-").map(Number);
    const startDate = new Date(startYear, startMonth - 1, 1);

    for (let i = 0; i < count; i += 1) {
      const d = new Date(startDate.getFullYear(), startDate.getMonth() + i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
  }

  function analysisRangeMonths() {
    const start = selectedStartMonth();
    const end = currentMonth();

    const months = [];
    const [startYear, startMonth] = start.split("-").map(Number);
    const [endYear, endMonth] = end.split("-").map(Number);

    let cursor = new Date(startYear, startMonth - 1, 1);
    const endDate = new Date(endYear, endMonth - 1, 1);

    while (cursor <= endDate) {
      months.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`);
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return months;
  }

  function housingMonthRange() {
    const count = housingRangeMonths();
    const months = [];
    const [endYear, endMonth] = selectedAnalysisMonth().split("-").map(Number);
    const endDate = new Date(endYear, endMonth - 1, 1);

    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(endDate.getFullYear(), endDate.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return months;
  }

  function isSettlement(row) {
    return String(row.booking_type || "expense").toLowerCase() === "settlement";
  }

  function isExpenseBooking(row) {
    return !isSettlement(row);
  }

  function visibleCategories(module) {
    const user = currentUserName();

    return (state.data.categories || [])
      .filter((row) => String(row.module || "") === module)
      .filter((row) => {
        if (String(row.is_deleted || "").toLowerCase() === "ja") return false;
        if (module === "Urlaub") return true;
        if (normalizePersonName(row.owner_user || "") === user) return true;
        return String(row.visible_to_other || "").toLowerCase() === "ja";
      });
  }

  function allVisibleMainCategories() {
    const set = new Set();
    visibleCategories("Haushalt").forEach((r) => set.add(r.main_category));
    visibleCategories("Urlaub").forEach((r) => set.add(r.main_category));
    return [...set].sort();
  }

  function fillCategoryFilter() {
    if (!els.filterMainCategory) return;

    const categories = allVisibleMainCategories();
    const current = els.filterMainCategory.value;

    els.filterMainCategory.innerHTML =
      '<option value="">Alle Hauptkategorien</option>' +
      categories.map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join("");

    if (categories.includes(current)) els.filterMainCategory.value = current;
  }

  function isVisibleTransaction(row) {
    if (!row) return false;
    if (String(row.is_deleted || "").toLowerCase() === "ja") return false;

    const user = currentUserName();
    const owner = normalizePersonName(row.owner_user || "");
    const counterparty = row.counterparty === "-" ? "-" : normalizePersonName(row.counterparty || "");

    if (owner === user) return true;
    if (isSettlement(row) && counterparty === user) return true;

    const splitEnabled = String(row.split_enabled || "nein").toLowerCase() === "ja";
    if (!splitEnabled) return false;

    const mainCategory = String(row.main_category || "");
    if (mainCategory === "Wohnen" || mainCategory === "Alltag") return true;

    return String(row.visible_to_other || "").toLowerCase() === "ja";
  }

  function isVisibleTrip(row) {
    if (!row) return false;
    return String(row.is_deleted || "").toLowerCase() !== "ja";
  }

  function isVisibleIncome(row) {
    if (!row) return false;
    if (String(row.is_deleted || "").toLowerCase() === "ja") return false;
    return normalizePersonName(row.owner_user || "") === currentUserName();
  }

  function isVisibleFixedCost(row) {
    if (!row) return false;
    if (String(row.is_deleted || "").toLowerCase() === "ja") return false;

    const user = currentUserName();
    if (normalizePersonName(row.owner_user || "") === user) return true;

    const splitEnabled = String(row.split_enabled || "nein").toLowerCase() === "ja";
    if (!splitEnabled) return false;

    return String(row.visible_to_other || "").toLowerCase() === "ja";
  }

  function getUserShareFromAmount(row, baseAmount) {
    if (isSettlement(row)) return 0;

    const amount = Number(baseAmount || 0);
    const splitEnabled = String(row.split_enabled || "nein").toLowerCase() === "ja";
    const splitPercent = Number(row.split_percent || 100);
    const owner = normalizePersonName(row.owner_user || "");
    const me = currentUserName();

    if (!splitEnabled) {
      return owner === me ? amount : 0;
    }

    const ownerShare = amount * (splitPercent / 100);
    const otherShare = amount - ownerShare;
    return owner === me ? ownerShare : otherShare;
  }

  function getCurrentUserAmount(row) {
    return getUserShareFromAmount(row, row.amount);
  }

  function filteredTransactionsForMonth(month) {
    return (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .filter(isExpenseBooking)
      .filter((row) => monthFromDate(row.month_key || row.date) === month);
  }

  function filteredTransactions() {
    return filteredTransactionsForMonth(selectedAnalysisMonth());
  }

  function filteredTripExpensesForMonth(month) {
    return (state.data.tripExpenses || [])
      .filter(isVisibleTrip)
      .filter((row) => monthFromDate(row.month_key || row.date) === month);
  }

  function filteredTripExpenses() {
    return filteredTripExpensesForMonth(selectedAnalysisMonth());
  }

  function monthlyIncome(month) {
    return (state.data.income || [])
      .filter(isVisibleIncome)
      .filter((row) => monthFromDate(row.month_key || row.date) === month)
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);
  }

  function normalizeFrequency(amount, frequency) {
    const value = Number(amount || 0);
    if (frequency === "jährlich") return value / 12;
    if (frequency === "quartalsweise") return value / 3;
    return value;
  }

  function activeFixedCostsForMonth(month) {
    return (state.data.fixedCosts || [])
      .filter(isVisibleFixedCost)
      .filter((row) => {
        const startMonth = monthFromDate(row.start_month || "");
        const endMonth = monthFromDate(row.end_month || "");
        if (startMonth && month < startMonth) return false;
        if (endMonth && month > endMonth) return false;
        return true;
      });
  }

  function fixedCostsMonthlyTotal(month) {
    return activeFixedCostsForMonth(month).reduce(
      (sum, row) => sum + getUserShareFromAmount(row, normalizeFrequency(row.amount, row.frequency)),
      0
    );
  }

  function calculateSettlementEffect(row) {
    if (!isSettlement(row)) return 0;

    const me = currentUserName();
    const amount = Number(row.amount || 0);
    const paidBy = normalizePersonName(row.paid_by || "");

    if (paidBy === me) return amount;
    return -amount;
  }

  function calculatePeerBalanceForMonth(month) {
    const me = currentUserName();
    let balance = 0;

    const txRows = (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .filter((row) => monthFromDate(row.month_key || row.date) === month);

    const tripRows = (state.data.tripExpenses || [])
      .filter(isVisibleTrip)
      .filter((row) => monthFromDate(row.month_key || row.date) === month);

    txRows.forEach((row) => {
      if (isSettlement(row)) {
        balance += calculateSettlementEffect(row);
        return;
      }

      const amount = Number(row.amount || 0);
      const splitEnabled = String(row.split_enabled || "nein").toLowerCase() === "ja";
      const splitPercent = Number(row.split_percent || 100);
      const owner = normalizePersonName(row.owner_user || "");
      const paidBy = normalizePersonName(row.paid_by || "");

      if (!splitEnabled) return;

      const ownerShare = amount * (splitPercent / 100);
      const otherShare = amount - ownerShare;

      if (owner === me) {
        if (paidBy === me) balance += otherShare;
        else balance -= ownerShare;
      } else {
        if (paidBy === me) balance += ownerShare;
        else balance -= otherShare;
      }
    });

    tripRows.forEach((row) => {
      const amount = Number(row.amount || 0);
      const splitEnabled = String(row.split_enabled || "nein").toLowerCase() === "ja";
      const splitPercent = Number(row.split_percent || 100);
      const owner = normalizePersonName(row.owner_user || "");
      const paidBy = normalizePersonName(row.paid_by || "");

      if (!splitEnabled) return;

      const ownerShare = amount * (splitPercent / 100);
      const otherShare = amount - ownerShare;

      if (owner === me) {
        if (paidBy === me) balance += otherShare;
        else balance -= ownerShare;
      } else {
        if (paidBy === me) balance += ownerShare;
        else balance -= otherShare;
      }
    });

    return balance;
  }

  function calculateOpenPeerBalanceUntil(month) {
    const months = analysisRangeMonths().filter((m) => m <= month);
    return months.reduce((sum, m) => sum + calculatePeerBalanceForMonth(m), 0);
  }

  function aggregateCategories(rows) {
    const map = new Map();
    rows.forEach((row) => {
      const key = row.main_category || "Ohne Kategorie";
      const value = getCurrentUserAmount(row);
      map.set(key, (map.get(key) || 0) + value);
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function aggregateSubcategories(rows, selectedMainCategory) {
    const map = new Map();
    rows
      .filter((row) => !selectedMainCategory || row.main_category === selectedMainCategory)
      .forEach((row) => {
        const key = row.sub_category || "Ohne Unterkategorie";
        const value = getCurrentUserAmount(row);
        map.set(key, (map.get(key) || 0) + value);
      });
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }

  function populateCategorySelects(module, mainEl, subEl, selectedMain = "", selectedSub = "") {
    if (!mainEl || !subEl) return;

    const rows = visibleCategories(module);
    const mains = [...new Set(rows.map((row) => row.main_category))];

    if (!selectedMain || !mains.includes(selectedMain)) {
      selectedMain = mains[0] || "";
    }

    mainEl.innerHTML = mains
      .map((main) => `<option ${main === selectedMain ? "selected" : ""}>${escapeHtml(main)}</option>`)
      .join("");

    const subs = rows
      .filter((row) => row.main_category === selectedMain)
      .map((row) => row.sub_category);

    if (!selectedSub || !subs.includes(selectedSub)) {
      selectedSub = subs[0] || "";
    }

    subEl.innerHTML = subs
      .map((sub) => `<option ${sub === selectedSub ? "selected" : ""}>${escapeHtml(sub)}</option>`)
      .join("");
  }

  function wireCategorySelects() {
    populateCategorySelects("Haushalt", els.bookingMainCategory, els.bookingSubCategory);
    populateCategorySelects("Urlaub", els.tripMainCategory, els.tripSubCategory);
    populateCategorySelects("Haushalt", els.fixedMainCategory, els.fixedSubCategory);

    els.bookingMainCategory?.addEventListener("change", () => {
      populateCategorySelects("Haushalt", els.bookingMainCategory, els.bookingSubCategory, els.bookingMainCategory.value);
    });

    els.tripMainCategory?.addEventListener("change", () => {
      populateCategorySelects("Urlaub", els.tripMainCategory, els.tripSubCategory, els.tripMainCategory.value);
    });

    els.fixedMainCategory?.addEventListener("change", () => {
      populateCategorySelects("Haushalt", els.fixedMainCategory, els.fixedSubCategory, els.fixedMainCategory.value);
    });
  }

  function populateTripSelect() {
    if (!els.tripExpenseTripId) return;

    const rows = (state.data.trips || []).filter(isVisibleTrip);
    els.tripExpenseTripId.innerHTML = rows
      .map((row) => `<option value="${escapeHtml(row.trip_id)}">${escapeHtml(row.title)} – ${escapeHtml(row.destination)}</option>`)
      .join("");
  }

  function populateVacationAnalysisSelect() {
    if (!els.vacationAnalysisSelect) return;

    const current = els.vacationAnalysisSelect.value;
    const trips = (state.data.trips || [])
      .filter(isVisibleTrip)
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));

    els.vacationAnalysisSelect.innerHTML =
      '<option value="year">Alle Urlaube aktuelles Jahr</option>' +
      trips.map((row) => `<option value="${escapeHtml(row.trip_id)}">${escapeHtml(row.title)} – ${escapeHtml(row.destination)}</option>`).join("");

    if ([ "year", ...trips.map((t) => t.trip_id) ].includes(current)) {
      els.vacationAnalysisSelect.value = current;
    }
  }

  function getTransactionsForTable() {
    return (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 10);
  }

  function getTripsForTable() {
    return (state.data.trips || [])
      .filter(isVisibleTrip)
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")));
  }

  function getTripExpensesForTable() {
    const months = new Set(monthRange());

    return (state.data.tripExpenses || [])
      .filter(isVisibleTrip)
      .filter((row) => months.has(monthFromDate(row.month_key || row.date)))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
  }

  function getIncomeForTable() {
    return (state.data.income || [])
      .filter(isVisibleIncome)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))
      .slice(0, 10);
  }

  function getAllVisibleCategoriesForTable() {
    return visibleCategories("Haushalt")
      .concat(visibleCategories("Urlaub"))
      .sort((a, b) => {
        const ka = `${a.module} ${a.main_category} ${a.sub_category}`;
        const kb = `${b.module} ${b.main_category} ${b.sub_category}`;
        return ka.localeCompare(kb);
      });
  }

  function getAllVisibleFixedCostsForTable() {
    return (state.data.fixedCosts || [])
      .filter(isVisibleFixedCost)
      .sort((a, b) => String(a.title || "").localeCompare(String(b.title || "")));
  }

  function actionButtons(type, record) {
    const backendId = type === "trip" ? record.trip_id : record.id;
    return `
      <div class="table-actions">
        <button type="button" class="btn btn-ghost btn-xs js-edit" data-type="${escapeHtml(type)}" data-key="${escapeHtml(record._clientKey)}">Bearbeiten</button>
        <button type="button" class="btn btn-ghost btn-xs js-delete" data-type="${escapeHtml(type)}" data-id="${escapeHtml(backendId)}">Löschen</button>
      </div>
    `;
  }

  function renderKpis(month, txRows, tripRows) {
    const income = monthlyIncome(month);
    const txTotal = txRows.reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
    const tripTotal = tripRows.reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
    const fixedCosts = fixedCostsMonthlyTotal(month);
    const totalExpenses = txTotal + tripTotal + fixedCosts;
    const variableCosts = txTotal + tripTotal;
    const available = income - totalExpenses;
    const savingsRate = income ? (available / income) * 100 : 0;
    const fixedRate = income ? (fixedCosts / income) * 100 : 0;
    const expenseRate = income ? (totalExpenses / income) * 100 : 0;
    const variableRate = income ? (variableCosts / income) * 100 : 0;

    const peerBalanceMonth = calculatePeerBalanceForMonth(month);
    const peerBalanceOpen = calculateOpenPeerBalanceUntil(month);
    const categoryAggregate = aggregateCategories(txRows.concat(tripRows));
    const percentMode = isPercentMode();

    if (els.heroAvailable) {
      els.heroAvailable.textContent = percentMode ? percent(toPercent(available, income)) : currency(available);
    }
    if (els.heroAvailableSub) {
      els.heroAvailableSub.textContent = available >= 0 ? "Positiver Monatsüberschuss" : "Monat aktuell negativ";
    }
    if (els.heroFixedCosts) {
      els.heroFixedCosts.textContent = percentMode ? percent(fixedRate) : currency(fixedCosts);
    }
    if (els.heroFixedCostsSub) {
      els.heroFixedCostsSub.textContent =
        percentMode ? "Fixkostenquote bezogen auf Einkommen" : "Monatliche Fixkostenbelastung";
    }

    if (els.heroPeerBalance) els.heroPeerBalance.textContent = currency(peerBalanceOpen);
    if (els.heroPeerLabel) els.heroPeerLabel.textContent = `Offener Saldo ${otherUserName()}`;

    if (els.kpiGrid) {
      const items = percentMode
        ? [
            ["Einnahmen", currency(income), "Monatliche Einnahmen"],
            ["Ausgaben gesamt", percent(expenseRate), "Ohne Ausgleichsbuchungen"],
            ["Fixkosten", percent(fixedRate), "Fixkostenquote"],
            ["Variable Kosten", percent(variableRate), "Haushalt + Urlaub"],
            ["Sparquote", percent(savingsRate), "Einnahmen minus Ausgaben"]
          ]
        : [
            ["Einnahmen", currency(income), "Monatliche Einnahmen"],
            ["Ausgaben gesamt", currency(totalExpenses), "Ohne Ausgleichsbuchungen"],
            ["Fixkosten", currency(fixedCosts), "Monatliche Fixkosten"],
            ["Variable Kosten", currency(variableCosts), "Haushalt + Urlaub"],
            ["Sparquote", percent(savingsRate), "Einnahmen minus Ausgaben"]
          ];

      els.kpiGrid.innerHTML = items.map(([label, value, sub]) => `
        <div class="kpi-card">
          <div class="kpi-label">${escapeHtml(label)}</div>
          <div class="kpi-value">${escapeHtml(value)}</div>
          <div class="kpi-sub">${escapeHtml(sub)}</div>
        </div>
      `).join("");
    }

    if (els.monthlySummary) {
      els.monthlySummary.innerHTML = [
        ["Analysemonat", month],
        ["Haushaltsausgaben", currency(txTotal)],
        ["Urlaubsausgaben", currency(tripTotal)],
        ["Fixkosten", currency(fixedCosts)],
        ["Variable Kosten", currency(variableCosts)],
        ["Ausgaben gesamt", currency(totalExpenses)],
        ["Überschuss", currency(available)]
      ].map(([k, v]) => `
        <div class="summary-row">
          <div class="key">${escapeHtml(k)}</div>
          <div class="val">${escapeHtml(v)}</div>
        </div>
      `).join("");
    }

    if (els.insightList) {
      els.insightList.innerHTML = [
        ["Saldo Monat", currency(peerBalanceMonth)],
        ["Offener Gesamtsaldo", currency(peerBalanceOpen)],
        ["Fixkosten aktiv", `${activeFixedCostsForMonth(month).length} Positionen`],
        ["Haushaltstransaktionen", `${txRows.length}`],
        ["Urlaubstransaktionen", `${tripRows.length}`]
      ].map(([k, v]) => `
        <div class="summary-row">
          <div class="key">${escapeHtml(k)}</div>
          <div class="val">${escapeHtml(v)}</div>
        </div>
      `).join("");
    }

    return {
      income,
      txTotal,
      tripTotal,
      fixedCosts,
      totalExpenses,
      variableCosts,
      available,
      categoryAggregate,
      peerBalanceMonth,
      peerBalanceOpen
    };
  }

  function chartOptions(stacked = false) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: "#d8e4ff" } }
      },
      scales: {
        x: {
          stacked,
          ticks: { color: "#aec1e6" },
          grid: { color: "rgba(255,255,255,.05)" }
        },
        y: {
          stacked,
          ticks: { color: "#aec1e6" },
          grid: { color: "rgba(255,255,255,.05)" }
        }
      }
    };
  }

  function createSelectedMonthHighlightPlugin(selectedMonth) {
    return {
      id: "selectedMonthHighlight",
      beforeDatasetsDraw(chart) {
        if (!selectedMonth) return;

        const { ctx, chartArea, scales } = chart;
        if (!chartArea || !scales?.x) return;

        const labels = chart.data.labels || [];
        const index = labels.indexOf(selectedMonth);
        if (index === -1) return;

        const xScale = scales.x;
        const centerX = xScale.getPixelForValue(index);

        let leftX = chartArea.left;
        let rightX = chartArea.right;

        if (labels.length === 1) {
          leftX = chartArea.left;
          rightX = chartArea.right;
        } else {
          const prevX = index > 0 ? xScale.getPixelForValue(index - 1) : null;
          const nextX = index < labels.length - 1 ? xScale.getPixelForValue(index + 1) : null;

          if (prevX != null && nextX != null) {
            leftX = (prevX + centerX) / 2;
            rightX = (centerX + nextX) / 2;
          } else if (prevX != null) {
            const half = (centerX - prevX) / 2;
            leftX = centerX - half;
            rightX = centerX + half;
          } else if (nextX != null) {
            const half = (nextX - centerX) / 2;
            leftX = centerX - half;
            rightX = centerX + half;
          }
        }

        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(leftX, chartArea.top, rightX - leftX, chartArea.bottom - chartArea.top);
        ctx.restore();
      }
    };
  }

  function ensureChart(name, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;
    if (state.charts[name]) state.charts[name].destroy();
    state.charts[name] = new Chart(canvas, config);
  }

  function renderCharts(month, txRows, tripRows, metrics) {
    const months = monthRange();
    const percentMode = isPercentMode();

    const incomeSeries = months.map((m) => monthlyIncome(m));

    const variableSeriesRaw = months.map((m) => {
      const tx = filteredTransactionsForMonth(m).reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
      const trip = filteredTripExpensesForMonth(m).reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
      return tx + trip;
    });

    const fixedSeriesRaw = months.map((m) => fixedCostsMonthlyTotal(m));
    const totalExpenseSeriesRaw = variableSeriesRaw.map((val, i) => val + fixedSeriesRaw[i]);

    const fixedSeries = percentMode ? fixedSeriesRaw.map((v, i) => toPercent(v, incomeSeries[i])) : fixedSeriesRaw;
    const variableSeries = percentMode ? variableSeriesRaw.map((v, i) => toPercent(v, incomeSeries[i])) : variableSeriesRaw;
    const totalExpenseSeries = percentMode ? totalExpenseSeriesRaw.map((v, i) => toPercent(v, incomeSeries[i])) : totalExpenseSeriesRaw;

    const datasets = percentMode
      ? [
          { label: "Totale Kosten", data: totalExpenseSeries, borderColor: "#4f7cff", backgroundColor: "rgba(79,124,255,.15)", fill: false, tension: 0.25 },
          { label: "Fixkosten", data: fixedSeries, borderColor: "#ffbe3d", backgroundColor: "rgba(255,190,61,.15)", fill: false, tension: 0.25 },
          { label: "Variable Kosten", data: variableSeries, borderColor: "#ff6d7a", backgroundColor: "rgba(255,109,122,.15)", fill: false, tension: 0.25 }
        ]
      : [
          { label: "Einnahmen", data: incomeSeries, borderColor: "#13c296", backgroundColor: "rgba(19,194,150,.15)", fill: false, tension: 0.25 },
          { label: "Totale Kosten", data: totalExpenseSeries, borderColor: "#4f7cff", backgroundColor: "rgba(79,124,255,.15)", fill: false, tension: 0.25 },
          { label: "Fixkosten", data: fixedSeries, borderColor: "#ffbe3d", backgroundColor: "rgba(255,190,61,.15)", fill: false, tension: 0.25 },
          { label: "Variable Kosten", data: variableSeries, borderColor: "#ff6d7a", backgroundColor: "rgba(255,109,122,.15)", fill: false, tension: 0.25 }
        ];

    ensureChart("masterChart", "masterChart", {
      type: "line",
      data: { labels: months, datasets },
      options: chartOptions(),
      plugins: [createSelectedMonthHighlightPlugin(selectedAnalysisMonth())]
    });

    const fixedMonthRows = activeFixedCostsForMonth(month);
    const fixedAgg = new Map();
    fixedMonthRows.forEach((row) => {
      const key = row.main_category || "Ohne Kategorie";
      const share = getUserShareFromAmount(row, normalizeFrequency(row.amount, row.frequency));
      fixedAgg.set(key, (fixedAgg.get(key) || 0) + share);
    });

    if (els.fixedCompositionLabel) els.fixedCompositionLabel.textContent = "Analysemonat";

    ensureChart("fixedCompositionChart", "fixedCompositionChart", {
      type: "bar",
      data: {
        labels: [...fixedAgg.keys()],
        datasets: [{
          label: percentMode ? "Fixkosten %" : "Fixkosten",
          data: [...fixedAgg.values()].map((v) => percentMode ? toPercent(v, metrics.income) : v),
          backgroundColor: "rgba(255,190,61,.82)"
        }]
      },
      options: chartOptions()
    });

    const variableRows = txRows.concat(tripRows);
    const variableAgg = new Map();
    variableRows.forEach((row) => {
      const key = row.main_category || "Ohne Kategorie";
      variableAgg.set(key, (variableAgg.get(key) || 0) + getCurrentUserAmount(row));
    });

    if (els.variableCompositionLabel) els.variableCompositionLabel.textContent = "Analysemonat";

    ensureChart("variableCompositionChart", "variableCompositionChart", {
      type: "bar",
      data: {
        labels: [...variableAgg.keys()],
        datasets: [{
          label: percentMode ? "Variable Kosten %" : "Variable Kosten",
          data: [...variableAgg.values()].map((v) => percentMode ? toPercent(v, metrics.income) : v),
          backgroundColor: "rgba(79,124,255,.82)"
        }]
      },
      options: chartOptions()
    });

    const selectedMainCategory = els.filterMainCategory?.value || "";
    const breakdownAggregate = selectedMainCategory
      ? aggregateSubcategories(txRows.concat(tripRows), selectedMainCategory)
      : aggregateCategories(txRows.concat(tripRows));

    ensureChart("categoryBreakdownChart", "categoryBreakdownChart", {
      type: "bar",
      data: {
        labels: breakdownAggregate.map((row) => row[0]),
        datasets: [{
          label: selectedMainCategory
            ? `Unterkategorien ${selectedMainCategory}${percentMode ? " %" : ""}`
            : `Hauptkategorien${percentMode ? " %" : ""}`,
          data: breakdownAggregate.map((row) => percentMode ? toPercent(row[1], metrics.income) : row[1]),
          backgroundColor: "rgba(97,201,255,.82)"
        }]
      },
      options: chartOptions()
    });
  }

  function renderCategoryTable(rows) {
    if (!els.categoryTableBody) return;

    const aggregate = aggregateCategories(rows);
    const total = aggregate.reduce((sum, row) => sum + row[1], 0) || 1;

    els.categoryTableBody.innerHTML = aggregate.length
      ? aggregate.map(([name, amount]) => `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(currency(amount))}</td>
            <td>${escapeHtml(percent((amount / total) * 100))}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="3" class="table-empty">Keine Daten vorhanden</td></tr>';
  }

  function renderMonthOverviewTable(metrics) {
    if (!els.monthOverviewTableBody) return;

    const percentMode = isPercentMode();
    const income = metrics.income || 0;

    const rows = [
      ["Einnahmen", percentMode ? "100,0 %" : currency(metrics.income)],
      ["Haushalt", percentMode ? percent(toPercent(metrics.txTotal, income)) : currency(metrics.txTotal)],
      ["Urlaub", percentMode ? percent(toPercent(metrics.tripTotal, income)) : currency(metrics.tripTotal)],
      ["Fixkosten", percentMode ? percent(toPercent(metrics.fixedCosts, income)) : currency(metrics.fixedCosts)],
      ["Variable Kosten", percentMode ? percent(toPercent(metrics.variableCosts, income)) : currency(metrics.variableCosts)],
      ["Gesamtausgaben", percentMode ? percent(toPercent(metrics.totalExpenses, income)) : currency(metrics.totalExpenses)],
      ["Überschuss", percentMode ? percent(toPercent(metrics.available, income)) : currency(metrics.available)],
      ["Saldo Monat", currency(metrics.peerBalanceMonth)],
      ["Offener Gesamtsaldo", currency(metrics.peerBalanceOpen)]
    ];

    els.monthOverviewTableBody.innerHTML = rows.map(([label, value]) => `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(value)}</td>
      </tr>
    `).join("");
  }

  function renderRangeOverviewTable() {
    if (!els.rangeOverviewTableBody) return;

    const months = analysisRangeMonths();
    const income = months.reduce((sum, m) => sum + monthlyIncome(m), 0);
    const txTotal = months.reduce((sum, m) => sum + filteredTransactionsForMonth(m).reduce((s, row) => s + getCurrentUserAmount(row), 0), 0);
    const tripTotal = months.reduce((sum, m) => sum + filteredTripExpensesForMonth(m).reduce((s, row) => s + getCurrentUserAmount(row), 0), 0);
    const fixedCosts = months.reduce((sum, m) => sum + fixedCostsMonthlyTotal(m), 0);
    const variableCosts = txTotal + tripTotal;
    const totalExpenses = variableCosts + fixedCosts;
    const available = income - totalExpenses;
    const percentMode = isPercentMode();
    const openBalance = calculateOpenPeerBalanceUntil(selectedAnalysisMonth());

    const rows = [
      ["Einnahmen", percentMode ? "100,0 %" : currency(income)],
      ["Haushalt", percentMode ? percent(toPercent(txTotal, income)) : currency(txTotal)],
      ["Urlaub", percentMode ? percent(toPercent(tripTotal, income)) : currency(tripTotal)],
      ["Fixkosten", percentMode ? percent(toPercent(fixedCosts, income)) : currency(fixedCosts)],
      ["Variable Kosten", percentMode ? percent(toPercent(variableCosts, income)) : currency(variableCosts)],
      ["Gesamtausgaben", percentMode ? percent(toPercent(totalExpenses, income)) : currency(totalExpenses)],
      ["Überschuss", percentMode ? percent(toPercent(available, income)) : currency(available)],
      ["Offener Gesamtsaldo", currency(openBalance)]
    ];

    els.rangeOverviewTableBody.innerHTML = rows.map(([label, value]) => `
      <tr>
        <td>${escapeHtml(label)}</td>
        <td>${escapeHtml(value)}</td>
      </tr>
    `).join("");
  }

  function renderCategoryCompareTable(month, txRows, tripRows) {
    if (!els.categoryCompareTableBody) return;

    const monthAgg = new Map();
    aggregateCategories(txRows.concat(tripRows)).forEach(([key, value]) => monthAgg.set(key, value));

    const rangeAgg = new Map();
    analysisRangeMonths().forEach((m) => {
      const rows = filteredTransactionsForMonth(m).concat(filteredTripExpensesForMonth(m));
      aggregateCategories(rows).forEach(([key, value]) => {
        rangeAgg.set(key, (rangeAgg.get(key) || 0) + value);
      });
    });

    const keys = [...new Set([...monthAgg.keys(), ...rangeAgg.keys()])].sort();
    const percentMode = isPercentMode();
    const monthIncome = monthlyIncome(month);
    const rangeIncome = analysisRangeMonths().reduce((sum, m) => sum + monthlyIncome(m), 0);

    els.categoryCompareTableBody.innerHTML = keys.length
      ? keys.map((key) => `
          <tr>
            <td>${escapeHtml(key)}</td>
            <td>${escapeHtml(percentMode ? percent(toPercent(monthAgg.get(key) || 0, monthIncome)) : currency(monthAgg.get(key) || 0))}</td>
            <td>${escapeHtml(percentMode ? percent(toPercent(rangeAgg.get(key) || 0, rangeIncome)) : currency(rangeAgg.get(key) || 0))}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="3" class="table-empty">Keine Daten vorhanden</td></tr>';
  }

  function getVisibleVacationExpenses() {
    return (state.data.tripExpenses || []).filter(isVisibleTrip);
  }

  function getTripById(tripId) {
    return (state.data.trips || []).find((row) => row.trip_id === tripId) || null;
  }

  function getVacationCategoryBucket(row) {
    const sub = String(row.sub_category || "").trim().toLowerCase();
    const main = String(row.main_category || "").trim().toLowerCase();

    if (sub.includes("transport")) return "Transport";
    if (sub.includes("unterkunft")) return "Unterkunft";
    if (sub.includes("essen")) return "Essen";
    if (sub.includes("aktiv")) return "Aktivitäten";

    if (main.includes("transport")) return "Transport";
    if (main.includes("unterkunft")) return "Unterkunft";
    if (main.includes("essen")) return "Essen";
    if (main.includes("aktiv")) return "Aktivitäten";

    return "Sonstiges";
  }

  function computeVacationOverviewData() {
    const analysisYear = selectedAnalysisMonth().slice(0, 4);
    const selectedTripId = els.vacationAnalysisSelect?.value || "year";
    const allExpenses = getVisibleVacationExpenses();
    const allTrips = (state.data.trips || []).filter(isVisibleTrip);

    let relevantExpenses = [];
    let relevantTrips = [];

    if (selectedTripId === "year") {
      relevantExpenses = allExpenses.filter((row) => normalizeDateOnly(row.date).slice(0, 4) === analysisYear);
      const tripIdSet = new Set(relevantExpenses.map((row) => row.trip_id));
      relevantTrips = allTrips.filter((trip) => tripIdSet.has(trip.trip_id));
    } else {
      relevantExpenses = allExpenses.filter((row) => row.trip_id === selectedTripId);
      const trip = getTripById(selectedTripId);
      relevantTrips = trip ? [trip] : [];
    }

    const categories = {
      Transport: 0,
      Unterkunft: 0,
      Essen: 0,
      Aktivitäten: 0
    };

    relevantExpenses.forEach((row) => {
      const bucket = getVacationCategoryBucket(row);
      if (categories[bucket] != null) {
        categories[bucket] += getCurrentUserAmount(row);
      }
    });

    const totalCost = Object.values(categories).reduce((sum, value) => sum + value, 0);

    const totalDays = relevantTrips.reduce((sum, trip) => sum + Number(trip.days || 0), 0);
    const costPerDay = totalDays > 0 ? totalCost / totalDays : 0;

    return {
      selectedTripId,
      relevantTrips,
      categories,
      totalCost,
      totalDays,
      costPerDay
    };
  }

  function computeVacationLast5TripsData() {
    const trips = (state.data.trips || [])
      .filter(isVisibleTrip)
      .sort((a, b) => String(b.start_date || "").localeCompare(String(a.start_date || "")))
      .slice(0, 5);

    const expenses = getVisibleVacationExpenses();

    const labels = [];
    const transport = [];
    const unterkunft = [];
    const essen = [];
    const aktivitaeten = [];

    trips.forEach((trip) => {
      labels.push(trip.title || trip.destination || trip.trip_id);

      const cat = {
        Transport: 0,
        Unterkunft: 0,
        Essen: 0,
        Aktivitäten: 0
      };

      expenses
        .filter((row) => row.trip_id === trip.trip_id)
        .forEach((row) => {
          const bucket = getVacationCategoryBucket(row);
          if (cat[bucket] != null) cat[bucket] += getCurrentUserAmount(row);
        });

      transport.push(cat.Transport);
      unterkunft.push(cat.Unterkunft);
      essen.push(cat.Essen);
      aktivitaeten.push(cat.Aktivitäten);
    });

    return { labels, transport, unterkunft, essen, aktivitaeten };
  }

  function renderVacationOverview() {
    const data = computeVacationOverviewData();

    if (els.vacationTotalCost) {
      els.vacationTotalCost.textContent = currency(data.totalCost);
    }
    if (els.vacationCostPerDay) {
      els.vacationCostPerDay.textContent = currency(data.costPerDay);
    }
    if (els.vacationTripCount) {
      els.vacationTripCount.textContent = String(data.relevantTrips.length);
    }

    if (els.vacationKpiTableBody) {
      const total = data.totalCost || 1;
      const rows = Object.entries(data.categories).map(([name, value]) => `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(currency(value))}</td>
          <td>${escapeHtml(percent((value / total) * 100))}</td>
        </tr>
      `).join("");

      els.vacationKpiTableBody.innerHTML = rows || '<tr><td colspan="3" class="table-empty">Keine Daten vorhanden</td></tr>';
    }

    if (els.vacationDaysTableBody) {
      const label = data.selectedTripId === "year" ? "Urlaubstage im Jahr" : "Urlaubstage";
      els.vacationDaysTableBody.innerHTML = `
        <tr><td>${escapeHtml(label)}</td><td>${escapeHtml(String(data.totalDays || 0))}</td></tr>
        <tr><td>Relevante Urlaube</td><td>${escapeHtml(String(data.relevantTrips.length))}</td></tr>
        <tr><td>Kosten pro Urlaubstag</td><td>${escapeHtml(currency(data.costPerDay))}</td></tr>
      `;
    }

    const chartData = computeVacationLast5TripsData();

    ensureChart("vacationCompositionChart", "vacationCompositionChart", {
      type: "bar",
      data: {
        labels: chartData.labels,
        datasets: [
          { label: "Transport", data: chartData.transport, backgroundColor: "rgba(79,124,255,.82)" },
          { label: "Unterkunft", data: chartData.unterkunft, backgroundColor: "rgba(255,190,61,.82)" },
          { label: "Essen", data: chartData.essen, backgroundColor: "rgba(19,194,150,.82)" },
          { label: "Aktivitäten", data: chartData.aktivitaeten, backgroundColor: "rgba(255,109,122,.82)" }
        ]
      },
      options: chartOptions(true)
    });
  }

  function getHousingTransactionRowsForMonth(month) {
    return (state.data.transactions || [])
      .filter((row) => String(row.is_deleted || "").toLowerCase() !== "ja")
      .filter(isExpenseBooking)
      .filter((row) => String(row.main_category || "") === "Wohnen")
      .filter((row) => String(row.sub_category || "") !== "Kaution")
      .filter((row) => monthFromDate(row.month_key || row.date) === month);
  }

  function getHousingFixedRowsForMonth(month) {
    return (state.data.fixedCosts || [])
      .filter((row) => String(row.is_deleted || "").toLowerCase() !== "ja")
      .filter((row) => String(row.main_category || "") === "Wohnen")
      .filter((row) => String(row.sub_category || "") !== "Kaution")
      .filter((row) => {
        const startMonth = monthFromDate(row.start_month || "");
        const endMonth = monthFromDate(row.end_month || "");
        if (startMonth && month < startMonth) return false;
        if (endMonth && month > endMonth) return false;
        return true;
      });
  }

  function getCombinedHousingCategoryMapForMonth(month) {
    const map = new Map();

    getHousingTransactionRowsForMonth(month).forEach((row) => {
      const key = row.sub_category || "Ohne Unterkategorie";
      map.set(key, (map.get(key) || 0) + Number(row.amount || 0));
    });

    getHousingFixedRowsForMonth(month).forEach((row) => {
      const key = row.sub_category || "Ohne Unterkategorie";
      map.set(key, (map.get(key) || 0) + normalizeFrequency(row.amount, row.frequency));
    });

    return map;
  }

  function computeHousingOverviewData() {
    const analysisMonth = selectedAnalysisMonth();
    const months = housingMonthRange();

    const monthMap = getCombinedHousingCategoryMapForMonth(analysisMonth);
    const monthTotal = [...monthMap.values()].reduce((sum, value) => sum + value, 0);

    const totalByCategory = new Map();
    const totalPerMonth = [];

    months.forEach((month) => {
      const map = getCombinedHousingCategoryMapForMonth(month);
      const monthValue = [...map.values()].reduce((sum, value) => sum + value, 0);
      totalPerMonth.push(monthValue);

      map.forEach((value, key) => {
        totalByCategory.set(key, (totalByCategory.get(key) || 0) + value);
      });
    });

    const averageTotal = months.length ? totalPerMonth.reduce((sum, value) => sum + value, 0) / months.length : 0;

    const averageMap = new Map();
    totalByCategory.forEach((value, key) => {
      averageMap.set(key, months.length ? value / months.length : 0);
    });

    return {
      analysisMonth,
      months,
      monthMap,
      monthTotal,
      averageMap,
      averageTotal,
      categoryCount: new Set([...monthMap.keys(), ...averageMap.keys()]).size
    };
  }

  function renderHousingTable(tableBody, valueMap, totalValue, mode, valueLabel) {
    if (!tableBody) return;

    const entries = [...valueMap.entries()].sort((a, b) => b[1] - a[1]);

    tableBody.innerHTML = entries.length
      ? entries.map(([name, value]) => `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(mode === "percent" ? percent(totalValue ? (value / totalValue) * 100 : 0) : currency(value))}</td>
            <td>${escapeHtml(percent(totalValue ? (value / totalValue) * 100 : 0))}</td>
          </tr>
        `).join("")
      : `<tr><td colspan="3" class="table-empty">Keine ${escapeHtml(valueLabel)} vorhanden</td></tr>`;
  }

  function renderHousingOverview() {
    const data = computeHousingOverviewData();
    const mode = housingDisplayMode();

    if (els.housingMonthTotal) {
      els.housingMonthTotal.textContent = currency(data.monthTotal);
    }
    if (els.housingAverageTotal) {
      els.housingAverageTotal.textContent = currency(data.averageTotal);
    }
    if (els.housingCategoryCount) {
      els.housingCategoryCount.textContent = String(data.categoryCount || 0);
    }

    renderHousingTable(els.housingMonthTableBody, data.monthMap, data.monthTotal, mode, "Daten");
    renderHousingTable(els.housingAverageTableBody, data.averageMap, data.averageTotal, mode, "Daten");

    const categoryKeys = [...new Set(
      data.months.flatMap((month) => [...getCombinedHousingCategoryMapForMonth(month).keys()])
    )].sort();

    const datasets = categoryKeys.map((key, idx) => {
      const rawValues = data.months.map((month) => getCombinedHousingCategoryMapForMonth(month).get(key) || 0);
      const displayValues = mode === "percent"
        ? rawValues.map((value, i) => {
            const total = [...getCombinedHousingCategoryMapForMonth(data.months[i]).values()].reduce((sum, v) => sum + v, 0);
            return total ? (value / total) * 100 : 0;
          })
        : rawValues;

      return {
        label: key,
        data: displayValues,
        backgroundColor: [
          "rgba(79,124,255,.82)",
          "rgba(255,190,61,.82)",
          "rgba(19,194,150,.82)",
          "rgba(255,109,122,.82)",
          "rgba(97,201,255,.82)",
          "rgba(159,122,234,.82)",
          "rgba(249,115,22,.82)"
        ][idx % 7]
      };
    });

    ensureChart("housingTrendChart", "housingTrendChart", {
      type: "bar",
      data: {
        labels: data.months,
        datasets
      },
      options: chartOptions(true)
    });
  }

  function renderTransactionsTable() {
    if (!els.transactionsTableBody) return;
    const rows = getTransactionsForTable();

    els.transactionsTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(normalizeDateOnly(row.date))}</td>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(
              isSettlement(row)
                ? `Verrechnung / ${row.counterparty || PERSON_B}`
                : `${row.main_category} / ${row.sub_category}`
            )}</td>
            <td>${escapeHtml(isSettlement(row) ? currency(row.amount) : currency(getCurrentUserAmount(row)))}</td>
            <td>${escapeHtml(row.paid_by)}</td>
            <td>${actionButtons("transaction", row)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="6" class="table-empty">Noch keine Haushaltsbuchungen vorhanden</td></tr>';
  }

  function renderTripsTable() {
    if (!els.tripsTableBody) return;
    const rows = getTripsForTable();

    els.tripsTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(row.destination)}</td>
            <td>${escapeHtml(`${normalizeDateOnly(row.start_date)} – ${normalizeDateOnly(row.end_date)}`)}</td>
            <td>${escapeHtml(currency(row.planned_budget))}</td>
            <td>${actionButtons("trip", row)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="5" class="table-empty">Noch keine Reisen vorhanden</td></tr>';
  }

  function renderTripExpensesTable() {
    if (!els.tripExpensesTableBody) return;
    const tripMap = new Map((state.data.trips || []).map((row) => [row.trip_id, row.title]));
    const rows = getTripExpensesForTable();

    els.tripExpensesTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(tripMap.get(row.trip_id) || row.trip_id)}</td>
            <td>${escapeHtml(normalizeDateOnly(row.date))}</td>
            <td>${escapeHtml(`${row.main_category} / ${row.sub_category}`)}</td>
            <td>${escapeHtml(currency(getCurrentUserAmount(row)))}</td>
            <td>${actionButtons("tripExpense", row)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="5" class="table-empty">Noch keine Urlaubsausgaben vorhanden</td></tr>';
  }

  function renderCategoriesTable() {
    if (!els.categoriesTableBody) return;
    const rows = getAllVisibleCategoriesForTable();

    els.categoriesTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.module)}</td>
            <td>${escapeHtml(row.main_category)}</td>
            <td>${escapeHtml(row.sub_category)}</td>
            <td>${actionButtons("category", row)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4" class="table-empty">Noch keine Kategorien vorhanden</td></tr>';
  }

  function renderFixedCostsTable() {
    if (!els.fixedCostsTableBody) return;
    const rows = getAllVisibleFixedCostsForTable();

    els.fixedCostsTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(currency(getUserShareFromAmount(row, row.amount)))}</td>
            <td>${escapeHtml(row.frequency)}</td>
            <td>${actionButtons("fixedCost", row)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4" class="table-empty">Noch keine Fixkosten vorhanden</td></tr>';
  }

  function renderIncomeTable() {
    if (!els.incomeTableBody) return;
    const rows = getIncomeForTable();

    els.incomeTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(normalizeDateOnly(row.date))}</td>
            <td>${escapeHtml(row.income_type)}</td>
            <td>${escapeHtml(currency(row.amount))}</td>
            <td>${actionButtons("income", row)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4" class="table-empty">Noch keine Einnahmen vorhanden</td></tr>';
  }

  function renderDashboard() {
    const month = selectedAnalysisMonth();
    const txRows = filteredTransactions();
    const tripRows = filteredTripExpenses();
    const metrics = renderKpis(month, txRows, tripRows);

    renderCharts(month, txRows, tripRows, metrics);
    renderCategoryTable(txRows.concat(tripRows));
    renderMonthOverviewTable(metrics);
    renderRangeOverviewTable();
    renderCategoryCompareTable(month, txRows, tripRows);
  }

  function renderAll() {
    fillCategoryFilter();
    populateVacationAnalysisSelect();
    renderDashboard();
    renderHousingOverview();
    renderVacationOverview();
    renderTransactionsTable();
    renderTripsTable();
    renderTripExpensesTable();
    renderCategoriesTable();
    renderFixedCostsTable();
    renderIncomeTable();
    populateTripSelect();
    populateCategorySelects("Haushalt", els.bookingMainCategory, els.bookingSubCategory, els.bookingMainCategory?.value);
    populateCategorySelects("Urlaub", els.tripMainCategory, els.tripSubCategory, els.tripMainCategory?.value);
    populateCategorySelects("Haushalt", els.fixedMainCategory, els.fixedSubCategory, els.fixedMainCategory?.value);
    updateTransactionFormVisibility();
  }

  async function loadAll() {
    clearMessage();

    try {
      if (els.syncStatus) els.syncStatus.textContent = "Synchronisierung läuft...";

      const result = await apiGet("getAll");
      state.data = withClientKeys(result.data || {
        income: [],
        transactions: [],
        trips: [],
        tripExpenses: [],
        categories: [],
        fixedCosts: []
      });

      renderAll();

      if (els.syncStatus) {
        els.syncStatus.textContent = `Synchronisiert: ${new Date().toLocaleString("de-DE")}`;
      }

      showMessage("Daten erfolgreich geladen.", "success");
    } catch (error) {
      if (els.syncStatus) els.syncStatus.textContent = "Synchronisierung fehlgeschlagen";
      showMessage(error.message || "Fehler beim Laden.", "error");
      console.error(error);
    }
  }

  function formToObject(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const user = currentUser();
    const normalizedUser = currentUserName();

    delete data._clientKey;

    if (data.date && !data.month_key) data.month_key = data.date.slice(0, 7);

    if (data.booking_type === "settlement") {
      if (!data.counterparty || data.counterparty === "-") {
        data.counterparty = otherUserName();
      }
      data.counterparty = normalizePersonName(data.counterparty);
      data.split_enabled = "nein";
      data.split_percent = "100";
      data.main_category = "Verrechnung";
      data.sub_category = "Saldoausgleich";
    } else {
      data.counterparty = "-";
    }

    if (data.paid_by) data.paid_by = normalizePersonName(data.paid_by);

    if (user) {
      data.owner_user = normalizedUser;
      data.created_by = normalizePersonName(data.created_by || user.displayName || normalizedUser);
      data.updated_by = normalizedUser;
    }

    return data;
  }

  function setFormValues(form, record) {
    if (!form || !record) return;

    Object.entries(record).forEach(([key, value]) => {
      if (key === "_clientKey") return;

      const field = form.elements.namedItem(key);
      if (!field) return;
      if (field instanceof RadioNodeList) return;

      if (field.tagName === "INPUT" && field.type === "date") {
        field.value = normalizeDateOnly(value);
      } else if (field.tagName === "INPUT" && field.type === "month") {
        field.value = monthFromDate(value);
      } else {
        field.value = value ?? "";
      }
    });
  }

  function setFieldDisabled(field, disabled) {
    if (!field) return;
    field.disabled = disabled;
  }

  function closestLabel(field) {
    return field?.closest("label") || null;
  }

  function setLabelHidden(field, hidden) {
    const label = closestLabel(field);
    if (label) label.style.display = hidden ? "none" : "";
  }

  function updateTransactionFormVisibility() {
    const isSettlementType = (els.bookingType?.value || "expense") === "settlement";

    setLabelHidden(els.transactionCounterparty, !isSettlementType);
    setLabelHidden(els.bookingMainCategory, isSettlementType);
    setLabelHidden(els.bookingSubCategory, isSettlementType);
    setLabelHidden(els.transactionSplitEnabled, isSettlementType);
    setLabelHidden(els.transactionSplitPercent, isSettlementType);

    setFieldDisabled(els.bookingMainCategory, isSettlementType);
    setFieldDisabled(els.bookingSubCategory, isSettlementType);
    setFieldDisabled(els.transactionSplitEnabled, isSettlementType);
    setFieldDisabled(els.transactionSplitPercent, isSettlementType);

    if (isSettlementType) {
      if (els.transactionSplitEnabled) els.transactionSplitEnabled.value = "nein";
      if (els.transactionSplitPercent) els.transactionSplitPercent.value = "100";
      if (els.transactionCounterparty && (!els.transactionCounterparty.value || els.transactionCounterparty.value === "-")) {
        els.transactionCounterparty.value = otherUserName();
      }
    } else {
      if (els.transactionCounterparty) els.transactionCounterparty.value = "-";
    }
  }

  function resetFormUi(type) {
    if (type === "transaction") {
      editState.transaction = null;
      els.transactionForm?.reset();
      setDefaultMonth();

      const splitField = els.transactionForm?.elements.namedItem("split_percent");
      const splitEnabledField = els.transactionForm?.elements.namedItem("split_enabled");
      const bookingTypeField = els.transactionForm?.elements.namedItem("booking_type");
      const counterpartyField = els.transactionForm?.elements.namedItem("counterparty");

      if (splitField) splitField.value = "100";
      if (splitEnabledField) splitEnabledField.value = "nein";
      if (bookingTypeField) bookingTypeField.value = "expense";
      if (counterpartyField) counterpartyField.value = "-";

      if (els.bookingFormModeLabel) els.bookingFormModeLabel.textContent = "Neue Buchung";
      if (els.transactionSubmitBtn) els.transactionSubmitBtn.textContent = "Buchung speichern";
      if (els.transactionCancelEditBtn) els.transactionCancelEditBtn.style.display = "none";

      populateCategorySelects("Haushalt", els.bookingMainCategory, els.bookingSubCategory);
      updateTransactionFormVisibility();
      return;
    }

    if (type === "trip") {
      editState.trip = null;
      els.tripForm?.reset();
      if (els.tripFormModeLabel) els.tripFormModeLabel.textContent = "Neue Reise";
      if (els.tripSubmitBtn) els.tripSubmitBtn.textContent = "Reise speichern";
      if (els.tripCancelEditBtn) els.tripCancelEditBtn.style.display = "none";
      return;
    }

    if (type === "tripExpense") {
      editState.tripExpense = null;
      els.tripExpenseForm?.reset();
      setDefaultMonth();

      const splitField = els.tripExpenseForm?.elements.namedItem("split_percent");
      const splitEnabledField = els.tripExpenseForm?.elements.namedItem("split_enabled");
      if (splitField) splitField.value = "100";
      if (splitEnabledField) splitEnabledField.value = "nein";

      if (els.tripExpenseFormModeLabel) els.tripExpenseFormModeLabel.textContent = "Neue Urlaubsausgabe";
      if (els.tripExpenseSubmitBtn) els.tripExpenseSubmitBtn.textContent = "Urlaubsausgabe speichern";
      if (els.tripExpenseCancelEditBtn) els.tripExpenseCancelEditBtn.style.display = "none";
      populateTripSelect();
      populateCategorySelects("Urlaub", els.tripMainCategory, els.tripSubCategory);
      return;
    }

    if (type === "category") {
      editState.category = null;
      els.categoryForm?.reset();
      if (els.categoryFormModeLabel) els.categoryFormModeLabel.textContent = "Neue Kategorie";
      if (els.categorySubmitBtn) els.categorySubmitBtn.textContent = "Kategorie speichern";
      if (els.categoryCancelEditBtn) els.categoryCancelEditBtn.style.display = "none";
      return;
    }

    if (type === "fixedCost") {
      editState.fixedCost = null;
      els.fixedCostForm?.reset();

      const splitField = els.fixedCostForm?.elements.namedItem("split_percent");
      const splitEnabledField = els.fixedCostForm?.elements.namedItem("split_enabled");
      if (splitField) splitField.value = "100";
      if (splitEnabledField) splitEnabledField.value = "nein";

      if (els.fixedCostFormModeLabel) els.fixedCostFormModeLabel.textContent = "Neue Fixkostenposition";
      if (els.fixedCostSubmitBtn) els.fixedCostSubmitBtn.textContent = "Fixkosten speichern";
      if (els.fixedCostCancelEditBtn) els.fixedCostCancelEditBtn.style.display = "none";
      populateCategorySelects("Haushalt", els.fixedMainCategory, els.fixedSubCategory);
      return;
    }

    if (type === "income") {
      editState.income = null;
      els.incomeForm?.reset();
      setDefaultMonth();
      if (els.incomeFormModeLabel) els.incomeFormModeLabel.textContent = "Neue Einnahme";
      if (els.incomeSubmitBtn) els.incomeSubmitBtn.textContent = "Einnahme speichern";
      if (els.incomeCancelEditBtn) els.incomeCancelEditBtn.style.display = "none";
    }
  }

  function startEdit(type, record) {
    if (!record) return;

    if (type === "transaction") {
      editState.transaction = record.id;
      setFormValues(els.transactionForm, record);
      if (els.bookingFormModeLabel) els.bookingFormModeLabel.textContent = "Buchung bearbeiten";
      if (els.transactionSubmitBtn) els.transactionSubmitBtn.textContent = "Änderungen speichern";
      if (els.transactionCancelEditBtn) els.transactionCancelEditBtn.style.display = "inline-flex";
      populateCategorySelects("Haushalt", els.bookingMainCategory, els.bookingSubCategory, record.main_category, record.sub_category);
      updateTransactionFormVisibility();
      document.getElementById("panel-bookings")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (type === "trip") {
      editState.trip = record.trip_id;
      setFormValues(els.tripForm, record);
      if (els.tripFormModeLabel) els.tripFormModeLabel.textContent = "Reise bearbeiten";
      if (els.tripSubmitBtn) els.tripSubmitBtn.textContent = "Änderungen speichern";
      if (els.tripCancelEditBtn) els.tripCancelEditBtn.style.display = "inline-flex";
      document.getElementById("panel-urlaub")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (type === "tripExpense") {
      editState.tripExpense = record.id;
      setFormValues(els.tripExpenseForm, record);
      if (els.tripExpenseFormModeLabel) els.tripExpenseFormModeLabel.textContent = "Urlaubsausgabe bearbeiten";
      if (els.tripExpenseSubmitBtn) els.tripExpenseSubmitBtn.textContent = "Änderungen speichern";
      if (els.tripExpenseCancelEditBtn) els.tripExpenseCancelEditBtn.style.display = "inline-flex";
      populateTripSelect();
      populateCategorySelects("Urlaub", els.tripMainCategory, els.tripSubCategory, record.main_category, record.sub_category);
      document.getElementById("panel-urlaub")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (type === "category") {
      editState.category = record.id;
      setFormValues(els.categoryForm, record);
      if (els.categoryFormModeLabel) els.categoryFormModeLabel.textContent = "Kategorie bearbeiten";
      if (els.categorySubmitBtn) els.categorySubmitBtn.textContent = "Änderungen speichern";
      if (els.categoryCancelEditBtn) els.categoryCancelEditBtn.style.display = "inline-flex";
      document.getElementById("panel-zentrale")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (type === "fixedCost") {
      editState.fixedCost = record.id;
      setFormValues(els.fixedCostForm, record);
      if (els.fixedCostFormModeLabel) els.fixedCostFormModeLabel.textContent = "Fixkosten bearbeiten";
      if (els.fixedCostSubmitBtn) els.fixedCostSubmitBtn.textContent = "Änderungen speichern";
      if (els.fixedCostCancelEditBtn) els.fixedCostCancelEditBtn.style.display = "inline-flex";
      populateCategorySelects("Haushalt", els.fixedMainCategory, els.fixedSubCategory, record.main_category, record.sub_category);
      document.getElementById("panel-zentrale")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (type === "income") {
      editState.income = record.id;
      setFormValues(els.incomeForm, record);
      if (els.incomeFormModeLabel) els.incomeFormModeLabel.textContent = "Einnahme bearbeiten";
      if (els.incomeSubmitBtn) els.incomeSubmitBtn.textContent = "Änderungen speichern";
      if (els.incomeCancelEditBtn) els.incomeCancelEditBtn.style.display = "inline-flex";
      document.getElementById("panel-zentrale")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  function getRecordByTypeAndKey(type, key) {
    if (type === "transaction") return (state.data.transactions || []).find((r) => r._clientKey === key);
    if (type === "trip") return (state.data.trips || []).find((r) => r._clientKey === key);
    if (type === "tripExpense") return (state.data.tripExpenses || []).find((r) => r._clientKey === key);
    if (type === "category") return (state.data.categories || []).find((r) => r._clientKey === key);
    if (type === "fixedCost") return (state.data.fixedCosts || []).find((r) => r._clientKey === key);
    if (type === "income") return (state.data.income || []).find((r) => r._clientKey === key);
    return null;
  }

  async function deleteRecord(type, backendId) {
    const confirmed = window.confirm("Diesen Eintrag wirklich löschen?");
    if (!confirmed) return;

    const actionMap = {
      transaction: "deleteTransaction",
      trip: "deleteTrip",
      tripExpense: "deleteTripExpense",
      category: "deleteCategory",
      fixedCost: "deleteFixedCost",
      income: "deleteIncome"
    };

    const payload = {};
    if (type === "trip") payload.trip_id = backendId;
    else payload.id = backendId;

    await apiPost(actionMap[type], payload);
    resetFormUi(type);
    await loadAll();
    showMessage("Eintrag gelöscht.", "success");
  }

  async function submitForm(form, addAction, updateAction, successAddText, successUpdateText, type) {
    try {
      clearMessage();

      const data = formToObject(form);

      const isEdit =
        (type === "trip" && !!editState.trip) ||
        (type === "transaction" && !!editState.transaction) ||
        (type === "tripExpense" && !!editState.tripExpense) ||
        (type === "category" && !!editState.category) ||
        (type === "fixedCost" && !!editState.fixedCost) ||
        (type === "income" && !!editState.income);

      const action = isEdit ? updateAction : addAction;

      await apiPost(action, data);

      resetFormUi(type);
      await loadAll();
      showMessage(isEdit ? successUpdateText : successAddText, "success");
    } catch (error) {
      showMessage(error.message || "Speichern fehlgeschlagen.", "error");
      console.error(error);
    }
  }

  function bindForms() {
    els.transactionForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(
        els.transactionForm,
        "addTransaction",
        "updateTransaction",
        "Haushaltsbuchung gespeichert.",
        "Haushaltsbuchung aktualisiert.",
        "transaction"
      );
    });

    els.tripForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(
        els.tripForm,
        "addTrip",
        "updateTrip",
        "Reise gespeichert.",
        "Reise aktualisiert.",
        "trip"
      );
    });

    els.tripExpenseForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(
        els.tripExpenseForm,
        "addTripExpense",
        "updateTripExpense",
        "Urlaubsausgabe gespeichert.",
        "Urlaubsausgabe aktualisiert.",
        "tripExpense"
      );
    });

    els.categoryForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(
        els.categoryForm,
        "addCategory",
        "updateCategory",
        "Kategorie gespeichert.",
        "Kategorie aktualisiert.",
        "category"
      );
    });

    els.fixedCostForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(
        els.fixedCostForm,
        "addFixedCost",
        "updateFixedCost",
        "Fixkosten gespeichert.",
        "Fixkosten aktualisiert.",
        "fixedCost"
      );
    });

    els.incomeForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(
        els.incomeForm,
        "addIncome",
        "updateIncome",
        "Einnahme gespeichert.",
        "Einnahme aktualisiert.",
        "income"
      );
    });

    els.transactionCancelEditBtn?.addEventListener("click", () => resetFormUi("transaction"));
    els.tripCancelEditBtn?.addEventListener("click", () => resetFormUi("trip"));
    els.tripExpenseCancelEditBtn?.addEventListener("click", () => resetFormUi("tripExpense"));
    els.categoryCancelEditBtn?.addEventListener("click", () => resetFormUi("category"));
    els.fixedCostCancelEditBtn?.addEventListener("click", () => resetFormUi("fixedCost"));
    els.incomeCancelEditBtn?.addEventListener("click", () => resetFormUi("income"));

    els.bookingType?.addEventListener("change", updateTransactionFormVisibility);
  }

  function bindTableActions() {
    document.addEventListener("click", async (event) => {
      const editBtn = event.target.closest(".js-edit");
      if (editBtn) {
        const type = editBtn.dataset.type;
        const key = editBtn.dataset.key;
        const record = getRecordByTypeAndKey(type, key);
        startEdit(type, record);
        return;
      }

      const deleteBtn = event.target.closest(".js-delete");
      if (deleteBtn) {
        const type = deleteBtn.dataset.type;
        const backendId = deleteBtn.dataset.id;
        try {
          await deleteRecord(type, backendId);
        } catch (error) {
          showMessage(error.message || "Löschen fehlgeschlagen.", "error");
          console.error(error);
        }
      }
    });
  }

  function bindTabs() {
    els.tabs?.addEventListener("click", (event) => {
      const btn = event.target.closest(".nav-btn");
      if (!btn) return;

      document.querySelectorAll(".nav-btn").forEach((el) => el.classList.remove("active"));
      btn.classList.add("active");

      document.querySelectorAll(".panel").forEach((el) => el.classList.remove("active"));
      document.getElementById(`panel-${btn.dataset.tab}`)?.classList.add("active");
    });
  }

  function bindFilters() {
    [
      els.filterStartMonth,
      els.filterAnalysisMonth,
      els.filterMainCategory,
      els.rangeMonths,
      els.chartMode,
      els.compositionMode,
      els.housingRangeMonths,
      els.housingDisplayMode,
      els.vacationAnalysisSelect
    ].filter(Boolean).forEach((element) => {
      element.addEventListener("change", renderAll);
    });

    els.reloadBtn?.addEventListener("click", loadAll);
  }

  function setupUiOnce() {
    if (state.initializedUi) return;

    setDefaultMonth();
    bindTabs();
    bindForms();
    bindFilters();
    bindTableActions();
    wireCategorySelects();
    resetFormUi("transaction");

    state.initializedUi = true;
  }

  async function onUserLoggedIn() {
    setupUiOnce();
    await loadAll();
  }

  async function init() {
    await initAuth();
    const user = currentUser();
    if (!user) return;

    setupUiOnce();
    await loadAll();
  }

  window.onUserLoggedIn = onUserLoggedIn;
  window.loadAll = loadAll;

  document.addEventListener("DOMContentLoaded", init);
})();
