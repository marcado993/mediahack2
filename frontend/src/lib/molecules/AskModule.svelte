<script>
  // "Escucha de medios": one button that fans out to every source the
  // backend can reach (fact-checkers, outlets, Facebook pages, Instagram
  // accounts) and brings back the actual publications, grouped by origin.
  // DeepSeek is the brain that picks the search terms and summarizes - it
  // never invents the citations, those come from app/news_search.py.
  import { askAssistant, searchNews } from "../utils/api";
  import { renderMarkdown } from "../utils/markdown";
  import ListeningAnimation from "./ListeningAnimation.svelte";
  import SourceGroups from "./SourceGroups.svelte";

  export let province = null;
  export let ivd = null;
  export let nivel = null;

  let modalOpen = false;
  let question = "";
  let answer = null;
  let bySource = null;
  let loading = false;
  let error = null;

  function open() {
    modalOpen = true;
    question = "";
    answer = null;
    bySource = null;
    error = null;
  }

  function reset() {
    error = null;
    answer = null;
    bySource = null;
  }

  async function ask(q) {
    if (!q || loading) return;
    loading = true;
    reset();
    try {
      const res = await askAssistant(q, { province, ivd, nivel });
      answer = res.answer;
      bySource = res.by_source ?? null;
    } catch (e) {
      error = e.message.includes("503")
        ? "El asistente no está configurado todavía (falta la clave de API en el backend)."
        : "No se pudo consultar el asistente. Intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  // Straight source sweep, no LLM in the loop - fastest path to "just show
  // me the publications".
  async function sweep(q) {
    if (loading) return;
    loading = true;
    reset();
    try {
      const res = await searchNews(q);
      bySource = res.by_source ?? {};
    } catch (e) {
      error = "No se pudo consultar las fuentes. Intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  function submit() {
    ask(question.trim());
  }
</script>

<button class="trigger" on:click={open}>
  <span class="trigger-icon" aria-hidden="true">
    <svg viewBox="0 0 20 20" width="17" height="17">
      <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" stroke-width="1.9" />
      <line x1="13.5" y1="13.5" x2="18" y2="18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" />
    </svg>
  </span>
  <span class="trigger-text">
    <strong>Escuchar medios y redes</strong>
    <small>Lupa · Ecuador Chequea · Facebook · Instagram · TikTok</small>
  </span>
</button>

{#if modalOpen}
  <div class="backdrop" on:click={() => (modalOpen = false)}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-head">
        <div>
          <h3>Escucha de medios</h3>
          {#if province}<span class="scope">Provincia: {province}</span>{/if}
        </div>
        <button class="close" on:click={() => (modalOpen = false)} aria-label="Cerrar">×</button>
      </div>

      <form on:submit|preventDefault={submit}>
        <input
          type="text"
          bind:value={question}
          autofocus
          placeholder={province ? `Ej: ¿qué se está diciendo de ${province}?` : "Ej: ¿qué desinformación circula sobre las elecciones?"}
        />
        <button type="submit" class="submit-btn" disabled={loading || !question.trim()}>
          {loading ? "…" : "Buscar"}
        </button>
      </form>

      <div class="shortcuts">
        <button class="chip" on:click={() => sweep(province || "Ecuador")} disabled={loading}>
          Todo lo reciente{province ? ` sobre ${province}` : ""}
        </button>
        <button class="chip" on:click={() => sweep("desinformación")} disabled={loading}>Desinformación</button>
        <button class="chip" on:click={() => sweep("elecciones")} disabled={loading}>Elecciones</button>
      </div>

      <div class="status" aria-live="polite">
        {#if loading}
          <ListeningAnimation />
        {:else if error}
          <p class="error">{error}</p>
        {:else if answer || bySource}
          <div class="result">
            {#if answer}
              <div class="answer-text">{@html renderMarkdown(answer)}</div>
            {/if}
            {#if bySource && Object.keys(bySource).length}
              <SourceGroups {bySource} />
            {/if}
            <span class="disclaimer">
              Las publicaciones de arriba son reales y vienen con su enlace original.
              {#if answer}El resumen lo redacta una IA a partir de ellas — verifica antes de publicar.{/if}
            </span>
          </div>
        {:else}
          <p class="hint">
            Escribe una pregunta o usa un atajo. Se consultan verificadores (Lupa Media, Ecuador
            Chequea), medios y redes en una sola pasada, y se devuelven las publicaciones con su
            enlace.
          </p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* Deliberately loud: a journalist scanning this dashboard for the first
     time was missing the old quiet outlined button entirely. */
  .trigger {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    text-align: left;
    font-family: var(--body);
    color: #fff;
    background: var(--brand);
    border: none;
    border-radius: 8px;
    padding: 11px 13px;
    cursor: pointer;
    box-shadow: 0 2px 8px color-mix(in srgb, var(--brand) 35%, transparent);
    transition: transform 0.12s ease, box-shadow 0.12s ease, filter 0.12s ease;
  }
  .trigger:hover {
    filter: brightness(1.08);
    box-shadow: 0 4px 14px color-mix(in srgb, var(--brand) 45%, transparent);
    transform: translateY(-1px);
  }
  .trigger:active {
    transform: translateY(0) scale(0.99);
  }
  .trigger-icon {
    display: flex;
    flex-shrink: 0;
  }
  .trigger-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .trigger-text strong {
    font-size: 13px;
    font-weight: 700;
  }
  .trigger-text small {
    font-family: var(--mono);
    font-size: 9px;
    opacity: 0.85;
    letter-spacing: 0.02em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(28, 43, 58, 0.45);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 70;
  }
  .modal {
    background: var(--card);
    border-radius: 10px;
    padding: 20px 24px;
    width: 560px;
    max-width: 92vw;
    max-height: 85vh;
    overflow-y: auto;
    box-shadow: 0 12px 32px rgba(28, 43, 58, 0.25);
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 12px;
  }
  h3 {
    font-family: var(--display);
    font-size: 18px;
    margin: 0;
    color: var(--ink);
  }
  .scope {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-dim);
  }
  .close {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--ink-dim);
    cursor: pointer;
    line-height: 1;
  }
  form {
    display: flex;
    gap: 8px;
  }
  input {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-family: var(--body);
    padding: 8px 10px;
    border: 1px solid var(--hairline-strong);
    border-radius: 6px;
    background: var(--card-alt);
    color: var(--ink);
  }
  input:focus-visible {
    outline: 2px solid var(--brand);
    outline-offset: 1px;
  }
  .submit-btn {
    font-family: var(--mono);
    font-size: 12px;
    color: #fff;
    background: var(--brand);
    border: none;
    padding: 8px 18px;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .chip {
    font-family: var(--body);
    font-size: 11px;
    font-weight: 500;
    color: var(--brand);
    background: var(--brand-soft);
    border: 1px solid color-mix(in srgb, var(--brand) 20%, var(--hairline));
    border-radius: 20px;
    padding: 5px 11px;
    cursor: pointer;
  }
  .chip:hover {
    background: color-mix(in srgb, var(--brand) 12%, var(--brand-soft));
  }
  .chip:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .status {
    margin-top: 14px;
  }
  .hint {
    margin: 0;
    font-size: 11.5px;
    color: var(--ink-dim);
    line-height: 1.5;
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--tier-critico);
  }
  .result {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .answer-text {
    background: var(--brand-soft);
    border-radius: 6px;
    padding: 12px 14px;
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
  }
  .answer-text :global(p) {
    margin: 0 0 8px;
  }
  .answer-text :global(p:last-child) {
    margin-bottom: 0;
  }
  .answer-text :global(ul) {
    margin: 0 0 8px;
    padding-left: 18px;
  }
  .answer-text :global(li) {
    margin-bottom: 3px;
  }
  .answer-text :global(strong) {
    color: var(--ink);
    font-weight: 700;
  }
  .disclaimer {
    font-size: 10px;
    line-height: 1.45;
    color: var(--ink-dim);
  }
</style>
