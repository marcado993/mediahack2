<script>
  // Hub-and-spoke reading of one province's IVD, in the spirit of an
  // Obsidian local graph: the province is the center node, its three IVD
  // dimensions are the first ring. D1/D2 fan out to their raw indicators (5
  // and 4 items - legible at this scale); D3's 9 institutions would just
  // crowd into unreadable labels at this size, so that node expands into a
  // list on hover instead of nine more leaf nodes.
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
          <filter id="node-shadow" x="-150%" y="-150%" width="400%" height="400%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.6" flood-color="#1c2b3a" flood-opacity="0.28" />
          </filter>
        </defs>

        <circle cx={CX} cy={CY} r={R1} fill="none" stroke="var(--hairline)" stroke-width="1" stroke-dasharray="2 4" />

        {#each graph.dims as d}
          <path
            d={curve(graph.root.x, graph.root.y, d.x, d.y, 14)}
            fill="none"
            stroke={alertLevelHex(d.value)}
            stroke-width={edgeWidth(d.value, 3)}
            opacity="0.7"
          />
        {/each}
        {#each graph.dims as d}
          {#each d.raws as r}
            <path d={curve(d.x, d.y, r.x, r.y, 6)} fill="none" stroke={alertLevelHex(r.value)} stroke-width={edgeWidth(r.value, 1.6)} opacity="0.45" />
          {/each}
        {/each}

        {#each graph.dims as d}
          {#each d.raws as r}
            <circle
              cx={r.x}
              cy={r.y}
              r="3.6"
              fill="#fff"
              stroke={alertLevelHex(r.value)}
              stroke-width="2"
              class="node raw"
              on:mouseenter={() => (hoverNode = { label: r.label, value: r.value, x: r.x, y: r.y })}
              on:mouseleave={() => (hoverNode = null)}
            />
            <text x={r.x} y={r.y - 8} text-anchor="middle" class="raw-label">{r.label}</text>
          {/each}
        {/each}

        {#each graph.dims as d}
          <circle
            cx={d.x}
            cy={d.y}
            r="13"
            fill={alertLevelHex(d.value)}
            filter="url(#node-shadow)"
            class="node dim"
            on:mouseenter={() => (hoverNode = { label: d.label, value: d.value, x: d.x, y: d.y, list: d.list })}
            on:mouseleave={() => (hoverNode = null)}
          />
          <text x={d.x} y={d.y + (d.y > CY ? 26 : -19)} text-anchor="middle" class="dim-label">{d.label}</text>
          <text x={d.x} y={d.y + 4} text-anchor="middle" class="node-value">{d.value ?? "—"}</text>
          {#if d.list}
            <text x={d.x} y={d.y + (d.y > CY ? 38 : -7)} text-anchor="middle" class="hint-label">{d.list.length} instituciones ›</text>
          {/if}
        {/each}

        <circle cx={graph.root.x} cy={graph.root.y} r="25" fill={alertLevelHex(graph.root.value)} filter="url(#node-shadow)" class="node root" />
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
  }
  svg {
    width: 100%;
    height: 100%;
  }
  .node {
    cursor: pointer;
    transition: r 0.12s ease;
  }
  .node.raw:hover {
    r: 5.5;
  }
  .node.dim:hover {
    r: 15;
  }
  .dim-label {
    font-family: var(--body);
    font-weight: 500;
    font-size: 11px;
    fill: var(--ink-mid);
  }
  .hint-label {
    font-family: var(--mono);
    font-size: 8px;
    fill: var(--brand);
  }
  .node-value {
    font-family: var(--mono);
    font-size: 10px;
    fill: #fff;
    font-weight: 700;
  }
  .raw-label {
    font-family: var(--body);
    font-size: 8px;
    fill: var(--ink-dim);
  }
  .root-value {
    font-family: var(--display);
    font-size: 18px;
    fill: #fff;
    font-weight: 700;
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
