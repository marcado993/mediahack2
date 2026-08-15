<script>
  // Press-style horizontal bar comparison: sorted, scannable in one glance -
  // the format journalists actually redraw in Datawrapper/Illustrator, so
  // give it to them ready-made instead of only offering the node graph.
  import { alertLevelHex, alertLevel } from "../utils/alertLevel";

  export let detail = null;

  const SHORT_LABEL = {
    "Pobreza por ingresos": "Pobreza (ingresos)",
    "Pobreza extrema por ingresos": "Pobreza extrema",
    "Pobreza multidimensional": "Pobreza multidimensional",
    "Pobreza por NBI": "NBI",
    "Coeficiente de Gini": "Coef. de Gini",
    "Tasa de analfabetismo": "Analfabetismo",
    "Años promedio de escolaridad": "Escolaridad (años)",
    "Tasa neta asistencia secundaria": "Asistencia secundaria",
    "Tasa neta asistencia bachillerato": "Asistencia bachillerato",
    "Institución electoral": "Institución electoral",
    "Poder Judicial": "Poder Judicial",
    "Partidos políticos": "Partidos políticos",
  };

  const DIM_DEFS = [
    { key: "d1_socioeconomica", label: "D1 · Socioeconómica", raw: "d1_subindicadores", bruto: "d1_subindicadores_bruto" },
    { key: "d2_educativa", label: "D2 · Educativa", raw: "d2_subindicadores", bruto: "d2_subindicadores_bruto" },
    { key: "d3_desconfianza_institucional", label: "D3 · Desconfianza institucional", raw: "desconfianza_por_institucion", bruto: null },
  ];

  $: groups = detail
    ? DIM_DEFS.map((def) => ({
        ...def,
        value: detail[def.key],
        items: Object.entries(detail[def.raw] ?? {})
          .map(([label, value]) => ({
            label: SHORT_LABEL[label] ?? label,
            value,
            bruto: def.bruto ? detail[def.bruto]?.[label] : null,
          }))
          .filter((i) => i.value != null)
          .sort((a, b) => b.value - a.value),
      }))
    : [];
</script>

<div class="bars-wrap">
  {#if !detail}
    <div class="empty">
      <p>Selecciona una provincia en el mapa o la lista<br />para comparar sus indicadores.</p>
    </div>
  {:else}
    <div class="scroll">
      {#each groups as g}
        <div class="dim-block">
          <div class="dim-header">
            <span class="dim-label">{g.label}</span>
            <span class="dim-value" style="color:{alertLevelHex(g.value)}">{g.value}%</span>
          </div>
          {#each g.items as item, i}
            <div class="row" style="transition-delay: {i * 35}ms">
              <span class="row-label">{item.label}</span>
              <div class="row-track">
                <div class="row-fill" style="--w:{item.value}%; background:{alertLevelHex(item.value)}"></div>
              </div>
              <span class="row-value"
                >{item.value}%{#if item.bruto}<span class="row-bruto">· {item.bruto.valor}{item.bruto.unidad === "índice" ? "" : item.bruto.unidad}</span
                  >{/if}</span
              >
            </div>
          {/each}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .bars-wrap {
    height: 100%;
    display: flex;
    flex-direction: column;
    min-height: 0;
  }
  .empty {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-dim);
    text-align: center;
    padding: 20px;
  }
  .empty p {
    font-size: 12px;
    line-height: 1.5;
    margin: 0;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 2px 2px 4px;
  }
  .dim-block {
    margin-bottom: 12px;
  }
  .dim-header {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 4px;
    padding-bottom: 3px;
    border-bottom: 1px solid var(--hairline);
  }
  .dim-label {
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink);
  }
  .dim-value {
    font-family: var(--mono);
    font-size: 12px;
    font-weight: 700;
  }
  .row {
    display: grid;
    grid-template-columns: 108px 1fr 78px;
    align-items: center;
    gap: 6px;
    padding: 2.5px 0;
  }
  .row-label {
    font-size: 10.5px;
    color: var(--ink-mid);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .row-track {
    background: var(--card-alt);
    border-radius: 3px;
    height: 8px;
    overflow: hidden;
  }
  .row-fill {
    height: 100%;
    border-radius: 3px;
    width: var(--w, 0);
    animation: grow 0.55s cubic-bezier(0.16, 1, 0.3, 1) backwards;
  }
  @keyframes grow {
    from {
      width: 0;
    }
    to {
      width: var(--w, 0);
    }
  }
  .row-value {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-mid);
    text-align: right;
    white-space: nowrap;
  }
  .row-bruto {
    color: var(--ink-dim);
    margin-left: 3px;
  }
  @media (prefers-reduced-motion: reduce) {
    .row-fill {
      animation: none;
    }
  }
</style>
