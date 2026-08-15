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
  import IndicatorEmptyState from "./lib/molecules/IndicatorEmptyState.svelte";
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
  let detailError = false;
  let noDataSelected = false; // clicked Galápagos - excluded from the IVD (no INEC poverty/inequality data)
  let hasSelectedOnce = false; // lighter empty-state copy once the user already knows how this works
  let highlightKey = null; // cross-highlight on the map from hovering the empty state's CTA
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
    detailError = false;

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
    try {
      const result = await getProvince(selectedName);
      // Guard against a slower stale request resolving after a newer click.
      if (selectedKey === key) {
        detail = result;
        detailLoading = false;
        hasSelectedOnce = true;
      }
    } catch (e) {
      if (selectedKey === key) {
        detailError = true;
        detailLoading = false;
      }
    }
  }

  function clearSelection() {
    selectedKey = null;
    selectedName = null;
    detail = null;
    detailError = false;
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
        <EcuadorMap {indexByProvince} selected={selectedKey} {highlightKey} onSelect={selectProvince} />
      </section>

      <section class="graph-card">
        <PanelHeader eyebrow="INDICADORES" title={detail ? detail.province : ""}>
          <div class="view-toggle" role="tablist" class:disabled={!detail}>
            <button
              role="tab"
              aria-selected={graphView === "bars"}
              class:active={graphView === "bars"}
              disabled={!detail}
              on:click={() => (graphView = "bars")}>Barras</button
            >
            <button
              role="tab"
              aria-selected={graphView === "graph"}
              class:active={graphView === "graph"}
              disabled={!detail}
              on:click={() => (graphView = "graph")}>Red</button
            >
          </div>
        </PanelHeader>
        <div class="graph-body">
          {#if detailError}
            <div class="panel-message" transition:fade={{ duration: 150 }}>
              <p>No se pudieron cargar los indicadores.</p>
              <button class="btn-secondary" on:click={() => selectProvince(selectedKey, selectedName)}>Reintentar</button>
            </div>
          {:else if detailLoading}
            <div class="skeleton" transition:fade={{ duration: 120 }} aria-live="polite" aria-busy="true">
              {#each Array(3) as _}
                <div class="skeleton-group">
                  <div class="skeleton-line w40"></div>
                  {#each Array(3) as __}<div class="skeleton-bar"></div>{/each}
                </div>
              {/each}
            </div>
          {:else if noDataSelected}
            <div class="panel-message" transition:fade={{ duration: 150 }}>
              <p><strong>{selectedName}</strong> queda fuera del IVD: el INEC no reporta indicadores de pobreza/desigualdad para esta provincia.</p>
              <button class="btn-secondary" on:click={clearSelection}>Ver provincias con muestra</button>
            </div>
          {:else if detail}
            <div transition:fade={{ duration: 150 }} class="graph-fill">
              {#if graphView === "bars"}
                <DimensionBars {detail} />
              {:else}
                <AssociationGraph {detail} bare />
              {/if}
            </div>
          {:else}
            <IndicatorEmptyState
              {provinces}
              visitedBefore={hasSelectedOnce}
              onSelectMax={(p) => selectProvince(provinceKey(p.province), p.province)}
              onHoverMax={(p) => (highlightKey = provinceKey(p.province))}
              onLeaveMax={() => (highlightKey = null)}
            />
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
    display: flex;
    flex-direction: column;
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
  .view-toggle button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .graph-fill {
    height: 100%;
    min-height: 0;
  }
  .panel-message {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    padding: 24px 20px;
  }
  .panel-message p {
    font-size: 13px;
    line-height: 1.5;
    color: var(--ink-mid);
    margin: 0;
    max-width: 300px;
  }
  .panel-message strong {
    color: var(--ink);
  }
  .btn-secondary {
    font-family: var(--body);
    font-size: 12px;
    font-weight: 500;
    color: var(--brand);
    background: none;
    border: 1px solid var(--hairline-strong);
    border-radius: 8px;
    padding: 8px 16px;
    cursor: pointer;
    transition: background 0.1s ease;
  }
  .btn-secondary:hover {
    background: var(--brand-soft);
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
    gap: 14px;
  }
  .skeleton-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .skeleton-bar {
    height: 10px;
    border-radius: 3px;
    background: var(--card-alt);
    animation: shimmer 1.3s ease-in-out infinite;
  }
  .skeleton-bar:nth-child(2) {
    width: 85%;
  }
  .skeleton-bar:nth-child(3) {
    width: 65%;
  }
  .skeleton-bar:nth-child(4) {
    width: 45%;
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
    .skeleton-card,
    .skeleton-bar {
      animation: none;
    }
  }

  /* Mobile: the "no scroll" desktop constraint only works because a 3-column
     grid can show the map, indicators, and province detail side by side.
     On a phone there's no room for that - stack everything in one column
     and let the page scroll like any normal mobile page. */
  @media (max-width: 860px) {
    :global(html, body) {
      overflow: visible;
      height: auto;
    }
    .app {
      height: auto;
      min-height: 100svh;
      overflow: visible;
    }
    .topbar {
      flex-wrap: wrap;
      padding: 10px 14px;
      gap: 8px;
    }
    .brand h1 {
      font-size: 19px;
      white-space: normal;
    }
    .body {
      grid-template-columns: 1fr;
      grid-auto-rows: auto;
    }
    .map-card {
      height: 340px;
    }
    .graph-card {
      height: 380px;
    }
    .rail-panel {
      height: auto;
      min-height: 420px;
    }
  }
</style>
