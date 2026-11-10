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
    width: 46px;
    height: 26px;
    border-radius: var(--r);
    border: 3px solid var(--ink);
    background: var(--card);
    padding: 0;
    cursor: pointer;
    position: relative;
    transition: background 0.12s;
  }
  .knob {
    position: absolute;
    top: 3px;
    left: 3px;
    width: 14px;
    height: 14px;
    border-radius: 1px;
    background: var(--ink);
    transition: transform 0.12s;
  }
  button.on {
    background: var(--ok);
  }
  button.on .knob {
    background: #fff;
    transform: translateX(20px);
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
