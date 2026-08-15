<script>
  // Choropleth with a switchable indicator layer (dimensión / IVEI /
  // exclusión / hiperexposición), plus a scatter of exclusión vs.
  // hiperexposición - the two independent digital-vulnerability mechanisms.
  // Reuses the same GeoJSON as the main dashboard's EcuadorMap.
  import { geoMercator, geoPath } from "d3-geo";
  import rawGeoData from "../../../data/ecuador_provinces.geo.json";
  import { provinceKey, displayName } from "../../utils/geo";
  import { alertLevelHex } from "../../utils/alertLevel";

  export let mapa; // { capas, provincias, nacional }
  export let onSelect = (name) => {};

  let capa = "IVEI";

  const WIDTH = 480;
  const HEIGHT = 560;

  const geoData = {
    ...rawGeoData,
    features: rawGeoData.features
      .filter((f) => f.properties.dpa_despro !== "ZONA NO DELIMITADA")
      .map((f) => ({ ...f, properties: { ...f.properties, province: displayName(f.properties.dpa_despro) } })),
  };
  const mainlandFeatures = geoData.features.filter((f) => f.properties.province !== "Galápagos");
  const galapagosFeatures = geoData.features.filter((f) => f.properties.province === "Galápagos");
  const mainProjection = geoMercator().fitExtent(
    [
      [12, 12],
      [WIDTH - 12, HEIGHT - 12],
    ],
    { type: "FeatureCollection", features: mainlandFeatures }
  );
  const mainPath = geoPath(mainProjection);
  const insetProjection = geoMercator().fitSize([90, 90], { type: "FeatureCollection", features: galapagosFeatures });
  const insetPath = geoPath(insetProjection);

  $: byKey = Object.fromEntries((mapa?.provincias ?? []).map((p) => [provinceKey(p.provincia), p]));

  function valueFor(feature) {
    return byKey[provinceKey(feature.properties.province)]?.[capa] ?? null;
  }

  function colorFor(feature) {
    const v = valueFor(feature);
    if (v == null) return "#e4e7eb";
    // RES reads inverted: high resilience should look "safe", not "alarming".
    return alertLevelHex(capa === "RES" ? 100 - v : v);
  }

  let hovered = null;
  let mouse = { x: 0, y: 0 };
  function onMove(e) {
    mouse = { x: e.offsetX, y: e.offsetY };
  }
</script>

<div class="obs-map">
  <div class="chips">
    {#each mapa?.capas ?? [] as c}
      <button class="chip" class:on={capa === c.codigo} style={capa === c.codigo ? `background:${c.color};border-color:${c.color};color:#fff` : ""} on:click={() => (capa = c.codigo)}>
        {c.nombre}
      </button>
    {/each}
  </div>

  <div class="grid">
    <div class="canvas">
      <svg viewBox="0 0 {WIDTH} {HEIGHT}" preserveAspectRatio="xMidYMid meet" on:mousemove={onMove} role="img" aria-label="Mapa de {capa}">
        <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#eaf0f6" />
        {#each mainlandFeatures as feature}
          {@const key = provinceKey(feature.properties.province)}
          <path
            d={mainPath(feature)}
            fill={colorFor(feature)}
            stroke="#fff"
            stroke-width="1"
            class="province"
            role="button"
            tabindex="0"
            on:click={() => onSelect(feature.properties.province)}
            on:keydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(feature.properties.province))}
            on:mouseenter={() => (hovered = key)}
            on:mouseleave={() => (hovered = null)}
          >
            <title>{feature.properties.province}</title>
          </path>
        {/each}
        <g transform="translate(4,4)">
          <rect width="90" height="90" rx="4" fill="#fff" stroke="var(--hairline-strong)" />
          {#each galapagosFeatures as feature}
            <path d={insetPath(feature)} fill={colorFor(feature)} stroke="#fff" stroke-width="0.8" class="province" role="button" tabindex="0" on:click={() => onSelect(feature.properties.province)} on:keydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(feature.properties.province))} />
          {/each}
        </g>
      </svg>
      {#if hovered && byKey[hovered]}
        {@const p = byKey[hovered]}
        <div class="tooltip" style="left:{mouse.x + 14}px; top:{mouse.y + 10}px;">
          <strong>{p.provincia}</strong>
          <div>{capa} <b>{p[capa]?.toFixed?.(1) ?? "—"}</b></div>
          <div class="muted">Puesto {p.rank} de 24 · {p.nivel}</div>
        </div>
      {/if}
    </div>

    <div class="rank-panel">
      <h3>Ranking · {mapa?.capas?.find((c) => c.codigo === capa)?.nombre ?? capa}</h3>
      <div class="rank-list">
        {#each [...(mapa?.provincias ?? [])].sort((a, b) => (capa === "RES" ? a[capa] - b[capa] : b[capa] - a[capa])) as p, i}
          <button class="rank-row" on:click={() => onSelect(p.provincia)}>
            <span class="rk" style="background:{alertLevelHex(capa === 'RES' ? 100 - p[capa] : p[capa])}">{i + 1}</span>
            <span class="rk-name">{p.provincia}{p.n_lb === 0 ? " ·" : ""}<span class="rk-tag">{p.n_lb === 0 ? " sin muestra LB" : ""}</span></span>
            <span class="rk-val">{p[capa]?.toFixed?.(1) ?? "—"}</span>
          </button>
        {/each}
      </div>
    </div>
  </div>
  <p class="note">Haz clic en una provincia (mapa o ranking) para ver su perfil completo.</p>
</div>

<style>
  .obs-map {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .chips {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }
  .chip {
    padding: 6px 12px;
    border: 1px solid var(--hairline-strong);
    background: var(--card);
    border-radius: 999px;
    cursor: pointer;
    font-size: 12px;
    font-family: var(--body);
    color: var(--ink-mid);
  }
  .chip.on {
    font-weight: 700;
  }
  .grid {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
    gap: 14px;
    min-height: 0;
  }
  .canvas {
    position: relative;
    border: 1px solid var(--hairline);
    border-radius: 8px;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: auto;
    display: block;
  }
  .province {
    cursor: pointer;
    transition: filter 0.12s ease;
  }
  .province:hover {
    filter: brightness(0.92);
  }
  .tooltip {
    position: absolute;
    pointer-events: none;
    background: #fff;
    border: 1px solid var(--hairline-strong);
    box-shadow: 0 4px 14px rgba(28, 43, 58, 0.12);
    color: var(--ink);
    padding: 6px 10px;
    border-radius: 6px;
    font-size: 12px;
    line-height: 1.4;
    white-space: nowrap;
    font-family: var(--mono);
  }
  .tooltip .muted {
    color: var(--ink-dim);
    font-size: 10.5px;
  }
  .rank-panel {
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .rank-panel h3 {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--ink-dim);
    margin: 0 0 8px;
    font-weight: 700;
  }
  .rank-list {
    display: flex;
    flex-direction: column;
    max-height: 480px;
    overflow-y: auto;
    border: 1px solid var(--hairline);
    border-radius: 8px;
  }
  .rank-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    background: none;
    border: none;
    border-bottom: 1px solid var(--hairline);
    cursor: pointer;
    text-align: left;
    font-family: inherit;
  }
  .rank-row:last-child {
    border-bottom: none;
  }
  .rank-row:hover {
    background: var(--brand-soft);
  }
  .rk {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 20px;
    height: 20px;
    border-radius: 5px;
    font-size: 10.5px;
    font-weight: 700;
    color: #fff;
    flex: 0 0 auto;
  }
  .rk-name {
    flex: 1;
    font-size: 12px;
    color: var(--ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rk-tag {
    font-size: 9.5px;
    color: var(--ink-dim);
  }
  .rk-val {
    font-family: var(--mono);
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink);
  }
  .note {
    font-size: 11px;
    color: var(--ink-dim);
    margin: 0;
  }
  @media (max-width: 760px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
