<script>
  import { onMount } from "svelte";
  import { fade } from "svelte/transition";
  import EcuadorMap from "./lib/organisms/EcuadorMap.svelte";
  import AssociationGraph from "./lib/organisms/AssociationGraph.svelte";
  import DimensionBars from "./lib/organisms/DimensionBars.svelte";
  import PanelHeader from "./lib/molecules/PanelHeader.svelte";
  import ProvinceList from "./lib/organisms/ProvinceList.svelte";
  import StatStrip from "./lib/organisms/StatStrip.svelte";
  import IndicatorBreakdown from "./lib/organisms/IndicatorBreakdown.svelte";
  import Headline from "./lib/organisms/Headline.svelte";
  import SourceBar from "./lib/molecules/SourceBar.svelte";
  import { listProvinces, getProvince } from "./lib/utils/api";
  import { provinceKey } from "./lib/utils/geo";

  let provinces = [];
  let indexByProvince = {};
  let selectedKey = null;
  let selectedName = null;
  let detail = null;
  let detailLoading = false;
  let noDataSelected = false; // clicked Galápagos - excluded from the IVD (no INEC poverty/inequality data)
  let graphView = "bars"; // "bars" (default, comparable at a glance) | "graph" (network identity view)
  let loading = true;
  let error = null;

  async function loadProvinces() {
    provinces = await listProvinces();
    indexByProvince = Object.fromEntries(provinces.map((p) => [provinceKey(p.province), p]));
  }

  async function selectProvince(key, name) {
    selectedKey = key;
    detail = null;

    if (!indexByProvince[key]) {
      // Not in the IVD dataset (only Galápagos, which INEC has no poverty
      // data for) - don't even try the fetch, show why directly. Callers
      // (map, list) may spell a province differently than the backend does
      // ("Santo Domingo de los Tsáchilas" vs "Santo Domingo") - `name` is
      // only a reasonable label to show while we don't have the record yet.
      selectedName = name;
      noDataSelected = true;
      detailLoading = false;
      return;
    }
    // Always fetch using the backend's own spelling, never the caller's -
    // otherwise a province whose map/list label diverges from the API's
    // canonical name 404s.
    selectedName = indexByProvince[key].province;
    noDataSelected = false;
    detailLoading = true;
    const result = await getProvince(selectedName);
    // Guard against a slower stale request resolving after a newer click.
    if (selectedKey === key) {
      detail = result;
      detailLoading = false;
    }
  }

  function clearSelection() {
    selectedKey = null;
    selectedName = null;
    detail = null;
    noDataSelected = false;
  }

  onMount(async () => {
    try {
      await loadProvinces();
    } catch (e) {
      error = "No se pudo conectar con el backend (¿está corriendo en localhost:8000?).";
    } finally {
      loading = false;
    }
  });
</script>

<div class="app">
  <header class="topbar">
    <div class="brand">
      <span class="eyebrow">INFORME · REPÚBLICA DEL ECUADOR</span>
      <h1>Vulnerabilidad a la Desinformación</h1>
    </div>
    <SourceBar />
  </header>

  {#if loading}
    <div class="status">Cargando datos…</div>
  {:else if error}
    <div class="status error">{error}</div>
  {:else}
    <Headline {provinces} />
    <div class="strip-row">
      <StatStrip {provinces} />
    </div>

    <main class="body">
      <section class="map-card">
        <EcuadorMap {indexByProvince} selected={selectedKey} onSelect={selectProvince} />
      </section>

      <section class="graph-card">
        <PanelHeader eyebrow="INDICADORES" title={detail ? detail.province : ""}>
          <div class="view-toggle" role="tablist">
            <button role="tab" aria-selected={graphView === "bars"} class:active={graphView === "bars"} on:click={() => (graphView = "bars")}>Barras</button>
            <button role="tab" aria-selected={graphView === "graph"} class:active={graphView === "graph"} on:click={() => (graphView = "graph")}>Red</button>
          </div>
        </PanelHeader>
        <div class="graph-body">
          {#if graphView === "bars"}
            <DimensionBars {detail} />
          {:else}
            <AssociationGraph {detail} bare />
          {/if}
        </div>
      </section>

      <aside class="rail-panel">
        {#if noDataSelected}
          <div class="no-data-msg" transition:fade={{ duration: 150 }}>
            <p><strong>{selectedName}</strong> queda fuera del IVD: el INEC no reporta indicadores de pobreza/desigualdad para esta provincia, así que no se puede calcular la dimensión socioeconómica.</p>
            <button class="back" on:click={clearSelection}>‹ todas las provincias</button>
          </div>
        {:else if detailLoading}
          <div class="skeleton" transition:fade={{ duration: 120 }} aria-live="polite" aria-busy="true">
            <div class="skeleton-line w60"></div>
            <div class="skeleton-line w40"></div>
            <div class="skeleton-grid">
              {#each Array(6) as _}<div class="skeleton-card"></div>{/each}
            </div>
          </div>
        {:else if detail}
          <div transition:fade={{ duration: 150 }} class="rail-fill">
            <IndicatorBreakdown {detail} />
            <button class="back" on:click={clearSelection}>‹ todas las provincias</button>
          </div>
        {:else}
          <div transition:fade={{ duration: 150 }} class="rail-fill">
            <ProvinceList {provinces} selected={selectedKey} onSelect={selectProvince} />
          </div>
        {/if}
      </aside>
    </main>
  {/if}
</div>

<style>
  :global(html, body) {
    height: 100%;
    overflow: hidden;
  }
  .app {
    height: 100vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .topbar {
    flex: 0 0 auto;
    background: var(--card);
    border-bottom: 3px solid var(--brand);
    padding: 10px 20px;
    display: flex;
    flex-wrap: nowrap;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
  }
  .brand {
    min-width: 0;
  }
  .brand .eyebrow {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 500;
    letter-spacing: 0.08em;
    color: var(--brand);
    opacity: 0.7;
    margin-bottom: 4px;
    white-space: nowrap;
  }
  .brand h1 {
    font-family: var(--display);
    font-size: 27px;
    font-weight: 700;
    margin: 0;
    color: var(--ink);
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .status {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-dim);
    font-family: var(--mono);
  }
  .status.error {
    color: var(--tier-critico);
  }

  .strip-row {
    flex: 0 0 auto;
    padding: 10px 14px 0;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 1.05fr 0.9fr 300px;
    gap: 10px;
    padding: 10px 14px 14px;
  }
  .map-card,
  .graph-card,
  .rail-panel {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    box-shadow: 0 1px 3px rgba(28, 43, 58, 0.06);
  }
  .map-card,
  .graph-card {
    padding: 12px;
    min-height: 0;
  }
  .graph-card {
    display: flex;
    flex-direction: column;
  }
  .graph-body {
    flex: 1;
    min-height: 0;
  }
  .view-toggle {
    display: flex;
    border: 1px solid var(--hairline-strong);
    border-radius: 6px;
    overflow: hidden;
  }
  .view-toggle button {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.03em;
    padding: 4px 10px;
    background: var(--card);
    border: none;
    color: var(--ink-mid);
    cursor: pointer;
  }
  .view-toggle button + button {
    border-left: 1px solid var(--hairline-strong);
  }
  .view-toggle button.active {
    background: var(--brand);
    color: #fff;
  }
  .rail-panel {
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    position: relative;
  }
  .rail-fill {
    display: flex;
    flex-direction: column;
    min-height: 0;
    height: 100%;
  }
  .back {
    flex: 0 0 auto;
    background: none;
    border: none;
    border-top: 1px solid var(--hairline);
    color: var(--ink-dim);
    font-size: 11px;
    padding: 10px 8px;
    cursor: pointer;
    font-family: var(--mono);
    transition: color 0.12s ease;
  }
  .back:hover {
    color: var(--brand);
  }

  .no-data-msg {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: 100%;
  }
  .no-data-msg p {
    font-size: 12.5px;
    line-height: 1.5;
    color: var(--ink-mid);
    margin: 0;
  }
  .no-data-msg strong {
    color: var(--ink);
  }

  .skeleton {
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .skeleton-line {
    height: 14px;
    border-radius: 4px;
    background: var(--card-alt);
    animation: shimmer 1.3s ease-in-out infinite;
  }
  .skeleton-line.w60 {
    width: 60%;
    height: 20px;
  }
  .skeleton-line.w40 {
    width: 40%;
  }
  .skeleton-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }
  .skeleton-card {
    height: 58px;
    border-radius: 6px;
    background: var(--card-alt);
    animation: shimmer 1.3s ease-in-out infinite;
  }
  @keyframes shimmer {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  :global(button) {
    font: inherit;
  }
  :global(button:focus-visible),
  :global(.province:focus-visible) {
    outline: 2px solid var(--brand);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .skeleton-line,
    .skeleton-card {
      animation: none;
    }
  }
</style>
