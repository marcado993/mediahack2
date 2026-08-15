<script>
  // Investigative-journalism framing on purpose: an investigator doesn't
  // want a sentiment gauge, they want leads. So actors come first ("who do
  // I call?"), topics second ("what is this about?"), and every single term
  // expands to the posts behind it - nothing here asks to be taken on
  // faith, which matters doubly on a disinformation tool.
  //
  // Lives in the province panel rather than inside the assistant modal:
  // "what is being talked about here" is orienting information a journalist
  // should see while reading the province, not something they have to know
  // to go looking for behind a dialog (recognition over recall).
  //
  // Loads itself in the background on province change. First load per
  // province costs a live X search (~15s), but it doesn't block anything on
  // screen and the backend caches for 30 min, so revisits are instant.
  import { getTrends } from "../utils/api";

  export let province = null;

  let trends = null;
  let loading = false;
  let failed = false;
  let openTerm = null;

  function toggle(term) {
    openTerm = openTerm === term ? null : term;
  }

  async function load(p) {
    if (!p) return;
    loading = true;
    failed = false;
    trends = null;
    openTerm = null;
    const requested = p;
    try {
      const res = await getTrends(p);
      // Guard against a slow response for a province the user already left.
      if (requested === province) trends = res;
    } catch (e) {
      if (requested === province) failed = true;
    } finally {
      if (requested === province) loading = false;
    }
  }

  // Debounced, and this is a rate-limiting measure rather than a polish one:
  // clicking across ten provinces used to fire ten live X searches in a few
  // seconds, which is precisely the burst pattern that gets a scraping
  // session flagged. Waiting for the selection to settle collapses that into
  // one request for the province the journalist actually stopped on.
  const SETTLE_MS = 800;
  let settleTimer;

  function schedule(p) {
    clearTimeout(settleTimer);
    if (!p) return;
    loading = true; // show the loader immediately, so the wait isn't dead air
    trends = null;
    failed = false;
    settleTimer = setTimeout(() => load(p), SETTLE_MS);
  }

  $: schedule(province);
</script>

{#if loading}
  <!-- Explicit rather than a bare shimmer: the skeleton chips alone read as
       "this panel is empty", not "this panel is working". A moving bar plus
       a sentence naming what it's doing removes that ambiguity. -->
  <div class="trends compact" aria-busy="true">
    <div class="head">
      <span class="eyebrow">TEMAS MÁS HABLADOS</span>
      <span class="meta">buscando…</span>
    </div>
    <div class="bar" role="progressbar" aria-label="Buscando temas"><span></span></div>
    <p class="note">Leyendo X y medios sobre {province}. Puede tardar unos segundos.</p>
    <div class="skeleton-chips">
      {#each Array(7) as _, i}<span class="skel" style="animation-delay: {i * 90}ms"></span>{/each}
    </div>
  </div>
{:else if failed}
  <div class="trends compact">
    <span class="eyebrow">TEMAS MÁS HABLADOS</span>
    <p class="note">No se pudo leer la conversación.</p>
    <!-- Retry matters here: a live search can fail transiently (backend
         restart, X slow) and without this the only way back is switching
         province and returning. -->
    <button class="retry" on:click={() => load(province)}>Reintentar</button>
  </div>
{:else if trends}
  <div class="trends">
    <div class="head">
      <span class="eyebrow">TEMAS MÁS HABLADOS</span>
      <span class="meta">{trends.total_analizados} publicaciones · X y medios</span>
    </div>

    {#if trends.note}
      <p class="note">{trends.note}</p>
    {:else}
      <!-- One flat row of chips rather than two titled sections: this sits
           inside a fixed-height rail, and the sectioned version was 397px
           tall - it pushed the indicator list below it to zero height.
           Institutions are simply rendered bold, no heading needed. -->
      <div class="chips">
        {#each [...(trends.actores ?? []), ...(trends.temas ?? [])] as t}
          <button class="chip" class:actor={trends.actores?.includes(t)} class:open={openTerm === t.term} on:click={() => toggle(t.term)}>
            {t.term}<span class="count">{t.count}</span>
          </button>
        {/each}
      </div>

      {#each [...(trends.actores ?? []), ...(trends.temas ?? [])] as t}
        {#if openTerm === t.term}
          <div class="samples">
            {#each t.samples as s}
              <a class="sample" href={s.link} target="_blank" rel="noopener noreferrer">
                <span class="sample-text">{s.title}</span>
              </a>
            {/each}
          </div>
        {/if}
      {/each}

      <p class="caveat">Conteo en muestra pequeña — pista para reportear, no dato citable.</p>
    {/if}
  </div>
{/if}

<style>
  .trends {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    gap: 7px;
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 8px;
    padding: 9px 11px;
    /* Hard cap: this panel shares a fixed-height rail with the indicator
       cards, and must never grow enough to squeeze them out - at 168px it
       collapsed the indicator list to zero height on the mobile layout. */
    max-height: 142px;
    overflow-y: auto;
  }
  .trends.compact {
    gap: 7px;
  }
  .bar {
    height: 3px;
    border-radius: 3px;
    background: var(--hairline);
    overflow: hidden;
  }
  /* Indeterminate: we genuinely don't know how long the live search takes,
     and a fake percentage would be a lie about progress. */
  .bar span {
    display: block;
    height: 100%;
    width: 40%;
    border-radius: 3px;
    background: var(--brand);
    animation: slide 1.2s ease-in-out infinite;
  }
  @keyframes slide {
    0% {
      transform: translateX(-100%);
    }
    100% {
      transform: translateX(250%);
    }
  }
  .skeleton-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
  }
  .skel {
    height: 20px;
    width: 62px;
    border-radius: 20px;
    background: var(--card);
    border: 1px solid var(--hairline);
    animation: shimmer 1.3s ease-in-out infinite;
  }
  /* Varied widths so the placeholder reads as a row of chips loading,
     rather than a generic grey block. */
  .skel:nth-child(2) {
    width: 88px;
  }
  .skel:nth-child(3) {
    width: 52px;
  }
  .skel:nth-child(4) {
    width: 74px;
  }
  .skel:nth-child(5) {
    width: 58px;
  }
  .skel:nth-child(6) {
    width: 96px;
  }
  .skel:nth-child(7) {
    width: 46px;
  }
  .retry {
    align-self: flex-start;
    font-family: var(--body);
    font-size: 11px;
    font-weight: 600;
    color: var(--brand);
    background: var(--brand-soft);
    border: 1px solid color-mix(in srgb, var(--brand) 25%, var(--hairline));
    border-radius: 20px;
    padding: 4px 12px;
    cursor: pointer;
  }
  .retry:hover {
    background: color-mix(in srgb, var(--brand) 12%, var(--brand-soft));
  }
  @keyframes shimmer {
    0%,
    100% {
      opacity: 0.55;
    }
    50% {
      opacity: 1;
    }
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
  @media (prefers-reduced-motion: reduce) {
    .skel {
      animation: none;
    }
    .bar span {
      animation: none;
      width: 100%;
      opacity: 0.5;
    }
  }
</style>
