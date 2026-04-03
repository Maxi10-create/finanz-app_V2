(() => {
  const state = {
    activeApiBaseUrl: null,
    fixedCostDisplayMode: "currency",
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
    filterEndMonth: document.getElementById("filterEndMonth") || document.getElementById("filterMonth"),
    filterDay: document.getElementById("filterDay"),
    filterPerson: document.getElementById("filterPerson"),
    filterMainCategory: document.getElementById("filterMainCategory"),
    rangeMonths: document.getElementById("rangeMonths"),
    chartMode: document.getElementById("chartMode"),
    compositionMode: document.getElementById("compositionMode"),
    reloadBtn: document.getElementById("reloadBtn"),
    syncStatus: document.getElementById("syncStatus"),
    fixedModeBtn: document.getElementById("fixedModeBtn"),
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
    heroAvailable: document.getElementById("heroAvailable"),
    heroAvailableSub: document.getElementById("heroAvailableSub"),
    heroFixedCosts: document.getElementById("heroFixedCosts"),
    heroFixedCostsSub: document.getElementById("heroFixedCostsSub"),
    heroJanaBalance: document.getElementById("heroJanaBalance"),
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
    variableCompositionLabel: document.getElementById("variableCompositionLabel")
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

  function currentUser() {
    return typeof getActiveUser === "function" ? getActiveUser() : null;
  }

  function currentUserName() {
    return currentUser()?.displayName || CONFIG.USER_NAME || "Hofer Maximilian";
  }

  function otherUserName() {
    return currentUserName() === "Jana March" ? "Hofer Maximilian" : "Jana March";
  }

  function showMessage(text, type = "error") {
    if (!els.messageBox) return;
    els.messageBox.innerHTML = `<div class="alert ${type}">${escapeHtml(text)}</div>`;
  }

  function clearMessage() {
    if (!els.messageBox) return;
    els.messageBox.innerHTML = "";
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
    if (els.filterEndMonth && !els.filterEndMonth.value) {
      els.filterEndMonth.value = currentMonth();
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
    const end = els.filterEndMonth?.value || currentMonth();
    const count = Number(els.rangeMonths?.value || 12);
    const months = [];

    const [year, month] = end.split("-").map(Number);
    const cursor = new Date(year, month - 1, 1);

    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(cursor.getFullYear(), cursor.getMonth() - i, 1);
      months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }

    return months;
  }

  function visibleCategories(module) {
    const user = currentUserName();

    return (state.data.categories || [])
      .filter((row) => String(row.module || "") === module)
      .filter((row) => {
        if (String(row.is_deleted || "").toLowerCase() === "ja") return false;
        if (module === "Urlaub") return true;
        if ((row.owner_user || "") === user) return true;
        return String(row.visible_to_other || "").toLowerCase() === "ja";
      });
  }

  function isVisibleTransaction(row) {
    if (!row) return false;
    if (String(row.is_deleted || "").toLowerCase() === "ja") return false;

    const user = currentUserName();
    if ((row.owner_user || "") === user) return true;

    const mainCategory = String(row.main_category || "");
    if (mainCategory === "Wohnen" || mainCategory === "Alltag") return true;

    return false;
  }

  function isVisibleTrip(row) {
    if (!row) return false;
    return String(row.is_deleted || "").toLowerCase() !== "ja";
  }

  function isVisibleIncome(row) {
    if (!row) return false;
    if (String(row.is_deleted || "").toLowerCase() === "ja") return false;
    return (row.owner_user || "") === currentUserName();
  }

  function isVisibleFixedCost(row) {
    if (!row) return false;
    if (String(row.is_deleted || "").toLowerCase() === "ja") return false;

    const user = currentUserName();
    if ((row.owner_user || "") === user) return true;
    return String(row.visible_to_other || "").toLowerCase() === "ja";
  }

  function getCurrentUserAmount(row) {
    const amount = Number(row.amount || 0);
    const splitPercent = Number(row.split_percent || 50);
    const owner = row.owner_user || "";
    const me = currentUserName();

    if (owner === me) {
      return amount * (splitPercent / 100);
    }

    if (String(row.visible_to_other || "").toLowerCase() === "ja") {
      return amount * ((100 - splitPercent) / 100);
    }

    return 0;
  }

  function filteredTransactionsForMonth(month) {
    const person = els.filterPerson?.value || "";
    const category = els.filterMainCategory?.value || "";

    return (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .filter((row) => monthFromDate(row.month_key || row.date) === month)
      .filter((row) => !person || [row.paid_by, row.owner_user].includes(person))
      .filter((row) => !category || row.main_category === category);
  }

  function filteredTransactions() {
    const month = els.filterEndMonth?.value || currentMonth();
    return filteredTransactionsForMonth(month);
  }

  function filteredTripExpensesForMonth(month) {
    return (state.data.tripExpenses || [])
      .filter(isVisibleTrip)
      .filter((row) => monthFromDate(row.month_key || row.date) === month);
  }

  function filteredTripExpenses() {
    const month = els.filterEndMonth?.value || currentMonth();
    return filteredTripExpensesForMonth(month);
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
      (sum, row) => sum + normalizeFrequency(row.amount, row.frequency),
      0
    );
  }

  function calculatePeerBalance(rows) {
    const me = currentUserName();
    const other = otherUserName();
    let balance = 0;

    rows.forEach((row) => {
      const amount = Number(row.amount || 0);
      const splitPercent = Number(row.split_percent || 50);

      const myShare = amount * (splitPercent / 100);
      const otherShare = amount - myShare;

      if (row.paid_by === me) {
        balance += otherShare;
      } else if (row.paid_by === other) {
        balance -= myShare;
      }
    });

    return balance;
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

  function fillCategoryFilter() {
    if (!els.filterMainCategory) return;

    const categories = [...new Set(visibleCategories("Haushalt").map((row) => row.main_category))];
    const current = els.filterMainCategory.value;

    els.filterMainCategory.innerHTML =
      '<option value="">Alle</option>' +
      categories.map((cat) => `<option>${escapeHtml(cat)}</option>`).join("");

    if (categories.includes(current)) {
      els.filterMainCategory.value = current;
    }
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

  function getTransactionsForTable() {
    const day = els.filterDay?.value || "";

    let rows = (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    if (day) {
      return rows.filter((row) => normalizeDateOnly(row.date) === day);
    }

    return rows.slice(0, 10);
  }

  function getTripsForTable() {
    const months = new Set(monthRange());

    return (state.data.trips || [])
      .filter(isVisibleTrip)
      .filter((row) => {
        const startMonth = monthFromDate(row.start_date || "");
        const endMonth = monthFromDate(row.end_date || "");
        return months.has(startMonth) || months.has(endMonth);
      })
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
    const months = monthRange().slice(-10);
    const monthSet = new Set(months);

    return (state.data.income || [])
      .filter(isVisibleIncome)
      .filter((row) => monthSet.has(monthFromDate(row.month_key || row.date)))
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
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

  function actionButtons(type, idValue) {
    return `
      <div class="table-actions">
        <button type="button" class="btn btn-ghost btn-xs js-edit" data-type="${escapeHtml(type)}" data-id="${escapeHtml(idValue)}">Bearbeiten</button>
        <button type="button" class="btn btn-ghost btn-xs js-delete" data-type="${escapeHtml(type)}" data-id="${escapeHtml(idValue)}">Löschen</button>
      </div>
    `;
  }

  function renderKpis(month, txRows, tripRows) {
    const income = monthlyIncome(month);
    const txTotal = txRows.reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
    const tripTotal = tripRows.reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
    const fixedCosts = fixedCostsMonthlyTotal(month);
    const totalExpenses = txTotal + tripTotal;
    const variableCosts = Math.max(totalExpenses - fixedCosts, 0);
    const available = income - totalExpenses;
    const savingsRate = income ? (available / income) * 100 : 0;
    const fixedRate = income ? (fixedCosts / income) * 100 : 0;
    const expenseRate = income ? (totalExpenses / income) * 100 : 0;
    const peerBalance = calculatePeerBalance(txRows.concat(tripRows));
    const categoryAggregate = aggregateCategories(txRows.concat(tripRows));
    const topCategory = categoryAggregate.length ? categoryAggregate[0][0] : "—";

    if (els.heroAvailable) els.heroAvailable.textContent = currency(available);
    if (els.heroAvailableSub) {
      els.heroAvailableSub.textContent = available >= 0 ? "Positiver Monatsüberschuss" : "Monat aktuell negativ";
    }

    if (els.heroFixedCosts) {
      els.heroFixedCosts.textContent =
        state.fixedCostDisplayMode === "percent" ? percent(fixedRate) : currency(fixedCosts);
    }

    if (els.heroFixedCostsSub) {
      els.heroFixedCostsSub.textContent =
        state.fixedCostDisplayMode === "percent"
          ? "Fixkostenquote bezogen auf Einkommen"
          : "Monatliche Fixkostenbelastung";
    }

    const balanceTarget = els.heroPeerBalance || els.heroJanaBalance;
    if (balanceTarget) balanceTarget.textContent = currency(peerBalance);
    if (els.heroPeerLabel) els.heroPeerLabel.textContent = `Saldo ${otherUserName()}`;

    if (els.kpiGrid) {
      const items = [
        ["Einnahmen", currency(income), "Monatliche Einnahmen"],
        ["Ausgaben gesamt", currency(totalExpenses), "Haushalt plus Urlaub"],
        ["Fixkostenquote", percent(fixedRate), "Monatliche Fixkosten zum Einkommen"],
        ["Ausgabenquote", percent(expenseRate), "Monatliche Ausgaben zum Einkommen"],
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
        ["Monat", month],
        ["Haushaltsausgaben", currency(txTotal)],
        ["Urlaubsausgaben", currency(tripTotal)],
        ["Fixkosten (monatl.)", currency(fixedCosts)],
        ["Variable Kosten", currency(variableCosts)],
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
        ["Top-Kategorie", topCategory],
        [`Saldo ${otherUserName()}`, currency(peerBalance)],
        ["Fixkosten aktiv", `${activeFixedCostsForMonth(month).length} Positionen`],
        ["Haushaltstransaktionen", `${txRows.length}`],
        ["Urlaubstransaktionen", `${tripRows.length}`],
        ["Verfügbare Mittel", currency(available)]
      ].map(([k, v]) => `
        <div class="summary-row">
          <div class="key">${escapeHtml(k)}</div>
          <div class="val">${escapeHtml(v)}</div>
        </div>
      `).join("");
    }

    return { income, txTotal, tripTotal, fixedCosts, totalExpenses, variableCosts, available, categoryAggregate };
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

  function ensureChart(name, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;
    if (state.charts[name]) state.charts[name].destroy();
    state.charts[name] = new Chart(canvas, config);
  }

  function renderCharts(month, txRows, tripRows, metrics) {
    const months = monthRange();

    const incomeSeries = months.map((m) => monthlyIncome(m));
    const totalExpenseSeries = months.map((m) => {
      const tx = filteredTransactionsForMonth(m).reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
      const trip = filteredTripExpensesForMonth(m).reduce((sum, row) => sum + getCurrentUserAmount(row), 0);
      return tx + trip;
    });

    const fixedSeries = months.map((m) => fixedCostsMonthlyTotal(m));
    const variableSeries = totalExpenseSeries.map((val, i) => Math.max(val - fixedSeries[i], 0));

    ensureChart("masterChart", "masterChart", {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Einnahmen",
            data: incomeSeries,
            borderColor: "#13c296",
            backgroundColor: "rgba(19,194,150,.15)",
            fill: false,
            tension: 0.25
          },
          {
            label: "Totale Kosten",
            data: totalExpenseSeries,
            borderColor: "#4f7cff",
            backgroundColor: "rgba(79,124,255,.15)",
            fill: false,
            tension: 0.25
          },
          {
            label: "Fixkosten",
            data: fixedSeries,
            borderColor: "#ffbe3d",
            backgroundColor: "rgba(255,190,61,.15)",
            fill: false,
            tension: 0.25
          },
          {
            label: "Variable Kosten",
            data: variableSeries,
            borderColor: "#ff6d7a",
            backgroundColor: "rgba(255,109,122,.15)",
            fill: false,
            tension: 0.25
          }
        ]
      },
      options: chartOptions()
    });

    const fixedMonthRows = activeFixedCostsForMonth(month);
    const fixedAgg = new Map();
    fixedMonthRows.forEach((row) => {
      const key = row.main_category || "Ohne Kategorie";
      fixedAgg.set(key, (fixedAgg.get(key) || 0) + normalizeFrequency(row.amount, row.frequency));
    });

    if (els.fixedCompositionLabel) {
      els.fixedCompositionLabel.textContent = "Aktueller Monat";
    }

    ensureChart("fixedCompositionChart", "fixedCompositionChart", {
      type: "bar",
      data: {
        labels: [...fixedAgg.keys()],
        datasets: [{
          label: "Fixkosten",
          data: [...fixedAgg.values()],
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

    if (els.variableCompositionLabel) {
      els.variableCompositionLabel.textContent = "Aktueller Monat";
    }

    ensureChart("variableCompositionChart", "variableCompositionChart", {
      type: "bar",
      data: {
        labels: [...variableAgg.keys()],
        datasets: [{
          label: "Variable Kosten",
          data: [...variableAgg.values()],
          backgroundColor: "rgba(79,124,255,.82)"
        }]
      },
      options: chartOptions()
    });

    ensureChart("categoryBreakdownChart", "categoryBreakdownChart", {
      type: "bar",
      data: {
        labels: metrics.categoryAggregate.map((row) => row[0]),
        datasets: [{
          label: "Kosten",
          data: metrics.categoryAggregate.map((row) => row[1]),
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

  function renderTransactionsTable() {
    if (!els.transactionsTableBody) return;
    const rows = getTransactionsForTable();

    els.transactionsTableBody.innerHTML = rows.length
      ? rows.map((row) => `
          <tr>
            <td>${escapeHtml(normalizeDateOnly(row.date))}</td>
            <td>${escapeHtml(row.title)}</td>
            <td>${escapeHtml(`${row.main_category} / ${row.sub_category}`)}</td>
            <td>${escapeHtml(currency(getCurrentUserAmount(row)))}</td>
            <td>${escapeHtml(row.paid_by)}</td>
            <td>${actionButtons("transaction", row.id)}</td>
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
            <td>${actionButtons("trip", row.trip_id)}</td>
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
            <td>${actionButtons("tripExpense", row.id)}</td>
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
            <td>${actionButtons("category", row.id)}</td>
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
            <td>${escapeHtml(currency(row.amount))}</td>
            <td>${escapeHtml(row.frequency)}</td>
            <td>${actionButtons("fixedCost", row.id)}</td>
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
            <td>${actionButtons("income", row.id)}</td>
          </tr>
        `).join("")
      : '<tr><td colspan="4" class="table-empty">Noch keine Einnahmen vorhanden</td></tr>';
  }

  function renderDashboard() {
    const month = els.filterEndMonth?.value || currentMonth();
    const txRows = filteredTransactions();
    const tripRows = filteredTripExpenses();
    const metrics = renderKpis(month, txRows, tripRows);
    renderCharts(month, txRows, tripRows, metrics);
    renderCategoryTable(txRows.concat(tripRows));
  }

  function renderAll() {
    fillCategoryFilter();
    renderDashboard();
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
  }

  async function loadAll() {
    clearMessage();

    try {
      if (els.syncStatus) els.syncStatus.textContent = "Synchronisierung läuft...";

      const result = await apiGet("getAll");
      state.data = result.data || {
        income: [],
        transactions: [],
        trips: [],
        tripExpenses: [],
        categories: [],
        fixedCosts: []
      };

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

    if (data.date && !data.month_key) data.month_key = data.date.slice(0, 7);

    if (user) {
      if (!data.created_by) data.created_by = user.displayName;
      data.updated_by = user.displayName;
      if (!data.owner_user) data.owner_user = user.displayName;
    }

    return data;
  }

  function setFormValues(form, record) {
    if (!form || !record) return;

    Object.entries(record).forEach(([key, value]) => {
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

  function resetFormUi(type) {
    if (type === "transaction") {
      editState.transaction = null;
      els.transactionForm?.reset();
      setDefaultMonth();
      if (els.bookingFormModeLabel) els.bookingFormModeLabel.textContent = "Neue Buchung";
      if (els.transactionSubmitBtn) els.transactionSubmitBtn.textContent = "Buchung speichern";
      if (els.transactionCancelEditBtn) els.transactionCancelEditBtn.style.display = "none";
      populateCategorySelects("Haushalt", els.bookingMainCategory, els.bookingSubCategory);
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

  function getRecordByTypeAndId(type, id) {
    if (type === "transaction") return (state.data.transactions || []).find((r) => String(r.id) === String(id));
    if (type === "trip") return (state.data.trips || []).find((r) => String(r.trip_id) === String(id));
    if (type === "tripExpense") return (state.data.tripExpenses || []).find((r) => String(r.id) === String(id));
    if (type === "category") return (state.data.categories || []).find((r) => String(r.id) === String(id));
    if (type === "fixedCost") return (state.data.fixedCosts || []).find((r) => String(r.id) === String(id));
    if (type === "income") return (state.data.income || []).find((r) => String(r.id) === String(id));
    return null;
  }

  async function deleteRecord(type, id) {
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
    if (type === "trip") payload.trip_id = id;
    else payload.id = id;

    await apiPost(actionMap[type], payload);
    resetFormUi(type);
    await loadAll();
    showMessage("Eintrag gelöscht.", "success");
  }

  async function submitForm(form, addAction, updateAction, successAddText, successUpdateText, type) {
    try {
      clearMessage();
      console.log("submitForm", { action: addAction, type, formData: Object.fromEntries(new FormData(form).entries()) });

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
      console.log("submit ok");

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
  }

  function bindTableActions() {
    document.addEventListener("click", async (event) => {
      const editBtn = event.target.closest(".js-edit");
      if (editBtn) {
        const type = editBtn.dataset.type;
        const id = editBtn.dataset.id;
        const record = getRecordByTypeAndId(type, id);
        startEdit(type, record);
        return;
      }

      const deleteBtn = event.target.closest(".js-delete");
      if (deleteBtn) {
        const type = deleteBtn.dataset.type;
        const id = deleteBtn.dataset.id;
        try {
          await deleteRecord(type, id);
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
      els.filterEndMonth,
      els.filterDay,
      els.filterPerson,
      els.filterMainCategory,
      els.rangeMonths,
      els.chartMode,
      els.compositionMode
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
