<script>
  import { getMethodology } from "../utils/api";

  let modalOpen = false;
  let methodology = null;
  let copied = false;

  async function openMethodology() {
    modalOpen = true;
    if (!methodology) methodology = await getMethodology();
  }

  async function copyCitation() {
    const text = "Fuente: Índice de Vulnerabilidad ante la Desinformación (IVD) 2024 — INEC 2024 y Latinobarómetro 2024, Ecuador.";
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch (e) {
      // Clipboard API unavailable (non-secure context, permissions) - fail quietly, the button just won't confirm.
    }
  }
</script>

<div class="source-bar">
  <span class="source-badge">
    <span class="dot" aria-hidden="true"></span>
    Latinobarómetro 2024 · n=1200
  </span>
  <button class="link-btn" on:click={openMethodology}>Metodología</button>
  <button class="link-btn" on:click={copyCitation}>{copied ? "✓ copiado" : "Cómo citar"}</button>
</div>

{#if modalOpen}
  <div class="backdrop" on:click={() => (modalOpen = false)}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-head">
        <h3>Metodología</h3>
        <button class="close" on:click={() => (modalOpen = false)}>×</button>
      </div>
      {#if !methodology}
        <p class="loading">Cargando…</p>
      {:else}
        <p class="desc">{methodology.description}</p>
        <h4>Dimensiones del IVD</h4>
        <dl>
          {#each Object.entries(methodology.ivd_layer.dimensions) as [name, desc]}
            <dt>{name}</dt>
            <dd>{desc}</dd>
          {/each}
        </dl>
        <div class="meta-row">
          <div>
            <span class="meta-label">Cobertura</span>
            <p>{methodology.ivd_layer.coverage}</p>
          </div>
          <div>
            <span class="meta-label">Imputación</span>
            <p>{methodology.ivd_layer.imputation}</p>
          </div>
        </div>
        <div class="cite-box">
          <span class="meta-label">Cómo citar</span>
          <p>Índice de Vulnerabilidad ante la Desinformación (IVD) 2024 — {methodology.ivd_layer.source}</p>
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .source-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .source-badge {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-size: 11px;
    color: var(--ink-mid);
    border: 1px solid var(--hairline-strong);
    padding: 5px 11px;
    border-radius: 20px;
    white-space: nowrap;
  }
  .source-badge .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--brand);
  }
  .link-btn {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--brand);
    background: none;
    border: 1px solid var(--hairline-strong);
    padding: 5px 10px;
    border-radius: 20px;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.12s ease;
  }
  .link-btn:hover {
    background: var(--brand-soft);
  }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(28, 43, 58, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }
  .modal {
    background: var(--card);
    border-radius: 10px;
    padding: 20px 24px;
    width: 480px;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 12px 32px rgba(28, 43, 58, 0.25);
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  h3 {
    font-family: var(--display);
    font-size: 18px;
    margin: 0;
    color: var(--ink);
  }
  h4 {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-dim);
    margin: 14px 0 6px;
  }
  .close {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--ink-dim);
    cursor: pointer;
  }
  .loading {
    color: var(--ink-dim);
    font-size: 12px;
  }
  .desc {
    font-size: 13px;
    color: var(--ink-mid);
    line-height: 1.5;
  }
  dl {
    margin: 0;
  }
  dt {
    font-weight: 700;
    font-size: 12.5px;
    color: var(--ink);
    margin-top: 6px;
  }
  dd {
    margin: 1px 0 0;
    font-size: 12px;
    color: var(--ink-mid);
    line-height: 1.4;
  }
  .meta-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 14px;
  }
  .meta-label {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--ink-dim);
  }
  .meta-row p {
    font-size: 12px;
    color: var(--ink-mid);
    margin: 3px 0 0;
    line-height: 1.4;
  }
  .cite-box {
    margin-top: 14px;
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 10px 12px;
  }
  .cite-box p {
    font-family: var(--mono);
    font-size: 11.5px;
    color: var(--ink);
    margin: 3px 0 0;
  }
</style>
