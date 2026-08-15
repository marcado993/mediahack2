<script>
  // The INDICADORES panel used to just say "selecciona una provincia" and
  // stop there - a dead end, not an interface (Nielsen #1 visibility of
  // system status, #6 recognition over recall, #10 contextual help). Every
  // variant here ends in an action, never just a label.
  import { alertLevelHex } from "../utils/alertLevel";

  export let provinces = [];
  export let visitedBefore = false; // lighter copy once the user already knows how this works
  export let onSelectMax = (key, name) => {};
  export let onHoverMax = () => {};
  export let onLeaveMax = () => {};

  $: maxProvince = provinces.length
    ? provinces.reduce((a, b) => ((b.vulnerability_index ?? -1) > (a.vulnerability_index ?? -1) ? b : a))
    : null;
  $: nationalAvg = provinces.length
    ? Math.round((provinces.reduce((s, p) => s + (p.vulnerability_index ?? 0), 0) / provinces.length) * 10) / 10
    : null;

  let showingNational = false;
</script>

<div class="empty-state">
  <svg class="glyph" viewBox="0 0 64 64" width="48" height="48" aria-hidden="true">
    <path
      d="M18 8 L30 6 L38 12 L48 10 L54 18 L50 28 L56 36 L48 46 L40 44 L34 54 L24 52 L20 42 L10 40 L12 28 L8 20 Z"
      fill="none"
      stroke="var(--ink-dim)"
      stroke-width="2"
      stroke-linejoin="round"
      opacity="0.4"
    />
  </svg>

  {#if showingNational && nationalAvg != null}
    <h3>Promedio nacional</h3>
    <div class="national-value" style="color:{alertLevelHex(nationalAvg)}">{nationalAvg}</div>
    <p class="subtitle">Es el promedio del Índice de Vulnerabilidad ante la Desinformación en las {provinces.length} provincias con datos. Selecciona una provincia para ver su desglose completo por dimensión.</p>
    <button class="btn-secondary" on:click={() => (showingNational = false)}>‹ volver</button>
  {:else}
    <h3>{visitedBefore ? "Elige otra provincia" : "Elige una provincia para ver sus indicadores"}</h3>
    {#if !visitedBefore}
      <p class="subtitle">Compara desconfianza institucional, brecha educativa y condiciones socioeconómicas en las 23 provincias.</p>
    {/if}

    {#if maxProvince}
      <button
        class="btn-primary"
        style="background:{alertLevelHex(maxProvince.vulnerability_index)}"
        on:click={() => onSelectMax(maxProvince)}
        on:mouseenter={() => onHoverMax(maxProvince)}
        on:mouseleave={onLeaveMax}
        on:focus={() => onHoverMax(maxProvince)}
        on:blur={onLeaveMax}
      >
        ▸ Empezar con {maxProvince.province} ({maxProvince.vulnerability_index} · la más alta)
      </button>
    {/if}

    {#if nationalAvg != null}
      <button class="btn-secondary" on:click={() => (showingNational = true)}>Ver promedio nacional</button>
    {/if}

    {#if !visitedBefore}
      <span class="hint">o haz clic en cualquier provincia del mapa</span>
    {/if}
  {/if}
</div>

<style>
  .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    text-align: center;
    padding: 24px 20px;
  }
  .glyph {
    margin-bottom: 2px;
  }
  h3 {
    font-family: var(--display);
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
    margin: 0;
    max-width: 280px;
  }
  .subtitle {
    font-size: 14px;
    color: var(--ink-mid);
    line-height: 1.5;
    margin: 0;
    max-width: 300px;
  }
  .national-value {
    font-family: var(--mono);
    font-size: 40px;
    font-weight: 700;
    line-height: 1;
  }
  .btn-primary {
    font-family: var(--body);
    font-size: 12.5px;
    font-weight: 600;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 10px 18px;
    cursor: pointer;
    margin-top: 4px;
    transition: transform 0.1s ease, filter 0.1s ease;
  }
  .btn-primary:hover {
    filter: brightness(1.06);
    transform: translateY(-1px);
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
  .hint {
    font-family: var(--mono);
    font-size: 12px;
    color: var(--ink-dim);
    margin-top: 2px;
  }
</style>
