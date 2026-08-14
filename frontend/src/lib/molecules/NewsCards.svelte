<script>
  export let query = "";
  export let sourcesChecked = [];
  export let articles = [];

  function formatDate(pubDate) {
    if (!pubDate) return "";
    try {
      return new Date(pubDate).toLocaleDateString("es-EC", { day: "numeric", month: "short" });
    } catch (e) {
      return "";
    }
  }
</script>

<div class="news-block">
  {#if query || sourcesChecked.length}
    <div class="news-meta">
      Búsqueda en vivo{sourcesChecked.length ? ` en ${sourcesChecked.join(", ")}` : ""}{query ? ` · "${query}"` : ""}
    </div>
  {/if}

  {#if articles.length === 0}
    <div class="empty">
      <p>
        Ninguno de los medios rastreados publicó algo reciente que mencione esto. Un feed RSS solo
        cubre sus ~20 artículos más nuevos, no es un archivo buscable — esto significa "nada
        reciente", no "no existe".
      </p>
    </div>
  {:else}
    <div class="slide">
      {#each articles as a, i}
        <a class="card" href={a.link} target="_blank" rel="noopener noreferrer" style="animation-delay: {i * 60}ms">
          <span class="source">{a.source}</span>
          <span class="title">{a.title}</span>
          <span class="date">{formatDate(a.published)}</span>
        </a>
      {/each}
    </div>
  {/if}
</div>

<style>
  .news-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .news-meta {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-dim);
  }
  .empty {
    background: var(--card-alt);
    border: 1px dashed var(--hairline-strong);
    border-radius: 6px;
    padding: 10px 12px;
  }
  .empty p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.5;
    color: var(--ink-mid);
  }
  .slide {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .card {
    flex: 0 0 auto;
    width: 180px;
    display: flex;
    flex-direction: column;
    gap: 5px;
    background: var(--card);
    border: 1px solid var(--hairline-strong);
    border-radius: 8px;
    padding: 10px;
    text-decoration: none;
    animation: rise 0.3s ease-out backwards;
    transition: border-color 0.12s ease, transform 0.12s ease;
  }
  .card:hover {
    border-color: var(--brand);
    transform: translateY(-2px);
  }
  @keyframes rise {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .source {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--brand);
    text-transform: uppercase;
  }
  .title {
    font-size: 11.5px;
    line-height: 1.35;
    color: var(--ink);
    font-weight: 500;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .date {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-dim);
    margin-top: auto;
  }
</style>
