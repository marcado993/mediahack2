<script>
  // Progressive "escucha de medios" indicator: the backend hits every source
  // in one request, so we can't stream real per-source progress without
  // rewriting it as SSE. What we CAN do honestly is show which sources are
  // being checked and tick them off on a timer that matches their real
  // typical latency (RSS is fast, Facebook/Instagram go through a cache that
  // may be refreshing). The tick is a progress *indication*, not a claim
  // that a specific source has already answered - so nothing here shows a
  // result count until the real response lands.
  import { onMount, onDestroy } from "svelte";

  const SOURCES = [
    { name: "Lupa Media", kind: "RSS", at: 250 },
    { name: "Ecuador Chequea", kind: "RSS", at: 700 },
    { name: "El Comercio", kind: "RSS", at: 1150 },
    { name: "Facebook", kind: "páginas", at: 1900 },
    { name: "Instagram", kind: "cuentas", at: 2700 },
    { name: "TikTok", kind: "cuentas", at: 3400 },
  ];

  let reached = 0;
  let timers = [];

  onMount(() => {
    timers = SOURCES.map((s, i) => setTimeout(() => (reached = i + 1), s.at));
  });
  onDestroy(() => timers.forEach(clearTimeout));
</script>

<div class="listening" aria-live="polite">
  <div class="head">
    <span class="pulse" aria-hidden="true"></span>
    Escuchando fuentes…
  </div>

  <ul class="sources">
    {#each SOURCES as s, i}
      <li class:done={i < reached} class:active={i === reached}>
        <span class="marker" aria-hidden="true">
          {#if i < reached}✓{:else if i === reached}<span class="dot"></span>{:else}·{/if}
        </span>
        <span class="name">{s.name}</span>
        <span class="kind">{s.kind}</span>
      </li>
    {/each}
  </ul>

  <p class="note">Puede tardar unos segundos: se consultan verificadores, medios y redes en una sola pasada.</p>
</div>

<style>
  .listening {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px;
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 8px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    font-family: var(--mono);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--brand);
    text-transform: uppercase;
  }
  .pulse {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--brand);
    animation: pulse 1.4s ease-in-out infinite;
    flex-shrink: 0;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
      transform: scale(1);
    }
    50% {
      opacity: 0.35;
      transform: scale(0.75);
    }
  }
  .sources {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .sources li {
    display: grid;
    grid-template-columns: 16px 1fr auto;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--ink-dim);
    opacity: 0.55;
    transition: opacity 0.25s ease, color 0.25s ease;
  }
  .sources li.active {
    opacity: 1;
    color: var(--ink);
  }
  .sources li.done {
    opacity: 1;
    color: var(--ink-mid);
  }
  .marker {
    font-family: var(--mono);
    font-size: 11px;
    color: var(--brand);
    display: flex;
    justify-content: center;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    border: 1.5px solid var(--brand);
    border-top-color: transparent;
    animation: spin 0.7s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .name {
    font-weight: 500;
  }
  .kind {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-dim);
  }
  .note {
    margin: 0;
    font-size: 10.5px;
    line-height: 1.45;
    color: var(--ink-dim);
  }
  @media (prefers-reduced-motion: reduce) {
    .pulse,
    .dot {
      animation: none;
    }
  }
</style>
