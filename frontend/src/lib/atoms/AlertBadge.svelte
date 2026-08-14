<script>
  import { alertLevel } from "../utils/alertLevel";

  export let value = null;
  export let dotOnly = false;
  export let pill = false; // filled chip, reads as a secondary datum rather than a caption
</script>

{#if dotOnly}
  <span class="dot" style="background:{alertLevel(value).color}" title={alertLevel(value).tag}></span>
{:else if pill}
  <span class="chip" style="--c: {alertLevel(value).color}">
    <span class="dot" style="background:var(--c)"></span>
    {alertLevel(value).tag}
  </span>
{:else}
  <span class="badge" style="--c: {alertLevel(value).color}">
    <span class="dot" style="background:var(--c)"></span>
    {alertLevel(value).tag}
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 9.5px;
    letter-spacing: 0.07em;
    color: var(--c);
  }
  .chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    color: var(--c);
    background: color-mix(in srgb, var(--c) 12%, transparent);
    border-radius: 4px;
    padding: 2px 7px 2px 6px;
    width: fit-content;
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }
</style>
