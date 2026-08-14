<script>
  import { askAssistant, searchNews } from "../utils/api";
  import { renderMarkdown } from "../utils/markdown";
  import NewsCards from "./NewsCards.svelte";

  export let province = null; // used to seed the placeholder + quick-ask shortcut

  let modalOpen = false;
  let question = "";
  let answer = null;
  let answerArticles = []; // real articles DeepSeek's search_news tool call actually found, if any
  let news = null; // { query, sourcesChecked, articles }
  let loading = false;
  let error = null;

  function open() {
    modalOpen = true;
    question = "";
    answer = null;
    answerArticles = [];
    news = null;
    error = null;
  }

  async function ask(q) {
    if (!q || loading) return;
    loading = true;
    error = null;
    answer = null;
    answerArticles = [];
    news = null;
    try {
      const res = await askAssistant(q);
      answer = res.answer;
      answerArticles = res.articles_used ?? [];
    } catch (e) {
      error = e.message.includes("503")
        ? "El asistente no está configurado todavía (falta la clave de API en el backend)."
        : "No se pudo consultar el asistente. Intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  async function askNewsAboutCandidates() {
    if (loading) return;
    const q = `candidatos ${province}`;
    loading = true;
    error = null;
    answer = null;
    news = null;
    try {
      const res = await searchNews(q);
      news = { query: res.query, sourcesChecked: res.sources_checked, articles: res.articles };
    } catch (e) {
      error = "No se pudo buscar noticias. Intenta de nuevo.";
    } finally {
      loading = false;
    }
  }

  function submit() {
    ask(question.trim());
  }
</script>

<button class="trigger" on:click={open}>
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3" />
    <path d="M6 6.2c0-1.1 0.9-1.9 2-1.9s2 0.7 2 1.7c0 1.5-2 1.3-2 3" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" />
    <circle cx="8" cy="11.3" r="0.75" fill="currentColor" />
  </svg>
  Preguntar al asistente
</button>

{#if modalOpen}
  <div class="backdrop" on:click={() => (modalOpen = false)}>
    <div class="modal" on:click|stopPropagation>
      <div class="modal-head">
        <h3>Preguntar al asistente</h3>
        <button class="close" on:click={() => (modalOpen = false)} aria-label="Cerrar">×</button>
      </div>

      <form on:submit|preventDefault={submit}>
        <input
          type="text"
          bind:value={question}
          autofocus
          placeholder={province ? `Ej: ¿qué propuso el alcalde de ${province}?` : "Ej: ¿qué propuso el alcalde de Quito?"}
        />
        <button type="submit" class="submit-btn" disabled={loading || !question.trim()}>
          {loading ? "Consultando…" : "Preguntar"}
        </button>
      </form>

      {#if province}
        <button class="quick-ask" on:click={askNewsAboutCandidates} disabled={loading}>
          📰 Noticias sobre candidatos en {province}
        </button>
      {/if}

      <div class="status" aria-live="polite">
        {#if loading}
          <div class="loading">
            <span class="spinner" aria-hidden="true"></span>
            Consultando…
          </div>
        {:else if error}
          <p class="error">{error}</p>
        {:else if news}
          <NewsCards query={news.query} sourcesChecked={news.sourcesChecked} articles={news.articles} />
        {:else if answer}
          <div class="answer">
            <div class="answer-text">{@html renderMarkdown(answer)}</div>
            {#if answerArticles.length}
              <div class="sources">
                <span class="sources-label">Fuentes reales consultadas:</span>
                <NewsCards query="" sourcesChecked={[]} articles={answerArticles} />
              </div>
              <span class="disclaimer">
                Resumen generado por IA a partir de las noticias de arriba, encontradas en vivo. Aun así, verifica antes de publicar.
              </span>
            {:else}
              <span class="disclaimer">
                Respuesta generada por IA a partir de su conocimiento entrenado — no encontró (o no buscó) noticias en vivo para esto. Verifica antes de publicar.
              </span>
            {/if}
          </div>
        {:else}
          <p class="hint">
            Escribe una pregunta para el asistente (IA, sin internet en vivo), o usa el botón de
            noticias arriba para buscar artículos reales y recientes de medios ecuatorianos.
          </p>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .trigger {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    justify-content: center;
    font-family: var(--body);
    font-size: 12px;
    font-weight: 600;
    color: var(--brand);
    background: var(--brand-soft);
    border: 1px solid color-mix(in srgb, var(--brand) 25%, var(--hairline));
    border-radius: 6px;
    padding: 9px 10px;
    cursor: pointer;
    transition: transform 0.12s ease, background 0.12s ease;
  }
  .trigger:hover {
    background: color-mix(in srgb, var(--brand) 12%, var(--brand-soft));
  }
  .trigger:active {
    transform: scale(0.98);
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
    width: 520px;
    max-width: 90vw;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 12px 32px rgba(28, 43, 58, 0.25);
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
  }
  h3 {
    font-family: var(--display);
    font-size: 18px;
    margin: 0;
    color: var(--ink);
  }
  .close {
    background: none;
    border: none;
    font-size: 20px;
    color: var(--ink-dim);
    cursor: pointer;
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
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    flex-shrink: 0;
  }
  .submit-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .quick-ask {
    margin-top: 8px;
    width: 100%;
    text-align: left;
    font-family: var(--body);
    font-size: 11.5px;
    font-weight: 600;
    color: var(--brand);
    background: none;
    border: 1px dashed color-mix(in srgb, var(--brand) 35%, var(--hairline));
    border-radius: 6px;
    padding: 6px 10px;
    cursor: pointer;
  }
  .quick-ask:hover {
    background: var(--brand-soft);
  }
  .quick-ask:disabled {
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
    line-height: 1.4;
  }
  .loading {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--ink-mid);
  }
  .spinner {
    width: 13px;
    height: 13px;
    border-radius: 50%;
    border: 2px solid var(--hairline-strong);
    border-top-color: var(--brand);
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .error {
    margin: 0;
    font-size: 12px;
    color: var(--tier-critico);
  }
  .answer {
    background: var(--brand-soft);
    border-radius: 6px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .answer-text {
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
    color: var(--ink-dim);
  }
  .sources {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .sources-label {
    font-family: var(--mono);
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--ink-dim);
    text-transform: uppercase;
  }
  @media (prefers-reduced-motion: reduce) {
    .spinner {
      animation: none;
    }
  }
</style>
