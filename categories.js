// Kategorien neu ordnen: preview and run the move to the new category tree.
// The server finds every category that is really used (also in old bookings),
// suggests a new name for each and only renames after a full backup; it checks
// afterwards that no booking or amount went missing. Only the owner sees this.
(() => {
  "use strict";

  const app = () => window.FinanceApp;
  let inventory = null;
  let busy = false;

  function root() {
    return document.getElementById("categoryMigrationCard");
  }

  function isOwner() {
    // The server only sends the Hausbau block to the owner.
    return !!app()?.data?.hausbau;
  }

  function esc(value) {
    return app().escapeHtml(value == null ? "" : String(value));
  }

  function label(main, sub) {
    return sub ? `${main} › ${sub}` : main;
  }

  function sync() {
    const card = root();
    if (!card) return;
    card.hidden = !isOwner();
    if (!card.dataset.built) {
      card.dataset.built = "1";
      card.innerHTML = `
        <div class="card-header">
          <div>
            <h2>Kategorien neu ordnen</h2>
            <p>Findet alle Kategorien, die in Buchungen, Fixkosten und Urlaubsausgaben vorkommen, und ordnet sie dem neuen Kategoriebaum zu. Vorher wird das ganze Google Sheet kopiert; danach wird geprüft, dass jeder Eintrag und jeder Betrag erhalten ist.</p>
          </div>
        </div>
        <div class="actions-row">
          <button class="btn btn-ghost" type="button" data-cm="load">Vorschau laden</button>
          <button class="btn btn-primary" type="button" data-cm="run" disabled>Umstellung durchführen</button>
        </div>
        <p class="cm-summary" data-cm="summary"></p>
        <div class="table-scroll">
          <table class="data-table" data-cm="table" hidden>
            <thead>
              <tr>
                <th>Modul</th>
                <th>Heute</th>
                <th>Einträge</th>
                <th>Betrag</th>
                <th>Neue Hauptkategorie</th>
                <th>Neue Unterkategorie</th>
                <th></th>
              </tr>
            </thead>
            <tbody></tbody>
          </table>
        </div>
        <datalist id="cmMainList"></datalist>`;
      card.addEventListener("click", onClick);
      card.addEventListener("input", onInput);
    }
  }

  function onClick(event) {
    const action = event.target.closest("[data-cm]")?.dataset.cm;
    if (action === "load") load();
    if (action === "run") run();
  }

  function onInput(event) {
    const input = event.target.closest("input[data-index]");
    if (!input || !inventory) return;
    const row = inventory.categories[Number(input.dataset.index)];
    row[input.dataset.field] = input.value.trim();
    const status = input.closest("tr").querySelector(".cm-status");
    status.outerHTML = statusPill(row);
    renderSummary();
  }

  function changes(row) {
    return row.new_main !== row.main_category || row.new_sub !== row.sub_category;
  }

  function statusPill(row) {
    if (!row.new_main) return '<span class="pill cm-status cm-warn">Hauptkategorie fehlt</span>';
    return changes(row)
      ? '<span class="pill cm-status cm-move">wird umbenannt</span>'
      : '<span class="pill cm-status">bleibt</span>';
  }

  function renderSummary() {
    const el = root().querySelector('[data-cm="summary"]');
    const runBtn = root().querySelector('[data-cm="run"]');
    if (!inventory) {
      el.textContent = "";
      runBtn.disabled = true;
      return;
    }
    const rows = inventory.categories;
    const moving = rows.filter(changes);
    const entries = rows.reduce((sum, r) => sum + r.bookings + r.fixed_costs + r.trip_expenses, 0);
    const invalid = rows.some((r) => !r.new_main);
    el.textContent =
      `${rows.length} Kategorien in Verwendung mit ${entries} Einträgen. ` +
      `${moving.length} werden umbenannt, ${rows.length - moving.length} bleiben wie sie sind. ` +
      "Du kannst jede Zuordnung vorher ändern.";
    runBtn.disabled = busy || invalid || !moving.length;
  }

  function renderTable() {
    const table = root().querySelector('[data-cm="table"]');
    const mains = new Set(inventory.tree.map((g) => g.main));
    inventory.categories.forEach((r) => mains.add(r.new_main));
    document.getElementById("cmMainList").innerHTML = [...mains]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "de"))
      .map((m) => `<option value="${esc(m)}"></option>`)
      .join("");
    table.querySelector("tbody").innerHTML = inventory.categories
      .map((row, index) => {
        const count = row.bookings + row.fixed_costs + row.trip_expenses;
        const parts = [];
        if (row.bookings) parts.push(`${row.bookings} Buchungen`);
        if (row.fixed_costs) parts.push(`${row.fixed_costs} Fixkosten`);
        if (row.trip_expenses) parts.push(`${row.trip_expenses} Urlaub`);
        return `
          <tr>
            <td>${esc(row.module)}</td>
            <td>${esc(label(row.main_category, row.sub_category))}</td>
            <td title="${esc(parts.join(", "))}">${count || "nur Liste"}</td>
            <td>${count ? esc(app().currency(row.amount)) : "–"}</td>
            <td><input type="text" list="cmMainList" data-index="${index}" data-field="new_main" value="${esc(row.new_main)}" aria-label="Neue Hauptkategorie für ${esc(label(row.main_category, row.sub_category))}" /></td>
            <td><input type="text" data-index="${index}" data-field="new_sub" value="${esc(row.new_sub)}" aria-label="Neue Unterkategorie für ${esc(label(row.main_category, row.sub_category))}" /></td>
            <td>${statusPill(row)}</td>
          </tr>`;
      })
      .join("");
    table.hidden = false;
  }

  async function load() {
    if (busy) return;
    busy = true;
    app().clearMessage();
    const loadBtn = root().querySelector('[data-cm="load"]');
    loadBtn.disabled = true;
    loadBtn.textContent = "Lade …";
    try {
      const result = await app().apiPost("categoryInventory", {});
      inventory = { categories: result.categories || [], tree: result.tree || [] };
      renderTable();
    } catch (err) {
      app().showMessage(
        /Unknown action/i.test(err.message)
          ? "Das Backend kennt die Umstellung noch nicht. Bitte zuerst Categories.gs in Apps Script anlegen und eine neue Version bereitstellen."
          : err.message,
        "error"
      );
    } finally {
      busy = false;
      loadBtn.disabled = false;
      loadBtn.textContent = "Vorschau neu laden";
      renderSummary();
    }
  }

  async function run() {
    if (busy || !inventory) return;
    const moving = inventory.categories.filter(changes).length;
    const ok = window.confirm(
      `${moving} Kategorien werden umbenannt. Vorher wird eine vollständige Kopie des Google Sheets angelegt. Fortfahren?`
    );
    if (!ok) return;
    busy = true;
    renderSummary();
    const runBtn = root().querySelector('[data-cm="run"]');
    runBtn.textContent = "Stelle um …";
    try {
      const mapping = inventory.categories.map((r) => ({
        module: r.module,
        main_category: r.main_category,
        sub_category: r.sub_category,
        new_main: r.new_main,
        new_sub: r.new_sub
      }));
      const result = await app().apiPost("categoryMigrate", { mapping });
      await app().refreshAfterWrite(result);
      const m = result.migration || {};
      inventory = null;
      root().querySelector('[data-cm="table"]').hidden = true;
      app().showMessage(
        `Umstellung fertig: ${m.changedRows || 0} Einträge umbenannt, ${m.addedCategories || 0} Kategorien ergänzt. ` +
        `Alle Einträge und Beträge sind geprüft. Sicherung: „${m.backupName || "Kopie im Google Drive"}“.`,
        "success"
      );
    } catch (err) {
      app().showMessage(err.message, "error");
    } finally {
      busy = false;
      runBtn.textContent = "Umstellung durchführen";
      renderSummary();
    }
  }

  window.CategoryMigration = { sync };
})();
