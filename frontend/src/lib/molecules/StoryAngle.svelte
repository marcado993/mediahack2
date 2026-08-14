<script>
  import { fly } from "svelte/transition";
  import { storyAngle } from "../utils/storyAngle";

  export let detail = null;

  $: angle = storyAngle(detail);
</script>

{#if angle}
  <div class="angle" in:fly={{ y: 6, duration: 300 }}>
    <span class="tag">Ángulo sugerido · {angle.tag}</span>
    <p>{angle.text}</p>
  </div>
{/if}

<style>
  .angle {
    background: var(--brand-soft);
    border: 1px solid color-mix(in srgb, var(--brand) 25%, var(--hairline));
    border-radius: 6px;
    padding: 8px 10px;
  }
  .tag {
    display: block;
    font-family: var(--mono);
    font-size: 9px;
    font-weight: 600;
    letter-spacing: 0.06em;
    color: var(--brand);
    margin-bottom: 3px;
  }
  p {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.45;
    color: var(--ink-mid);
  }
</style>
