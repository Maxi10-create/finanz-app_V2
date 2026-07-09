function getTripGroupKey(trip) {
  if (!trip) return "";

  const title = String(trip.title || "").trim().toLowerCase();
  const destination = String(trip.destination || "").trim().toLowerCase();
  const start = normalizeDateOnly(trip.start_date || "");
  const end = normalizeDateOnly(trip.end_date || "");

  if (isSharedTrip(trip)) {
    return `shared|${title}|${destination}|${start}|${end}|${PERSON_A}|${PERSON_B}`;
  }

  const owner = normalizePersonName(trip.owner_user || "");
  return `single|${owner}|${title}|${destination}|${start}|${end}`;
}

function buildVacationSelectionEntries(selectedYear) {
  const visibleTrips = (state.data.trips || [])
    .filter(isVisibleTrip)
    .filter((trip) => String(trip.start_date || "").slice(0, 4) === selectedYear);

  const unique = new Map();

  visibleTrips.forEach((trip) => {
    const key = getTripGroupKey(trip);
    if (!unique.has(key)) {
      unique.set(key, {
        value: `group:${key}`,
        label: `${trip.title} – ${trip.destination}`,
        sortDate: String(trip.start_date || "")
      });
    }
  });

  return [...unique.values()].sort((a, b) => b.sortDate.localeCompare(a.sortDate));
}

function populateVacationAnalysisSelect() {
  if (!els.vacationYearSelect || !els.vacationAnalysisSelect) return;

  const availableYears = getVacationAvailableYears();
  const currentYearString = String(currentYear());

  if (!els.vacationYearSelect.dataset.initialized) {
    const defaultYear = availableYears.includes(currentYearString)
      ? currentYearString
      : (availableYears[0] || currentYearString);

    els.vacationYearSelect.innerHTML = availableYears.length
      ? availableYears.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("")
      : `<option value="${escapeHtml(currentYearString)}">${escapeHtml(currentYearString)}</option>`;

    els.vacationYearSelect.value = defaultYear;
    els.vacationYearSelect.dataset.initialized = "true";
  } else {
    const currentSelectedYear = els.vacationYearSelect.value || currentYearString;
    els.vacationYearSelect.innerHTML = availableYears.length
      ? availableYears.map((year) => `<option value="${escapeHtml(year)}">${escapeHtml(year)}</option>`).join("")
      : `<option value="${escapeHtml(currentYearString)}">${escapeHtml(currentYearString)}</option>`;

    els.vacationYearSelect.value = availableYears.includes(currentSelectedYear)
      ? currentSelectedYear
      : (availableYears.includes(currentYearString) ? currentYearString : (availableYears[0] || currentYearString));
  }

  const selectedYear = selectedVacationYear();
  const currentValue = els.vacationAnalysisSelect.value;
  const entries = buildVacationSelectionEntries(selectedYear);

  els.vacationAnalysisSelect.innerHTML =
    '<option value="year">Alle Urlaube im gewählten Jahr</option>' +
    entries.map((entry) => `<option value="${escapeHtml(entry.value)}">${escapeHtml(entry.label)}</option>`).join("");

  const validValues = ["year", ...entries.map((e) => e.value)];
  els.vacationAnalysisSelect.value = validValues.includes(currentValue) ? currentValue : "year";
}

function resolveVacationPayer(row) {
  const paidBy = normalizePersonName(row.paid_by || "");
  if (paidBy === PERSON_A || paidBy === PERSON_B) return paidBy;

  const owner = normalizePersonName(row.owner_user || "");
  if (owner === PERSON_A || owner === PERSON_B) return owner;

  return currentUserName();
}

function getVacationExpenseShares(row, trip) {
  const amount = Number(row.amount || 0);
  const splitEnabled = String(row.split_enabled || "nein").toLowerCase() === "ja";
  const splitPercent = Number(row.split_percent || 100);
  const payer = resolveVacationPayer(row);

  const shares = {
    total: amount,
    [PERSON_A]: 0,
    [PERSON_B]: 0
  };

  if (isSharedTrip(trip)) {
    const other = payer === PERSON_A ? PERSON_B : PERSON_A;

    if (splitEnabled) {
      const payerShare = amount * (splitPercent / 100);
      const otherShare = amount - payerShare;
      shares[payer] = payerShare;
      shares[other] = otherShare;
    } else {
      shares[payer] = amount;
    }

    return shares;
  }

  shares[payer] = amount;
  return shares;
}

function getVacationCurrentUserAmount(row) {
  const trip = getTripById(row.trip_id);
  const shares = getVacationExpenseShares(row, trip);
  return shares[currentUserName()] || 0;
}

function isRelevantTripExpenseForUser(row) {
  if (!row) return false;
  if (String(row.is_deleted || "").toLowerCase() === "ja") return false;

  const trip = getTripById(row.trip_id);
  if (trip && isSharedTrip(trip)) return true;

  return getVacationCurrentUserAmount(row) > 0;
}

function isVisibleTripExpense(row) {
  if (!row) return false;
  if (String(row.is_deleted || "").toLowerCase() === "ja") return false;

  const trip = getTripById(row.trip_id);

  if (trip && isSharedTrip(trip)) return true;
  if (trip && isVisibleTrip(trip) && getVacationCurrentUserAmount(row) > 0) return true;

  return isRelevantTripExpenseForUser(row);
}

function getTripExpenseVisibleAmountForTable(row) {
  const trip = getTripById(row.trip_id);
  if (trip && isSharedTrip(trip)) return Number(row.amount || 0);
  return getVacationCurrentUserAmount(row);
}

function createVacationCategoryAccumulator() {
  return VACATION_BUCKETS.reduce((acc, bucket) => {
    acc[bucket] = { total: 0, max: 0, jana: 0 };
    return acc;
  }, {});
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

function resolveSelectedVacationTrips() {
  const selectedYear = selectedVacationYear();
  const selectedValue = els.vacationAnalysisSelect?.value || "year";
  const visibleTrips = (state.data.trips || [])
    .filter(isVisibleTrip)
    .filter((trip) => String(trip.start_date || "").slice(0, 4) === selectedYear);

  if (selectedValue === "year") return visibleTrips;

  if (selectedValue.startsWith("group:")) {
    const groupKey = selectedValue.slice(6);
    return visibleTrips.filter((trip) => getTripGroupKey(trip) === groupKey);
  }

  return visibleTrips;
}

function computeVacationOverviewData() {
  const relevantTrips = resolveSelectedVacationTrips();
  const relevantTripIds = new Set(relevantTrips.map((trip) => trip.trip_id));
  const visibleExpenses = getVisibleVacationExpenses();
  const relevantExpenses = visibleExpenses.filter((row) => relevantTripIds.has(row.trip_id));

  const categories = createVacationCategoryAccumulator();

  relevantExpenses.forEach((row) => {
    const bucket = getVacationCategoryBucket(row);
    const trip = getTripById(row.trip_id);
    const shares = getVacationExpenseShares(row, trip);

    categories[bucket].total += shares.total;
    categories[bucket].max += shares[PERSON_A] || 0;
    categories[bucket].jana += shares[PERSON_B] || 0;
  });

  const totals = { total: 0, max: 0, jana: 0 };
  Object.values(categories).forEach((entry) => {
    totals.total += entry.total;
    totals.max += entry.max;
    totals.jana += entry.jana;
  });

  const isYearSelection = (els.vacationAnalysisSelect?.value || "year") === "year";
  const hasSharedTrip = relevantTrips.some((trip) => isSharedTrip(trip));
  const currentUserTotal = currentUserName() === PERSON_A ? totals.max : totals.jana;

  return {
    relevantTrips,
    relevantExpenses,
    categories,
    totals,
    hasSharedTrip,
    isYearSelection,
    currentUserTotal
  };
}

function computeVacationChartData() {
  const data = computeVacationOverviewData();

  const showThreeBars = data.hasSharedTrip && !data.isYearSelection;
  const labels = showThreeBars ? ["Gesamt", PERSON_A, PERSON_B] : [currentUserName()];

  const bucketData = {};

  VACATION_BUCKETS.forEach((bucket) => {
    if (showThreeBars) {
      bucketData[bucket] = [
        data.categories[bucket].total,
        data.categories[bucket].max,
        data.categories[bucket].jana
      ];
    } else {
      const ownValue = currentUserName() === PERSON_A
        ? data.categories[bucket].max
        : data.categories[bucket].jana;

      bucketData[bucket] = [ownValue];
    }
  });

  return { labels, bucketData, data, showThreeBars };
}

function renderVacationOverview() {
  const data = computeVacationOverviewData();

  if (els.vacationTotalCost) {
    const mainValue = data.isYearSelection ? data.currentUserTotal : (data.hasSharedTrip ? data.totals.total : data.currentUserTotal);
    els.vacationTotalCost.textContent = currency(mainValue);
  }

  if (els.vacationTripCount) {
    if (data.isYearSelection) {
      els.vacationTripCount.textContent = `${data.relevantTrips.length}`;
    } else if (data.hasSharedTrip) {
      els.vacationTripCount.textContent = `${currency(data.totals.max)} / ${currency(data.totals.jana)}`;
    } else {
      els.vacationTripCount.textContent = `${data.relevantTrips.length}`;
    }
  }

  if (els.vacationKpiTableBody) {
    const totalBase = data.isYearSelection ? (data.currentUserTotal || 1) : (data.totals.total || 1);

    const summaryRow = data.isYearSelection
      ? `
        <tr>
          <td><strong>Ausgaben gesamt Nutzer</strong></td>
          <td>${escapeHtml(currency(data.currentUserTotal))}</td>
          <td>${escapeHtml("100,0 %")}</td>
        </tr>
      `
      : data.hasSharedTrip
        ? `
          <tr>
            <td><strong>Ausgaben gesamt Urlaub</strong></td>
            <td>
              Gesamt ${escapeHtml(currency(data.totals.total))}<br>
              ${escapeHtml(PERSON_A)} ${escapeHtml(currency(data.totals.max))}<br>
              ${escapeHtml(PERSON_B)} ${escapeHtml(currency(data.totals.jana))}
            </td>
            <td>
              Gesamt 100,0 %<br>
              ${escapeHtml(PERSON_A)} ${escapeHtml(percent((data.totals.max / (data.totals.total || 1)) * 100))}<br>
              ${escapeHtml(PERSON_B)} ${escapeHtml(percent((data.totals.jana / (data.totals.total || 1)) * 100))}
            </td>
          </tr>
        `
        : `
          <tr>
            <td><strong>Ausgaben gesamt Urlaub</strong></td>
            <td>${escapeHtml(currency(data.currentUserTotal))}</td>
            <td>${escapeHtml("100,0 %")}</td>
          </tr>
        `;

    const categoryRows = VACATION_BUCKETS.map((name) => {
      const values = data.categories[name];

      if (!data.isYearSelection && data.hasSharedTrip) {
        return `
          <tr>
            <td>${escapeHtml(name)}</td>
            <td>
              Gesamt ${escapeHtml(currency(values.total))}<br>
              ${escapeHtml(PERSON_A)} ${escapeHtml(currency(values.max))}<br>
              ${escapeHtml(PERSON_B)} ${escapeHtml(currency(values.jana))}
            </td>
            <td>
              Gesamt ${escapeHtml(percent((values.total / totalBase) * 100))}<br>
              ${escapeHtml(PERSON_A)} ${escapeHtml(percent((values.max / totalBase) * 100))}<br>
              ${escapeHtml(PERSON_B)} ${escapeHtml(percent((values.jana / totalBase) * 100))}
            </td>
          </tr>
        `;
      }

      const ownValue = currentUserName() === PERSON_A ? values.max : values.jana;
      return `
        <tr>
          <td>${escapeHtml(name)}</td>
          <td>${escapeHtml(currency(ownValue))}</td>
          <td>${escapeHtml(percent((ownValue / totalBase) * 100))}</td>
        </tr>
      `;
    }).join("");

    els.vacationKpiTableBody.innerHTML = summaryRow + categoryRows;
  }

  const chartPayload = computeVacationChartData();
  const canvas = document.getElementById("vacationCompositionChart");

  const baseColors = {
    Transport: "rgba(79,124,255,0.82)",
    Unterkunft: "rgba(255,190,61,0.82)",
    Essen: "rgba(19,194,150,0.82)",
    Aktivitäten: "rgba(255,109,122,0.82)",
    Sonstiges: "rgba(97,201,255,0.82)"
  };

  const datasets = [];
  VACATION_BUCKETS.forEach((bucket) => {
    const color = baseColors[bucket];

    if (chartPayload.showThreeBars) {
      datasets.push({
        label: bucket,
        data: chartPayload.bucketData[bucket],
        backgroundColor: [
          color,
          createCanvasPattern(canvas, "dotted", color),
          createCanvasPattern(canvas, "striped", color)
        ],
        borderColor: [color, color, color],
        borderWidth: 1,
        stack: "vacationSummary"
      });
    } else {
      datasets.push({
        label: bucket,
        data: chartPayload.bucketData[bucket],
        backgroundColor: color,
        borderColor: color,
        borderWidth: 1,
        stack: "vacationSummary"
      });
    }
  });

  ensureChart("vacationCompositionChart", "vacationCompositionChart", {
    type: "bar",
    data: {
      labels: chartPayload.labels,
      datasets
    },
    options: chartOptions(true)
  });
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
          <td>${escapeHtml(currency(getTripExpenseVisibleAmountForTable(row)))}</td>
          <td>${escapeHtml(row.paid_by)}</td>
          <td>${actionButtons("tripExpense", row)}</td>
        </tr>
      `).join("")
    : '<tr><td colspan="6" class="table-empty">Noch keine Urlaubsausgaben vorhanden</td></tr>';
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
