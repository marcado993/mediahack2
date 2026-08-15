<script>
  import AlertBadge from "../atoms/AlertBadge.svelte";
  import MonoValue from "../atoms/MonoValue.svelte";
  import { alertLevel } from "../utils/alertLevel";

  export let label;
  export let value;
  export let sub = null; // optional small caption line under the value, e.g. raw-vs-adjusted figures
</script>

<div class="card" style="--c: {alertLevel(value).color}">
  <div class="label">{label}</div>
  <div class="value-row">
    <MonoValue {value} unit="%" size={19} color="var(--ink)" />
    <AlertBadge {value} pill />
  </div>
  {#if sub}
    <div class="sub">{sub}</div>
  {/if}
</div>

<style>
  .card {
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-left: 3px solid var(--c);
    border-radius: 6px;
    padding: 7px 10px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
  }
  .label {
    font-size: 10.5px;
    color: var(--ink-mid);
    line-height: 1.2;
  }
  .value-row {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .sub {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-dim);
  }
</style>
