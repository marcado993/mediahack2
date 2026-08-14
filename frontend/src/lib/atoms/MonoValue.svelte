<script>
  import { tweened } from "svelte/motion";
  import { cubicOut } from "svelte/easing";

  export let value = null;
  export let unit = "";
  export let size = 18; // px
  export let color = "var(--ink)";
  export let variant = "mono"; // "mono" (tabular data) | "display" (editorial hero number)
  export let animate = false; // count up from 0 on first render / value change

  const display = tweened(0, { duration: 650, easing: cubicOut });
  let started = false;

  $: if (animate && value != null) {
    display.set(value, { duration: started ? 500 : 700 });
    started = true;
  }

  $: shown = value == null ? null : animate ? Math.round($display * 10) / 10 : value;
</script>

<span class="stat-value {variant}" style="font-size:{size}px; color:{color}">
  {shown ?? "—"}{#if value != null && unit}<span class="unit">{unit}</span>{/if}
</span>

<style>
  .stat-value {
    line-height: 1;
    font-variant-numeric: tabular-nums lining-nums;
  }
  .stat-value.mono {
    font-family: var(--mono);
    font-weight: 600;
  }
  .stat-value.display {
    font-family: var(--display);
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .unit {
    font-size: 0.55em;
    color: var(--ink-dim);
    margin-left: 2px;
    font-family: var(--mono);
    font-weight: 500;
    vertical-align: baseline;
  }
</style>
