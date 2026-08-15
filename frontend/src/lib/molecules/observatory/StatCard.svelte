<script>
  // Single-metric card: value + national comparison + source line. Mirrors
  // the reference observatory's ".metric" component.
  export let label;
  export let value = null;
  export let nacional = null;
  export let unit = "%";
  export let source = "";
  export let direction = 0; // 1 = higher is worse, -1 = higher is better, 0 = neutral
  export let decimals = 1;
  export let absolute = false; // population-style totals: no +/- delta, just % of national total

  $: display = value == null ? "—" : absolute ? Math.round(value).toLocaleString("es-EC") : value.toFixed(decimals);
  $: diff = value != null && nacional != null ? value - nacional : null;
  $: tone = diff == null ? "eq" : direction === 1 ? (diff > 1 ? "up" : diff < -1 ? "dn" : "eq") : direction === -1 ? (diff > 1 ? "dn" : diff < -1 ? "up" : "eq") : "eq";
</script>

<div class="metric">
  <div class="k">{label}</div>
  <div class="v">{display}<small>{unit === "hab." || absolute ? "" : ` ${unit}`}</small></div>
  {#if absolute && nacional != null}
    <div class="c"><span>Total país {Math.round(nacional).toLocaleString("es-EC")}</span></div>
  {:else if diff != null}
    <div class="c">
      <span>Nacional {nacional.toFixed(decimals)}</span>
      <span class="cmp {tone}">{diff >= 0 ? "+" : "−"}{Math.abs(diff).toFixed(decimals)}{unit === "%" ? " pp" : ""}</span>
    </div>
  {/if}
  {#if source}<div class="srcline">{source}</div>{/if}
</div>

<style>
  .metric {
    padding: 10px 12px;
    border: 1px solid var(--hairline);
    border-radius: 8px;
    background: var(--card);
  }
  .k {
    font-size: 11px;
    color: var(--ink-dim);
    line-height: 1.35;
    min-height: 28px;
  }
  .v {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin: 2px 0 1px;
    color: var(--ink);
  }
  .v small {
    font-family: var(--body);
    font-size: 11px;
    font-weight: 500;
    color: var(--ink-dim);
    margin-left: 2px;
  }
  .c {
    font-size: 10.5px;
    color: var(--ink-dim);
    display: flex;
    justify-content: space-between;
    gap: 6px;
  }
  .cmp {
    font-weight: 700;
  }
  .up {
    color: var(--tier-critico);
  }
  .dn {
    color: #1f7a4d;
  }
  .eq {
    color: var(--ink-dim);
  }
  .srcline {
    font-size: 9.5px;
    color: var(--ink-dim);
    opacity: 0.8;
    margin-top: 4px;
    line-height: 1.35;
  }
</style>
