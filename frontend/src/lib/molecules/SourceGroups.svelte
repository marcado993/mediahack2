<script>
  // Publications grouped by where they came from, rather than one merged
  // list. On a disinformation project the *source* is half the information -
  // a claim in a Facebook post and the same claim in a fact-checker's
  // verification are not equivalent, so they don't get mixed into one pile.
  import NewsCards from "./NewsCards.svelte";

  export let bySource = {}; // { "Lupa Media": [...], "Facebook · X": [...] }

  const KIND = [
    { match: (n) => n.startsWith("Facebook"), label: "FACEBOOK", tone: "social" },
    { match: (n) => n.startsWith("Instagram"), label: "INSTAGRAM", tone: "social" },
    { match: (n) => n === "Lupa Media" || n === "Ecuador Chequea", label: "VERIFICADOR", tone: "check" },
  ];

  function kindOf(name) {
    return KIND.find((k) => k.match(name)) ?? { label: "MEDIO", tone: "media" };
  }

  // Groups with results first; empty ones still listed (honestly) at the end
  // so the reader can tell "checked, found nothing" from "never checked".
  $: entries = Object.entries(bySource).sort((a, b) => b[1].length - a[1].length);
  $: withResults = entries.filter(([, v]) => v.length > 0);
  $: empty = entries.filter(([, v]) => v.length === 0).map(([k]) => k);
  $: total = withResults.reduce((n, [, v]) => n + v.length, 0);
</script>

<div class="groups">
  <div class="summary">
    <strong>{total}</strong> publicaciones reales en {withResults.length} de {entries.length} fuentes
  </div>

  {#each withResults as [name, articles], i}
    {@const kind = kindOf(name)}
    <div class="group" style="animation-delay: {i * 70}ms">
      <div class="group-head">
        <span class="badge {kind.tone}">{kind.label}</span>
        <span class="group-name">{name}</span>
        <span class="count">{articles.length}</span>
      </div>
      <NewsCards query="" sourcesChecked={[]} {articles} />
    </div>
  {/each}

  {#if empty.length}
    <div class="empty-note">
      Sin publicaciones recientes que coincidan en: {empty.join(" · ")}
    </div>
  {/if}
</div>

<style>
  .groups {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .summary {
    font-size: 11.5px;
    color: var(--ink-mid);
  }
  .summary strong {
    font-family: var(--mono);
    color: var(--ink);
  }
  .group {
    display: flex;
    flex-direction: column;
    gap: 6px;
    animation: rise 0.35s ease-out backwards;
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
  .group-head {
    display: flex;
    align-items: center;
    gap: 7px;
  }
  .badge {
    font-family: var(--mono);
    font-size: 8.5px;
    font-weight: 700;
    letter-spacing: 0.06em;
    padding: 2px 5px;
    border-radius: 3px;
    color: #fff;
  }
  .badge.check {
    background: var(--brand);
  }
  .badge.social {
    background: var(--tier-alto);
  }
  .badge.media {
    background: var(--ink-mid);
  }
  .group-name {
    font-size: 12px;
    font-weight: 600;
    color: var(--ink);
  }
  .count {
    font-family: var(--mono);
    font-size: 10px;
    color: var(--ink-dim);
    margin-left: auto;
  }
  .empty-note {
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--ink-dim);
    border-top: 1px dashed var(--hairline);
    padding-top: 8px;
  }
  @media (prefers-reduced-motion: reduce) {
    .group {
      animation: none;
    }
  }
</style>
