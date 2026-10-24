// Kategorien neu ordnen: preview and run the move to the new category tree.
// The server finds every category that is really used (also in old bookings),
// suggests a new name for each and only renames after a full backup; it checks
// afterwards that no booking or amount went missing. Only the owner sees this.
(() => {
  "use strict";

  const app = () => window.FinanceApp;
  let inventory = null;
  let busy = false;

  // Refinements on top of the server's suggestions, so the mapping can improve
  // without a new backend deployment. [pattern on "main sub", new main, new sub|null=keep]
  const CLIENT_RULES = [
    [/^abos? .*(netzbetreiber|handy|mobilfunk)/, "Abos & Kommunikation", "Handy"],
    [/^abos? .*(daten|cloud|speicher)/, "Abos & Kommunikation", "Software & Cloud"],
    [/^abos? .*(unterhaltung|streaming|netflix|spotify|disney|prime)/, "Abos & Kommunikation", "Streaming"],
    [/^abos? /, "Abos & Kommunikation", null],
    [/ abos?$/, "Abos & Kommunikation", "Sonstiges"]
  ];

  // Maximilian's own categories, decided one by one (24.10.2026). Exact match on
  // "module|main|sub"; these win over every rule and are never marked "bitte prüfen".
  const DECIDED = {
    "Haushalt|Abo|Daten": ["Abos & Kommunikation", "Software & Cloud"],
    "Haushalt|Abo|Netzbetreiber": ["Abos & Kommunikation", "Handy"],
    "Haushalt|Abo|Unterhaltung": ["Abos & Kommunikation", "Streaming"],
    // Contains a Zara order (182,70 €) and an ID card fee (20 €); the bigger one decides.
    "Haushalt|Alltag|Abo": ["Shopping", "Kleidung & Schuhe"],
    "Haushalt|Alltag|Apotheke": ["Gesundheit & Pflege", "Apotheke"],
    "Haushalt|Alltag|Friseur": ["Gesundheit & Pflege", "Friseur & Körperpflege"],
    "Haushalt|Alltag|Kleidung": ["Shopping", "Kleidung & Schuhe"],
    "Haushalt|Alltag|Kosmetik": ["Gesundheit & Pflege", "Friseur & Körperpflege"],
    "Haushalt|Alltag|Online-Einkauf": ["Shopping", "Online-Einkauf"],
    "Haushalt|Arbeit|Firmenreise": ["Arbeit", "Firmenreise"],
    "Haushalt|Bank|Bancomat": ["Finanzen & Gebühren", "Bargeld (Bancomat)"],
    "Haushalt|Bank|Bankspesen": ["Finanzen & Gebühren", "Bankgebühren"],
    "Haushalt|Bank|Hausrate": ["Bank", "Hausrate"],
    "Haushalt|Bank|Investitionen": ["Sparen & Investieren", "Investitionen"],
    "Haushalt|Freizeit|Aktivitäten": ["Freizeit & Hobby", "Aktivitäten"],
    "Haushalt|Freizeit|Geschenke": ["Geschenke & Spenden", "Geschenke"],
    "Haushalt|Freizeit|Restaurant": ["Essen & Ausgehen", "Restaurant"],
    "Haushalt|Mobilität|Auto Leasing": ["Mobilität", "Leasing/Kredit"],
    "Haushalt|Mobilität|Car wash": ["Mobilität", "Service & Reifen"],
    "Haushalt|Mobilität|Laden/Tanken": ["Mobilität", "Treibstoff/Laden"],
    "Haushalt|Mobilität|Maut": ["Mobilität", "Vignette/Maut/Parken"],
    "Haushalt|Mobilität|Parken": ["Mobilität", "Vignette/Maut/Parken"],
    "Haushalt|Wohnen|Akonto-Nebenkosten": ["Wohnen", "Betriebskosten"],
    "Haushalt|Wohnen|Haushaltsbedarf": ["Lebensmittel & Haushalt", "Haushaltsbedarf"],
    "Haushalt|Wohnen|Internet": ["Wohnen", "Internet & TV/ORF"],
    "Haushalt|Wohnen|Lebensmittel": ["Lebensmittel & Haushalt", "Supermarkt"],
    "Haushalt|Wohnen|Versicherung": ["Wohnen", "Haushaltsversicherung"]
  };

  function refine(row) {
    const decided = DECIDED[`${row.module}|${row.main_category}|${row.sub_category}`];
    if (decided) {
      [row.new_main, row.new_sub] = decided;
      row.rule = "decided";
      row.uncertain = false;
      return;
    }
    if (row.module !== "Haushalt") return;
    const text = `${row.main_category} ${row.sub_category}`.toLowerCase();
    const keep = /arbeit|mapact|kaution|hausbau/.test(text);
    if (!keep) {
      for (const [pattern, main, sub] of CLIENT_RULES) {
        // A generic rule (keeps the sub) never overrides a precise server suggestion.
        if (pattern.test(text) && !(sub == null && row.rule === "sub")) {
          row.new_main = main;
          row.new_sub = sub == null ? row.sub_category : sub;
          row.rule = "client";
          break;
        }
      }
    }
    // A sub category that does not exist in the new tree is a guess: ask to check it.
    const group = inventory.tree.find((g) => g.main === row.new_main);
    row.uncertain = !!group && !group.subs.includes(row.new_sub) && (row.new_main !== row.main_category || row.new_sub !== row.sub_category);
  }

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
          <button class="btn btn-ghost" type="button" data-cm="copy" disabled>Liste kopieren</button>
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
        <datalist id="cmMainList"></datalist>
        <div class="cm-hausbau" data-cm="hausbau" hidden>
          <h3>Hausbau-Buchungen im Haushalt</h3>
          <p data-cm="hbtext"></p>
          <button class="btn btn-ghost" type="button" data-cm="hbmove">In den Hausbau-Bereich verschieben</button>
        </div>`;
      card.addEventListener("click", onClick);
      card.addEventListener("input", onInput);
    }
    renderHausbauMove();
  }

  function onClick(event) {
    const action = event.target.closest("[data-cm]")?.dataset.cm;
    if (action === "load") load();
    if (action === "run") run();
    if (action === "copy") copyList();
    if (action === "hbmove") moveHausbauBookings();
  }

  function onInput(event) {
    const input = event.target.closest("input[data-index]");
    if (!input || !inventory) return;
    const row = inventory.categories[Number(input.dataset.index)];
    row[input.dataset.field] = input.value.trim();
    row.uncertain = false;
    const status = input.closest("tr").querySelector(".cm-status");
    status.outerHTML = statusPill(row);
    renderSummary();
  }

  function changes(row) {
    return row.new_main !== row.main_category || row.new_sub !== row.sub_category;
  }

  function statusPill(row) {
    if (!row.new_main) return '<span class="pill cm-status cm-warn">Hauptkategorie fehlt</span>';
    if (row.uncertain) return '<span class="pill cm-status cm-check">bitte prüfen</span>';
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
    const unsure = rows.filter((r) => r.uncertain).length;
    el.textContent =
      `${rows.length} Kategorien in Verwendung mit ${entries} Einträgen. ` +
      `${moving.length} werden umbenannt, ${rows.length - moving.length} bleiben wie sie sind` +
      (unsure ? `, ${unsure} bitte prüfen` : "") +
      ". Du kannst jede Zuordnung vorher ändern.";
    root().querySelector('[data-cm="copy"]').disabled = false;
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

  // Plain text of the whole preview, to paste into a chat or a spreadsheet.
  async function copyList() {
    if (!inventory) return;
    const lines = [["Modul", "Hauptkategorie", "Unterkategorie", "Einträge", "Betrag", "Neu Haupt", "Neu Unter"].join("\t")]
      .concat(inventory.categories.map((r) => [
        r.module, r.main_category, r.sub_category,
        r.bookings + r.fixed_costs + r.trip_expenses,
        Number(r.amount || 0).toFixed(2).replace(".", ","),
        r.new_main, r.new_sub
      ].join("\t")));
    const text = lines.join("\n");
    const btn = root().querySelector('[data-cm="copy"]');
    try {
      await navigator.clipboard.writeText(text);
      btn.textContent = "Kopiert ✓";
    } catch (err) {
      window.prompt("Liste kopieren:", text);
    }
    setTimeout(() => { btn.textContent = "Liste kopieren"; }, 2000);
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
      inventory.categories.forEach(refine);
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

  /* ---- Hausbau bookings that were entered as household expenses ---------- */

  // Building costs belong in the Hausbau area (single source for the cockpit too);
  // as household bookings they would count as monthly costs.
  const HAUSBAU_BLOCK = "Bürokratie & Gebühren";

  function hausbauBookings() {
    const me = app().currentUserName();
    return (app().data.transactions || []).filter((row) =>
      String(row.is_deleted || "").toLowerCase() !== "ja" &&
      String(row.booking_type || "expense").toLowerCase() !== "settlement" &&
      String(row.main_category || "").trim().toLowerCase() === "hausbau" &&
      String(row.owner_user || "").trim() === me
    );
  }

  function renderHausbauMove() {
    const box = root()?.querySelector('[data-cm="hausbau"]');
    if (!box) return;
    const rows = hausbauBookings();
    box.hidden = !rows.length;
    if (!rows.length) return;
    const total = rows.reduce((sum, row) => sum + Number(row.amount || 0), 0);
    box.querySelector('[data-cm="hbtext"]').textContent =
      `${rows.length} Buchungen (${app().currency(total)}) stehen als Haushaltsausgabe unter „Hausbau“ und zählen deshalb zu den Monatskosten. ` +
      `Sie werden als bezahlte Hausbau-Kosten im Budgetblock „${HAUSBAU_BLOCK}“ übernommen (Aufteilung nach Nutzfläche) und im Haushalt gelöscht.`;
  }

  async function moveHausbauBookings() {
    const rows = hausbauBookings();
    if (busy || !rows.length) return;
    if (!window.confirm(`${rows.length} Buchungen in den Hausbau-Bereich verschieben?`)) return;
    busy = true;
    const btn = root().querySelector('[data-cm="hbmove"]');
    btn.disabled = true;
    let moved = 0;
    let last = null;
    try {
      const share = window.Hausbau?.areaShareMax?.() ?? 53.07;
      for (const row of rows) {
        btn.textContent = `Verschiebe ${moved + 1} von ${rows.length} …`;
        await app().apiPost("hausbauSave", {
          entity: "expense",
          record: {
            date: row.date,
            title: row.title || row.sub_category || "Hausbau",
            main_category: HAUSBAU_BLOCK,
            sub_category: row.sub_category || "",
            unit: "shared",
            allocation_key: "AREA",
            share_max: share,
            amount: row.amount,
            status: "bezahlt",
            paid_by: "max",
            funding_source: "eigenmittel",
            note: [row.note, `übernommen aus Haushaltsbuchung ${row.id}`].filter(Boolean).join(" · ")
          }
        });
        last = await app().apiPost("deleteTransaction", { id: row.id });
        moved++;
      }
      app().showMessage(`${moved} Buchungen in den Hausbau-Bereich verschoben.`, "success");
    } catch (err) {
      app().showMessage(`Nach ${moved} Buchungen abgebrochen: ${err.message}`, "error");
    } finally {
      busy = false;
      btn.disabled = false;
      btn.textContent = "In den Hausbau-Bereich verschieben";
      if (last) await app().refreshAfterWrite(last);
      renderHausbauMove();
    }
  }

  window.CategoryMigration = { sync };
})();
