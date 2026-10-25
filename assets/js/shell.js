// App shell: month switcher in the top bar, the "Filter & Konto" panel and, on phones,
// the floating bottom bar with its sheets. Everything here drives the existing
// controls (nav buttons, #filterAnalysisMonth, #quickAddSelect), so app.js stays the
// only place with app logic.
(() => {
  "use strict";

  const MONTHS = ["Jänner", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
  const ICONS = {
    dashboard: '<rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/>',
    bookings: '<path d="M4 6h16M4 12h16M4 18h10"/>',
    household: '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
    hausbau: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6"/>',
    more: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>'
  };
  const svg = (name) =>
    `<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</svg>`;

  const phone = window.matchMedia("(max-width: 760px)");
  let bar = null;
  let sheet = null;
  let backdrop = null;

  const $ = (selector) => document.querySelector(selector);
  const navButton = (tab) => $(`#tabs .nav-btn[data-tab="${tab}"]`);
  const isVisible = (button) => button && !button.classList.contains("is-hidden");
  const activeTab = () => $("#tabs .nav-btn.active")?.dataset.tab || "dashboard";

  /* ---- month switcher ------------------------------------------------- */

  function monthInput() {
    return document.getElementById("filterAnalysisMonth");
  }

  function updateMonthLabel() {
    const value = monthInput()?.value || "";
    const [year, month] = value.split("-").map(Number);
    const label = document.getElementById("monthSwitchLabel");
    if (label) label.textContent = year && month ? `${MONTHS[month - 1]} ${year}` : "—";
  }

  function shiftMonth(delta) {
    const input = monthInput();
    if (!input?.value) return;
    const [year, month] = input.value.split("-").map(Number);
    const date = new Date(year, month - 1 + delta, 1);
    input.value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    updateMonthLabel();
  }

  /* ---- filter & account panel ----------------------------------------- */

  function setPanel(open) {
    closeSheet();
    document.body.classList.toggle("panel-open", open);
    document.querySelectorAll('[data-shell="panel"]').forEach((button) => button.setAttribute("aria-expanded", String(open)));
    setBackdrop(open);
  }

  /* ---- phone: bottom bar and sheets ----------------------------------- */

  function setBackdrop(visible) {
    if (!backdrop) {
      backdrop = document.createElement("div");
      backdrop.className = "shell-backdrop";
      backdrop.addEventListener("click", closeAll);
      document.body.appendChild(backdrop);
    }
    backdrop.classList.toggle("is-visible", visible);
  }

  function buildBar() {
    if (bar) return;
    bar = document.createElement("nav");
    bar.className = "mobile-bar";
    bar.setAttribute("aria-label", "Hauptnavigation");
    document.body.appendChild(bar);
    bar.addEventListener("click", onBarClick);

    sheet = document.createElement("div");
    sheet.className = "mobile-sheet";
    sheet.setAttribute("role", "dialog");
    document.body.appendChild(sheet);
    sheet.addEventListener("click", onSheetClick);
  }

  /** Fourth slot: Hausbau for its owner, otherwise the household plan. */
  function fourthTab() {
    return isVisible(navButton("hausbau")) ? "hausbau" : "household";
  }

  function renderBar() {
    if (!bar) return;
    const tab = activeTab();
    const fourth = fourthTab();
    const label = (name) => navButton(name)?.textContent.trim() || name;
    const item = (name, icon, text) =>
      `<button type="button" data-bar="${name}" class="${tab === name ? "active" : ""}" aria-label="${text}">${svg(icon)}<span>${text}</span></button>`;
    const inMore = !["dashboard", "bookings", fourth].includes(tab);
    bar.innerHTML =
      item("dashboard", "dashboard", "Übersicht") +
      item("bookings", "bookings", label("bookings")) +
      `<button type="button" data-bar="add" class="mobile-add" aria-label="Neuer Eintrag">+</button>` +
      item(fourth, fourth, label(fourth)) +
      `<button type="button" data-bar="more" class="${inMore ? "active" : ""}" aria-label="Mehr">${svg("more")}<span>Mehr</span></button>`;
  }

  function openSheet(kind) {
    const select = document.getElementById("quickAddSelect");
    let html = "";
    if (kind === "add") {
      const options = [...(select?.options || [])].filter((option) => option.value && !option.hidden);
      html = `<h2>Neuer Eintrag</h2><div class="sheet-list">${options
        .map((option) => `<button type="button" data-add="${option.value}">${option.textContent.trim()}</button>`)
        .join("")}</div>`;
    } else {
      const tabs = [...document.querySelectorAll("#tabs .nav-btn")].filter(isVisible);
      html = `<h2>Bereiche</h2><div class="sheet-grid">${tabs
        .map((button) => `<button type="button" data-tab="${button.dataset.tab}" class="${button.classList.contains("active") ? "active" : ""}">${button.textContent.trim()}</button>`)
        .join("")}</div><button type="button" class="btn btn-ghost btn-full" data-shell="panel">Filter &amp; Konto</button>`;
    }
    sheet.innerHTML = `<div class="sheet-grip" aria-hidden="true"></div>${html}`;
    sheet.setAttribute("aria-label", kind === "add" ? "Neuer Eintrag" : "Bereiche");
    document.body.classList.remove("panel-open");
    sheet.classList.add("is-open");
    setBackdrop(true);
  }

  function closeSheet() {
    sheet?.classList.remove("is-open");
  }

  function closeAll() {
    closeSheet();
    document.body.classList.remove("panel-open");
    document.querySelectorAll('[data-shell="panel"]').forEach((button) => button.setAttribute("aria-expanded", "false"));
    setBackdrop(false);
  }

  function goTo(tab) {
    navButton(tab)?.click();
    window.scrollTo({ top: 0 });
  }

  function onBarClick(event) {
    const button = event.target.closest("[data-bar]");
    if (!button) return;
    const name = button.dataset.bar;
    if (name === "add" || name === "more") {
      if (sheet.classList.contains("is-open")) closeAll();
      else openSheet(name);
      return;
    }
    closeAll();
    goTo(name);
  }

  function onSheetClick(event) {
    const add = event.target.closest("[data-add]");
    if (add) {
      closeAll();
      const select = document.getElementById("quickAddSelect");
      select.value = add.dataset.add;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }
    const tab = event.target.closest("[data-tab]");
    if (tab) {
      closeAll();
      goTo(tab.dataset.tab);
    }
  }

  /* ---- wiring ---------------------------------------------------------- */

  function sync() {
    updateMonthLabel();
    if (phone.matches) buildBar();
    renderBar();
  }

  document.addEventListener("click", (event) => {
    const control = event.target.closest("[data-shell]");
    if (!control) return;
    const action = control.dataset.shell;
    if (action === "prev") shiftMonth(-1);
    if (action === "next") shiftMonth(1);
    if (action === "panel") setPanel(!document.body.classList.contains("panel-open"));
    if (action === "close") closeAll();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeAll();
  });
  document.addEventListener("change", (event) => {
    if (event.target === monthInput()) updateMonthLabel();
  });
  document.addEventListener("DOMContentLoaded", () => {
    // Tab switches from anywhere (cards, quick add) keep the bar's highlight right.
    document.getElementById("tabs")?.addEventListener("click", () => requestAnimationFrame(renderBar));
    sync();
  });
  phone.addEventListener?.("change", () => {
    closeAll();
    sync();
  });

  window.AppShell = { sync };
})();
