<script>
  import { onMount } from "svelte";
  import { getSegmentadoresMetodologia } from "../../utils/api";

  let data = null;
  let loading = true;
  let failed = false;

  onMount(async () => {
    try {
      data = await getSegmentadoresMetodologia();
    } catch (e) {
      failed = true;
    } finally {
      loading = false;
    }
  });
</script>

<div class="meth">
  {#if loading}
    <div class="loading">Cargando metodología…</div>
  {:else if failed}
    <div class="loading">No se pudo cargar la metodología.</div>
  {:else if data}
    <div class="card">
      <h2>Nota metodológica</h2>
      <p class="lead">{data.descripcion}</p>
    </div>

    <div class="card">
      <h3>Dimensiones</h3>
      {#each Object.entries(data.dimensiones) as [nombre, texto]}
        <div class="item">
          <b>{nombre}</b>
          <p>{texto}</p>
        </div>
      {/each}
    </div>

    <div class="card">
      <h3>Mecanismos digitales</h3>
      {#each Object.entries(data.mecanismos_digitales) as [nombre, texto]}
        <div class="item">
          <b>{nombre}</b>
          <p>{texto}</p>
        </div>
      {/each}
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Fuentes</h3>
        <ul>
          {#each data.fuentes as f}<li>{f}</li>{/each}
        </ul>
        <p class="item-p"><b>Cobertura:</b> {data.cobertura}</p>
      </div>
      <div class="card">
        <h3>Limitaciones</h3>
        <p class="item-p">{data.limitaciones}</p>
      </div>
    </div>

    <div class="warn">{data.advertencia}</div>
  {/if}
</div>

<style>
  .meth {
    display: flex;
    flex-direction: column;
    gap: 14px;
    max-width: 900px;
  }
  .loading {
    padding: 24px;
    color: var(--ink-dim);
    font-size: 13px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .card h2 {
    font-family: var(--display);
    font-size: 16px;
    margin: 0 0 8px;
    color: var(--ink);
    font-weight: 700;
  }
  .card h3 {
    font-size: 12px;
    margin: 0 0 10px;
    font-weight: 700;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .lead {
    font-size: 13.5px;
    line-height: 1.6;
    color: var(--ink-mid);
    margin: 0;
  }
  .item {
    margin-bottom: 12px;
  }
  .item b {
    font-size: 13px;
    color: var(--ink);
  }
  .item p,
  .item-p {
    font-size: 12.5px;
    color: var(--ink-mid);
    line-height: 1.5;
    margin: 3px 0 0;
  }
  ul {
    margin: 0;
    padding-left: 18px;
  }
  li {
    font-size: 12.5px;
    color: var(--ink-mid);
    line-height: 1.6;
  }
  .grid.g2 {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 14px;
  }
  .warn {
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--ink-mid);
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 8px;
    padding: 12px 14px;
  }
  @media (max-width: 760px) {
    .grid.g2 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
