<script>
  import MonoValue from "../atoms/MonoValue.svelte";
  import AlertBadge from "../atoms/AlertBadge.svelte";
  import { alertLevel } from "../utils/alertLevel";

  export let provinces = [];

  $: withIndex = provinces.filter((p) => p.vulnerability_index != null);
  $: avg = withIndex.length
    ? Math.round((withIndex.reduce((s, p) => s + p.vulnerability_index, 0) / withIndex.length) * 10) / 10
    : null;
  $: mostVulnerable = withIndex.length
    ? withIndex.reduce((a, b) => (b.vulnerability_index > a.vulnerability_index ? b : a))
    : null;
  $: leastVulnerable = withIndex.length
    ? withIndex.reduce((a, b) => (b.vulnerability_index < a.vulnerability_index ? b : a))
    : null;
  $: lowConfidenceCount = provinces.filter((p) => p.low_confidence).length;

  $: chips = [
    { label: "Promedio nacional", value: avg, color: alertLevel(avg).color, showLevel: true },
    { label: `Máx · ${mostVulnerable?.province ?? "—"}`, value: mostVulnerable?.vulnerability_index, color: "var(--tier-critico)", showLevel: false },
    { label: `Mín · ${leastVulnerable?.province ?? "—"}`, value: leastVulnerable?.vulnerability_index, color: "var(--tier-bajo)", showLevel: false },
    { label: "Muestra baja", value: lowConfidenceCount, color: "var(--ink-dim)", suffix: " prov.", showLevel: false },
  ];
</script>

<div class="strip">
  {#each chips as c, i}
    <div class="chip" style="animation-delay: {i * 60}ms">
      <span class="bar" style="background:{c.color}"></span>
      <div class="chip-body">
        <div class="value-slot">
          <MonoValue value={c.value} unit={c.suffix ?? ""} size={22} variant="display" animate />
          {#if c.showLevel && c.value != null}
            <AlertBadge value={c.value} pill />
          {/if}
        </div>
        <div class="chip-label">{c.label}</div>
      </div>
    </div>
  {/each}
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  @media (max-width: 860px) {
    .strip {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  .chip {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 8px;
    box-shadow: 0 1px 3px rgba(28, 43, 58, 0.06);
    display: flex;
    overflow: hidden;
    animation: rise 0.4s ease-out backwards;
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
  .bar {
    width: 4px;
    flex-shrink: 0;
  }
  .chip-body {
    padding: 7px 10px;
    min-width: 0;
  }
  .value-slot {
    height: 24px;
    display: flex;
    align-items: flex-end;
    gap: 8px;
  }
  .chip-label {
    font-size: 9.5px;
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-dim);
    margin-top: 3px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: reduce) {
    .chip {
      animation: none;
    }
  }
</style>
