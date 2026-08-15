<script>
  import { getSegmentadoresComparar } from "../../utils/api";

  export let provincias = [];
  export let initialA = null;
  export let initialB = null;

  let a = initialA;
  let b = initialB;
  let data = null;
  let loading = false;
  let failed = false;

  async function load() {
    if (!a || !b) return;
    loading = true;
    failed = false;
    data = null;
    try {
      data = await getSegmentadoresComparar(a, b);
    } catch (e) {
      failed = true;
    } finally {
      loading = false;
    }
  }

  $: if (provincias.length && !a) a = provincias[0];
  $: if (provincias.length && !b) b = provincias[1] ?? provincias[0];
  $: if (a && b) load();

  function toneClass(direction, diff) {
    if (diff == null) return "eq";
    if (direction === 1) return diff > 0 ? "up" : diff < 0 ? "dn" : "eq";
    if (direction === -1) return diff > 0 ? "dn" : diff < 0 ? "up" : "eq";
    return "eq";
  }
</script>

<div class="compare">
  <div class="pickers">
    <label>
      Provincia A
      <select bind:value={a}>
        {#each provincias as p}<option value={p}>{p}</option>{/each}
      </select>
    </label>
    <label>
      Provincia B
      <select bind:value={b}>
        {#each provincias as p}<option value={p}>{p}</option>{/each}
      </select>
    </label>
  </div>

  {#if loading}
    <div class="loading">Comparando…</div>
  {:else if failed}
    <div class="loading">No se pudo cargar la comparación.</div>
  {:else if data}
    <div class="grid g2">
      {#each [data.a, data.b] as p}
        <div class="card">
          <h3>{p.provincia}</h3>
          <div class="headline">
            <div class="big">{p.ivei?.toFixed(1)}</div>
            <span class="pill">{p.nivel}</span>
          </div>
          <div class="dims">
            {#each p.dimensiones as d}
              <div class="dimrow">
                <span class="nm">{d.nombre}</span>
                <div class="tr"><div class="fl" style="width:{Math.max(2, d.valor)}%; background:{d.color}"></div></div>
                <span class="vl">{d.valor?.toFixed(1)}</span>
              </div>
            {/each}
          </div>
          <p class="desc"><b>{p.perfil}.</b> {p.perfil_desc}</p>
        </div>
      {/each}
    </div>

    <div class="card">
      <h3>Indicador por indicador</h3>
      <div class="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Indicador</th>
              <th class="num">{data.a.provincia}</th>
              <th class="num">{data.b.provincia}</th>
              <th class="num">Dif.</th>
              <th class="num">Nacional</th>
              <th>Unidad</th>
            </tr>
          </thead>
          <tbody>
            {#each data.indicadores as row}
              <tr>
                <td>{row.label}<div class="srcline">{row.source}</div></td>
                <td class="num"><b>{row.a?.toFixed(1) ?? "—"}</b></td>
                <td class="num"><b>{row.b?.toFixed(1) ?? "—"}</b></td>
                <td class="num {toneClass(row.direction, row.diferencia)}">{row.diferencia == null ? "" : (row.diferencia >= 0 ? "+" : "−") + Math.abs(row.diferencia).toFixed(1)}</td>
                <td class="num muted">{row.nacional?.toFixed(1) ?? "—"}</td>
                <td class="muted">{row.unit}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/if}
</div>

<style>
  .compare {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .pickers {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
    min-width: 0;
  }
  .pickers label {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
    color: var(--ink-dim);
    font-weight: 600;
    min-width: 0;
  }
  select {
    font: inherit;
    font-size: 13px;
    padding: 7px 11px;
    border: 1px solid var(--hairline-strong);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
    /* <select> keeps its widest-option content as an intrinsic minimum in
       flex/grid layouts unless explicitly zeroed - without this it forced
       every ancestor up to the page wider than the viewport on mobile. */
    min-width: 0;
    max-width: 100%;
  }
  .loading {
    padding: 24px;
    color: var(--ink-dim);
    font-size: 13px;
  }
  .grid.g2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .card h3 {
    font-size: 13px;
    margin: 0 0 8px;
    color: var(--ink);
    font-weight: 700;
  }
  .headline {
    display: flex;
    align-items: baseline;
    gap: 10px;
    margin-bottom: 12px;
  }
  .big {
    font-family: var(--display);
    font-size: 30px;
    font-weight: 700;
    color: var(--brand);
  }
  .pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: var(--brand);
  }
  .dimrow {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 11.5px;
    margin-bottom: 6px;
  }
  .nm {
    width: 130px;
    color: var(--ink-dim);
    flex: none;
  }
  .tr {
    flex: 1;
    height: 8px;
    background: var(--card-alt);
    border-radius: 4px;
  }
  .fl {
    height: 100%;
    border-radius: 4px;
  }
  .vl {
    width: 34px;
    text-align: right;
    font-weight: 700;
    font-family: var(--mono);
    flex: none;
  }
  .desc {
    font-size: 12.5px;
    color: var(--ink-mid);
    margin: 10px 0 0;
    line-height: 1.5;
  }
  .table-scroll {
    overflow: auto;
    max-height: 560px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  th {
    text-align: left;
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.045em;
    color: var(--ink-dim);
    padding: 7px 8px;
    border-bottom: 1px solid var(--hairline);
    font-weight: 700;
    position: sticky;
    top: 0;
    background: var(--card);
  }
  td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--hairline);
  }
  .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .muted {
    color: var(--ink-dim);
  }
  .srcline {
    font-size: 9.5px;
    color: var(--ink-dim);
    margin-top: 2px;
  }
  .up {
    color: var(--tier-critico);
  }
  .dn {
    color: #1f7a4d;
  }
  .eq {
    color: var(--ink-dim);
  }
  @media (max-width: 760px) {
    .grid.g2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
