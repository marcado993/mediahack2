<script>
  let { call, oncount } = $props();

  let rows = $state([]);
  let loading = $state(true);
  let error = $state("");
  let filter = $state("pendientes");
  let edits = $state({});
  let savingId = $state("");

  const ESTADOS = [
    ["nueva", "Nueva"],
    ["en_revision", "En revisión"],
    ["respondida", "Respondida"],
  ];

  const shown = $derived(rows.filter((r) => filter === "todas" || r.estado !== "respondida"));
  const pending = $derived(rows.filter((r) => r.estado === "nueva").length);

  $effect(() => {
    oncount(pending);
  });

  async function load() {
    loading = true;
    error = "";
    try {
      const { solicitudes } = await call("/api/admin/solicitudes");
      rows = solicitudes;
      edits = Object.fromEntries(solicitudes.map((r) => [r.id, { estado: r.estado, revisado_por: r.revisado_por, nota: r.nota }]));
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
  load();

  const changed = (r) => {
    const e = edits[r.id];
    return e && (e.estado !== r.estado || e.revisado_por !== r.revisado_por || e.nota !== r.nota);
  };
  // A request can only be marked answered once a person has put their name on the review.
  const blocked = (r) => edits[r.id]?.estado === "respondida" && !edits[r.id].revisado_por.trim();

  async function save(r) {
    savingId = r.id;
    error = "";
    try {
      const rec = await call(`/api/admin/solicitudes/${r.id}`, { method: "PUT", body: JSON.stringify(edits[r.id]) });
      rows = rows.map((x) => (x.id === r.id ? rec : x));
    } catch (e) {
      error = e.message;
    } finally {
      savingId = "";
    }
  }

  const fecha = (iso) => new Date(iso).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
</script>

<main>
  <header>
    <div>
      <h2>Solicitudes de información</h2>
      <p>Ninguna cifra sale sin que una persona la revise: anota quién firmó la revisión antes de marcar una solicitud como respondida.</p>
    </div>
    <div class="seg" role="group" aria-label="Filtro">
      <button type="button" aria-pressed={filter === "pendientes"} onclick={() => (filter = "pendientes")}>Pendientes ({rows.filter((r) => r.estado !== "respondida").length})</button>
      <button type="button" aria-pressed={filter === "todas"} onclick={() => (filter = "todas")}>Todas ({rows.length})</button>
    </div>
  </header>

  {#if error}<p class="msg-err" role="alert">{error}</p>{/if}
  {#if loading}
    <p class="empty">Cargando…</p>
  {:else if !shown.length}
    <p class="empty">{filter === "pendientes" ? "No hay solicitudes pendientes. Cuando alguien use el botón «Solicitar información», aparecerá aquí." : "Todavía no hay solicitudes."}</p>
  {:else}
    <ul>
      {#each shown as r (r.id)}
        <li class:nueva={r.estado === "nueva"}>
          <div class="top">
            <strong>{r.nombre}</strong>
            <span>{r.organizacion}</span>
            <span class="mono">{r.provincia || "Todo el país"}</span>
            <span class="when">{fecha(r.creada)}{r.medio && r.medio !== "default" ? ` · desde ${r.medio}` : ""}</span>
          </div>
          <dl>
            <dt>Necesita</dt>
            <dd>{r.necesidad}</dd>
            <dt>Para qué</dt>
            <dd>{r.uso}</dd>
          </dl>
          <div class="edit">
            <label>
              <span>Estado</span>
              <select bind:value={edits[r.id].estado}>
                {#each ESTADOS as [v, l]}<option value={v}>{l}</option>{/each}
              </select>
            </label>
            <label>
              <span>Revisión firmada por</span>
              <input type="text" bind:value={edits[r.id].revisado_por} maxlength="100" placeholder="Nombre de quien revisó" />
            </label>
            <label class="wide">
              <span>Nota interna</span>
              <input type="text" bind:value={edits[r.id].nota} maxlength="1000" />
            </label>
            <div class="acts">
              <a class="btn ghost" href="mailto:{r.correo}?subject={encodeURIComponent('Tu solicitud al observatorio')}">Escribir a {r.correo}</a>
              <button class="btn red" type="button" disabled={!changed(r) || blocked(r) || savingId === r.id} onclick={() => save(r)}>{savingId === r.id ? "Guardando…" : "Guardar"}</button>
            </div>
            {#if blocked(r)}<small class="msg-err">Escribe quién firmó la revisión para marcarla como respondida.</small>{/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    max-width: 980px;
    margin: 0 auto;
    padding: 22px 22px 60px;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 24px;
  }
  header p {
    margin: 4px 0 0;
    color: var(--mut);
    max-width: 60ch;
  }
  .seg {
    display: flex;
    border: 1.5px solid var(--ink);
    border-radius: 6px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 7px 13px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .seg button[aria-pressed="true"] {
    background: var(--ink);
    color: #fff;
  }
  .empty {
    padding: 40px 0;
    color: var(--mut);
    text-align: center;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
  }
  li {
    background: var(--card);
    border: 1px solid var(--line);
    border-left: 5px solid var(--line);
    padding: 14px 18px 16px;
  }
  li.nueva {
    border-left-color: var(--red);
  }
  .top {
    display: flex;
    gap: 6px 14px;
    flex-wrap: wrap;
    align-items: baseline;
    margin-bottom: 8px;
  }
  .top strong {
    font-family: var(--display);
    font-size: 17px;
  }
  .when {
    margin-left: auto;
    color: var(--mut);
    font-size: 12.5px;
  }
  dl {
    margin: 0 0 12px;
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 4px 12px;
  }
  dt {
    font-weight: 600;
    font-size: 12.5px;
    color: var(--mut);
  }
  dd {
    margin: 0;
    white-space: pre-wrap;
  }
  .edit {
    display: grid;
    grid-template-columns: 160px 1fr;
    gap: 10px 14px;
    padding-top: 12px;
    border-top: 1px solid var(--paper);
    align-items: end;
  }
  .edit label span {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .edit input,
  .edit select {
    width: 100%;
    padding: 8px 10px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: var(--card);
  }
  .edit input:focus,
  .edit select:focus {
    border-color: var(--ink);
    outline: none;
    box-shadow: 0 0 0 3px var(--hl);
  }
  .wide,
  .acts,
  small {
    grid-column: 1 / -1;
  }
  .acts {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .acts a {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
</style>
