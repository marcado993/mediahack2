<script>
  export let eyebrow;
  export let title = "";
</script>

<div class="header">
  <div class="text">
    <span class="eyebrow">{eyebrow}</span>
    {#if title}<span class="title">{title}</span>{/if}
  </div>
  <slot />
</div>

<style>
  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 8px;
  }
  .text {
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--text-dim);
  }
  .title {
    font-family: var(--display);
    font-weight: 700;
    font-size: 15px;
    color: var(--text-hi);
  }
</style>
