<script>
  import { geoMercator, geoPath } from "d3-geo";
  import rawGeoData from "../../data/ecuador_provinces.geo.json";
  import { provinceKey, displayName } from "../utils/geo";
  import { alertLevelHex } from "../utils/alertLevel";
  import PanelHeader from "../molecules/PanelHeader.svelte";
  import ScaleLegend from "../atoms/ScaleLegend.svelte";

  export let indexByProvince = {};
  export let selected = null;
  export let highlightKey = null; // cross-highlight from hovering a CTA elsewhere on the page (e.g. the empty-state's "start with X" button)
  export let onSelect = (key, name) => {};

  const WIDTH = 520;
  const HEIGHT = 620;
  const INSET_SIZE = 104;

  // Source uses dpa_despro in ALL CAPS ("CANAR") plus a non-province
  // "ZONA NO DELIMITADA" feature - normalize to .properties.province with
  // proper display casing so the rest of this component reads naturally,
  // and drop the undelimited-zone feature.
  const geoData = {
    ...rawGeoData,
    features: rawGeoData.features
      .filter((f) => f.properties.dpa_despro !== "ZONA NO DELIMITADA")
      .map((f) => ({ ...f, properties: { ...f.properties, province: displayName(f.properties.dpa_despro) } })),
  };

  const mainlandFeatures = geoData.features.filter((f) => f.properties.province !== "Galápagos");
  const galapagosFeatures = geoData.features.filter((f) => f.properties.province === "Galápagos");
  const mainlandFC = { type: "FeatureCollection", features: mainlandFeatures };
  const galapagosFC = { type: "FeatureCollection", features: galapagosFeatures };

  const mainProjection = geoMercator().fitExtent(
    [
      [14, 14],
      [WIDTH - 14, HEIGHT - 14],
    ],
    mainlandFC
  );
  const mainPath = geoPath(mainProjection);
  const insetProjection = geoMercator().fitSize([INSET_SIZE, INSET_SIZE], galapagosFC);
  const insetPath = geoPath(insetProjection);

  function colorFor(feature) {
    const key = provinceKey(feature.properties.province);
    return alertLevelHex(indexByProvince[key]?.vulnerability_index);
  }

  function isImputed(feature) {
    const key = provinceKey(feature.properties.province);
    return indexByProvince[key]?.confiabilidad_muestra === "Sin muestra (imputado nacional)";
  }

  let hovered = null;
  let mouse = { x: 0, y: 0 };
  function onMove(event) {
    mouse = { x: event.offsetX, y: event.offsetY };
  }

  $: activeKey = hovered || highlightKey || selected;

  // Selection marker: echo the *actual province shape* outward from itself
  // (not a generic circle) - three staggered copies of its own <path>,
  // reused via <use>, scaling from their own fill-box so each ring follows
  // the real coastline. Tied to `selected` rather than to the click, so it
  // keeps breathing for as long as that province is the active one. Slow and
  // low-contrast on purpose: it should read as a calm sonar marking "you are
  // here", not a heartbeat competing with the numbers.
  $: echoKey = selected;

  // First-time guidance (Nielsen "help and documentation" / recognition over
  // recall): a reader landing here has no reason to know the map is
  // clickable. Shown once as an inline banner - never a popover over the
  // data itself (a floating callout can sit on top of a real province
  // value, which reads as obscuring data on a fact-checking tool) - then
  // remembered so returning visitors aren't nagged.
  const HINT_KEY = "mediahack_map_hint_seen";
  let showHint = typeof localStorage !== "undefined" && !localStorage.getItem(HINT_KEY);
  function dismissHint() {
    if (!showHint) return;
    showHint = false;
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch (e) {
      // localStorage unavailable (private mode, etc.) - hint just won't persist across reloads
    }
  }

  // Direct on-map callouts for the extremes, like a press map annotates the
  // headline number instead of making the reader hunt for it in a legend.
  $: withData = mainlandFeatures.filter((f) => indexByProvince[provinceKey(f.properties.province)]?.vulnerability_index != null);
  $: maxFeature = withData.length
    ? withData.reduce((a, b) =>
        indexByProvince[provinceKey(b.properties.province)].vulnerability_index >
        indexByProvince[provinceKey(a.properties.province)].vulnerability_index
          ? b
          : a
      )
    : null;
  $: minFeature = withData.length
    ? withData.reduce((a, b) =>
        indexByProvince[provinceKey(b.properties.province)].vulnerability_index <
        indexByProvince[provinceKey(a.properties.province)].vulnerability_index
          ? b
          : a
      )
    : null;

  function callout(feature, side) {
    const [cx, cy] = mainPath.centroid(feature);
    const dx = side === "left" ? -46 : 46;
    return { cx, cy, lx: cx + dx, ly: cy - 30, anchor: side === "left" ? "end" : "start" };
  }
</script>

<div class="map-wrap">
  <PanelHeader eyebrow="MAPA" title="Vulnerabilidad por provincia">
    <ScaleLegend />
  </PanelHeader>

  {#if showHint}
    <div class="hint-banner">
      <span>Haz clic en una provincia del mapa para ver sus indicadores.</span>
      <button class="hint-dismiss" on:click={dismissHint} aria-label="Cerrar sugerencia">×</button>
    </div>
  {/if}

  <div class="canvas">
    <svg
      viewBox="0 0 {WIDTH} {HEIGHT}"
      preserveAspectRatio="xMidYMid meet"
      on:mousemove={onMove}
      role="img"
      aria-label="Mapa de vulnerabilidad por provincia"
    >
      <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill="#eaf0f6" />

      <defs>
        <filter id="select-halo" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="4.5" />
        </filter>
        <pattern id="imputed-hatch" width="6" height="6" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="transparent" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="#ffffff" stroke-width="1.6" opacity="0.55" />
        </pattern>
      </defs>

      {#each mainlandFeatures as feature}
        {@const key = provinceKey(feature.properties.province)}
        {#if selected === key}
          <path d={mainPath(feature)} fill="none" stroke="var(--brand)" stroke-width="7" opacity="0.35" filter="url(#select-halo)" />
        {/if}
      {/each}

      <g>
        {#each mainlandFeatures as feature, i}
          {@const key = provinceKey(feature.properties.province)}
          <path
            id="province-path-{key}"
            d={mainPath(feature)}
            fill={colorFor(feature)}
            stroke={selected === key || highlightKey === key ? "var(--brand)" : "#ffffff"}
            stroke-width={selected === key ? 2.6 : highlightKey === key ? 2 : 1}
            class="province"
            class:hovered={hovered === key}
            class:external-highlight={highlightKey === key}
            style="animation-delay: {i * 22}ms"
            role="button"
            tabindex="0"
            on:click={() => {
              dismissHint();
              onSelect(key, feature.properties.province);
            }}
            on:keydown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), dismissHint(), onSelect(key, feature.properties.province))}
            on:mouseenter={() => (hovered = key)}
            on:mouseleave={() => (hovered = null)}
            on:focus={() => (hovered = key)}
            on:blur={() => (hovered = null)}
          >
            <title>{feature.properties.province}{indexByProvince[key]?.vulnerability_index != null ? ` — índice ${indexByProvince[key].vulnerability_index}` : " — sin datos"}</title>
          </path>
          {#if isImputed(feature)}
            <path d={mainPath(feature)} fill="url(#imputed-hatch)" pointer-events="none" />
          {/if}
        {/each}
      </g>

      {#each mainlandFeatures as feature}
        {@const key = provinceKey(feature.properties.province)}
        {#if activeKey === key}
          {@const [cx, cy] = mainPath.centroid(feature)}
          <circle {cx} {cy} r="9" fill="none" stroke="var(--brand)" stroke-width="1.6" class="ping" />
          <circle {cx} {cy} r="3" fill="var(--brand)" stroke="#fff" stroke-width="1.2" />
        {/if}
      {/each}

      <!-- press-style callouts: the extremes are labeled directly, not left to the legend -->
      {#if maxFeature}
        {@const c = callout(maxFeature, "right")}
        {@const val = indexByProvince[provinceKey(maxFeature.properties.province)].vulnerability_index}
        <g class="callout">
          <line x1={c.cx} y1={c.cy} x2={c.lx} y2={c.ly} stroke="var(--tier-critico)" stroke-width="1" />
          <circle cx={c.cx} cy={c.cy} r="2.2" fill="var(--tier-critico)" />
          <text x={c.lx + (c.anchor === "end" ? -4 : 4)} y={c.ly - 3} text-anchor={c.anchor} class="callout-label">{maxFeature.properties.province}</text>
          <text x={c.lx + (c.anchor === "end" ? -4 : 4)} y={c.ly + 9} text-anchor={c.anchor} class="callout-value" fill="var(--tier-critico)">{val} · máx.</text>
        </g>
      {/if}
      {#if minFeature}
        {@const c = callout(minFeature, "left")}
        {@const val = indexByProvince[provinceKey(minFeature.properties.province)].vulnerability_index}
        <g class="callout">
          <line x1={c.cx} y1={c.cy} x2={c.lx} y2={c.ly} stroke="var(--ink-mid)" stroke-width="1" />
          <circle cx={c.cx} cy={c.cy} r="2.2" fill="var(--ink-mid)" />
          <text x={c.lx + (c.anchor === "end" ? -4 : 4)} y={c.ly - 3} text-anchor={c.anchor} class="callout-label">{minFeature.properties.province}</text>
          <text x={c.lx + (c.anchor === "end" ? -4 : 4)} y={c.ly + 9} text-anchor={c.anchor} class="callout-value" fill="var(--ink-mid)">{val} · mín.</text>
        </g>
      {/if}

      <g transform="translate(6, 6)">
        <rect width={INSET_SIZE} height={INSET_SIZE} rx="4" fill="#fff" stroke="var(--hairline-strong)" stroke-width="1" />
        <text x="5" y="13" font-family="var(--mono)" font-size="7.5" letter-spacing="0.06em" fill="var(--ink-dim)">GALÁPAGOS</text>
        {#each galapagosFeatures as feature}
          {@const key = provinceKey(feature.properties.province)}
          <path
            d={insetPath(feature)}
            fill={colorFor(feature)}
            stroke={selected === key ? "var(--brand)" : "#ffffff"}
            stroke-width={selected === key ? 1.8 : 0.8}
            class="province"
            on:click={() => {
              dismissHint();
              onSelect(key, feature.properties.province);
            }}
            on:mouseenter={() => (hovered = key)}
            on:mouseleave={() => (hovered = null)}
          />
        {/each}
      </g>

      {#if echoKey}
        {@const echoColor = alertLevelHex(indexByProvince[echoKey]?.vulnerability_index)}
        <g class="echo-group" style="--echo-color: {echoColor}">
          <use href="#province-path-{echoKey}" class="echo echo-1" />
          <use href="#province-path-{echoKey}" class="echo echo-2" />
          <use href="#province-path-{echoKey}" class="echo echo-3" />
        </g>
      {/if}

      {#if withData.some((f) => isImputed(f))}
        <g transform="translate({WIDTH - 132}, {HEIGHT - 22})">
          <rect width="12" height="12" fill="url(#imputed-hatch)" stroke="var(--hairline-strong)" />
          <text x="16" y="10" font-family="var(--mono)" font-size="8" fill="var(--ink-dim)">dato imputado (n=0)</text>
        </g>
      {/if}
    </svg>

    {#if hovered}
      {@const entry = indexByProvince[hovered]}
      <div class="tooltip" style="left:{mouse.x + 14}px; top:{mouse.y + 10}px;">
        <strong>{entry?.province ?? hovered}</strong>
        {#if entry?.vulnerability_index != null}
          <div>IVD <b>{entry.vulnerability_index}</b> · {entry.nivel}</div>
          <div class="muted">n={entry.n_latinobarometro}{entry.low_confidence ? " · muestra baja" : ""}</div>
        {:else}
          <div class="muted">sin datos INEC (Galápagos)</div>
        {/if}
      </div>
    {/if}

  </div>
</div>

<style>
  .map-wrap {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    border-radius: 8px;
    overflow: hidden;
    border: 1px solid var(--hairline);
  }
  svg {
    width: 100%;
    height: 100%;
    display: block;
  }
  .province {
    cursor: pointer;
    transition: filter 0.12s ease, stroke 0.1s ease-out, stroke-width 0.1s ease-out, transform 0.1s ease-out;
    transform-box: fill-box;
    transform-origin: center;
    animation: province-in 0.5s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  .province.hovered {
    filter: brightness(0.93);
  }
  .province.external-highlight {
    filter: drop-shadow(0 2px 3px rgba(28, 43, 58, 0.35));
  }
  @keyframes province-in {
    from {
      opacity: 0;
      transform: scale(0.85) translateY(6px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }
  .hint-banner {
    flex: 0 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    background: var(--brand-soft);
    border: 1px solid color-mix(in srgb, var(--brand) 25%, var(--hairline));
    border-radius: 6px;
    padding: 6px 10px;
    margin-bottom: 8px;
    font-size: 11.5px;
    color: var(--brand);
  }
  .hint-dismiss {
    border: none;
    background: none;
    color: inherit;
    opacity: 0.7;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
    padding: 0 0 0 4px;
    flex-shrink: 0;
  }
  .hint-dismiss:hover {
    opacity: 1;
  }
  .ping {
    /* One gentle pulse when a province becomes active, then it settles into
       a plain static marker - a loop here read as a literal heartbeat and
       competes with reading the data, which is exactly the "no animation
       in a loop" rule this dashboard follows. */
    animation: pulse 1s ease-out;
    transform-box: fill-box;
    transform-origin: center;
  }
  @keyframes pulse {
    0% {
      r: 5;
      opacity: 0.9;
    }
    70%,
    100% {
      r: 16;
      opacity: 0;
    }
  }
  .echo-group {
    pointer-events: none;
  }
  /* Echo the province's own outline outward from itself, not a generic
     circle - fill-box is what makes scale() expand from the shape's own
     center instead of the SVG origin, so it grows following the real
     coastline. One shot, never a loop (a province pulsing forever would
     compete with reading its data). */
  .echo {
    fill: none;
    stroke: var(--echo-color, var(--brand));
    transform-box: fill-box;
    transform-origin: center;
    /* Infinite while the province stays selected, but slow (2.4s) and
       staggered so the three rings read as one continuous outward wave
       rather than a repeating thump. */
    animation: echo-out 2.4s cubic-bezier(0.15, 0.55, 0.35, 1) infinite;
  }
  .echo-1 {
    stroke-width: 2.6;
    --start-op: 0.5;
  }
  .echo-2 {
    stroke-width: 1.8;
    --start-op: 0.34;
    animation-delay: 800ms;
  }
  .echo-3 {
    stroke-width: 1.2;
    --start-op: 0.22;
    animation-delay: 1600ms;
  }
  @keyframes echo-out {
    /* A percentage scale grows by very different absolute pixel amounts
       depending on the province's own size - a big province (Manabí,
       Guayas) blew straight past the map's edge and got clipped almost
       instantly, while a small one (Santa Elena) stayed on screen long
       enough to read. Capped low enough that the wave stays visible
       against the map edge regardless of which province it's echoing. */
    0% {
      transform: scale(1);
      opacity: var(--start-op, 0.5);
    }
    100% {
      transform: scale(1.16);
      opacity: 0;
    }
  }
  .callout-label {
    font-family: var(--body);
    font-weight: 600;
    font-size: 9.5px;
    fill: var(--ink);
  }
  .callout-value {
    font-family: var(--mono);
    font-weight: 700;
    font-size: 10px;
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
    z-index: 10;
    font-family: var(--mono);
  }
  .tooltip .muted {
    color: var(--ink-dim);
    font-size: 10.5px;
  }
  @media (prefers-reduced-motion: reduce) {
    .ping,
    .province,
    .echo {
      animation: none;
    }
    .echo {
      opacity: 0;
    }
  }
</style>
