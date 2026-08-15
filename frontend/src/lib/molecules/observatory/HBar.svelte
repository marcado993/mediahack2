<script>
  // Shared horizontal-bar row: province value as a filled track, national
  // average as a vertical tick on top of it - the same "bar + tick" idiom
  // used throughout the profile view (age structure, digital access, diet,
  // resilience, pressure) so every section reads the same way.
  export let label;
  export let value = null;
  export let nacional = null;
  export let max = 100;
  export let unit = "%";
  export let color = "var(--brand)";
  export let decimals = 1;

  $: pct = value == null ? 0 : Math.max(1.5, Math.min(100, (value / max) * 100));
  $: nacPct = nacional == null ? null : Math.max(0, Math.min(100, (nacional / max) * 100));
  $: display = value == null ? "—" : value.toFixed(decimals);
</script>

<div class="hbar">
  <span class="hbar-label">{label}</span>
  <div class="hbar-track">
    <div class="hbar-fill" style="width:{pct}%; background:{color}"></div>
    {#if nacPct != null}
      <div class="hbar-tick" style="left:{nacPct}%" title="Promedio nacional: {nacional.toFixed(decimals)}{unit}"></div>
    {/if}
  </div>
  <span class="hbar-value">{display}{value != null ? unit : ""}</span>
</div>

<style>
  .hbar {
    display: grid;
    grid-template-columns: minmax(90px, 34%) 1fr 56px;
    align-items: center;
    gap: 8px;
    padding: 3px 0;
    font-size: 12px;
  }
  .hbar-label {
    color: var(--ink-mid);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hbar-track {
    position: relative;
    background: var(--card-alt);
    border-radius: 4px;
    height: 9px;
    overflow: visible;
  }
  .hbar-fill {
    height: 100%;
    border-radius: 4px;
    overflow: hidden;
  }
  .hbar-tick {
    position: absolute;
    top: -2.5px;
    width: 2px;
    height: 14px;
    background: var(--ink);
    opacity: 0.4;
  }
  .hbar-value {
    font-family: var(--mono);
    font-size: 11px;
    font-weight: 600;
    color: var(--ink);
    text-align: right;
    white-space: nowrap;
  }
</style>
