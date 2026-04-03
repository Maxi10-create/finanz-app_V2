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
    incomeForm: document.getElementById("incomeForm")
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
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
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
      map.set(key, (map.get(key) || 0) + Number(row.amount || 0));
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
      populateCategorySelects(
        "Haushalt",
        els.bookingMainCategory,
        els.bookingSubCategory,
        els.bookingMainCategory.value
      );
    });

    els.tripMainCategory?.addEventListener("change", () => {
      populateCategorySelects(
        "Urlaub",
        els.tripMainCategory,
        els.tripSubCategory,
        els.tripMainCategory.value
      );
    });

    els.fixedMainCategory?.addEventListener("change", () => {
      populateCategorySelects(
        "Haushalt",
        els.fixedMainCategory,
        els.fixedSubCategory,
        els.fixedMainCategory.value
      );
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

  function renderKpis(month, txRows, tripRows) {
    const income = monthlyIncome(month);
    const txTotal = txRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    const tripTotal = tripRows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
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

    if (els.heroAvailable) {
      els.heroAvailable.textContent = currency(available);
    }

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
    if (balanceTarget) {
      balanceTarget.textContent = currency(peerBalance);
    }

    if (els.heroPeerLabel) {
      els.heroPeerLabel.textContent = `Saldo ${otherUserName()}`;
    }

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
        legend: {
          labels: { color: "#d8e4ff" }
        }
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

  function doughnutOptions() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#d8e4ff",
            boxWidth: 14
          }
        }
      }
    };
  }

  function ensureChart(name, canvasId, config) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === "undefined") return;

    if (state.charts[name]) {
      state.charts[name].destroy();
    }

    state.charts[name] = new Chart(canvas, config);
  }

  function renderCharts(month, txRows, tripRows, metrics) {
    const months = monthRange();

    const expenseSeries = months.map((m) => {
      const tx = filteredTransactionsForMonth(m).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      const trip = filteredTripExpensesForMonth(m).reduce((sum, row) => sum + Number(row.amount || 0), 0);
      return tx + trip;
    });

    const incomeSeries = months.map((m) => monthlyIncome(m));

    ensureChart("trendChart", "trendChart", {
      type: "line",
      data: {
        labels: months,
        datasets: [{
          label: "Ausgaben gesamt",
          data: expenseSeries,
          borderColor: "#61c9ff",
          backgroundColor: "rgba(97,201,255,.18)",
          fill: true,
          tension: 0.28
        }]
      },
      options: chartOptions()
    });

    ensureChart("incomeExpenseChart", "incomeExpenseChart", {
      type: "bar",
      data: {
        labels: months,
        datasets: [
          { label: "Einnahmen", data: incomeSeries, backgroundColor: "rgba(19,194,150,.78)" },
          { label: "Ausgaben", data: expenseSeries, backgroundColor: "rgba(79,124,255,.78)" }
        ]
      },
      options: chartOptions(true)
    });

    ensureChart("categoryChart", "categoryChart", {
      type: "doughnut",
      data: {
        labels: metrics.categoryAggregate.map((row) => row[0]),
        datasets: [{
          data: metrics.categoryAggregate.map((row) => row[1]),
          backgroundColor: ["#4f7cff", "#61c9ff", "#13c296", "#ffbe3d", "#ff6d7a", "#9f7aea", "#00c2a8", "#f97316"]
        }]
      },
      options: doughnutOptions()
    });

    ensureChart("fixedVariableChart", "fixedVariableChart", {
      type: "bar",
      data: {
        labels: ["Aktueller Monat"],
        datasets: [
          { label: "Fixkosten", data: [metrics.fixedCosts], backgroundColor: "rgba(255,190,61,.82)" },
          { label: "Variable Kosten", data: [metrics.variableCosts], backgroundColor: "rgba(79,124,255,.82)" }
        ]
      },
      options: chartOptions(true)
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
            <td>${escapeHtml(currency(row.amount))}</td>
            <td>${escapeHtml(row.paid_by)}</td>
            <td>${escapeHtml(row.owner_user || "")}</td>
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
            <td>${escapeHtml(row.status)}</td>
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
            <td>${escapeHtml(currency(row.amount))}</td>
            <td>${escapeHtml(row.paid_by)}</td>
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
          </tr>
        `).join("")
      : '<tr><td colspan="3" class="table-empty">Noch keine Kategorien vorhanden</td></tr>';
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
            <td>${escapeHtml(row.visible_to_other || "")}</td>
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
          </tr>
        `).join("")
      : '<tr><td colspan="3" class="table-empty">Noch keine Einnahmen vorhanden</td></tr>';
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
      if (els.syncStatus) {
        els.syncStatus.textContent = "Synchronisierung läuft...";
      }

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
      if (els.syncStatus) {
        els.syncStatus.textContent = "Synchronisierung fehlgeschlagen";
      }
      showMessage(error.message || "Fehler beim Laden.", "error");
      console.error(error);
    }
  }

  function formToObject(form) {
    const data = Object.fromEntries(new FormData(form).entries());
    const user = currentUser();

    if (data.date && !data.month_key) {
      data.month_key = data.date.slice(0, 7);
    }

    if (user) {
      data.created_by = user.displayName;
      data.updated_by = user.displayName;
      data.owner_user = user.displayName;
    }

    return data;
  }

  async function submitForm(form, action, successText) {
    try {
      clearMessage();
      await apiPost(action, formToObject(form));
      form.reset();
      setDefaultMonth();
      await loadAll();
      showMessage(successText, "success");
    } catch (error) {
      showMessage(error.message || "Speichern fehlgeschlagen.", "error");
      console.error(error);
    }
  }

  function bindForms() {
    els.transactionForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(els.transactionForm, "addTransaction", "Haushaltsbuchung gespeichert.");
    });

    els.tripForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(els.tripForm, "addTrip", "Reise gespeichert.");
    });

    els.tripExpenseForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(els.tripExpenseForm, "addTripExpense", "Urlaubsausgabe gespeichert.");
    });

    els.categoryForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(els.categoryForm, "addCategory", "Kategorie gespeichert.");
    });

    els.fixedCostForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(els.fixedCostForm, "addFixedCost", "Fixkosten gespeichert.");
    });

    els.incomeForm?.addEventListener("submit", (event) => {
      event.preventDefault();
      submitForm(els.incomeForm, "addIncome", "Einnahme gespeichert.");
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
    ]
      .filter(Boolean)
      .forEach((element) => {
        element.addEventListener("change", renderAll);
      });

    els.reloadBtn?.addEventListener("click", loadAll);

    els.fixedModeBtn?.addEventListener("click", () => {
      state.fixedCostDisplayMode =
        state.fixedCostDisplayMode === "currency" ? "percent" : "currency";
      els.fixedModeBtn.textContent =
        state.fixedCostDisplayMode === "currency" ? "€ anzeigen" : "% anzeigen";
      renderDashboard();
    });
  }

  function setupUiOnce() {
    if (state.initializedUi) return;

    setDefaultMonth();
    bindTabs();
    bindForms();
    bindFilters();
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
