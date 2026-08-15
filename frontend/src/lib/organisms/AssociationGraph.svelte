<script>
  // Hub-and-spoke reading of one province's IVD, in the spirit of an
  // Obsidian local graph: the province is the center node, its three IVD
  // dimensions are the first ring. D1/D2 fan out to their raw indicators (5
  // and 4 items - legible at this scale); D3's 9 institutions would just
  // crowd into unreadable labels at this size, so that node expands into a
  // list on hover instead of nine more leaf nodes.
  //
  // Visual treatment: same palette and typography as the rest of the
  // dashboard (no separate dark theme for this one panel) - just glossy
  // orb nodes instead of flat circles, and hovering a node dims every
  // unrelated branch so the reader's eye follows one thread at a time.
  import { alertLevelHex, alertLevel } from "../utils/alertLevel";

  export let detail = null; // ProvinceDetail from the API, or null
  export let bare = false; // true when an ancestor already renders the panel chrome/header

  const W = 460;
  const H = 480;
  const CX = W / 2;
  const CY = H / 2 + 4;
  const R1 = 122;
  const R2 = 78;

  const DIM_DEFS = [
    { key: "d1_socioeconomica", label: "D1 · Socioeconómica", raw: "d1_subindicadores", expandRaws: true },
    { key: "d2_educativa", label: "D2 · Educativa", raw: "d2_subindicadores", expandRaws: true },
    { key: "d3_desconfianza_institucional", label: "D3 · Desconfianza institucional", raw: "desconfianza_por_institucion", expandRaws: false },
  ];

  const SHORT_LABEL = {
    "Pobreza por ingresos": "Pobreza (ingr.)",
    "Pobreza extrema por ingresos": "Pobreza extrema",
    "Pobreza multidimensional": "Pobreza multidim.",
    "Pobreza por NBI": "NBI",
    "Coeficiente de Gini": "Gini",
    "Tasa de analfabetismo": "Analfabetismo",
    "Años promedio de escolaridad": "Escolaridad",
    "Tasa neta asistencia secundaria": "Asist. secundaria",
    "Tasa neta asistencia bachillerato": "Asist. bachillerato",
    "Institución electoral": "Electoral",
    "Poder Judicial": "Judicial",
    "Partidos políticos": "Partidos",
  };

  // Tier key drives which radial-gradient orb a node gets - keep in sync
  // with the gradients declared in <defs> below.
  const TIER_KEY = { BAJO: "bajo", MODERADO: "moderado", ALTO: "alto", "CRÍTICO": "critico", "SIN DATO": "nodata" };
  function tierKey(value) {
    return TIER_KEY[alertLevel(value).tag] ?? "nodata";
  }

  function polar(cx, cy, r, angleDeg) {
    const rad = (angleDeg * Math.PI) / 180;
    return [cx + r * Math.sin(rad), cy - r * Math.cos(rad)];
  }

  // Gentle outward bow instead of a straight line - reads as a real network,
  // not a wireframe.
  function curve(x1, y1, x2, y2, bow = 10) {
    const mx = (x1 + x2) / 2;
    const my = (y1 + y2) / 2;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * bow;
    const ny = (dx / len) * bow;
    return `M ${x1} ${y1} Q ${mx + nx} ${my + ny} ${x2} ${y2}`;
  }

  // Thicker edge = higher value, so line weight carries information instead
  // of being an arbitrary hierarchy cue.
  function edgeWidth(value, max) {
    if (value == null) return 1;
    return +(1 + (value / 100) * max).toFixed(2);
  }

  $: graph = (() => {
    if (!detail) return null;
    const dims = DIM_DEFS.map((def, i) => {
      const angle = (360 / DIM_DEFS.length) * i;
      const [x, y] = polar(CX, CY, R1, angle);
      const value = detail[def.key];
      const rawEntries = Object.entries(detail[def.raw] ?? {});
      let raws = [];
      if (def.expandRaws) {
        const spread = Math.min(70, 16 * Math.max(rawEntries.length - 1, 0) + 18);
        raws = rawEntries.map(([label, v], j, arr) => {
          const rAngle = angle - spread / 2 + (arr.length > 1 ? (spread / (arr.length - 1)) * j : 0);
          const [rx, ry] = polar(x, y, R2, rAngle);
          return { label: SHORT_LABEL[label] ?? label, value: v, x: rx, y: ry };
        });
      }
      const list = !def.expandRaws ? rawEntries.map(([label, v]) => ({ label: SHORT_LABEL[label] ?? label, value: v })) : null;
      return { ...def, x, y, value, raws, list };
    });
    return { root: { x: CX, y: CY, value: detail.ivd }, dims };
  })();

  let hoverNode = null;
  let hoverBranch = null; // index into graph.dims, or null when nothing/root is hovered
</script>

<div class="graph-wrap" class:bare>

  {#if !graph}
    <div class="empty">
      <svg viewBox="0 0 200 160" class="ghost">
        <circle cx="100" cy="80" r="14" fill="none" stroke="var(--hairline-strong)" stroke-width="1.5" stroke-dasharray="3 3" />
        {#each Array(6) as _, i}
          {@const a = (i * 360) / 6}
          {@const [x, y] = polar(100, 80, 52, a)}
          <path d={curve(100, 80, x, y, 4)} fill="none" stroke="var(--hairline)" stroke-width="1" />
          <circle cx={x} cy={y} r="5" fill="none" stroke="var(--hairline-strong)" stroke-width="1.5" />
        {/each}
      </svg>
      <p>Selecciona una provincia en el mapa o la lista<br />para desplegar su red de indicadores.</p>
    </div>
  {:else}
    <div class="canvas">
      <svg viewBox="0 0 {W} {H}">
        <defs>
          <radialGradient id="grad-bajo" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#eef4fc" />
            <stop offset="55%" stop-color="#c7d6e8" />
            <stop offset="100%" stop-color="#93aecb" />
          </radialGradient>
          <radialGradient id="grad-moderado" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#c9def4" />
            <stop offset="55%" stop-color="#7fa8d4" />
            <stop offset="100%" stop-color="#4d7bac" />
          </radialGradient>
          <radialGradient id="grad-alto" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#ffe1ab" />
            <stop offset="55%" stop-color="#e8a33d" />
            <stop offset="100%" stop-color="#b87b1f" />
          </radialGradient>
          <radialGradient id="grad-critico" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#f28f80" />
            <stop offset="55%" stop-color="#b23a2e" />
            <stop offset="100%" stop-color="#7a2018" />
          </radialGradient>
          <radialGradient id="grad-nodata" cx="35%" cy="30%" r="75%">
            <stop offset="0%" stop-color="#f5f6f8" />
            <stop offset="55%" stop-color="#c9cfd6" />
            <stop offset="100%" stop-color="#9aa2ac" />
          </radialGradient>
          <radialGradient id="root-halo" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stop-color={alertLevelHex(graph.root.value)} stop-opacity="0.22" />
            <stop offset="100%" stop-color={alertLevelHex(graph.root.value)} stop-opacity="0" />
          </radialGradient>
        </defs>

        <circle cx={CX} cy={CY} r={R1} fill="none" stroke="var(--hairline)" stroke-width="1" stroke-dasharray="2 5" />

        <circle class="root-halo" cx={graph.root.x} cy={graph.root.y} r="46" fill="url(#root-halo)" />

        {#each graph.dims as d, i}
          <path
            class="edge"
            class:dimmed={hoverBranch !== null && hoverBranch !== i}
            d={curve(graph.root.x, graph.root.y, d.x, d.y, 14)}
            fill="none"
            stroke={alertLevelHex(d.value)}
            stroke-width={edgeWidth(d.value, 3)}
            
          />
        {/each}
        {#each graph.dims as d, i}
          {#each d.raws as r}
            <path
              class="edge raw-edge"
              class:dimmed={hoverBranch !== null && hoverBranch !== i}
              d={curve(d.x, d.y, r.x, r.y, 6)}
              fill="none"
              stroke={alertLevelHex(r.value)}
              stroke-width={edgeWidth(r.value, 1.6)}
              
            />
          {/each}
        {/each}

        {#each graph.dims as d, i}
          {#each d.raws as r, j}
            <circle
              cx={r.x}
              cy={r.y}
              r="4.2"
              fill="url(#grad-{tierKey(r.value)})"
              stroke="#fff"
              stroke-width="1.2"
              class="node raw"
              class:dimmed={hoverBranch !== null && hoverBranch !== i}
              style="animation-delay: {120 + i * 90 + j * 45}ms"
              on:mouseenter={() => {
                hoverNode = { label: r.label, value: r.value, x: r.x, y: r.y };
                hoverBranch = i;
              }}
              on:mouseleave={() => {
                hoverNode = null;
                hoverBranch = null;
              }}
            />
            <text
              x={r.x}
              y={r.y - 9}
              text-anchor="middle"
              class="raw-label"
              class:dimmed={hoverBranch !== null && hoverBranch !== i}>{r.label}</text
            >
          {/each}
        {/each}

        {#each graph.dims as d, i}
          <circle
            cx={d.x}
            cy={d.y}
            r="14"
            fill="url(#grad-{tierKey(d.value)})"
            stroke="#fff"
            stroke-width="1.6"
            class="node dim"
            class:dimmed={hoverBranch !== null && hoverBranch !== i}
            style="animation-delay: {i * 90}ms"
            on:mouseenter={() => {
              hoverNode = { label: d.label, value: d.value, x: d.x, y: d.y, list: d.list };
              hoverBranch = i;
            }}
            on:mouseleave={() => {
              hoverNode = null;
              hoverBranch = null;
            }}
          />
          <text
            x={d.x}
            y={d.y + (d.y > CY ? 27 : -20)}
            text-anchor="middle"
            class="dim-label"
            class:dimmed={hoverBranch !== null && hoverBranch !== i}>{d.label}</text
          >
          <text x={d.x} y={d.y + 4} text-anchor="middle" class="node-value">{d.value ?? "—"}</text>
          {#if d.list}
            <text
              x={d.x}
              y={d.y + (d.y > CY ? 39 : -6)}
              text-anchor="middle"
              class="hint-label"
              class:dimmed={hoverBranch !== null && hoverBranch !== i}>{d.list.length} instituciones ›</text
            >
          {/if}
        {/each}

        <circle
          cx={graph.root.x}
          cy={graph.root.y}
          r="26"
          fill="url(#grad-{tierKey(graph.root.value)})"
          stroke="#fff"
          stroke-width="2"
          class="node root"
          
        />
        <text x={graph.root.x} y={graph.root.y + 6} text-anchor="middle" class="root-value">{graph.root.value}</text>
      </svg>

      {#if hoverNode}
        <div class="tooltip" class:list={!!hoverNode.list} style="left:{(hoverNode.x / W) * 100}%; top:{(hoverNode.y / H) * 100}%;">
          <strong>{hoverNode.label}</strong>
          {#if hoverNode.list}
            {#each hoverNode.list as item}
              <div class="tooltip-row">
                <span class="tooltip-row-label">{item.label}</span>
                <span class="tooltip-row-value" style="color:{alertLevelHex(item.value)}">{item.value ?? "—"}%</span>
              </div>
            {/each}
          {:else}
            <span style="color:{alertLevelHex(hoverNode.value)}">{hoverNode.value ?? "—"}% · {alertLevel(hoverNode.value).tag}</span>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .graph-wrap {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 12px;
    padding: 12px 14px;
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .graph-wrap.bare {
    background: none;
    border: none;
    padding: 0;
  }
  .empty {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    color: var(--ink-dim);
    text-align: center;
    padding: 20px;
  }
  .ghost {
    width: 140px;
    opacity: 0.7;
  }
  .empty p {
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
    max-width: 220px;
  }
  .canvas {
    position: relative;
    flex: 1;
    min-height: 0;
    background: var(--card-alt);
    border-radius: 10px;
    border: 1px solid var(--hairline);
  }
  svg {
    width: 100%;
    height: 100%;
  }
  .root-halo {
    animation: halo-breathe 3.2s ease-in-out infinite;
    transform-origin: center;
  }
  @keyframes halo-breathe {
    0%,
    100% {
      opacity: 0.7;
      r: 42;
    }
    50% {
      opacity: 1;
      r: 48;
    }
  }
  .edge {
    opacity: 0.7;
    transition: opacity 0.2s ease;
  }
  .raw-edge {
    opacity: 0.5;
  }
  .edge.dimmed {
    opacity: 0.08;
  }
  .node {
    cursor: pointer;
    filter: drop-shadow(0 1px 2px rgba(28, 43, 58, 0.22));
    transition: r 0.15s ease, opacity 0.2s ease, filter 0.15s ease;
    animation: node-in 0.5s cubic-bezier(0.2, 0.8, 0.3, 1) backwards;
  }
  @keyframes node-in {
    from {
      opacity: 0;
      transform: scale(0.3);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
  .node.raw:hover {
    r: 6;
    filter: drop-shadow(0 2px 4px rgba(28, 43, 58, 0.3));
  }
  .node.dim:hover {
    r: 16;
    filter: drop-shadow(0 2px 6px rgba(28, 43, 58, 0.32));
  }
  .node.dimmed {
    opacity: 0.15;
  }
  .node.root {
    filter: drop-shadow(0 2px 6px rgba(28, 43, 58, 0.28));
  }
  .dim-label {
    font-family: var(--body);
    font-weight: 500;
    font-size: 11px;
    fill: var(--ink-mid);
    transition: opacity 0.2s ease;
  }
  .hint-label {
    font-family: var(--mono);
    font-size: 8px;
    fill: var(--brand);
    transition: opacity 0.2s ease;
  }
  .node-value {
    font-family: var(--mono);
    font-size: 10px;
    fill: var(--ink);
    font-weight: 700;
    pointer-events: none;
  }
  .raw-label {
    font-family: var(--body);
    font-size: 8px;
    fill: var(--ink-dim);
    transition: opacity 0.2s ease;
  }
  text.dimmed {
    opacity: 0.15;
  }
  .root-value {
    font-family: var(--mono);
    font-size: 16px;
    fill: var(--ink);
    font-weight: 700;
    pointer-events: none;
  }
  .tooltip {
    position: absolute;
    transform: translate(-50%, -110%);
    pointer-events: none;
    background: #fff;
    border: 1px solid var(--hairline-strong);
    box-shadow: 0 4px 14px rgba(28, 43, 58, 0.15);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 11px;
    white-space: nowrap;
    display: flex;
    flex-direction: column;
    gap: 2px;
    z-index: 10;
  }
  .tooltip.list {
    transform: translate(-50%, -8px);
    align-items: stretch;
  }
  .tooltip strong {
    color: var(--ink);
    font-size: 11px;
    margin-bottom: 1px;
  }
  .tooltip span {
    font-family: var(--mono);
    font-size: 10.5px;
  }
  .tooltip-row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 10.5px;
  }
  .tooltip-row-label {
    color: var(--ink-mid);
  }
  .tooltip-row-value {
    font-family: var(--mono);
    font-weight: 600;
  }
</style>
