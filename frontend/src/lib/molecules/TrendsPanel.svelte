<script>
  // Investigative-journalism framing on purpose: an investigator doesn't
  // want a sentiment gauge, they want leads. So actors come first ("who do
  // I call?"), topics second ("what is this about?"), and every single term
  // expands to the posts behind it - nothing here asks to be taken on
  // faith, which matters doubly on a disinformation tool.
  export let trends = null; // { province, actores, temas, posts, total_analizados, note }

  let openTerm = null;

  function toggle(term) {
    openTerm = openTerm === term ? null : term;
  }
</script>

{#if trends}
  <div class="trends">
    <div class="head">
      <span class="eyebrow">ESCUCHA DE LA CONVERSACIÓN</span>
      <span class="meta">{trends.total_analizados} publicaciones políticas en X</span>
    </div>

    {#if trends.note}
      <p class="note">{trends.note}</p>
    {:else}
      {#if trends.actores?.length}
        <div class="block">
          <h4>Actores mencionados <span class="hint">a quién rastrear</span></h4>
          <div class="chips">
            {#each trends.actores as t}
              <button class="chip actor" class:open={openTerm === t.term} on:click={() => toggle(t.term)}>
                {t.term}<span class="count">{t.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#if trends.temas?.length}
        <div class="block">
          <h4>Temas recurrentes <span class="hint">de qué se habla</span></h4>
          <div class="chips">
            {#each trends.temas as t}
              <button class="chip" class:open={openTerm === t.term} on:click={() => toggle(t.term)}>
                {t.term}<span class="count">{t.count}</span>
              </button>
            {/each}
          </div>
        </div>
      {/if}

      {#each [...(trends.actores ?? []), ...(trends.temas ?? [])] as t}
        {#if openTerm === t.term}
          <div class="samples">
            <span class="samples-label">Publicaciones con "{t.term}"</span>
            {#each t.samples as s}
              <a class="sample" href={s.link} target="_blank" rel="noopener noreferrer">
                <span class="sample-user">{s.user || "X"}</span>
                <span class="sample-text">{s.title}</span>
              </a>
            {/each}
          </div>
        {/if}
      {/each}

      <p class="caveat">
        Conteo de menciones en una muestra reciente y pequeña, no una medición de opinión pública.
        Úsalo como pista para reportear, no como dato citable.
      </p>
    {/if}
  </div>
{/if}

<style>
  .trends {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 8px;
    padding: 12px 14px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    flex-wrap: wrap;
  }
  .eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--brand);
  }
  .meta {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-dim);
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  h4 {
    margin: 0;
    font-size: 11.5px;
    font-weight: 700;
    color: var(--ink);
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .hint {
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 400;
    color: var(--ink-dim);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--body);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink);
    background: var(--card);
    border: 1px solid var(--hairline-strong);
    border-radius: 20px;
    padding: 4px 10px;
    cursor: pointer;
    transition: border-color 0.12s ease, background 0.12s ease;
  }
  .chip:hover,
  .chip.open {
    border-color: var(--brand);
    background: var(--brand-soft);
  }
  .chip.actor {
    font-weight: 700;
  }
  .count {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--ink-dim);
  }
  .samples {
    display: flex;
    flex-direction: column;
    gap: 5px;
    border-top: 1px dashed var(--hairline);
    padding-top: 8px;
  }
  .samples-label {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-dim);
  }
  .sample {
    display: flex;
    flex-direction: column;
    gap: 2px;
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 7px 9px;
    text-decoration: none;
  }
  .sample:hover {
    border-color: var(--brand);
  }
  .sample-user {
    font-family: var(--mono);
    font-size: 9px;
    color: var(--brand);
  }
  .sample-text {
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--ink);
  }
  .note,
  .caveat {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--ink-dim);
  }
</style>
