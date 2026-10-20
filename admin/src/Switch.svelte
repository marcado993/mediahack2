<script>
  let { checked = $bindable(false), disabled = false, label, onchange } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class:on={checked}
  onclick={() => {
    checked = !checked;
    onchange?.(checked);
  }}
>
  <span class="knob"></span>
</button>

<style>
  button {
    flex: none;
    width: 40px;
    height: 22px;
    border-radius: 11px;
    border: 1.5px solid var(--ink);
    background: var(--card);
    padding: 0;
    cursor: pointer;
    position: relative;
    transition: background 0.12s;
  }
  .knob {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--ink);
    transition: transform 0.12s;
  }
  button.on {
    background: var(--ink);
  }
  button.on .knob {
    background: #fff;
    transform: translateX(18px);
  }
  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
  @media (prefers-reduced-motion: reduce) {
    button,
    .knob {
      transition: none;
    }
  }
</style>
