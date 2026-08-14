<script>
  import { fly } from "svelte/transition";
  import { alertLevel } from "../utils/alertLevel";

  export let provinces = [];

  $: withIndex = provinces.filter((p) => p.vulnerability_index != null);
  $: max = withIndex.length ? withIndex.reduce((a, b) => (b.vulnerability_index > a.vulnerability_index ? b : a)) : null;
  $: min = withIndex.length ? withIndex.reduce((a, b) => (b.vulnerability_index < a.vulnerability_index ? b : a)) : null;
  $: ratio = max && min && min.vulnerability_index > 0 ? (max.vulnerability_index / min.vulnerability_index).toFixed(1) : null;
</script>

{#if max && min}
  <div class="headline" in:fly={{ y: -10, duration: 420, delay: 60 }}>
    <span class="dot" style="background:{alertLevel(max.vulnerability_index).color}"></span>
    <p>
      <strong>{max.province}</strong> lidera la vulnerabilidad nacional
      (<span class="num">{max.vulnerability_index}</span>) — {ratio}× que
      <strong>{min.province}</strong> (<span class="num">{min.vulnerability_index}</span>)
    </p>
  </div>
{/if}

<style>
  .headline {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 2px 14px 0;
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
    transform: translateY(-1px);
    animation: pop 0.5s ease-out;
  }
  p {
    margin: 0;
    font-family: var(--display);
    font-size: 16px;
    color: var(--ink);
    line-height: 1.35;
  }
  strong {
    font-weight: 700;
  }
  .num {
    font-family: var(--mono);
    font-weight: 600;
    font-size: 0.92em;
    color: var(--brand);
  }
  @keyframes pop {
    0% {
      transform: scale(0.3) translateY(-1px);
      opacity: 0;
    }
    70% {
      transform: scale(1.3) translateY(-1px);
    }
    100% {
      transform: scale(1) translateY(-1px);
      opacity: 1;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .dot {
      animation: none;
    }
  }
</style>
