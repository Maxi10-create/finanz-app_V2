(() => {
  "use strict";

  const DEFAULT_START_MONTH = "2026-01";
  const DEFAULT_RANGE_MONTHS = 12;

  const PERSON_A = "Maximilian Hofer";
  const PERSON_B = "Jana March";
  const ASSIGNED_BOTH = "beide";

  const VACATION_BUCKETS = [
    "Transport",
    "Unterkunft",
    "Essen",
    "Aktivitäten",
    "Sonstiges"
  ];

  const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"];
  const WEEKDAY_NAMES = [
    "Montag",
    "Dienstag",
    "Mittwoch",
    "Donnerstag",
    "Freitag",
    "Samstag",
    "Sonntag"
  ];

  const EMPTY_DATA = () => ({
    income: [],
    transactions: [],
    trips: [],
    tripExpenses: [],
    categories: [],
    fixedCosts: [],
    tasks: []
  });

  const state = {
    activeApiBaseUrl: null,
    charts: {},
    initializedUi: false,
    loadingPromise: null,
    loading: false,
    data: EMPTY_DATA(),
    tripIndex: {
      byId: new Map(),
      groupByTripKey: new Map(),
      groups: []
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
    taskTableBody: document.querySelector("#tasksTable tbody"),

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
    householdTaskForm: document.getElementById("householdTaskForm"),

    bookingFormModeLabel: document.getElementById("bookingFormModeLabel"),
    tripFormModeLabel: document.getElementById("tripFormModeLabel"),
    tripExpenseFormModeLabel: document.getElementById("tripExpenseFormModeLabel"),
    categoryFormModeLabel: document.getElementById("categoryFormModeLabel"),
    fixedCostFormModeLabel: document.getElementById("fixedCostFormModeLabel"),
    incomeFormModeLabel: document.getElementById("incomeFormModeLabel"),
    taskFormModeLabel: document.getElementById("taskFormModeLabel"),

    transactionSubmitBtn: document.getElementById("transactionSubmitBtn"),
    tripSubmitBtn: document.getElementById("tripSubmitBtn"),
    tripExpenseSubmitBtn: document.getElementById("tripExpenseSubmitBtn"),
    categorySubmitBtn: document.getElementById("categorySubmitBtn"),
    fixedCostSubmitBtn: document.getElementById("fixedCostSubmitBtn"),
    incomeSubmitBtn: document.getElementById("incomeSubmitBtn"),
    taskSubmitBtn: document.getElementById("taskSubmitBtn"),

    transactionCancelEditBtn: document.getElementById("transactionCancelEditBtn"),
    tripCancelEditBtn: document.getElementById("tripCancelEditBtn"),
    tripExpenseCancelEditBtn: document.getElementById("tripExpenseCancelEditBtn"),
    categoryCancelEditBtn: document.getElementById("categoryCancelEditBtn"),
    fixedCostCancelEditBtn: document.getElementById("fixedCostCancelEditBtn"),
    incomeCancelEditBtn: document.getElementById("incomeCancelEditBtn"),
    taskCancelEditBtn: document.getElementById("taskCancelEditBtn"),

    fixedCompositionLabel: document.getElementById("fixedCompositionLabel"),
    variableCompositionLabel: document.getElementById("variableCompositionLabel"),

    bookingType: document.getElementById("bookingType"),
    transactionCounterparty: document.getElementById("transactionCounterparty"),
    transactionSplitEnabled: document.getElementById("transactionSplitEnabled"),
    transactionSplitPercent: document.getElementById("transactionSplitPercent"),

    housingDisplayMode: document.getElementById("housingDisplayMode"),
    housingMonthTotal: document.getElementById("housingMonthTotal"),
    housingAverageTotal: document.getElementById("housingAverageTotal"),
    housingCategoryCount: document.getElementById("housingCategoryCount"),
    housingMonthTableBody: document.querySelector("#housingMonthTable tbody"),

    vacationYearSelect: document.getElementById("vacationYearSelect"),
    vacationAnalysisSelect: document.getElementById("vacationAnalysisSelect"),
    vacationTotalCost: document.getElementById("vacationTotalCost"),
    vacationTripCount: document.getElementById("vacationTripCount"),
    vacationKpiTableBody: document.querySelector("#vacationKpiTable tbody"),

    vacationSectionTitle: document.getElementById("vacationSectionTitle"),
    vacationSectionSubtitle: document.getElementById("vacationSectionSubtitle"),
    vacationTotalCostLabel: document.getElementById("vacationTotalCostLabel"),
    vacationTotalCostSub: document.getElementById("vacationTotalCostSub"),
    vacationTripCountLabel: document.getElementById("vacationTripCountLabel"),
    vacationTripCountSub: document.getElementById("vacationTripCountSub"),
    vacationKpiTitle: document.getElementById("vacationKpiTitle"),
    vacationKpiSubtitle: document.getElementById("vacationKpiSubtitle"),
    vacationChartTitle: document.getElementById("vacationChartTitle"),
    vacationChartSubtitle: document.getElementById("vacationChartSubtitle"),

    householdWeekGrid: document.getElementById("householdWeekGrid"),
    householdWeekSubtitle: document.getElementById("householdWeekSubtitle"),
    taskRepeatType: document.getElementById("taskRepeatType"),
    taskWeekdaysWrap: document.getElementById("taskWeekdaysWrap"),
    taskDayOfMonthWrap: document.getElementById("taskDayOfMonthWrap")
  };

  const editState = {
    transaction: null,
    trip: null,
    tripExpense: null,
    category: null,
    fixedCost: null,
    income: null,
    task: null
  };

  const currency = (value) =>
    new Intl.NumberFormat("de-DE", {
      style: "currency",
      currency: (typeof CONFIG !== "undefined" && CONFIG.DEFAULT_CURRENCY) || "EUR"
    }).format(Number(value || 0));

  const percent = (value) => `${Number(value || 0).toFixed(1)} %`;

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;"
    }[character]));

  function setText(element, value) {
    if (element) element.textContent = String(value ?? "");
  }

  function numberValue(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, numberValue(value, min)));
  }

  function normalizeDateOnly(value) {
    return String(value || "").slice(0, 10);
  }

  function monthFromDate(value) {
    return String(value || "").slice(0, 7);
  }

  function localDateKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  }

  function localMonthKey(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  }

  function todayKey() {
    return localDateKey(new Date());
  }

  function currentMonth() {
    return localMonthKey(new Date());
  }

  function currentYear() {
    return new Date().getFullYear();
  }

  function parseLocalDate(value) {
    const dateOnly = normalizeDateOnly(value);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOnly);
    if (!match) return null;

    const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  function addDays(date, days) {
    const result = startOfDay(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  function startOfWeek(date) {
    const result = startOfDay(date);
    const day = result.getDay();
    result.setDate(result.getDate() + (day === 0 ? -6 : 1 - day));
    return result;
  }

  function utcDayNumber(date) {
    return Math.floor(
      Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
    );
  }

  function daysBetween(startDate, endDate) {
    return utcDayNumber(endDate) - utcDayNumber(startDate);
  }

  function monthsBetween(startMonth, endMonth) {
    if (!/^\d{4}-\d{2}$/.test(startMonth) || !/^\d{4}-\d{2}$/.test(endMonth)) {
      return [];
    }

    const [startYear, startMonthNumber] = startMonth.split("-").map(Number);
    const [endYear, endMonthNumber] = endMonth.split("-").map(Number);
    const start = new Date(startYear, startMonthNumber - 1, 1);
    const end = new Date(endYear, endMonthNumber - 1, 1);
    const months = [];

    if (start > end) return months;

    let cursor = start;

    while (cursor <= end) {
      months.push(localMonthKey(cursor));
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }

    return months;
  }

  function toPercent(value, income) {
    const denominator = numberValue(income);
    return denominator > 0
      ? (numberValue(value) / denominator) * 100
      : 0;
  }

  function normalizePersonName(name) {
    const raw = String(name || "").trim().toLowerCase();

    if (
      raw === "maximilian hofer" ||
      raw === "hofer maximilian" ||
      raw === "maxi hofer"
    ) {
      return PERSON_A;
    }

    if (raw === "jana march") return PERSON_B;

    return String(name || "").trim();
  }

  function normalizeAssignedTo(value) {
    const person = normalizePersonName(value);

    if (person === PERSON_A || person === PERSON_B) {
      return person;
    }

    return ASSIGNED_BOTH;
  }

  function isYes(value) {
    return String(value || "").trim().toLowerCase() === "ja";
  }

  function currentUser() {
    return typeof getActiveUser === "function"
      ? getActiveUser()
      : null;
  }

  function currentUserName() {
    const fallback =
      typeof CONFIG !== "undefined"
        ? CONFIG.USER_NAME
        : "";

    return normalizePersonName(
      currentUser()?.displayName ||
      fallback ||
      PERSON_A
    );
  }

  function otherUserName() {
    return currentUserName() === PERSON_B
      ? PERSON_A
      : PERSON_B;
  }

  function normalizeRecordNames(record) {
    const normalized = { ...record };

    ["owner_user", "paid_by", "created_by", "updated_by"].forEach((field) => {
      if (field in normalized) {
        normalized[field] = normalizePersonName(normalized[field]);
      }
    });

    if ("counterparty" in normalized) {
      normalized.counterparty =
        normalized.counterparty === "-"
          ? "-"
          : normalizePersonName(normalized.counterparty);
    }

    if ("travel_with" in normalized) {
      const value = String(normalized.travel_with || "").trim();

      normalized.travel_with = [
        PERSON_A.toLowerCase(),
        PERSON_B.toLowerCase(),
        "hofer maximilian"
      ].includes(value.toLowerCase())
        ? normalizePersonName(value)
        : value;
    }

    if ("assigned_to" in normalized) {
      normalized.assigned_to = normalizeAssignedTo(normalized.assigned_to);
    }

    return normalized;
  }

  function showMessage(text, type = "error") {
    if (!els.messageBox) return;

    els.messageBox.innerHTML =
      `<div class="alert ${escapeHtml(type)}">${escapeHtml(text)}</div>`;
  }

  function clearMessage() {
    if (els.messageBox) {
      els.messageBox.innerHTML = "";
    }
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

  function monthRange() {
    const count = Math.max(
      1,
      Math.floor(
        numberValue(els.rangeMonths?.value, DEFAULT_RANGE_MONTHS)
      )
    );

    const [year, month] = selectedStartMonth()
      .split("-")
      .map(Number);

    const start = new Date(year, month - 1, 1);

    return Array.from({ length: count }, (_, index) => {
      return localMonthKey(
        new Date(start.getFullYear(), start.getMonth() + index, 1)
      );
    });
  }

  function analysisRangeMonths() {
    return monthRange();
  }

  function balanceMonthsUntil(month) {
    return monthsBetween(DEFAULT_START_MONTH, month);
  }

  function withClientKeys(raw) {
    const input = raw || EMPTY_DATA();

    return {
      income: (input.income || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `income_${index}_${row.id || ""}`
      })),

      transactions: (input.transactions || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `transaction_${index}_${row.id || ""}`
      })),

      trips: (input.trips || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `trip_${index}_${row.trip_id || ""}`
      })),

      tripExpenses: (input.tripExpenses || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `tripExpense_${index}_${row.id || ""}`
      })),

      categories: (input.categories || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `category_${index}_${row.id || ""}`
      })),

      fixedCosts: (input.fixedCosts || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `fixedCost_${index}_${row.id || ""}`
      })),

      tasks: (input.tasks || []).map((row, index) => ({
        ...normalizeRecordNames(row),
        _clientKey: `task_${index}_${row.id || ""}`
      }))
    };
  }

  function buildApiUrl(baseUrl, params = {}) {
    const separator = String(baseUrl).includes("?") ? "&" : "?";
    const query = new URLSearchParams(params);

    return `${baseUrl}${separator}${query.toString()}`;
  }

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(
        "Die API hat keine gültige JSON-Antwort geliefert."
      );
    }
  }

  async function resolveApiBaseUrl() {
    if (state.activeApiBaseUrl) {
      return state.activeApiBaseUrl;
    }

    const urls =
      (typeof CONFIG !== "undefined" && CONFIG.API_BASE_URLS) ||
      [];

    for (const baseUrl of urls) {
      try {
        const result = await fetchJson(
          buildApiUrl(baseUrl, {
            action: "ping",
            _: Date.now()
          })
        );

        if (result?.success) {
          state.activeApiBaseUrl = baseUrl;
          return baseUrl;
        }
      } catch (error) {
        console.warn("API-Test fehlgeschlagen:", baseUrl, error);
      }
    }

    throw new Error(
      "Keine funktionierende Apps-Script-URL gefunden. Bitte Deployment prüfen."
    );
  }

  async function apiGet(action) {
    const baseUrl = await resolveApiBaseUrl();

    const result = await fetchJson(
      buildApiUrl(baseUrl, {
        action,
        _: Date.now()
      })
    );

    if (!result?.success) {
      throw new Error(
        result?.error ||
        "Unbekannter Backend-Fehler"
      );
    }

    return result;
  }

  async function apiPost(action, payload) {
    const baseUrl = await resolveApiBaseUrl();

    const result = await fetchJson(baseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify({
        action,
        payload
      })
    });

    if (!result?.success) {
      throw new Error(
        result?.error ||
        "Unbekannter Backend-Fehler"
      );
    }

    return result;
  }

  function isDeleted(row) {
    return String(row?.is_deleted || "").toLowerCase() === "ja";
  }

  function getTripsById(tripId) {
    return (state.data.trips || []).filter((trip) => {
      return (
        !isDeleted(trip) &&
        String(trip.trip_id) === String(tripId)
      );
    });
  }

  function getTripById(tripId) {
    return getTripsById(tripId)[0] || null;
  }

  function resolveTripPeople(trip) {
    return {
      owner: normalizePersonName(trip?.owner_user || ""),
      travelWith: normalizePersonName(trip?.travel_with || "")
    };
  }

  function isSharedTrip(trip) {
    if (!trip || isDeleted(trip)) return false;

    const { owner, travelWith } = resolveTripPeople(trip);

    if (
      (owner === PERSON_A && travelWith === PERSON_B) ||
      (owner === PERSON_B && travelWith === PERSON_A)
    ) {
      return true;
    }

    const raw = String(trip.travel_with || "")
      .trim()
      .toLowerCase();

    if (
      raw === "beide" ||
      raw.includes("gemeinsam") ||
      raw.includes("zusammen")
    ) {
      return true;
    }

    return (
      raw.includes(PERSON_A.toLowerCase()) &&
      raw.includes(PERSON_B.toLowerCase())
    );
  }

  function normalizeTripText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function normalizedTripText(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function dateWithinTrip(expenseDate, trip) {
    const date = normalizeDateOnly(expenseDate);
    const start = normalizeDateOnly(trip?.start_date);
    const end = normalizeDateOnly(trip?.end_date);

    if (!date || !start || !end) return false;

    return date >= start && date <= end;
  }

  function distanceToTrip(expenseDate, trip) {
    const date = parseLocalDate(expenseDate);
    const start = parseLocalDate(trip?.start_date);
    const end = parseLocalDate(trip?.end_date);

    if (!date || !start || !end) {
      return Number.POSITIVE_INFINITY;
    }

    if (date >= start && date <= end) {
      return 0;
    }

    return Math.min(
      Math.abs(date - start),
      Math.abs(date - end)
    );
  }

  function resolveTripForExpense(expense) {
    const candidates = getTripsById(expense?.trip_id);

    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    const inRange = candidates.filter((trip) => {
      return dateWithinTrip(expense.date, trip);
    });

    if (inRange.length === 1) {
      return inRange[0];
    }

    const pool = inRange.length
      ? inRange
      : candidates;

    const expenseOwner = normalizePersonName(
      expense.owner_user || ""
    );

    const ownerMatches = pool.filter((trip) => {
      return normalizePersonName(trip.owner_user || "") === expenseOwner;
    });

    if (ownerMatches.length === 1) {
      return ownerMatches[0];
    }

    const sorted = [
      ...(ownerMatches.length ? ownerMatches : pool)
    ].sort((a, b) => {
      return (
        distanceToTrip(expense.date, a) -
        distanceToTrip(expense.date, b)
      );
    });

    return sorted[0] || null;
  }

  function tripDatesAreRelated(first, second) {
    const firstStart = parseLocalDate(first?.start_date);
    const firstEnd =
      parseLocalDate(first?.end_date) ||
      firstStart;

    const secondStart = parseLocalDate(second?.start_date);
    const secondEnd =
      parseLocalDate(second?.end_date) ||
      secondStart;

    if (!firstStart || !secondStart) return false;

    const aStart = utcDayNumber(firstStart);
    const aEnd = utcDayNumber(firstEnd || firstStart);
    const bStart = utcDayNumber(secondStart);
    const bEnd = utcDayNumber(secondEnd || secondStart);

    const overlaps =
      aStart <= bEnd &&
      bStart <= aEnd;

    if (overlaps) return true;

    const gap = Math.min(
      Math.abs(aStart - bEnd),
      Math.abs(bStart - aEnd)
    );

    return gap <= 3;
  }

  function tripsBelongTogether(first, second) {
    if (!first || !second) return false;

    const titleA = normalizedTripText(first.title);
    const titleB = normalizedTripText(second.title);
    const destinationA = normalizedTripText(first.destination);
    const destinationB = normalizedTripText(second.destination);

    const sameTitle =
      titleA &&
      titleB &&
      titleA === titleB;

    const sameDestination =
      destinationA &&
      destinationB &&
      destinationA === destinationB;

    if (
      sameTitle &&
      sameDestination &&
      tripDatesAreRelated(first, second)
    ) {
      return true;
    }

    if (
      String(first.trip_id || "") &&
      String(first.trip_id || "") === String(second.trip_id || "") &&
      sameTitle &&
      tripDatesAreRelated(first, second)
    ) {
      return true;
    }

    return false;
  }

  function buildTripGroupKey(group, index) {
    const representative = group.trips[0] || {};

    const title =
      normalizedTripText(representative.title) ||
      "reise";

    const destination =
      normalizedTripText(representative.destination) ||
      "ziel";

    const starts = group.trips
      .map((trip) => normalizeDateOnly(trip.start_date))
      .filter(Boolean)
      .sort();

    const ends = group.trips
      .map((trip) => normalizeDateOnly(trip.end_date))
      .filter(Boolean)
      .sort();

    return [
      group.shared ? "shared" : "single",
      title,
      destination,
      starts[0] || "",
      ends[ends.length - 1] || "",
      String(index + 1)
    ].join("|");
  }

  function rebuildTripIndex() {
    const activeTrips = (state.data.trips || [])
      .filter((trip) => !isDeleted(trip))
      .slice()
      .sort((a, b) => {
        return (
          String(a.start_date || "").localeCompare(
            String(b.start_date || "")
          ) ||
          String(a.title || "").localeCompare(
            String(b.title || "")
          )
        );
      });

    const byId = new Map();

    activeTrips.forEach((trip) => {
      const id = String(trip.trip_id || "");

      if (!byId.has(id)) {
        byId.set(id, []);
      }

      byId.get(id).push(trip);
    });

    const groups = [];

    activeTrips.forEach((trip) => {
      let group = groups.find((candidate) => {
        return candidate.trips.some((existing) => {
          return tripsBelongTogether(existing, trip);
        });
      });

      if (!group) {
        group = {
          key: "",
          trips: [],
          shared: false,
          owners: new Set(),
          startDate: "",
          endDate: "",
          title: trip.title || "Reise",
          destination: trip.destination || ""
        };

        groups.push(group);
      }

      group.trips.push(trip);

      const owner = normalizePersonName(
        trip.owner_user || ""
      );

      if (owner === PERSON_A || owner === PERSON_B) {
        group.owners.add(owner);
      }
    });

    const groupByTripKey = new Map();

    groups.forEach((group, index) => {
      group.shared =
        group.trips.some(isSharedTrip) ||
        (
          group.owners.has(PERSON_A) &&
          group.owners.has(PERSON_B)
        );

      const starts = group.trips
        .map((trip) => normalizeDateOnly(trip.start_date))
        .filter(Boolean)
        .sort();

      const ends = group.trips
        .map((trip) => normalizeDateOnly(trip.end_date))
        .filter(Boolean)
        .sort();

      group.startDate = starts[0] || "";
      group.endDate =
        ends[ends.length - 1] ||
        group.startDate;

      group.key = buildTripGroupKey(group, index);

      const preferred = group.trips.find((trip) => {
        return normalizePersonName(trip.owner_user) === currentUserName();
      });

      group.representative =
        preferred ||
        group.trips[0] ||
        null;

      group.title =
        group.representative?.title ||
        group.title;

      group.destination =
        group.representative?.destination ||
        group.destination;

      group.label = [
        group.title,
        group.destination
      ].filter(Boolean).join(" – ");

      group.trips.forEach((trip) => {
        groupByTripKey.set(trip._clientKey, group);
      });
    });

    state.tripIndex = {
      byId,
      groupByTripKey,
      groups
    };
  }

  function tripCandidateScore(trip, expense) {
    let score = 0;

    const expenseDate = parseLocalDate(expense?.date);
    const start = parseLocalDate(trip?.start_date);
    const end =
      parseLocalDate(trip?.end_date) ||
      start;

    if (expenseDate && start) {
      const expenseDay = utcDayNumber(expenseDate);
      const startDay = utcDayNumber(start);
      const endDay = utcDayNumber(end || start);

      if (
        expenseDay >= startDay &&
        expenseDay <= endDay
      ) {
        score += 10000;
      } else {
        const distance =
          expenseDay < startDay
            ? startDay - expenseDay
            : expenseDay - endDay;

        score += Math.max(
          0,
          1000 - distance * 20
        );
      }
    }

    const owner = normalizePersonName(
      trip?.owner_user || ""
    );

    const expenseOwner = normalizePersonName(
      expense?.owner_user || ""
    );

    if (owner && owner === expenseOwner) {
      score += 100;
    }

    const tripCreated = Date.parse(
      trip?.created_at || ""
    );

    const expenseCreated = Date.parse(
      expense?.created_at || ""
    );

    if (
      Number.isFinite(tripCreated) &&
      Number.isFinite(expenseCreated)
    ) {
      if (tripCreated <= expenseCreated) {
        score += 50;
      }

      const diffDays =
        Math.abs(expenseCreated - tripCreated) /
        86400000;

      score += Math.max(
        0,
        40 - Math.min(40, diffDays / 30)
      );
    }

    if (isSharedTrip(trip)) {
      score += 5;
    }

    return score;
  }

  function getTripCandidatesById(tripId) {
    return (
      state.tripIndex.byId.get(String(tripId || "")) ||
      []
    );
  }

  function getTripForExpense(expense) {
    const candidates = getTripCandidatesById(
      expense?.trip_id
    );

    if (!candidates.length) return null;
    if (candidates.length === 1) return candidates[0];

    return candidates
      .slice()
      .sort((a, b) => {
        return (
          tripCandidateScore(b, expense) -
          tripCandidateScore(a, expense)
        );
      })[0] || null;
  }

  function getTripGroupForTrip(trip) {
    return trip
      ? state.tripIndex.groupByTripKey.get(trip._clientKey) || null
      : null;
  }

  function getTripGroupForExpense(expense) {
    return getTripGroupForTrip(
      getTripForExpense(expense)
    );
  }

  function isVisibleTripGroup(group) {
    if (!group) return false;

    if (group.shared) return true;

    return group.owners.has(currentUserName());
  }

  function getVisibleTripGroups() {
    return state.tripIndex.groups
      .filter(isVisibleTripGroup)
      .slice()
      .sort((a, b) => {
        return String(b.startDate || "").localeCompare(
          String(a.startDate || "")
        );
      });
  }

  function isVisibleTrip(trip) {
    return (
      !isDeleted(trip) &&
      isVisibleTripGroup(getTripGroupForTrip(trip))
    );
  }

  function visibleCategories(module) {
    const user = currentUserName();

    return (state.data.categories || [])
      .filter((row) => !isDeleted(row))
      .filter((row) => String(row.module || "") === module)
      .filter((row) => {
        if (module === "Urlaub") return true;

        if (
          normalizePersonName(row.owner_user || "") === user
        ) {
          return true;
        }

        return isYes(row.visible_to_other);
      });
  }

  function allVisibleMainCategories() {
    const categories = new Set();

    visibleCategories("Haushalt").forEach((row) => {
      categories.add(row.main_category);
    });

    visibleCategories("Urlaub").forEach((row) => {
      categories.add(row.main_category);
    });

    return [...categories]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"));
  }

  function fillCategoryFilter() {
    if (!els.filterMainCategory) return;

    const categories = allVisibleMainCategories();
    const previous = els.filterMainCategory.value;

    els.filterMainCategory.innerHTML =
      '<option value="">Alle Hauptkategorien</option>' +
      categories
        .map((category) => {
          return (
            `<option value="${escapeHtml(category)}">` +
            `${escapeHtml(category)}` +
            "</option>"
          );
        })
        .join("");

    if (categories.includes(previous)) {
      els.filterMainCategory.value = previous;
    }
  }

  function isSettlement(row) {
    return String(
      row?.booking_type ||
      "expense"
    ).toLowerCase() === "settlement";
  }

  function isExpenseBooking(row) {
    return !isSettlement(row);
  }

  function isVisibleTransaction(row) {
    if (!row || isDeleted(row)) return false;

    const me = currentUserName();
    const owner = normalizePersonName(row.owner_user || "");

    const counterparty =
      row.counterparty === "-"
        ? "-"
        : normalizePersonName(row.counterparty || "");

    if (owner === me) return true;

    if (
      isSettlement(row) &&
      counterparty === me
    ) {
      return true;
    }

    if (!isYes(row.split_enabled)) {
      return false;
    }

    if (
      ["Wohnen", "Alltag"].includes(
        String(row.main_category || "")
      )
    ) {
      return true;
    }

    return isYes(row.visible_to_other);
  }

  function isVisibleIncome(row) {
    return (
      !!row &&
      !isDeleted(row) &&
      normalizePersonName(row.owner_user || "") === currentUserName()
    );
  }

  function isVisibleFixedCost(row) {
    if (!row || isDeleted(row)) return false;

    if (
      normalizePersonName(row.owner_user || "") === currentUserName()
    ) {
      return true;
    }

    return (
      isYes(row.split_enabled) &&
      isYes(row.visible_to_other)
    );
  }

  function getTransactionShares(row, baseAmount = row?.amount) {
    const amount = numberValue(baseAmount);
    const owner = normalizePersonName(row?.owner_user || "");
    const splitEnabled = isYes(row?.split_enabled);
    const ownerPercent = clamp(
      row?.split_percent ?? 100,
      0,
      100
    );

    const shares = {
      total: amount,
      [PERSON_A]: 0,
      [PERSON_B]: 0
    };

    if (splitEnabled) {
      const ownerShare =
        amount * ownerPercent / 100;

      const otherShare =
        amount - ownerShare;

      if (owner === PERSON_A) {
        shares[PERSON_A] = ownerShare;
        shares[PERSON_B] = otherShare;
      } else if (owner === PERSON_B) {
        shares[PERSON_B] = ownerShare;
        shares[PERSON_A] = otherShare;
      } else {
        shares[PERSON_A] = amount / 2;
        shares[PERSON_B] = amount / 2;
      }
    } else if (
      owner === PERSON_A ||
      owner === PERSON_B
    ) {
      shares[owner] = amount;
    } else {
      shares[currentUserName()] = amount;
    }

    return shares;
  }

  function getUserShareFromAmount(row, baseAmount) {
    if (isSettlement(row)) return 0;

    return (
      getTransactionShares(
        row,
        baseAmount
      )[currentUserName()] ||
      0
    );
  }

  function getCurrentUserAmount(row) {
    return getUserShareFromAmount(
      row,
      row?.amount
    );
  }

  function resolveVacationPayer(row) {
    const paidBy = normalizePersonName(
      row?.paid_by || ""
    );

    if (
      paidBy === PERSON_A ||
      paidBy === PERSON_B
    ) {
      return paidBy;
    }

    const owner = normalizePersonName(
      row?.owner_user || ""
    );

    if (
      owner === PERSON_A ||
      owner === PERSON_B
    ) {
      return owner;
    }

    return currentUserName();
  }

  function getVacationExpenseShares(
    row,
    group = getTripGroupForExpense(row)
  ) {
    const amount = numberValue(row?.amount);
    const payer = resolveVacationPayer(row);
    const splitEnabled = isYes(row?.split_enabled);

    const payerPercent = clamp(
      row?.split_percent ?? 100,
      0,
      100
    );

    const shares = {
      total: amount,
      [PERSON_A]: 0,
      [PERSON_B]: 0
    };

    if (group?.shared) {
      const other =
        payer === PERSON_A
          ? PERSON_B
          : PERSON_A;

      if (splitEnabled) {
        shares[payer] =
          amount * payerPercent / 100;

        shares[other] =
          amount - shares[payer];
      } else {
        shares[payer] = amount;
      }

      return shares;
    }

    const singleOwner =
      group?.owners?.size === 1
        ? [...group.owners][0]
        : payer;

    shares[
      singleOwner === PERSON_A ||
      singleOwner === PERSON_B
        ? singleOwner
        : payer
    ] = amount;

    return shares;
  }

  function getVacationCurrentUserAmount(row) {
    return (
      getVacationExpenseShares(row)[currentUserName()] ||
      0
    );
  }

  function isVisibleTripExpense(row) {
    if (!row || isDeleted(row)) return false;

    const group = getTripGroupForExpense(row);

    if (!group) {
      return resolveVacationPayer(row) === currentUserName();
    }

    if (group.shared) return true;

    return group.owners.has(currentUserName());
  }

  function getRowCurrentUserAmount(row) {
    if (
      row &&
      Object.prototype.hasOwnProperty.call(row, "trip_id")
    ) {
      return getVacationCurrentUserAmount(row);
    }

    return getCurrentUserAmount(row);
  }

  function filteredTransactionsForMonth(month) {
    return (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .filter(isExpenseBooking)
      .filter((row) => {
        return monthFromDate(
          row.month_key ||
          row.date
        ) === month;
      });
  }

  function filteredTransactions() {
    return filteredTransactionsForMonth(
      selectedAnalysisMonth()
    );
  }

  function filteredTripExpensesForMonth(month) {
    return (state.data.tripExpenses || [])
      .filter(isVisibleTripExpense)
      .filter((row) => {
        return monthFromDate(
          row.month_key ||
          row.date
        ) === month;
      });
  }

  function filteredTripExpenses() {
    return filteredTripExpensesForMonth(
      selectedAnalysisMonth()
    );
  }

  function monthlyIncome(month) {
    return (state.data.income || [])
      .filter(isVisibleIncome)
      .filter((row) => {
        return monthFromDate(
          row.month_key ||
          row.date
        ) === month;
      })
      .reduce((sum, row) => {
        return sum + numberValue(row.amount);
      }, 0);
  }

  function normalizeFrequency(amount, frequency) {
    const value = numberValue(amount);

    const normalized = String(
      frequency ||
      "monatlich"
    ).toLowerCase();

    if (normalized === "jährlich") {
      return value / 12;
    }

    if (normalized === "quartalsweise") {
      return value / 3;
    }

    return value;
  }

  function activeFixedCostsForMonth(month) {
    return (state.data.fixedCosts || [])
      .filter(isVisibleFixedCost)
      .filter((row) => {
        const startMonth = monthFromDate(
          row.start_month ||
          ""
        );

        const endMonth = monthFromDate(
          row.end_month ||
          ""
        );

        if (
          startMonth &&
          month < startMonth
        ) {
          return false;
        }

        if (
          endMonth &&
          month > endMonth
        ) {
          return false;
        }

        return true;
      });
  }

  function fixedCostsMonthlyTotal(month) {
    return activeFixedCostsForMonth(month)
      .reduce((sum, row) => {
        return (
          sum +
          getUserShareFromAmount(
            row,
            normalizeFrequency(
              row.amount,
              row.frequency
            )
          )
        );
      }, 0);
  }

  function calculateSettlementEffect(row) {
    if (!isSettlement(row)) return 0;

    const paidBy = normalizePersonName(
      row.paid_by ||
      ""
    );

    const amount = numberValue(row.amount);

    return paidBy === currentUserName()
      ? amount
      : -amount;
  }

  function calculatePeerBalanceForMonth(month) {
    const me = currentUserName();
    const other = otherUserName();
    let balance = 0;

    (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .filter((row) => {
        return monthFromDate(
          row.month_key ||
          row.date
        ) === month;
      })
      .forEach((row) => {
        if (isSettlement(row)) {
          balance += calculateSettlementEffect(row);
          return;
        }

        if (!isYes(row.split_enabled)) {
          return;
        }

        const shares = getTransactionShares(row);
        const paidBy = normalizePersonName(row.paid_by || "");

        balance +=
          paidBy === me
            ? shares[other] || 0
            : -(shares[me] || 0);
      });

    (state.data.tripExpenses || [])
      .filter(isVisibleTripExpense)
      .filter((row) => {
        return monthFromDate(
          row.month_key ||
          row.date
        ) === month;
      })
      .forEach((row) => {
        if (!isYes(row.split_enabled)) {
          return;
        }

        const shares = getVacationExpenseShares(row);
        const payer = resolveVacationPayer(row);

        balance +=
          payer === me
            ? shares[other] || 0
            : -(shares[me] || 0);
      });

    return balance;
  }

  function calculateOpenPeerBalanceUntil(month) {
    return balanceMonthsUntil(month).reduce((sum, item) => {
      return sum + calculatePeerBalanceForMonth(item);
    }, 0);
  }

  function aggregateCategories(rows) {
    const map = new Map();

    rows.forEach((row) => {
      const key =
        row.main_category ||
        "Ohne Kategorie";

      map.set(
        key,
        (map.get(key) || 0) +
        getRowCurrentUserAmount(row)
      );
    });

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1]);
  }

  function aggregateSubcategories(rows, selectedMainCategory) {
    const map = new Map();

    rows
      .filter((row) => {
        return (
          !selectedMainCategory ||
          row.main_category === selectedMainCategory
        );
      })
      .forEach((row) => {
        const key =
          row.sub_category ||
          "Ohne Unterkategorie";

        map.set(
          key,
          (map.get(key) || 0) +
          getRowCurrentUserAmount(row)
        );
      });

    return [...map.entries()]
      .sort((a, b) => b[1] - a[1]);
  }

  function normalizeTaskWeekdays(value) {
    if (Array.isArray(value)) {
      return value.filter((code) => {
        return WEEKDAY_CODES.includes(code);
      });
    }

    return String(value || "")
      .split(",")
      .map((code) => code.trim().toUpperCase())
      .filter((code) => WEEKDAY_CODES.includes(code));
  }

  function weekdayCodeFromDate(date) {
    return [
      "SU",
      "MO",
      "TU",
      "WE",
      "TH",
      "FR",
      "SA"
    ][date.getDay()];
  }

  function getVisibleTasks() {
    return (state.data.tasks || [])
      .filter((task) => !isDeleted(task))
      .slice()
      .sort((a, b) => {
        const statusOrder =
          String(a.status || "active") === "active"
            ? 0
            : 1;

        const otherStatusOrder =
          String(b.status || "active") === "active"
            ? 0
            : 1;

        return (
          statusOrder - otherStatusOrder ||
          String(a.start_date || "").localeCompare(
            String(b.start_date || "")
          ) ||
          String(a.due_time || "").localeCompare(
            String(b.due_time || "")
          ) ||
          String(a.title || "").localeCompare(
            String(b.title || ""),
            "de"
          )
        );
      });
  }

  function taskAssignedLabel(task) {
    const assigned = normalizeAssignedTo(
      task?.assigned_to
    );

    if (
      assigned === PERSON_A ||
      assigned === PERSON_B
    ) {
      return assigned;
    }

    return "Gemeinsam";
  }

  function taskAssignedClass(task) {
    const assigned = normalizeAssignedTo(
      task?.assigned_to
    );

    if (assigned === PERSON_A) {
      return "task-user-max";
    }

    if (assigned === PERSON_B) {
      return "task-user-jana";
    }

    return "task-user-both";
  }

  function recurrenceText(task) {
    const type = String(
      task?.recurrence_type ||
      "none"
    ).toLowerCase();

    const interval = Math.max(
      1,
      Math.floor(
        numberValue(task?.recurrence_interval, 1)
      )
    );

    if (type === "none") {
      return "Einmalig";
    }

    if (type === "daily") {
      return interval === 1
        ? "Täglich"
        : `Alle ${interval} Tage`;
    }

    if (type === "weekly") {
      const labelMap = {
        MO: "Mo",
        TU: "Di",
        WE: "Mi",
        TH: "Do",
        FR: "Fr",
        SA: "Sa",
        SU: "So"
      };

      const labels = normalizeTaskWeekdays(task.weekdays)
        .map((code) => labelMap[code])
        .filter(Boolean)
        .join(", ");

      const base =
        interval === 1
          ? "Wöchentlich"
          : `Alle ${interval} Wochen`;

      return labels
        ? `${base} (${labels})`
        : base;
    }

    if (type === "monthly") {
      const startDate = parseLocalDate(task.start_date);

      const day =
        numberValue(task.day_of_month) ||
        startDate?.getDate();

      const base =
        interval === 1
          ? "Monatlich"
          : `Alle ${interval} Monate`;

      return day
        ? `${base} am ${day}.`
        : base;
    }

    return type;
  }

  function taskRangeText(task) {
    return (
      `${formatGermanDate(task.start_date)} – ` +
      `${task.end_date ? formatGermanDate(task.end_date) : "offen"}`
    );
  }

  function taskOccursOnDate(task, date) {
    if (
      !task ||
      isDeleted(task) ||
      String(task.status || "active").toLowerCase() !== "active"
    ) {
      return false;
    }

    const taskStart = parseLocalDate(task.start_date);
    const taskEnd = parseLocalDate(task.end_date);
    const current = startOfDay(date);

    if (
      !taskStart ||
      current < taskStart ||
      (taskEnd && current > taskEnd)
    ) {
      return false;
    }

    const type = String(
      task.recurrence_type ||
      "none"
    ).toLowerCase();

    const interval = Math.max(
      1,
      Math.floor(
        numberValue(task.recurrence_interval, 1)
      )
    );

    if (type === "none") {
      return (
        localDateKey(current) ===
        localDateKey(taskStart)
      );
    }

    if (type === "daily") {
      const difference = daysBetween(
        taskStart,
        current
      );

      return (
        difference >= 0 &&
        difference % interval === 0
      );
    }

    if (type === "weekly") {
      const selectedDays = normalizeTaskWeekdays(
        task.weekdays
      );

      const effectiveDays = selectedDays.length
        ? selectedDays
        : [weekdayCodeFromDate(taskStart)];

      if (
        !effectiveDays.includes(
          weekdayCodeFromDate(current)
        )
      ) {
        return false;
      }

      const difference = Math.floor(
        daysBetween(
          startOfWeek(taskStart),
          startOfWeek(current)
        ) / 7
      );

      return (
        difference >= 0 &&
        difference % interval === 0
      );
    }

    if (type === "monthly") {
      const monthDifference =
        (
          current.getFullYear() -
          taskStart.getFullYear()
        ) * 12 +
        current.getMonth() -
        taskStart.getMonth();

      if (
        monthDifference < 0 ||
        monthDifference % interval !== 0
      ) {
        return false;
      }

      const requestedDay = Math.max(
        1,
        Math.floor(
          numberValue(
            task.day_of_month,
            taskStart.getDate()
          )
        )
      );

      const finalDay = new Date(
        current.getFullYear(),
        current.getMonth() + 1,
        0
      ).getDate();

      return (
        current.getDate() ===
        Math.min(requestedDay, finalDay)
      );
    }

    return false;
  }

  function updateTaskRepeatFields() {
    const type =
      els.taskRepeatType?.value ||
      "none";

    if (els.taskWeekdaysWrap) {
      els.taskWeekdaysWrap.style.display =
        type === "weekly"
          ? ""
          : "none";
    }

    if (els.taskDayOfMonthWrap) {
      els.taskDayOfMonthWrap.style.display =
        type === "monthly"
          ? ""
          : "none";
    }
  }

  function populateCategorySelects(
    module,
    mainElement,
    subElement,
    selectedMain = "",
    selectedSub = ""
  ) {
    if (!mainElement || !subElement) return;

    const rows = visibleCategories(module);

    const mainCategories = [
      ...new Set(
        rows
          .map((row) => row.main_category)
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "de"));

    const effectiveMain =
      mainCategories.includes(selectedMain)
        ? selectedMain
        : mainCategories[0] || "";

    mainElement.innerHTML = mainCategories
      .map((main) => {
        return (
          `<option value="${escapeHtml(main)}" ` +
          `${main === effectiveMain ? "selected" : ""}>` +
          `${escapeHtml(main)}` +
          "</option>"
        );
      })
      .join("");

    const subCategories = [
      ...new Set(
        rows
          .filter((row) => {
            return row.main_category === effectiveMain;
          })
          .map((row) => row.sub_category)
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b, "de"));

    const effectiveSub =
      subCategories.includes(selectedSub)
        ? selectedSub
        : subCategories[0] || "";

    subElement.innerHTML = subCategories
      .map((sub) => {
        return (
          `<option value="${escapeHtml(sub)}" ` +
          `${sub === effectiveSub ? "selected" : ""}>` +
          `${escapeHtml(sub)}` +
          "</option>"
        );
      })
      .join("");
  }

  function wireCategorySelects() {
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

  function representativeForGroup(group) {
    if (!group) return null;

    return (
      group.trips.find((trip) => {
        return (
          normalizePersonName(trip.owner_user) ===
          currentUserName()
        );
      }) ||
      group.representative ||
      group.trips[0] ||
      null
    );
  }

  function populateTripSelect(selectedTripId = "") {
    if (!els.tripExpenseTripId) return;

    const options = [];
    const usedValues = new Set();

    getVisibleTripGroups().forEach((group) => {
      const trip = representativeForGroup(group);

      if (
        !trip ||
        !trip.trip_id ||
        usedValues.has(String(trip.trip_id))
      ) {
        return;
      }

      usedValues.add(String(trip.trip_id));

      options.push({
        value: String(trip.trip_id),
        label:
          group.label ||
          trip.title ||
          trip.trip_id
      });
    });

    if (
      selectedTripId &&
      !usedValues.has(String(selectedTripId))
    ) {
      const selectedTrip =
        getTripCandidatesById(selectedTripId)[0];

      if (selectedTrip) {
        options.unshift({
          value: String(selectedTripId),
          label:
            getTripGroupForTrip(selectedTrip)?.label ||
            selectedTrip.title ||
            selectedTripId
        });
      }
    }

    els.tripExpenseTripId.innerHTML = options.length
      ? options
          .map((option) => {
            return `
              <option
                value="${escapeHtml(option.value)}"
                ${
                  String(option.value) === String(selectedTripId)
                    ? "selected"
                    : ""
                }
              >
                ${escapeHtml(option.label)}
              </option>
            `;
          })
          .join("")
      : '<option value="">Keine sichtbare Reise vorhanden</option>';
  }

  function actionButtons(type, record) {
    const backendId =
      type === "trip"
        ? record.trip_id
        : record.id;

    return `
      <div class="table-actions">
        <button
          type="button"
          class="btn btn-ghost btn-xs js-edit"
          data-type="${escapeHtml(type)}"
          data-key="${escapeHtml(record._clientKey)}"
        >
          Bearbeiten
        </button>

        <button
          type="button"
          class="btn btn-ghost btn-xs js-delete"
          data-type="${escapeHtml(type)}"
          data-id="${escapeHtml(backendId)}"
        >
          Löschen
        </button>
      </div>
    `;
  }

  function createSelectedMonthHighlightPlugin(selectedMonth) {
    return {
      id: "selectedMonthHighlight",

      beforeDatasetsDraw(chart) {
        if (!selectedMonth) return;

        const {
          ctx,
          chartArea,
          scales
        } = chart;

        if (!chartArea || !scales?.x) return;

        const labels =
          chart.data.labels ||
          [];

        const index =
          labels.indexOf(selectedMonth);

        if (index < 0) return;

        const xScale = scales.x;
        const center =
          xScale.getPixelForValue(index);

        const previous =
          index > 0
            ? xScale.getPixelForValue(index - 1)
            : null;

        const next =
          index < labels.length - 1
            ? xScale.getPixelForValue(index + 1)
            : null;

        let left = chartArea.left;
        let right = chartArea.right;

        if (previous != null) {
          left = (previous + center) / 2;
        } else if (next != null) {
          left = center - (next - center) / 2;
        }

        if (next != null) {
          right = (center + next) / 2;
        } else if (previous != null) {
          right = center + (center - previous) / 2;
        }

        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.08)";
        ctx.fillRect(
          left,
          chartArea.top,
          right - left,
          chartArea.bottom - chartArea.top
        );
        ctx.restore();
      }
    };
  }

  function ensureChart(name, canvasId, config) {
    const canvas = document.getElementById(canvasId);

    if (
      !canvas ||
      typeof Chart === "undefined"
    ) {
      return;
    }

    if (state.charts[name]) {
      state.charts[name].destroy();
    }

    state.charts[name] = new Chart(
      canvas,
      config
    );
  }

  function compositionMonths() {
    const mode =
      els.compositionMode?.value ||
      "month";

    if (mode === "month") {
      return [selectedAnalysisMonth()];
    }

    if (mode === "total") {
      return monthsBetween(
        DEFAULT_START_MONTH,
        currentMonth()
      );
    }

    return analysisRangeMonths();
  }

  function getDashboardMetrics(month) {
    const txRows =
      filteredTransactionsForMonth(month);

    const tripRows =
      filteredTripExpensesForMonth(month);

    const income = monthlyIncome(month);

    const txTotal = txRows.reduce(
      (sum, row) => {
        return sum + getCurrentUserAmount(row);
      },
      0
    );

    const tripTotal = tripRows.reduce(
      (sum, row) => {
        return sum + getVacationCurrentUserAmount(row);
      },
      0
    );

    const fixedCosts =
      fixedCostsMonthlyTotal(month);

    const variableCosts =
      txTotal +
      tripTotal;

    const totalExpenses =
      fixedCosts +
      variableCosts;

    const available =
      income -
      totalExpenses;

    return {
      month,
      txRows,
      tripRows,
      income,
      txTotal,
      transactionTotal: txTotal,
      tripTotal,
      fixedCosts,
      variableCosts,
      totalExpenses,
      available,
      savingsRate:
        income
          ? available / income * 100
          : 0,
      fixedRate:
        income
          ? fixedCosts / income * 100
          : 0,
      variableRate:
        income
          ? variableCosts / income * 100
          : 0,
      expenseRate:
        income
          ? totalExpenses / income * 100
          : 0,
      peerBalanceMonth:
        calculatePeerBalanceForMonth(month),
      peerBalanceOpen:
        calculateOpenPeerBalanceUntil(month)
    };
  }

  function renderKpis(metrics) {
    const percentMode = isPercentMode();

    if (els.heroAvailable) {
      els.heroAvailable.textContent =
        percentMode
          ? percent(
              toPercent(
                metrics.available,
                metrics.income
              )
            )
          : currency(metrics.available);
    }

    if (els.heroAvailableSub) {
      els.heroAvailableSub.textContent =
        metrics.available >= 0
          ? "Positiver Monatsüberschuss"
          : "Monat aktuell negativ";
    }

    if (els.heroFixedCosts) {
      els.heroFixedCosts.textContent =
        percentMode
          ? percent(metrics.fixedRate)
          : currency(metrics.fixedCosts);
    }

    if (els.heroFixedCostsSub) {
      els.heroFixedCostsSub.textContent =
        percentMode
          ? "Fixkostenquote bezogen auf Einkommen"
          : "Monatliche Fixkostenbelastung";
    }

    if (els.heroPeerBalance) {
      els.heroPeerBalance.textContent =
        currency(metrics.peerBalanceOpen);
    }

    if (els.heroPeerLabel) {
      els.heroPeerLabel.textContent =
        `Offener Saldo ${otherUserName()}`;
    }

    if (els.kpiGrid) {
      const items = percentMode
        ? [
            [
              "Einnahmen",
              currency(metrics.income),
              "Monatliche Einnahmen"
            ],
            [
              "Ausgaben gesamt",
              percent(metrics.expenseRate),
              "Haushalt + Urlaub + Fixkosten"
            ],
            [
              "Fixkosten",
              percent(metrics.fixedRate),
              "Fixkostenquote"
            ],
            [
              "Variable Kosten",
              percent(metrics.variableRate),
              "Haushalt + Urlaub"
            ],
            [
              "Sparquote",
              percent(metrics.savingsRate),
              "Einnahmen minus Ausgaben"
            ]
          ]
        : [
            [
              "Einnahmen",
              currency(metrics.income),
              "Monatliche Einnahmen"
            ],
            [
              "Ausgaben gesamt",
              currency(metrics.totalExpenses),
              "Haushalt + Urlaub + Fixkosten"
            ],
            [
              "Fixkosten",
              currency(metrics.fixedCosts),
              "Monatliche Fixkosten"
            ],
            [
              "Variable Kosten",
              currency(metrics.variableCosts),
              "Haushalt + Urlaub"
            ],
            [
              "Sparquote",
              percent(metrics.savingsRate),
              "Einnahmen minus Ausgaben"
            ]
          ];

      els.kpiGrid.innerHTML = items
        .map(([label, value, sub]) => {
          return `
            <div class="kpi-card">
              <div class="kpi-label">
                ${escapeHtml(label)}
              </div>

              <div class="kpi-value">
                ${escapeHtml(value)}
              </div>

              <div class="kpi-sub">
                ${escapeHtml(sub)}
              </div>
            </div>
          `;
        })
        .join("");
    }

    if (els.monthlySummary) {
      els.monthlySummary.innerHTML = [
        ["Analysemonat", metrics.month],
        ["Haushaltsausgaben", currency(metrics.txTotal)],
        ["Urlaubsausgaben", currency(metrics.tripTotal)],
        ["Fixkosten", currency(metrics.fixedCosts)],
        ["Variable Kosten", currency(metrics.variableCosts)],
        ["Ausgaben gesamt", currency(metrics.totalExpenses)],
        ["Überschuss", currency(metrics.available)]
      ]
        .map(([label, value]) => {
          return `
            <div class="summary-row">
              <div class="key">
                ${escapeHtml(label)}
              </div>

              <div class="val">
                ${escapeHtml(value)}
              </div>
            </div>
          `;
        })
        .join("");
    }

    if (els.insightList) {
      els.insightList.innerHTML = [
        ["Saldo Monat", currency(metrics.peerBalanceMonth)],
        ["Offener Gesamtsaldo", currency(metrics.peerBalanceOpen)],
        [
          "Fixkosten aktiv",
          `${activeFixedCostsForMonth(metrics.month).length} Positionen`
        ],
        [
          "Haushaltstransaktionen",
          String(metrics.txRows.length)
        ],
        [
          "Urlaubstransaktionen",
          String(metrics.tripRows.length)
        ]
      ]
        .map(([label, value]) => {
          return `
            <div class="summary-row">
              <div class="key">
                ${escapeHtml(label)}
              </div>

              <div class="val">
                ${escapeHtml(value)}
              </div>
            </div>
          `;
        })
        .join("");
    }
  }

  function renderDashboardCharts(metrics) {
    const months = monthRange();
    const percentMode = isPercentMode();
    const valueMode =
      percentMode
        ? "percent"
        : "currency";

    const incomeSeries =
      months.map(monthlyIncome);

    const variableRaw = months.map((month) => {
      const transactions =
        filteredTransactionsForMonth(month)
          .reduce((sum, row) => {
            return sum + getCurrentUserAmount(row);
          }, 0);

      const vacation =
        filteredTripExpensesForMonth(month)
          .reduce((sum, row) => {
            return sum + getVacationCurrentUserAmount(row);
          }, 0);

      return transactions + vacation;
    });

    const fixedRaw =
      months.map(fixedCostsMonthlyTotal);

    const totalRaw =
      variableRaw.map((value, index) => {
        return value + fixedRaw[index];
      });

    const fixedSeries =
      percentMode
        ? fixedRaw.map((value, index) => {
            return toPercent(
              value,
              incomeSeries[index]
            );
          })
        : fixedRaw;

    const variableSeries =
      percentMode
        ? variableRaw.map((value, index) => {
            return toPercent(
              value,
              incomeSeries[index]
            );
          })
        : variableRaw;

    const totalSeries =
      percentMode
        ? totalRaw.map((value, index) => {
            return toPercent(
              value,
              incomeSeries[index]
            );
          })
        : totalRaw;

    const datasets = percentMode
      ? [
          {
            label: "Totale Kosten",
            data: totalSeries,
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
      : [
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
            data: totalSeries,
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
        ];

    ensureChart("masterChart", "masterChart", {
      type: "line",
      data: {
        labels: months,
        datasets
      },
      options: chartOptions(false, valueMode),
      plugins: [
        createSelectedMonthHighlightPlugin(
          selectedAnalysisMonth()
        )
      ]
    });

    const selectedMonths =
      compositionMonths();

    const compositionIncome =
      selectedMonths.reduce((sum, month) => {
        return sum + monthlyIncome(month);
      }, 0);

    const fixedMap = new Map();

    selectedMonths.forEach((month) => {
      activeFixedCostsForMonth(month).forEach((row) => {
        const key =
          row.main_category ||
          "Ohne Kategorie";

        const value =
          getUserShareFromAmount(
            row,
            normalizeFrequency(
              row.amount,
              row.frequency
            )
          );

        fixedMap.set(
          key,
          (fixedMap.get(key) || 0) + value
        );
      });
    });

    const compositionLabel =
      els.compositionMode?.value === "month"
        ? "Analysemonat"
        : els.compositionMode?.value === "range"
          ? "Gewählter Zeitraum"
          : "Seit Startmonat bis heute";

    setText(
      els.fixedCompositionLabel,
      compositionLabel
    );

    setText(
      els.variableCompositionLabel,
      compositionLabel
    );

    ensureChart(
      "fixedCompositionChart",
      "fixedCompositionChart",
      {
        type: "bar",
        data: {
          labels: [...fixedMap.keys()],
          datasets: [
            {
              label:
                percentMode
                  ? "Fixkosten %"
                  : "Fixkosten",

              data: [...fixedMap.values()]
                .map((value) => {
                  return percentMode
                    ? toPercent(
                        value,
                        compositionIncome
                      )
                    : value;
                }),

              backgroundColor:
                "rgba(255,190,61,.82)"
            }
          ]
        },
        options: chartOptions(false, valueMode)
      }
    );

    const compositionRows = [];

    selectedMonths.forEach((month) => {
      compositionRows.push(
        ...filteredTransactionsForMonth(month)
      );

      compositionRows.push(
        ...filteredTripExpensesForMonth(month)
      );
    });

    const variableMap = new Map();

    compositionRows.forEach((row) => {
      const key =
        row.main_category ||
        "Ohne Kategorie";

      variableMap.set(
        key,
        (variableMap.get(key) || 0) +
        getRowCurrentUserAmount(row)
      );
    });

    ensureChart(
      "variableCompositionChart",
      "variableCompositionChart",
      {
        type: "bar",
        data: {
          labels: [...variableMap.keys()],
          datasets: [
            {
              label:
                percentMode
                  ? "Variable Kosten %"
                  : "Variable Kosten",

              data: [...variableMap.values()]
                .map((value) => {
                  return percentMode
                    ? toPercent(
                        value,
                        compositionIncome
                      )
                    : value;
                }),

              backgroundColor:
                "rgba(79,124,255,.82)"
            }
          ]
        },
        options: chartOptions(false, valueMode)
      }
    );

    const variableRows =
      metrics.txRows.concat(metrics.tripRows);

    const selectedMainCategory =
      els.filterMainCategory?.value ||
      "";

    const categoryData =
      selectedMainCategory
        ? aggregateSubcategories(
            variableRows,
            selectedMainCategory
          )
        : aggregateCategories(variableRows);

    ensureChart(
      "categoryBreakdownChart",
      "categoryBreakdownChart",
      {
        type: "bar",
        data: {
          labels: categoryData.map(([label]) => label),
          datasets: [
            {
              label:
                selectedMainCategory
                  ? (
                      `Unterkategorien ${selectedMainCategory}` +
                      `${percentMode ? " %" : ""}`
                    )
                  : (
                      `Hauptkategorien` +
                      `${percentMode ? " %" : ""}`
                    ),

              data: categoryData.map(([, value]) => {
                return percentMode
                  ? toPercent(
                      value,
                      metrics.income
                    )
                  : value;
              }),

              backgroundColor:
                "rgba(97,201,255,.82)"
            }
          ]
        },
        options: chartOptions(false, valueMode)
      }
    );
  }

  function renderCategoryTable(rows) {
    if (!els.categoryTableBody) return;

    const aggregate =
      aggregateCategories(rows);

    const total =
      aggregate.reduce((sum, [, value]) => {
        return sum + value;
      }, 0) || 1;

    els.categoryTableBody.innerHTML =
      aggregate.length
        ? aggregate
            .map(([name, value]) => {
              return `
                <tr>
                  <td>${escapeHtml(name)}</td>
                  <td>${escapeHtml(currency(value))}</td>
                  <td>
                    ${escapeHtml(
                      percent(value / total * 100)
                    )}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="3" class="table-empty">' +
            "Keine Daten vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderMonthOverviewTable(metrics) {
    if (!els.monthOverviewTableBody) return;

    const percentMode = isPercentMode();
    const income = metrics.income || 0;

    const rows = [
      [
        "Einnahmen",
        percentMode
          ? "100,0 %"
          : currency(metrics.income)
      ],
      [
        "Haushalt",
        percentMode
          ? percent(
              toPercent(metrics.txTotal, income)
            )
          : currency(metrics.txTotal)
      ],
      [
        "Urlaub",
        percentMode
          ? percent(
              toPercent(metrics.tripTotal, income)
            )
          : currency(metrics.tripTotal)
      ],
      [
        "Fixkosten",
        percentMode
          ? percent(
              toPercent(metrics.fixedCosts, income)
            )
          : currency(metrics.fixedCosts)
      ],
      [
        "Variable Kosten",
        percentMode
          ? percent(
              toPercent(metrics.variableCosts, income)
            )
          : currency(metrics.variableCosts)
      ],
      [
        "Gesamtausgaben",
        percentMode
          ? percent(
              toPercent(metrics.totalExpenses, income)
            )
          : currency(metrics.totalExpenses)
      ],
      [
        "Überschuss",
        percentMode
          ? percent(
              toPercent(metrics.available, income)
            )
          : currency(metrics.available)
      ],
      [
        "Saldo Monat",
        currency(metrics.peerBalanceMonth)
      ],
      [
        "Offener Gesamtsaldo",
        currency(metrics.peerBalanceOpen)
      ]
    ];

    els.monthOverviewTableBody.innerHTML =
      rows
        .map(([label, value]) => {
          return `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(value)}</td>
            </tr>
          `;
        })
        .join("");
  }

  function renderRangeOverviewTable() {
    if (!els.rangeOverviewTableBody) return;

    const months = analysisRangeMonths();

    const income = months.reduce((sum, month) => {
      return sum + monthlyIncome(month);
    }, 0);

    const transactionTotal = months.reduce((sum, month) => {
      return (
        sum +
        filteredTransactionsForMonth(month)
          .reduce((inner, row) => {
            return inner + getCurrentUserAmount(row);
          }, 0)
      );
    }, 0);

    const tripTotal = months.reduce((sum, month) => {
      return (
        sum +
        filteredTripExpensesForMonth(month)
          .reduce((inner, row) => {
            return inner + getVacationCurrentUserAmount(row);
          }, 0)
      );
    }, 0);

    const fixedCosts = months.reduce((sum, month) => {
      return sum + fixedCostsMonthlyTotal(month);
    }, 0);

    const variableCosts =
      transactionTotal +
      tripTotal;

    const totalExpenses =
      variableCosts +
      fixedCosts;

    const available =
      income -
      totalExpenses;

    const percentMode =
      isPercentMode();

    const rows = [
      [
        "Einnahmen",
        percentMode
          ? "100,0 %"
          : currency(income)
      ],
      [
        "Haushalt",
        percentMode
          ? percent(
              toPercent(transactionTotal, income)
            )
          : currency(transactionTotal)
      ],
      [
        "Urlaub",
        percentMode
          ? percent(
              toPercent(tripTotal, income)
            )
          : currency(tripTotal)
      ],
      [
        "Fixkosten",
        percentMode
          ? percent(
              toPercent(fixedCosts, income)
            )
          : currency(fixedCosts)
      ],
      [
        "Variable Kosten",
        percentMode
          ? percent(
              toPercent(variableCosts, income)
            )
          : currency(variableCosts)
      ],
      [
        "Gesamtausgaben",
        percentMode
          ? percent(
              toPercent(totalExpenses, income)
            )
          : currency(totalExpenses)
      ],
      [
        "Überschuss",
        percentMode
          ? percent(
              toPercent(available, income)
            )
          : currency(available)
      ],
      [
        "Offener Gesamtsaldo",
        currency(
          calculateOpenPeerBalanceUntil(
            selectedAnalysisMonth()
          )
        )
      ]
    ];

    els.rangeOverviewTableBody.innerHTML =
      rows
        .map(([label, value]) => {
          return `
            <tr>
              <td>${escapeHtml(label)}</td>
              <td>${escapeHtml(value)}</td>
            </tr>
          `;
        })
        .join("");
  }

  function renderCategoryCompareTable(
    month,
    transactionRows,
    tripRows
  ) {
    if (!els.categoryCompareTableBody) return;

    const monthAggregate = new Map(
      aggregateCategories(
        transactionRows.concat(tripRows)
      )
    );

    const rangeAggregate = new Map();

    analysisRangeMonths().forEach((itemMonth) => {
      aggregateCategories(
        filteredTransactionsForMonth(itemMonth)
          .concat(
            filteredTripExpensesForMonth(itemMonth)
          )
      ).forEach(([key, value]) => {
        rangeAggregate.set(
          key,
          (rangeAggregate.get(key) || 0) + value
        );
      });
    });

    const keys = [
      ...new Set([
        ...monthAggregate.keys(),
        ...rangeAggregate.keys()
      ])
    ].sort((a, b) => a.localeCompare(b, "de"));

    const monthIncome =
      monthlyIncome(month);

    const rangeIncome =
      analysisRangeMonths().reduce((sum, itemMonth) => {
        return sum + monthlyIncome(itemMonth);
      }, 0);

    const percentMode =
      isPercentMode();

    els.categoryCompareTableBody.innerHTML =
      keys.length
        ? keys
            .map((key) => {
              const monthValue =
                monthAggregate.get(key) || 0;

              const rangeValue =
                rangeAggregate.get(key) || 0;

              return `
                <tr>
                  <td>${escapeHtml(key)}</td>

                  <td>
                    ${
                      escapeHtml(
                        percentMode
                          ? percent(
                              toPercent(
                                monthValue,
                                monthIncome
                              )
                            )
                          : currency(monthValue)
                      )
                    }
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        percentMode
                          ? percent(
                              toPercent(
                                rangeValue,
                                rangeIncome
                              )
                            )
                          : currency(rangeValue)
                      )
                    }
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="3" class="table-empty">' +
            "Keine Daten vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function getHousingTransactionRowsForMonth(month) {
    return (state.data.transactions || [])
      .filter((row) => !isDeleted(row))
      .filter(isExpenseBooking)
      .filter((row) => {
        return String(row.main_category || "") === "Wohnen";
      })
      .filter((row) => {
        return String(row.sub_category || "") !== "Kaution";
      })
      .filter((row) => {
        return monthFromDate(
          row.month_key ||
          row.date
        ) === month;
      });
  }

  function getHousingFixedRowsForMonth(month) {
    return (state.data.fixedCosts || [])
      .filter((row) => !isDeleted(row))
      .filter((row) => {
        return String(row.main_category || "") === "Wohnen";
      })
      .filter((row) => {
        return String(row.sub_category || "") !== "Kaution";
      })
      .filter((row) => {
        const startMonth =
          monthFromDate(row.start_month);

        const endMonth =
          monthFromDate(row.end_month);

        if (
          startMonth &&
          month < startMonth
        ) {
          return false;
        }

        if (
          endMonth &&
          month > endMonth
        ) {
          return false;
        }

        return true;
      });
  }

  function getCombinedHousingCategoryMapForMonth(month) {
    const values = new Map();

    getHousingTransactionRowsForMonth(month)
      .forEach((row) => {
        const key =
          row.sub_category ||
          "Ohne Unterkategorie";

        values.set(
          key,
          (values.get(key) || 0) +
          numberValue(row.amount)
        );
      });

    getHousingFixedRowsForMonth(month)
      .forEach((row) => {
        const key =
          row.sub_category ||
          "Ohne Unterkategorie";

        values.set(
          key,
          (values.get(key) || 0) +
          normalizeFrequency(
            row.amount,
            row.frequency
          )
        );
      });

    return values;
  }

  function computeHousingOverviewData() {
    const months = monthRange();
    const analysisMonth =
      selectedAnalysisMonth();

    const monthMap =
      getCombinedHousingCategoryMapForMonth(
        analysisMonth
      );

    const monthTotal =
      [...monthMap.values()]
        .reduce((sum, value) => {
          return sum + value;
        }, 0);

    const totalPerMonth = months.map((month) => {
      return [
        ...getCombinedHousingCategoryMapForMonth(month)
          .values()
      ].reduce((sum, value) => {
        return sum + value;
      }, 0);
    });

    const averageTotal =
      months.length
        ? totalPerMonth.reduce((sum, value) => {
            return sum + value;
          }, 0) / months.length
        : 0;

    const categoryKeys = new Set();

    months.forEach((month) => {
      getCombinedHousingCategoryMapForMonth(month)
        .forEach((_, key) => {
          categoryKeys.add(key);
        });
    });

    return {
      months,
      analysisMonth,
      monthMap,
      monthTotal,
      averageTotal,
      categoryKeys: [...categoryKeys]
        .sort((a, b) => a.localeCompare(b, "de"))
    };
  }

  function renderHousingOverview() {
    const data =
      computeHousingOverviewData();

    const displayMode =
      selectedHousingDisplayMode();

    setText(
      els.housingMonthTotal,
      currency(data.monthTotal)
    );

    setText(
      els.housingAverageTotal,
      currency(data.averageTotal)
    );

    setText(
      els.housingCategoryCount,
      String(data.categoryKeys.length)
    );

    if (els.housingMonthTableBody) {
      const entries = [...data.monthMap.entries()]
        .sort((a, b) => b[1] - a[1]);

      els.housingMonthTableBody.innerHTML =
        entries.length
          ? entries
              .map(([name, value]) => {
                return `
                  <tr>
                    <td>${escapeHtml(name)}</td>

                    <td>
                      ${
                        escapeHtml(
                          displayMode === "percent"
                            ? percent(
                                data.monthTotal
                                  ? value / data.monthTotal * 100
                                  : 0
                              )
                            : currency(value)
                        )
                      }
                    </td>

                    <td>
                      ${
                        escapeHtml(
                          percent(
                            data.monthTotal
                              ? value / data.monthTotal * 100
                              : 0
                          )
                        )
                      }
                    </td>
                  </tr>
                `;
              })
              .join("")
          : (
              '<tr>' +
              '<td colspan="3" class="table-empty">' +
              "Keine Wohndaten vorhanden" +
              "</td>" +
              "</tr>"
            );
    }

    const totalSeriesRaw = data.months.map((month) => {
      return [
        ...getCombinedHousingCategoryMapForMonth(month)
          .values()
      ].reduce((sum, value) => {
        return sum + value;
      }, 0);
    });

    const colors = [
      "rgba(79,124,255,0.95)",
      "rgba(255,190,61,0.95)",
      "rgba(19,194,150,0.95)",
      "rgba(255,109,122,0.95)",
      "rgba(97,201,255,0.95)",
      "rgba(159,122,234,0.95)",
      "rgba(249,115,22,0.95)"
    ];

    const totalSeries =
      displayMode === "percent"
        ? totalSeriesRaw.map((value) => {
            return value > 0 ? 100 : 0;
          })
        : totalSeriesRaw;

    const datasets = [
      {
        label: "Gesamtkosten Wohnen",
        data: totalSeries,
        borderColor: "rgba(255,255,255,0.95)",
        backgroundColor: "rgba(255,255,255,0.15)",
        fill: false,
        tension: 0.25
      }
    ];

    data.categoryKeys.forEach((key, index) => {
      const rawValues = data.months.map((month) => {
        return (
          getCombinedHousingCategoryMapForMonth(month)
            .get(key) ||
          0
        );
      });

      const values =
        displayMode === "percent"
          ? rawValues.map((value, itemIndex) => {
              return totalSeriesRaw[itemIndex]
                ? value / totalSeriesRaw[itemIndex] * 100
                : 0;
            })
          : rawValues;

      datasets.push({
        label: key,
        data: values,
        borderColor: colors[index % colors.length],
        backgroundColor: colors[index % colors.length],
        fill: false,
        tension: 0.25
      });
    });

    ensureChart(
      "housingTrendChart",
      "housingTrendChart",
      {
        type: "line",
        data: {
          labels: data.months,
          datasets
        },
        options: chartOptions(
          false,
          displayMode === "percent"
            ? "percent"
            : "currency"
        )
      }
    );
  }

  function getVacationAvailableYears() {
    const years = new Set();

    getVisibleTripGroups().forEach((group) => {
      const year =
        String(group.startDate || "").slice(0, 4);

      if (year) years.add(year);
    });

    (state.data.tripExpenses || [])
      .filter(isVisibleTripExpense)
      .forEach((row) => {
        const year =
          normalizeDateOnly(row.date).slice(0, 4);

        if (year) years.add(year);
      });

    if (!years.size) {
      years.add(String(currentYear()));
    }

    return [...years]
      .sort((a, b) => Number(b) - Number(a));
  }

  function selectedVacationYear() {
    return (
      els.vacationYearSelect?.value ||
      String(currentYear())
    );
  }

  function groupsForVacationYear(year) {
    return getVisibleTripGroups().filter((group) => {
      return (
        String(group.startDate || "").slice(0, 4) ===
        String(year)
      );
    });
  }

  function populateVacationAnalysisSelect() {
    if (
      !els.vacationYearSelect ||
      !els.vacationAnalysisSelect
    ) {
      return;
    }

    const years =
      getVacationAvailableYears();

    const previousYear =
      els.vacationYearSelect.value;

    const currentYearString =
      String(currentYear());

    els.vacationYearSelect.innerHTML =
      years
        .map((year) => {
          return (
            `<option value="${escapeHtml(year)}">` +
            `${escapeHtml(year)}` +
            "</option>"
          );
        })
        .join("");

    els.vacationYearSelect.value =
      years.includes(previousYear)
        ? previousYear
        : years.includes(currentYearString)
          ? currentYearString
          : years[0];

    const groups =
      groupsForVacationYear(
        els.vacationYearSelect.value
      );

    const previousSelection =
      els.vacationAnalysisSelect.value;

    els.vacationAnalysisSelect.innerHTML =
      '<option value="year">' +
      "Alle Urlaube im gewählten Jahr" +
      "</option>" +
      groups
        .map((group) => {
          return (
            `<option value="group:${escapeHtml(group.key)}">` +
            `${escapeHtml(group.label || "Reise")}` +
            "</option>"
          );
        })
        .join("");

    const validValues = [
      "year",
      ...groups.map((group) => `group:${group.key}`)
    ];

    els.vacationAnalysisSelect.value =
      validValues.includes(previousSelection)
        ? previousSelection
        : "year";
  }

  function resolveSelectedVacationGroups() {
    const groups =
      groupsForVacationYear(
        selectedVacationYear()
      );

    const value =
      els.vacationAnalysisSelect?.value ||
      "year";

    if (value === "year") {
      return groups;
    }

    if (value.startsWith("group:")) {
      const key = value.slice(6);

      return groups.filter((group) => {
        return group.key === key;
      });
    }

    return groups;
  }

  function getVacationCategoryBucket(row) {
    const sub = normalizedTripText(
      row?.sub_category
    );

    const main = normalizedTripText(
      row?.main_category
    );

    const combined =
      `${main} ${sub}`;

    if (
      combined.includes("transport") ||
      combined.includes("flug") ||
      combined.includes("bahn") ||
      combined.includes("mietwagen")
    ) {
      return "Transport";
    }

    if (
      combined.includes("unterkunft") ||
      combined.includes("hotel") ||
      combined.includes("wohnung")
    ) {
      return "Unterkunft";
    }

    if (
      combined.includes("essen") ||
      combined.includes("restaurant") ||
      combined.includes("lebensmittel")
    ) {
      return "Essen";
    }

    if (
      combined.includes("aktiv") ||
      combined.includes("ausflug") ||
      combined.includes("eintritt")
    ) {
      return "Aktivitäten";
    }

    return "Sonstiges";
  }

  function createVacationCategoryAccumulator() {
    return VACATION_BUCKETS.reduce((result, bucket) => {
      result[bucket] = {
        total: 0,
        max: 0,
        jana: 0
      };

      return result;
    }, {});
  }

  function computeVacationOverviewData() {
    const relevantGroups =
      resolveSelectedVacationGroups();

    const selectedKeys = new Set(
      relevantGroups.map((group) => group.key)
    );

    const relevantExpenses =
      (state.data.tripExpenses || [])
        .filter(isVisibleTripExpense)
        .filter((row) => {
          const group =
            getTripGroupForExpense(row);

          return (
            group &&
            selectedKeys.has(group.key)
          );
        });

    const categories =
      createVacationCategoryAccumulator();

    relevantExpenses.forEach((row) => {
      const bucket =
        getVacationCategoryBucket(row);

      const shares =
        getVacationExpenseShares(row);

      categories[bucket].total += shares.total;
      categories[bucket].max += shares[PERSON_A] || 0;
      categories[bucket].jana += shares[PERSON_B] || 0;
    });

    const totals =
      Object.values(categories).reduce(
        (result, category) => {
          result.total += category.total;
          result.max += category.max;
          result.jana += category.jana;

          return result;
        },
        {
          total: 0,
          max: 0,
          jana: 0
        }
      );

    const isYearSelection =
      (
        els.vacationAnalysisSelect?.value ||
        "year"
      ) === "year";

    const hasSharedTrip =
      relevantGroups.length === 1 &&
      relevantGroups[0]?.shared;

    const currentUserTotal =
      currentUserName() === PERSON_A
        ? totals.max
        : totals.jana;

    return {
      relevantGroups,
      relevantExpenses,
      categories,
      totals,
      isYearSelection,
      hasSharedTrip,
      currentUserTotal
    };
  }

  function computeVacationChartData(
    data = computeVacationOverviewData()
  ) {
    const showThreeBars =
      data.hasSharedTrip &&
      !data.isYearSelection;

    const labels =
      showThreeBars
        ? [
            "Gesamt",
            PERSON_A,
            PERSON_B
          ]
        : [currentUserName()];

    const bucketData = {};

    VACATION_BUCKETS.forEach((bucket) => {
      if (showThreeBars) {
        bucketData[bucket] = [
          data.categories[bucket].total,
          data.categories[bucket].max,
          data.categories[bucket].jana
        ];
      } else {
        bucketData[bucket] = [
          currentUserName() === PERSON_A
            ? data.categories[bucket].max
            : data.categories[bucket].jana
        ];
      }
    });

    return {
      data,
      showThreeBars,
      labels,
      bucketData
    };
  }

  function hexToRgba(hex, alpha) {
    const value =
      String(hex || "").replace("#", "");

    if (!/^[0-9a-f]{6}$/i.test(value)) {
      return `rgba(255,255,255,${alpha})`;
    }

    return (
      `rgba(` +
      `${parseInt(value.slice(0, 2), 16)},` +
      `${parseInt(value.slice(2, 4), 16)},` +
      `${parseInt(value.slice(4, 6), 16)},` +
      `${alpha}` +
      `)`
    );
  }

  function createCanvasPattern(canvas, type, color) {
    if (!canvas) return color;

    const context =
      canvas.getContext("2d");

    if (!context) return color;

    const patternCanvas =
      document.createElement("canvas");

    patternCanvas.width = 18;
    patternCanvas.height = 18;

    const patternContext =
      patternCanvas.getContext("2d");

    if (!patternContext) return color;

    patternContext.fillStyle =
      hexToRgba(color, 0.18);

    patternContext.fillRect(
      0,
      0,
      18,
      18
    );

    patternContext.fillStyle = color;
    patternContext.strokeStyle = color;
    patternContext.lineWidth = 2;

    if (type === "dotted") {
      [
        [4, 4],
        [13, 13]
      ].forEach(([x, y]) => {
        patternContext.beginPath();
        patternContext.arc(
          x,
          y,
          2,
          0,
          Math.PI * 2
        );
        patternContext.fill();
      });
    } else {
      for (
        let offset = -18;
        offset <= 18;
        offset += 7
      ) {
        patternContext.beginPath();

        patternContext.moveTo(
          offset,
          18
        );

        patternContext.lineTo(
          offset + 18,
          0
        );

        patternContext.stroke();
      }
    }

    return (
      context.createPattern(
        patternCanvas,
        "repeat"
      ) ||
      color
    );
  }

  function renderVacationLabels(data) {
    setText(
      els.vacationSectionTitle,
      "Urlaubsanalyse"
    );

    setText(
      els.vacationSectionSubtitle,
      "Kennzahlen und Kostenaufteilung nach Jahr und Urlaub"
    );

    if (data.isYearSelection) {
      setText(
        els.vacationTotalCostLabel,
        "Eigene Urlaubsausgaben"
      );

      setText(
        els.vacationTotalCostSub,
        `Eigener Anteil für ${selectedVacationYear()}`
      );

      setText(
        els.vacationTripCountLabel,
        "Urlaube in Auswahl"
      );

      setText(
        els.vacationTripCountSub,
        "Sichtbare Reisen im gewählten Jahr"
      );

      setText(
        els.vacationKpiTitle,
        "Eigene Kosten nach Kategorie"
      );

      setText(
        els.vacationKpiSubtitle,
        "Persönlicher Anteil über alle ausgewählten Urlaube"
      );

      setText(
        els.vacationChartTitle,
        "Eigene Urlaubskosten nach Kategorie"
      );

      setText(
        els.vacationChartSubtitle,
        "Gestapelte Kategorien in €"
      );

      return;
    }

    if (data.hasSharedTrip) {
      setText(
        els.vacationTotalCostLabel,
        "Gesamtausgaben Urlaub"
      );

      setText(
        els.vacationTotalCostSub,
        "Gesamtkosten beider Nutzer"
      );

      setText(
        els.vacationTripCountLabel,
        "Ausgaben pro Person"
      );

      setText(
        els.vacationTripCountSub,
        `${PERSON_A} / ${PERSON_B}`
      );

      setText(
        els.vacationKpiTitle,
        "Kostenaufteilung nach Kategorie"
      );

      setText(
        els.vacationKpiSubtitle,
        "Gesamt und pro Person für den ausgewählten Urlaub"
      );

      setText(
        els.vacationChartTitle,
        "Kostenverteilung des ausgewählten Urlaubs"
      );

      setText(
        els.vacationChartSubtitle,
        "Gesamt und beide Nutzer als separate, gestapelte Säulen"
      );

      return;
    }

    setText(
      els.vacationTotalCostLabel,
      "Eigene Ausgaben Urlaub"
    );

    setText(
      els.vacationTotalCostSub,
      "Persönliche Kosten des ausgewählten Urlaubs"
    );

    setText(
      els.vacationTripCountLabel,
      "Ausgewählter Urlaub"
    );

    setText(
      els.vacationTripCountSub,
      data.relevantGroups[0]?.label ||
      "Einzelreise"
    );

    setText(
      els.vacationKpiTitle,
      "Kostenaufteilung nach Kategorie"
    );

    setText(
      els.vacationKpiSubtitle,
      "Eigener Anteil für den ausgewählten Urlaub"
    );

    setText(
      els.vacationChartTitle,
      "Kosten des ausgewählten Urlaubs"
    );

    setText(
      els.vacationChartSubtitle,
      "Gestapelte Kategorien in €"
    );
  }

  function renderVacationOverview() {
    const data =
      computeVacationOverviewData();

    renderVacationLabels(data);

    if (els.vacationTotalCost) {
      els.vacationTotalCost.textContent =
        currency(
          data.isYearSelection
            ? data.currentUserTotal
            : data.hasSharedTrip
              ? data.totals.total
              : data.currentUserTotal
        );
    }

    if (els.vacationTripCount) {
      els.vacationTripCount.textContent =
        data.isYearSelection
          ? String(data.relevantGroups.length)
          : data.hasSharedTrip
            ? (
                `${currency(data.totals.max)} / ` +
                `${currency(data.totals.jana)}`
              )
            : data.relevantGroups.length
              ? "1"
              : "0";
    }

    if (els.vacationKpiTableBody) {
      const ownTotal =
        data.currentUserTotal ||
        1;

      const total =
        data.totals.total ||
        1;

      const maxTotal =
        data.totals.max ||
        1;

      const janaTotal =
        data.totals.jana ||
        1;

      const summary =
        data.isYearSelection
          ? `
            <tr>
              <td>
                <strong>Eigene Ausgaben gesamt</strong>
              </td>

              <td>
                ${escapeHtml(currency(data.currentUserTotal))}
              </td>

              <td>
                100,0 %
              </td>
            </tr>
          `
          : data.hasSharedTrip
            ? `
              <tr>
                <td>
                  <strong>Ausgaben gesamt Urlaub</strong>
                </td>

                <td>
                  Gesamt ${escapeHtml(currency(data.totals.total))}
                  <br>

                  ${escapeHtml(PERSON_A)}
                  ${escapeHtml(currency(data.totals.max))}
                  <br>

                  ${escapeHtml(PERSON_B)}
                  ${escapeHtml(currency(data.totals.jana))}
                </td>

                <td>
                  Gesamt 100,0 %
                  <br>

                  ${escapeHtml(PERSON_A)}
                  ${
                    escapeHtml(
                      percent(
                        data.totals.max / total * 100
                      )
                    )
                  }
                  <br>

                  ${escapeHtml(PERSON_B)}
                  ${
                    escapeHtml(
                      percent(
                        data.totals.jana / total * 100
                      )
                    )
                  }
                </td>
              </tr>
            `
            : `
              <tr>
                <td>
                  <strong>Eigene Ausgaben gesamt</strong>
                </td>

                <td>
                  ${escapeHtml(currency(data.currentUserTotal))}
                </td>

                <td>
                  100,0 %
                </td>
              </tr>
            `;

      const categoryRows =
        VACATION_BUCKETS
          .map((bucket) => {
            const category =
              data.categories[bucket];

            if (
              !data.isYearSelection &&
              data.hasSharedTrip
            ) {
              return `
                <tr>
                  <td>
                    ${escapeHtml(bucket)}
                  </td>

                  <td>
                    Gesamt
                    ${escapeHtml(currency(category.total))}
                    <br>

                    ${escapeHtml(PERSON_A)}
                    ${escapeHtml(currency(category.max))}
                    <br>

                    ${escapeHtml(PERSON_B)}
                    ${escapeHtml(currency(category.jana))}
                  </td>

                  <td>
                    Gesamt
                    ${
                      escapeHtml(
                        percent(
                          category.total / total * 100
                        )
                      )
                    }
                    <br>

                    ${escapeHtml(PERSON_A)}
                    ${
                      escapeHtml(
                        percent(
                          category.max / maxTotal * 100
                        )
                      )
                    }
                    <br>

                    ${escapeHtml(PERSON_B)}
                    ${
                      escapeHtml(
                        percent(
                          category.jana / janaTotal * 100
                        )
                      )
                    }
                  </td>
                </tr>
              `;
            }

            const ownValue =
              currentUserName() === PERSON_A
                ? category.max
                : category.jana;

            return `
              <tr>
                <td>
                  ${escapeHtml(bucket)}
                </td>

                <td>
                  ${escapeHtml(currency(ownValue))}
                </td>

                <td>
                  ${
                    escapeHtml(
                      percent(
                        ownValue / ownTotal * 100
                      )
                    )
                  }
                </td>
              </tr>
            `;
          })
          .join("");

      els.vacationKpiTableBody.innerHTML =
        summary +
        categoryRows;
    }

    const chartData =
      computeVacationChartData(data);

    const canvas =
      document.getElementById(
        "vacationCompositionChart"
      );

    const colors = {
      Transport: "#4f7cff",
      Unterkunft: "#ffbe3d",
      Essen: "#13c296",
      Aktivitäten: "#ff6d7a",
      Sonstiges: "#61c9ff"
    };

    const datasets =
      VACATION_BUCKETS.map((bucket) => {
        const color = colors[bucket];

        return {
          label: bucket,
          data: chartData.bucketData[bucket],

          backgroundColor:
            chartData.showThreeBars
              ? [
                  color,
                  createCanvasPattern(
                    canvas,
                    "dotted",
                    color
                  ),
                  createCanvasPattern(
                    canvas,
                    "striped",
                    color
                  )
                ]
              : color,

          borderColor:
            chartData.showThreeBars
              ? [
                  color,
                  color,
                  color
                ]
              : color,

          borderWidth: 1,
          stack: "vacationSummary"
        };
      });

    ensureChart(
      "vacationCompositionChart",
      "vacationCompositionChart",
      {
        type: "bar",

        data: {
          labels: chartData.labels,
          datasets
        },

        options: chartOptions(
          true,
          "currency"
        )
      }
    );
  }

  function getTransactionsForTable() {
    return (state.data.transactions || [])
      .filter(isVisibleTransaction)
      .sort((a, b) => {
        return String(b.date || "").localeCompare(
          String(a.date || "")
        );
      })
      .slice(0, 10);
  }

  function getTripsForTable() {
    return (state.data.trips || [])
      .filter(isVisibleTrip)
      .sort((a, b) => {
        return String(b.start_date || "").localeCompare(
          String(a.start_date || "")
        );
      });
  }

  function getTripExpensesForTable() {
    return (state.data.tripExpenses || [])
      .filter(isVisibleTripExpense)
      .sort((a, b) => {
        return String(b.date || "").localeCompare(
          String(a.date || "")
        );
      })
      .slice(0, 10);
  }

  function getIncomeForTable() {
    return (state.data.income || [])
      .filter(isVisibleIncome)
      .sort((a, b) => {
        return String(b.date || "").localeCompare(
          String(a.date || "")
        );
      })
      .slice(0, 10);
  }

  function getAllVisibleCategoriesForTable() {
    return visibleCategories("Haushalt")
      .concat(
        visibleCategories("Urlaub")
      )
      .sort((a, b) => {
        return (
          `${a.module} ${a.main_category} ${a.sub_category}`
            .localeCompare(
              `${b.module} ${b.main_category} ${b.sub_category}`,
              "de"
            )
        );
      });
  }

  function getAllVisibleFixedCostsForTable() {
    return (state.data.fixedCosts || [])
      .filter(isVisibleFixedCost)
      .sort((a, b) => {
        return String(a.title || "").localeCompare(
          String(b.title || ""),
          "de"
        );
      });
  }

  function renderHouseholdWeekOverview() {
    if (!els.householdWeekGrid) return;

    const week =
      getCurrentWeekTasks();

    if (
      week.length &&
      els.householdWeekSubtitle
    ) {
      els.householdWeekSubtitle.textContent =
        `${formatGermanDate(week[0].date)} bis ` +
        `${formatGermanDate(week[6].date)}`;
    }

    const today =
      todayDate();

    els.householdWeekGrid.innerHTML =
      week
        .map((day, index) => {
          return `
            <div
              class="task-day-card${
                localDateKey(day.date) === today
                  ? " is-today"
                  : ""
              }"
            >
              <div class="task-day-head">
                <div class="task-day-name">
                  ${escapeHtml(WEEKDAY_NAMES[index])}
                </div>

                <div class="task-day-date">
                  ${escapeHtml(formatGermanDate(day.date))}
                </div>
              </div>

              <div class="task-day-list">
                ${
                  day.tasks.length
                    ? day.tasks
                        .map((task) => {
                          return `
                            <div
                              class="task-chip ${taskAssignedClass(task)}"
                              title="${escapeHtml(
                                task.description ||
                                task.note ||
                                ""
                              )}"
                            >
                              <span class="task-chip-time">
                                ${
                                  escapeHtml(
                                    task.due_time ||
                                    "ohne Uhrzeit"
                                  )
                                }
                              </span>

                              <span class="task-chip-title">
                                ${escapeHtml(task.title || "")}
                              </span>

                              <span class="task-chip-meta">
                                ${escapeHtml(taskAssignedLabel(task))}
                              </span>
                            </div>
                          `;
                        })
                        .join("")
                    : '<div class="task-empty">Keine Aufgaben</div>'
                }
              </div>
            </div>
          `;
        })
        .join("");
  }

  function renderTasksTable() {
    if (!els.taskTableBody) return;

    const rows =
      getVisibleTasks();

    els.taskTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              return `
                <tr>
                  <td>
                    ${escapeHtml(row.title || "")}
                  </td>

                  <td>
                    <span
                      class="task-assignee-pill ${taskAssignedClass(row)}"
                    >
                      ${escapeHtml(taskAssignedLabel(row))}
                    </span>
                  </td>

                  <td>
                    ${escapeHtml(recurrenceText(row))}
                  </td>

                  <td>
                    ${escapeHtml(taskRangeText(row))}
                  </td>

                  <td>
                    ${escapeHtml(row.due_time || "—")}
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        String(row.status || "active") === "active"
                          ? "Aktiv"
                          : "Inaktiv"
                      )
                    }
                  </td>

                  <td>
                    ${actionButtons("task", row)}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="7" class="table-empty">' +
            "Noch keine Aufgaben vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderTransactionsTable() {
    if (!els.transactionsTableBody) return;

    const rows =
      getTransactionsForTable();

    els.transactionsTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              return `
                <tr>
                  <td>
                    ${escapeHtml(formatGermanDate(row.date))}
                  </td>

                  <td>
                    ${escapeHtml(row.title || "")}
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        isSettlement(row)
                          ? `Verrechnung / ${row.counterparty || otherUserName()}`
                          : (
                              `${row.main_category || "—"} / ` +
                              `${row.sub_category || "—"}`
                            )
                      )
                    }
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        isSettlement(row)
                          ? currency(row.amount)
                          : currency(getCurrentUserAmount(row))
                      )
                    }
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        normalizePersonName(row.paid_by || "") ||
                        "—"
                      )
                    }
                  </td>

                  <td>
                    ${actionButtons("transaction", row)}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="6" class="table-empty">' +
            "Noch keine Haushaltsbuchungen vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderTripsTable() {
    if (!els.tripsTableBody) return;

    const rows =
      getTripsForTable();

    els.tripsTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              return `
                <tr>
                  <td>
                    ${escapeHtml(row.title || "")}
                    ${
                      isSharedTrip(row)
                        ? ' <span class="pill">gemeinsam</span>'
                        : ""
                    }
                  </td>

                  <td>
                    ${escapeHtml(row.destination || "")}
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        `${formatGermanDate(row.start_date)} – ` +
                        `${formatGermanDate(row.end_date)}`
                      )
                    }
                  </td>

                  <td>
                    ${escapeHtml(currency(row.planned_budget))}
                  </td>

                  <td>
                    ${actionButtons("trip", row)}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="5" class="table-empty">' +
            "Noch keine Reisen vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderTripExpensesTable() {
    if (!els.tripExpensesTableBody) return;

    const rows =
      getTripExpensesForTable();

    els.tripExpensesTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              const trip =
                getTripForExpense(row);

              const group =
                getTripGroupForExpense(row);

              const displayAmount =
                group?.shared
                  ? numberValue(row.amount)
                  : getVacationCurrentUserAmount(row);

              return `
                <tr>
                  <td>
                    ${
                      escapeHtml(
                        group?.label ||
                        trip?.title ||
                        row.trip_id ||
                        "—"
                      )
                    }
                  </td>

                  <td>
                    ${escapeHtml(formatGermanDate(row.date))}
                  </td>

                  <td>
                    ${
                      escapeHtml(
                        `${row.main_category || "—"} / ` +
                        `${row.sub_category || "—"}`
                      )
                    }
                  </td>

                  <td>
                    ${escapeHtml(currency(displayAmount))}
                  </td>

                  <td>
                    ${escapeHtml(resolveVacationPayer(row))}
                  </td>

                  <td>
                    ${actionButtons("tripExpense", row)}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="6" class="table-empty">' +
            "Noch keine Urlaubsausgaben vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderCategoriesTable() {
    if (!els.categoriesTableBody) return;

    const rows =
      getAllVisibleCategoriesForTable();

    els.categoriesTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              return `
                <tr>
                  <td>${escapeHtml(row.module || "")}</td>
                  <td>${escapeHtml(row.main_category || "")}</td>
                  <td>${escapeHtml(row.sub_category || "")}</td>
                  <td>${actionButtons("category", row)}</td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="4" class="table-empty">' +
            "Noch keine Kategorien vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderFixedCostsTable() {
    if (!els.fixedCostsTableBody) return;

    const rows =
      getAllVisibleFixedCostsForTable();

    els.fixedCostsTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              return `
                <tr>
                  <td>${escapeHtml(row.title || "")}</td>

                  <td>
                    ${
                      escapeHtml(
                        currency(
                          getUserShareFromAmount(
                            row,
                            row.amount
                          )
                        )
                      )
                    }
                  </td>

                  <td>${escapeHtml(row.frequency || "")}</td>

                  <td>
                    ${actionButtons("fixedCost", row)}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="4" class="table-empty">' +
            "Noch keine Fixkosten vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function renderIncomeTable() {
    if (!els.incomeTableBody) return;

    const rows =
      getIncomeForTable();

    els.incomeTableBody.innerHTML =
      rows.length
        ? rows
            .map((row) => {
              return `
                <tr>
                  <td>
                    ${escapeHtml(formatGermanDate(row.date))}
                  </td>

                  <td>
                    ${escapeHtml(row.income_type || "")}
                  </td>

                  <td>
                    ${escapeHtml(currency(row.amount))}
                  </td>

                  <td>
                    ${actionButtons("income", row)}
                  </td>
                </tr>
              `;
            })
            .join("")
        : (
            '<tr>' +
            '<td colspan="4" class="table-empty">' +
            "Noch keine Einnahmen vorhanden" +
            "</td>" +
            "</tr>"
          );
  }

  function formToObject(form) {
    const formData =
      new FormData(form);

    const data = {};

    for (const [key, value] of formData.entries()) {
      if (key === "weekdays") continue;

      data[key] = value;
    }

    if (form === els.householdTaskForm) {
      data.weekdays =
        formData.getAll("weekdays").join(",");

      if (!data.calendar_sync) {
        data.calendar_sync = "ja";
      }
    }

    delete data._clientKey;

    if (data.date) {
      data.month_key =
        data.date.slice(0, 7);
    }

    if (data.booking_type === "settlement") {
      data.counterparty =
        normalizePersonName(
          data.counterparty ||
          otherUserName()
        );

      data.main_category =
        "Verrechnung";

      data.sub_category =
        "Saldoausgleich";

      data.split_enabled =
        "nein";

      data.split_percent =
        "100";
    } else if (
      Object.prototype.hasOwnProperty.call(
        data,
        "counterparty"
      )
    ) {
      data.counterparty = "-";
    }

    if (data.paid_by) {
      data.paid_by =
        normalizePersonName(data.paid_by);
    }

    if (data.travel_with) {
      const normalized =
        normalizePersonName(data.travel_with);

      data.travel_with =
        normalized ||
        data.travel_with;
    }

    if (data.assigned_to) {
      data.assigned_to =
        normalizeAssignedTo(data.assigned_to);
    }

    const me =
      currentUserName();

    data.updated_by = me;

    if (!data.created_by) {
      data.created_by = me;
    }

    if (!data.owner_user) {
      data.owner_user = me;
    }

    return data;
  }

  function setFormValues(form, record) {
    if (!form || !record) return;

    Object.entries(record).forEach(([key, value]) => {
      if (
        key === "_clientKey" ||
        key === "weekdays"
      ) {
        return;
      }

      const field =
        form.elements.namedItem(key);

      if (
        !field ||
        field instanceof RadioNodeList
      ) {
        return;
      }

      if (
        field instanceof HTMLInputElement &&
        field.type === "date"
      ) {
        field.value =
          normalizeDateOnly(value);
      } else if (
        field instanceof HTMLInputElement &&
        field.type === "month"
      ) {
        field.value =
          monthFromDate(value);
      } else if (
        field instanceof HTMLInputElement &&
        field.type === "time"
      ) {
        field.value =
          String(value || "").slice(0, 5);
      } else {
        field.value =
          value ?? "";
      }
    });
  }

  function setTaskFormValues(record) {
    if (
      !els.householdTaskForm ||
      !record
    ) {
      return;
    }

    setFormValues(
      els.householdTaskForm,
      record
    );

    const selectedDays =
      normalizeTaskWeekdays(
        record.weekdays
      );

    els.householdTaskForm
      .querySelectorAll('input[name="weekdays"]')
      .forEach((input) => {
        input.checked =
          selectedDays.includes(input.value);
      });

    updateTaskRepeatFields();
  }

  function setSelectValueIfPresent(field, value) {
    if (!field) return;

    const optionExists =
      [...field.options].some((option) => {
        return (
          option.value === value ||
          option.text === value
        );
      });

    if (optionExists) {
      field.value = value;
    }
  }

  function resetFormUi(type) {
    if (type === "transaction") {
      editState.transaction = null;
      els.transactionForm?.reset();
      setDefaultValues();

      const form =
        els.transactionForm;

      if (form) {
        setSelectValueIfPresent(
          form.elements.namedItem("booking_type"),
          "expense"
        );

        setSelectValueIfPresent(
          form.elements.namedItem("counterparty"),
          "-"
        );

        setSelectValueIfPresent(
          form.elements.namedItem("paid_by"),
          currentUserName()
        );

        setSelectValueIfPresent(
          form.elements.namedItem("split_enabled"),
          "nein"
        );

        setSelectValueIfPresent(
          form.elements.namedItem("split_percent"),
          "100"
        );
      }

      setText(
        els.bookingFormModeLabel,
        "Neue Buchung"
      );

      setText(
        els.transactionSubmitBtn,
        "Buchung speichern"
      );

      if (els.transactionCancelEditBtn) {
        els.transactionCancelEditBtn.style.display =
          "none";
      }

      populateCategorySelects(
        "Haushalt",
        els.bookingMainCategory,
        els.bookingSubCategory
      );

      updateTransactionFormVisibility();
      return;
    }

    if (type === "trip") {
      editState.trip = null;
      els.tripForm?.reset();

      const travelWith =
        els.tripForm?.elements.namedItem("travel_with");

      setSelectValueIfPresent(
        travelWith,
        otherUserName()
      );

      setText(
        els.tripFormModeLabel,
        "Neue Reise"
      );

      setText(
        els.tripSubmitBtn,
        "Reise speichern"
      );

      if (els.tripCancelEditBtn) {
        els.tripCancelEditBtn.style.display =
          "none";
      }

      return;
    }

    if (type === "tripExpense") {
      editState.tripExpense = null;
      els.tripExpenseForm?.reset();
      setDefaultValues();

      const form =
        els.tripExpenseForm;

      if (form) {
        setSelectValueIfPresent(
          form.elements.namedItem("paid_by"),
          currentUserName()
        );

        setSelectValueIfPresent(
          form.elements.namedItem("split_enabled"),
          "nein"
        );

        setSelectValueIfPresent(
          form.elements.namedItem("split_percent"),
          "100"
        );
      }

      setText(
        els.tripExpenseFormModeLabel,
        "Neue Urlaubsausgabe"
      );

      setText(
        els.tripExpenseSubmitBtn,
        "Urlaubsausgabe speichern"
      );

      if (els.tripExpenseCancelEditBtn) {
        els.tripExpenseCancelEditBtn.style.display =
          "none";
      }

      populateTripSelect();

      populateCategorySelects(
        "Urlaub",
        els.tripMainCategory,
        els.tripSubCategory
      );

      return;
    }

    if (type === "category") {
      editState.category = null;
      els.categoryForm?.reset();

      setText(
        els.categoryFormModeLabel,
        "Neue Kategorie"
      );

      setText(
        els.categorySubmitBtn,
        "Kategorie speichern"
      );

      if (els.categoryCancelEditBtn) {
        els.categoryCancelEditBtn.style.display =
          "none";
      }

      return;
    }

    if (type === "fixedCost") {
      editState.fixedCost = null;
      els.fixedCostForm?.reset();

      const form =
        els.fixedCostForm;

      if (form) {
        setSelectValueIfPresent(
          form.elements.namedItem("paid_by"),
          currentUserName()
        );

        setSelectValueIfPresent(
          form.elements.namedItem("split_enabled"),
          "nein"
        );

        setSelectValueIfPresent(
          form.elements.namedItem("split_percent"),
          "100"
        );
      }

      setText(
        els.fixedCostFormModeLabel,
        "Neue Fixkostenposition"
      );

      setText(
        els.fixedCostSubmitBtn,
        "Fixkosten speichern"
      );

      if (els.fixedCostCancelEditBtn) {
        els.fixedCostCancelEditBtn.style.display =
          "none";
      }

      populateCategorySelects(
        "Haushalt",
        els.fixedMainCategory,
        els.fixedSubCategory
      );

      return;
    }

    if (type === "income") {
      editState.income = null;
      els.incomeForm?.reset();
      setDefaultValues();

      setText(
        els.incomeFormModeLabel,
        "Neue Einnahme"
      );

      setText(
        els.incomeSubmitBtn,
        "Einnahme speichern"
      );

      if (els.incomeCancelEditBtn) {
        els.incomeCancelEditBtn.style.display =
          "none";
      }

      return;
    }

    if (type === "task") {
      editState.task = null;
      els.householdTaskForm?.reset();
      setDefaultValues();

      const form =
        els.householdTaskForm;

      if (form) {
        setSelectValueIfPresent(
          form.elements.namedItem("assigned_to"),
          ASSIGNED_BOTH
        );

        setSelectValueIfPresent(
          form.elements.namedItem("recurrence_type"),
          "weekly"
        );

        setSelectValueIfPresent(
          form.elements.namedItem("status"),
          "active"
        );

        const interval =
          form.elements.namedItem(
            "recurrence_interval"
          );

        if (interval) {
          interval.value = "1";
        }
      }

      setText(
        els.taskFormModeLabel,
        "Neue Aufgabe"
      );

      setText(
        els.taskSubmitBtn,
        "Aufgabe speichern"
      );

      if (els.taskCancelEditBtn) {
        els.taskCancelEditBtn.style.display =
          "none";
      }

      updateTaskRepeatFields();
    }
  }

  function startEdit(type, record) {
    if (!record) {
      showMessage(
        "Der ausgewählte Datensatz wurde nicht gefunden.",
        "error"
      );

      return;
    }

    if (type === "transaction") {
      editState.transaction = record.id;

      setFormValues(
        els.transactionForm,
        record
      );

      populateCategorySelects(
        "Haushalt",
        els.bookingMainCategory,
        els.bookingSubCategory,
        record.main_category,
        record.sub_category
      );

      updateTransactionFormVisibility();

      setText(
        els.bookingFormModeLabel,
        "Buchung bearbeiten"
      );

      setText(
        els.transactionSubmitBtn,
        "Änderungen speichern"
      );

      if (els.transactionCancelEditBtn) {
        els.transactionCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-bookings")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    if (type === "trip") {
      editState.trip = record.trip_id;

      setFormValues(
        els.tripForm,
        record
      );

      setText(
        els.tripFormModeLabel,
        "Reise bearbeiten"
      );

      setText(
        els.tripSubmitBtn,
        "Änderungen speichern"
      );

      if (els.tripCancelEditBtn) {
        els.tripCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-urlaub")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    if (type === "tripExpense") {
      editState.tripExpense = record.id;

      populateTripSelect(record.trip_id);

      setFormValues(
        els.tripExpenseForm,
        record
      );

      populateCategorySelects(
        "Urlaub",
        els.tripMainCategory,
        els.tripSubCategory,
        record.main_category,
        record.sub_category
      );

      setText(
        els.tripExpenseFormModeLabel,
        "Urlaubsausgabe bearbeiten"
      );

      setText(
        els.tripExpenseSubmitBtn,
        "Änderungen speichern"
      );

      if (els.tripExpenseCancelEditBtn) {
        els.tripExpenseCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-urlaub")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    if (type === "category") {
      editState.category = record.id;

      setFormValues(
        els.categoryForm,
        record
      );

      setText(
        els.categoryFormModeLabel,
        "Kategorie bearbeiten"
      );

      setText(
        els.categorySubmitBtn,
        "Änderungen speichern"
      );

      if (els.categoryCancelEditBtn) {
        els.categoryCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-zentrale")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    if (type === "fixedCost") {
      editState.fixedCost = record.id;

      setFormValues(
        els.fixedCostForm,
        record
      );

      populateCategorySelects(
        "Haushalt",
        els.fixedMainCategory,
        els.fixedSubCategory,
        record.main_category,
        record.sub_category
      );

      setText(
        els.fixedCostFormModeLabel,
        "Fixkosten bearbeiten"
      );

      setText(
        els.fixedCostSubmitBtn,
        "Änderungen speichern"
      );

      if (els.fixedCostCancelEditBtn) {
        els.fixedCostCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-zentrale")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    if (type === "income") {
      editState.income = record.id;

      setFormValues(
        els.incomeForm,
        record
      );

      setText(
        els.incomeFormModeLabel,
        "Einnahme bearbeiten"
      );

      setText(
        els.incomeSubmitBtn,
        "Änderungen speichern"
      );

      if (els.incomeCancelEditBtn) {
        els.incomeCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-zentrale")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });

      return;
    }

    if (type === "task") {
      editState.task = record.id;

      setTaskFormValues(record);

      setText(
        els.taskFormModeLabel,
        "Aufgabe bearbeiten"
      );

      setText(
        els.taskSubmitBtn,
        "Änderungen speichern"
      );

      if (els.taskCancelEditBtn) {
        els.taskCancelEditBtn.style.display =
          "inline-flex";
      }

      document
        .getElementById("panel-household")
        ?.scrollIntoView({
          behavior: "smooth",
          block: "start"
        });
    }
  }

  function getRecordByTypeAndKey(type, key) {
    const mapping = {
      transaction: state.data.transactions,
      trip: state.data.trips,
      tripExpense: state.data.tripExpenses,
      category: state.data.categories,
      fixedCost: state.data.fixedCosts,
      income: state.data.income,
      task: state.data.tasks
    };

    return (
      (mapping[type] || [])
        .find((row) => row._clientKey === key) ||
      null
    );
  }

  async function deleteRecord(type, backendId) {
    if (!backendId) {
      throw new Error(
        "Die ID des Datensatzes fehlt."
      );
    }

    if (
      !window.confirm(
        "Diesen Eintrag wirklich löschen?"
      )
    ) {
      return;
    }

    const actionMap = {
      transaction: "deleteTransaction",
      trip: "deleteTrip",
      tripExpense: "deleteTripExpense",
      category: "deleteCategory",
      fixedCost: "deleteFixedCost",
      income: "deleteIncome",
      task: "deleteTask"
    };

    const action =
      actionMap[type];

    if (!action) {
      throw new Error(
        "Unbekannter Datensatztyp."
      );
    }

    const payload =
      type === "trip"
        ? {
            trip_id: backendId
          }
        : {
            id: backendId
          };

    const result =
      await apiPost(
        action,
        payload
      );

    resetFormUi(type);

    await loadAll({
      silentSuccess: true
    });

    const warning =
      result.warning
        ? ` ${result.warning}`
        : "";

    showMessage(
      `Eintrag gelöscht.${warning}`,
      result.warning
        ? "warning"
        : "success"
    );
  }

  function isEditMode(type) {
    return Boolean(editState[type]);
  }

  async function submitForm({
    form,
    addAction,
    updateAction,
    successAddText,
    successUpdateText,
    type
  }) {
    if (!form) return;

    try {
      clearMessage();

      const data =
        formToObject(form);

      const editing =
        isEditMode(type);

      if (editing) {
        if (type === "trip") {
          data.trip_id =
            editState.trip;
        } else {
          data.id =
            editState[type];
        }
      } else if (type === "trip") {
        delete data.trip_id;
      } else {
        delete data.id;
      }

      const result =
        await apiPost(
          editing
            ? updateAction
            : addAction,
          data
        );

      resetFormUi(type);

      await loadAll({
        silentSuccess: true
      });

      const baseMessage =
        editing
          ? successUpdateText
          : successAddText;

      const warning =
        result.warning
          ? ` ${result.warning}`
          : "";

      showMessage(
        `${baseMessage}${warning}`,
        result.warning
          ? "warning"
          : "success"
      );
    } catch (error) {
      showMessage(
        error.message ||
        "Speichern fehlgeschlagen.",
        "error"
      );

      console.error(error);
    }
  }

  function setFieldDisabled(field, disabled) {
    if (field) {
      field.disabled = disabled;
    }
  }

  function setLabelHidden(field, hidden) {
    const label =
      field?.closest("label");

    if (label) {
      label.style.display =
        hidden
          ? "none"
          : "";
    }
  }

  function updateTransactionFormVisibility() {
    const settlement =
      (
        els.bookingType?.value ||
        "expense"
      ) === "settlement";

    setLabelHidden(
      els.transactionCounterparty,
      !settlement
    );

    setLabelHidden(
      els.bookingMainCategory,
      settlement
    );

    setLabelHidden(
      els.bookingSubCategory,
      settlement
    );

    setLabelHidden(
      els.transactionSplitEnabled,
      settlement
    );

    setLabelHidden(
      els.transactionSplitPercent,
      settlement
    );

    setFieldDisabled(
      els.bookingMainCategory,
      settlement
    );

    setFieldDisabled(
      els.bookingSubCategory,
      settlement
    );

    setFieldDisabled(
      els.transactionSplitEnabled,
      settlement
    );

    setFieldDisabled(
      els.transactionSplitPercent,
      settlement
    );

    if (settlement) {
      if (
        els.transactionCounterparty &&
        (
          !els.transactionCounterparty.value ||
          els.transactionCounterparty.value === "-"
        )
      ) {
        setSelectValueIfPresent(
          els.transactionCounterparty,
          otherUserName()
        );
      }

      setSelectValueIfPresent(
        els.transactionSplitEnabled,
        "nein"
      );

      setSelectValueIfPresent(
        els.transactionSplitPercent,
        "100"
      );
    } else if (els.transactionCounterparty) {
      setSelectValueIfPresent(
        els.transactionCounterparty,
        "-"
      );
    }
  }

  function renderDashboard() {
    const metrics =
      getDashboardMetrics(
        selectedAnalysisMonth()
      );

    renderKpis(metrics);
    renderDashboardCharts(metrics);

    renderCategoryTable(
      metrics.txRows.concat(metrics.tripRows)
    );

    renderMonthOverviewTable(metrics);
    renderRangeOverviewTable();

    renderCategoryCompareTable(
      metrics.month,
      metrics.txRows,
      metrics.tripRows
    );
  }

  function renderAll() {
    fillCategoryFilter();

    populateCategorySelects(
      "Haushalt",
      els.bookingMainCategory,
      els.bookingSubCategory,
      els.bookingMainCategory?.value,
      els.bookingSubCategory?.value
    );

    populateCategorySelects(
      "Urlaub",
      els.tripMainCategory,
      els.tripSubCategory,
      els.tripMainCategory?.value,
      els.tripSubCategory?.value
    );

    populateCategorySelects(
      "Haushalt",
      els.fixedMainCategory,
      els.fixedSubCategory,
      els.fixedMainCategory?.value,
      els.fixedSubCategory?.value
    );

    populateTripSelect();
    populateVacationAnalysisSelect();

    renderDashboard();
    renderHouseholdWeekOverview();
    renderTasksTable();
    renderHousingOverview();
    renderVacationOverview();

    renderTransactionsTable();
    renderTripsTable();
    renderTripExpensesTable();
    renderCategoriesTable();
    renderFixedCostsTable();
    renderIncomeTable();

    updateTransactionFormVisibility();
    updateTaskRepeatFields();
  }

  function bindForms() {
    els.transactionForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.transactionForm,
        addAction: "addTransaction",
        updateAction: "updateTransaction",
        successAddText: "Haushaltsbuchung gespeichert.",
        successUpdateText: "Haushaltsbuchung aktualisiert.",
        type: "transaction"
      });
    });

    els.tripForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.tripForm,
        addAction: "addTrip",
        updateAction: "updateTrip",
        successAddText: "Reise gespeichert.",
        successUpdateText: "Reise aktualisiert.",
        type: "trip"
      });
    });

    els.tripExpenseForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.tripExpenseForm,
        addAction: "addTripExpense",
        updateAction: "updateTripExpense",
        successAddText: "Urlaubsausgabe gespeichert.",
        successUpdateText: "Urlaubsausgabe aktualisiert.",
        type: "tripExpense"
      });
    });

    els.categoryForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.categoryForm,
        addAction: "addCategory",
        updateAction: "updateCategory",
        successAddText: "Kategorie gespeichert.",
        successUpdateText: "Kategorie aktualisiert.",
        type: "category"
      });
    });

    els.fixedCostForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.fixedCostForm,
        addAction: "addFixedCost",
        updateAction: "updateFixedCost",
        successAddText: "Fixkosten gespeichert.",
        successUpdateText: "Fixkosten aktualisiert.",
        type: "fixedCost"
      });
    });

    els.incomeForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.incomeForm,
        addAction: "addIncome",
        updateAction: "updateIncome",
        successAddText: "Einnahme gespeichert.",
        successUpdateText: "Einnahme aktualisiert.",
        type: "income"
      });
    });

    els.householdTaskForm?.addEventListener("submit", (event) => {
      event.preventDefault();

      submitForm({
        form: els.householdTaskForm,
        addAction: "addTask",
        updateAction: "updateTask",
        successAddText: "Aufgabe gespeichert.",
        successUpdateText: "Aufgabe aktualisiert.",
        type: "task"
      });
    });

    els.transactionCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("transaction")
    );

    els.tripCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("trip")
    );

    els.tripExpenseCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("tripExpense")
    );

    els.categoryCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("category")
    );

    els.fixedCostCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("fixedCost")
    );

    els.incomeCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("income")
    );

    els.taskCancelEditBtn?.addEventListener(
      "click",
      () => resetFormUi("task")
    );

    els.bookingType?.addEventListener(
      "change",
      updateTransactionFormVisibility
    );

    els.taskRepeatType?.addEventListener(
      "change",
      updateTaskRepeatFields
    );
  }

  function bindTableActions() {
    document.addEventListener("click", async (event) => {
      const editButton =
        event.target.closest(".js-edit");

      if (editButton) {
        const type =
          editButton.dataset.type;

        const key =
          editButton.dataset.key;

        startEdit(
          type,
          getRecordByTypeAndKey(type, key)
        );

        return;
      }

      const deleteButton =
        event.target.closest(".js-delete");

      if (!deleteButton) return;

      try {
        await deleteRecord(
          deleteButton.dataset.type,
          deleteButton.dataset.id
        );
      } catch (error) {
        showMessage(
          error.message ||
          "Löschen fehlgeschlagen.",
          "error"
        );

        console.error(error);
      }
    });
  }

  function bindTabs() {
    els.tabs?.addEventListener("click", (event) => {
      const button =
        event.target.closest(".nav-btn");

      if (!button) return;

      document
        .querySelectorAll(".nav-btn")
        .forEach((element) => {
          element.classList.remove("active");
        });

      button.classList.add("active");

      document
        .querySelectorAll(".panel")
        .forEach((element) => {
          element.classList.remove("active");
        });

      document
        .getElementById(
          `panel-${button.dataset.tab}`
        )
        ?.classList.add("active");

      requestAnimationFrame(() => {
        Object.values(state.charts).forEach((chart) => {
          chart?.resize?.();
        });
      });
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
      els.housingDisplayMode
    ]
      .filter(Boolean)
      .forEach((element) => {
        element.addEventListener(
          "change",
          renderAll
        );
      });

    els.vacationYearSelect?.addEventListener(
      "change",
      () => {
        if (els.vacationAnalysisSelect) {
          els.vacationAnalysisSelect.value = "year";
        }

        renderAll();
      }
    );

    els.vacationAnalysisSelect?.addEventListener(
      "change",
      renderAll
    );

    els.reloadBtn?.addEventListener(
      "click",
      () => loadAll()
    );
  }

  function todayDate() {
    return localDateKey(new Date());
  }

  function formatGermanDate(value) {
    const date =
      value instanceof Date
        ? value
        : parseLocalDate(value);

    if (
      !date ||
      Number.isNaN(date.getTime())
    ) {
      return "—";
    }

    return new Intl.DateTimeFormat(
      "de-DE",
      {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }
    ).format(date);
  }

  function selectedHousingDisplayMode() {
    return housingDisplayMode();
  }

  function setDefaultValues() {
    if (
      els.filterStartMonth &&
      !els.filterStartMonth.value
    ) {
      els.filterStartMonth.value =
        DEFAULT_START_MONTH;
    }

    if (
      els.filterAnalysisMonth &&
      !els.filterAnalysisMonth.value
    ) {
      els.filterAnalysisMonth.value =
        currentMonth();
    }

    if (
      els.rangeMonths &&
      !els.rangeMonths.value
    ) {
      els.rangeMonths.value =
        String(DEFAULT_RANGE_MONTHS);
    }

    const dateFields = [
      els.transactionForm?.elements?.namedItem("date"),
      els.tripExpenseForm?.elements?.namedItem("date"),
      els.incomeForm?.elements?.namedItem("date"),
      els.householdTaskForm?.elements?.namedItem("start_date")
    ];

    dateFields.forEach((field) => {
      if (field && !field.value) {
        field.value = todayDate();
      }
    });
  }

  function chartOptions(options = false, legacyMode) {
    let stacked = false;

    let valueMode =
      legacyMode ||
      (
        isPercentMode()
          ? "percent"
          : "currency"
      );

    if (typeof options === "boolean") {
      stacked = options;
    } else if (
      options &&
      typeof options === "object"
    ) {
      stacked = Boolean(options.stacked);

      if (options.mode) {
        valueMode = options.mode;
      }

      if (options.percentMode === true) {
        valueMode = "percent";
      }

      if (
        options.percentMode === false &&
        !options.mode
      ) {
        valueMode = "currency";
      }
    }

    return {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false
      },

      plugins: {
        legend: {
          labels: {
            color: "#d8e4ff",
            boxWidth: 14,
            boxHeight: 14
          }
        },

        tooltip: {
          callbacks: {
            label(context) {
              const label =
                context.dataset.label
                  ? `${context.dataset.label}: `
                  : "";

              return (
                `${label}` +
                `${
                  valueMode === "percent"
                    ? percent(context.parsed.y)
                    : currency(context.parsed.y)
                }`
              );
            }
          }
        }
      },

      scales: {
        x: {
          stacked,

          ticks: {
            color: "#aec1e6"
          },

          grid: {
            color: "rgba(255,255,255,.05)"
          }
        },

        y: {
          stacked,
          beginAtZero: true,

          ticks: {
            color: "#aec1e6",

            callback(value) {
              return valueMode === "percent"
                ? `${value} %`
                : value;
            }
          },

          grid: {
            color: "rgba(255,255,255,.05)"
          }
        }
      }
    };
  }

  function getCurrentWeekTasks() {
    const weekStart =
      startOfWeek(new Date());

    const tasks =
      getVisibleTasks();

    return Array.from(
      { length: 7 },
      (_, index) => {
        const date =
          addDays(weekStart, index);

        const dayTasks =
          tasks
            .filter((task) => {
              return taskOccursOnDate(task, date);
            })
            .sort((a, b) => {
              return (
                String(a.due_time || "").localeCompare(
                  String(b.due_time || "")
                ) ||
                String(a.title || "").localeCompare(
                  String(b.title || ""),
                  "de"
                )
              );
            });

        return {
          date,
          code: WEEKDAY_CODES[index],
          tasks: dayTasks,
          items: dayTasks
        };
      }
    );
  }

  async function loadAll({
    silentSuccess = false
  } = {}) {
    if (state.loading) return;

    state.loading = true;
    clearMessage();

    try {
      setText(
        els.syncStatus,
        "Synchronisierung läuft..."
      );

      if (els.reloadBtn) {
        els.reloadBtn.disabled = true;
      }

      const result =
        await apiGet("getAll");

      state.data =
        withClientKeys(
          result.data ||
          EMPTY_DATA()
        );

      rebuildTripIndex();
      renderAll();

      setText(
        els.syncStatus,
        `Synchronisiert: ${new Date().toLocaleString("de-DE")}`
      );

      if (!silentSuccess) {
        showMessage(
          "Daten erfolgreich geladen.",
          "success"
        );
      }
    } catch (error) {
      setText(
        els.syncStatus,
        "Synchronisierung fehlgeschlagen"
      );

      showMessage(
        error.message ||
        "Fehler beim Laden.",
        "error"
      );

      console.error(error);
    } finally {
      state.loading = false;

      if (els.reloadBtn) {
        els.reloadBtn.disabled = false;
      }
    }
  }

  function setupUiOnce() {
    if (state.initializedUi) return;

    setDefaultValues();
    bindTabs();
    bindForms();
    bindFilters();
    bindTableActions();
    wireCategorySelects();

    resetFormUi("transaction");
    resetFormUi("trip");
    resetFormUi("tripExpense");
    resetFormUi("fixedCost");
    resetFormUi("income");
    resetFormUi("task");

    state.initializedUi = true;
  }

  async function onUserLoggedIn() {
    setupUiOnce();
    await loadAll();
  }

  async function init() {
    try {
      if (typeof window.initAuth === "function") {
        await window.initAuth();
      }

      if (!currentUser()) return;

      setupUiOnce();
      await loadAll();
    } catch (error) {
      showMessage(
        error.message ||
        "Initialisierung fehlgeschlagen.",
        "error"
      );

      console.error(error);
    }
  }

  window.onUserLoggedIn = onUserLoggedIn;
  window.loadAll = loadAll;

  document.addEventListener(
    "DOMContentLoaded",
    init
  );
})();
