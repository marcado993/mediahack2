<script>
  import StatCard from "../molecules/StatCard.svelte";
  import AlertBadge from "../atoms/AlertBadge.svelte";
  import MonoValue from "../atoms/MonoValue.svelte";
  import StoryAngle from "../molecules/StoryAngle.svelte";
  import AskModule from "../molecules/AskModule.svelte";
  import TrendsPanel from "../molecules/TrendsPanel.svelte";

  export let detail = null;

  const DIMENSIONS = [
    { key: "d1_socioeconomica", label: "D1 · Socioeconómica" },
    { key: "d2_educativa", label: "D2 · Educativa" },
    { key: "d3_desconfianza_institucional", label: "D3 · Desconfianza institucional" },
  ];

  $: isImputed = detail?.confiabilidad_muestra === "Sin muestra (imputado nacional)";

  let copied = false;
  async function copyCitation() {
    const text = `${detail.province}: IVD ${detail.ivd} (${detail.nivel}) — Índice de Vulnerabilidad ante la Desinformación 2024, INEC y Latinobarómetro Ecuador.`;
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch (e) {
      // Clipboard unavailable - button just won't confirm.
    }
  }
</script>

<div class="panel">
  <div class="panel-head">
    <div>
      <div class="eyebrow">PROVINCIA · #{detail.ranking} de 23</div>
      <h2>{detail.province}</h2>
    </div>
    <div class="composite">
      <MonoValue value={detail.ivd} size={36} variant="display" animate />
      <AlertBadge value={detail.ivd} />
    </div>
  </div>

  <!-- Outside .scroll on purpose: a journalist opening this panel for the
       first time was never scrolling far enough to discover the media-listening
       action down at the bottom. -->
  <AskModule province={detail.province} ivd={detail.ivd} nivel={detail.nivel} />
  <TrendsPanel province={detail.province} />

  <div class="scroll">
    <div class="confiabilidad" class:imputed={isImputed}>
      {#if isImputed}
        <svg class="info-icon" viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.3" />
          <line x1="8" y1="7" x2="8" y2="11.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
          <circle cx="8" cy="4.7" r="0.9" fill="currentColor" />
        </svg>
      {/if}
      Confiabilidad de la muestra Latinobarómetro: <b>{detail.confiabilidad_muestra}</b>
      <span class="muted">(n={detail.n_latinobarometro})</span>
    </div>

    <div class="grid">
      {#each DIMENSIONS as d, i}
        <div class="card-slot" style="animation-delay: {i * 70}ms">
          <StatCard
            label={d.label}
            value={detail[d.key]}
            sub={d.key === "d3_desconfianza_institucional" && detail.d3_desconfianza_bruta_pct != null
              ? `encuesta: ${detail.d3_desconfianza_bruta_pct}% · ajustada: ${detail.d3_desconfianza_suavizada_pct}%`
              : null}
          />
        </div>
      {/each}
    </div>

    <StoryAngle {detail} />
  </div>

  <div class="footer">
    <div class="nivel-line">
      Nivel de vulnerabilidad (IVD): <strong>{detail.nivel}</strong>
    </div>
    <button class="cite-btn" on:click={copyCitation}>
      {copied ? "✓ cita copiada" : "Copiar cita con fuente"}
    </button>
  </div>
</div>

<style>
  .panel {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 12px;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    height: 100%;
  }
  .panel-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--ink-dim);
  }
  h2 {
    font-family: var(--display);
    font-weight: 700;
    font-size: 24px;
    margin: 2px 0 0;
    color: var(--ink);
  }
  .composite {
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
  }
  .confiabilidad {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    color: var(--ink-mid);
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 6px 9px;
  }
  .confiabilidad.imputed {
    background: color-mix(in srgb, var(--brand) 6%, var(--card-alt));
    border-color: color-mix(in srgb, var(--brand) 30%, var(--hairline));
    color: var(--brand);
  }
  .info-icon {
    flex-shrink: 0;
  }
  .confiabilidad b {
    color: var(--ink);
  }
  .confiabilidad.imputed b {
    color: var(--brand);
  }
  .confiabilidad .muted {
    color: var(--ink-dim);
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .card-slot {
    animation: rise 0.35s ease-out backwards;
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateX(-4px);
    }
    to {
      opacity: 1;
      transform: translateX(0);
    }
  }
  .footer {
    border-top: 1px dashed var(--hairline);
    padding-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .nivel-line {
    font-size: 12px;
    color: var(--ink-mid);
  }
  .nivel-line strong {
    color: var(--ink);
  }
  .cite-btn {
    align-self: flex-start;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--brand);
    background: var(--brand-soft);
    border: 1px solid transparent;
    padding: 6px 12px;
    border-radius: 20px;
    cursor: pointer;
    transition: transform 0.12s ease;
  }
  .cite-btn:active {
    transform: scale(0.96);
  }
  @media (prefers-reduced-motion: reduce) {
    .card-slot {
      animation: none;
    }
  }
</style>
