<script>
  import { onMount } from "svelte";
  import { getSegmentadoresTabla } from "../../utils/api";

  export let onSelect = (name) => {};

  let data = null;
  let loading = true;
  let failed = false;
  let sortKey = "rank";
  let sortDir = 1;
  let search = "";

  onMount(async () => {
    try {
      data = await getSegmentadoresTabla();
    } catch (e) {
      failed = true;
    } finally {
      loading = false;
    }
  });

  function sortBy(key) {
    if (sortKey === key) sortDir = -sortDir;
    else {
      sortKey = key;
      sortDir = 1;
    }
  }

  $: filas = data?.filas ?? [];
  $: visibles = filas
    .filter((f) => f.provincia.toLowerCase().includes(search.toLowerCase()))
    .slice()
    .sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string") return sortDir * va.localeCompare(vb);
      return sortDir * (va - vb);
    });
</script>

<div class="obs-table">
  <div class="toolbar">
    <input type="search" placeholder="Buscar provincia…" bind:value={search} />
    <span class="count">{visibles.length} de {filas.length} provincias</span>
  </div>

  {#if loading}
    <div class="loading">Cargando tabla…</div>
  {:else if failed}
    <div class="loading">No se pudo cargar la tabla de datos.</div>
  {:else}
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th on:click={() => sortBy("rank")} class:active={sortKey === "rank"}>#</th>
            <th on:click={() => sortBy("provincia")} class:active={sortKey === "provincia"}>Provincia</th>
            <th on:click={() => sortBy("nivel")} class:active={sortKey === "nivel"}>Nivel</th>
            {#each data.columnas as c}
              <th class="num" on:click={() => sortBy(c.key)} class:active={sortKey === c.key} title="{c.label} ({c.unit})">{c.key}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each visibles as fila}
            <tr on:click={() => onSelect(fila.provincia)}>
              <td>{fila.rank != null ? Math.round(fila.rank) : "—"}</td>
              <td class="prov">{fila.provincia}</td>
              <td>{fila.nivel}</td>
              {#each data.columnas as c}
                <td class="num">{fila[c.key] != null ? fila[c.key].toFixed(1) : "—"}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3">Nacional</td>
            {#each data.columnas as c}
              <td class="num">{data.nacional[c.key] != null ? data.nacional[c.key].toFixed(1) : "—"}</td>
            {/each}
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="note">Clic en una fila para ver el perfil completo de la provincia. Columnas: {#each data.columnas as c, i}{c.label} ({c.key}){i < data.columnas.length - 1 ? " · " : ""}{/each}</p>
  {/if}
</div>

<style>
  .obs-table {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .toolbar {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  input[type="search"] {
    font: inherit;
    font-size: 13px;
    padding: 7px 11px;
    border: 1px solid var(--hairline-strong);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
    max-width: 240px;
  }
  .count {
    font-size: 11.5px;
    color: var(--ink-dim);
    font-family: var(--mono);
  }
  .loading {
    padding: 24px;
    color: var(--ink-dim);
    font-size: 13px;
  }
  .table-scroll {
    overflow: auto;
    max-height: 620px;
    border: 1px solid var(--hairline);
    border-radius: 8px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--ink-dim);
    padding: 7px 8px;
    border-bottom: 1px solid var(--hairline);
    font-weight: 700;
    position: sticky;
    top: 0;
    background: var(--card);
    cursor: pointer;
    white-space: nowrap;
  }
  th.active {
    color: var(--brand);
  }
  td {
    padding: 5px 8px;
    border-bottom: 1px solid var(--hairline);
    white-space: nowrap;
  }
  td.prov {
    font-weight: 600;
    color: var(--ink);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-family: var(--mono);
  }
  tbody tr {
    cursor: pointer;
  }
  tbody tr:hover td {
    background: var(--brand-soft);
  }
  tfoot td {
    font-weight: 700;
    background: var(--card-alt);
    border-top: 2px solid var(--hairline-strong);
    border-bottom: none;
  }
  .note {
    font-size: 10.5px;
    color: var(--ink-dim);
    margin: 0;
    line-height: 1.5;
  }
</style>
