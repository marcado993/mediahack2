<script>
  // The intensity scale, spelled out once and reused everywhere a reader
  // needs to decode a shade (map, graph, list) instead of guessing.
  const STEPS = [
    { tag: "BAJO", range: "0–24", color: "var(--tier-bajo)" },
    { tag: "MODERADO", range: "25–44", color: "var(--tier-moderado)" },
    { tag: "ALTO", range: "45–64", color: "var(--tier-alto)" },
    { tag: "CRÍTICO", range: "65–100", color: "var(--tier-critico)" },
  ];
</script>

<div class="legend">
  {#each STEPS as s}
    <div class="step">
      <span class="swatch" style="background:{s.color}"></span>
      <span class="tag">{s.tag}</span>
      <span class="range">{s.range}</span>
    </div>
  {/each}
</div>

<style>
  .legend {
    display: flex;
    gap: 14px;
    flex-wrap: wrap;
  }
  .step {
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 9.5px;
  }
  .swatch {
    width: 9px;
    height: 9px;
    border-radius: 2px;
  }
  .tag {
    color: var(--ink-mid);
    letter-spacing: 0.04em;
  }
  .range {
    color: var(--ink-dim);
  }
</style>
