<script>
  import { provinceKey } from "../utils/geo";
  import AlertBadge from "../atoms/AlertBadge.svelte";

  export let provinces = [];
  export let selected = null;
  export let onSelect = (key, name) => {};
</script>

<div class="list">
  <div class="list-header">
    <span>PROVINCIAS</span>
    <span class="count">{provinces.length}</span>
  </div>
  <div class="rows">
    {#each provinces as p (p.province)}
      {@const key = provinceKey(p.province)}
      <button
        class="row"
        class:active={selected === key}
        aria-current={selected === key ? "true" : undefined}
        on:click={() => onSelect(key, p.province)}
      >
        <AlertBadge value={p.vulnerability_index} dotOnly />
        <span class="name">
          {p.province}
          {#if p.low_confidence}<span class="warn" title={p.confiabilidad_muestra}>·</span>{/if}
        </span>
        <span class="value">{p.vulnerability_index ?? "—"}</span>
      </button>
    {/each}
  </div>
</div>

<style>
  .list {
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
  }
  .list-header {
    font-family: var(--mono);
    font-size: 10.5px;
    letter-spacing: 0.08em;
    color: var(--text-dim);
    padding: 8px 12px 6px;
    display: flex;
    justify-content: space-between;
  }
  .rows {
    flex: 1;
    overflow-y: auto;
    min-height: 0;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    border: none;
    background: none;
    text-align: left;
    padding: 5px 12px;
    cursor: pointer;
    font-size: 12.5px;
    color: var(--text-hi);
    font-family: var(--body);
  }
  .row:hover {
    background: var(--panel-raised);
  }
  .row.active {
    background: var(--panel-raised);
    box-shadow: inset 2px 0 0 var(--alert-amarillo);
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .warn {
    color: var(--alert-amarillo);
    font-weight: 900;
  }
  .value {
    font-family: var(--mono);
    color: var(--text-mid);
    font-size: 11.5px;
  }
</style>
