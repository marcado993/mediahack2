<script>
  let { onlogin, error = "", busy = false } = $props();
  let value = $state("");
  let visible = $state(false);
</script>

<main>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      onlogin(value.trim());
    }}
  >
    <p class="brand"><img src="/marca-azul.svg" alt="" width="40" height="40" /><span>OVADE</span></p>
    <h1>Panel de medios</h1>
    <p class="lead">Configura la marca y las funciones que ve la audiencia de cada medio.</p>
    <label class="field">
      <span>Token de administración</span>
      <span class="row">
        <input type={visible ? "text" : "password"} bind:value autocomplete="current-password" required aria-describedby="tokenAyuda" />
        <button type="button" class="btn ghost ver" aria-pressed={visible} onclick={() => (visible = !visible)}>{visible ? "Ocultar" : "Ver"}</button>
      </span>
      <small id="tokenAyuda">Lo define quien administra el servidor en la variable <code>ADMIN_TOKEN</code>.</small>
    </label>
    {#if error}<p class="msg-err" role="alert">{error}</p>{/if}
    <button class="btn red" type="submit" disabled={busy || !value.trim()}>{busy ? "Comprobando…" : "Entrar"}</button>
  </form>
</main>

<style>
  main {
    min-height: 100%;
    display: grid;
    place-items: center;
    padding: 24px;
  }
  form {
    width: 100%;
    max-width: 400px;
    border: 4px solid var(--ink);
    border-radius: var(--r);
    background: var(--card);
    padding: 26px 28px;
    box-shadow: 6px 6px 0 var(--ink);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    margin: 0 0 14px;
  }
  .brand span {
    font: 400 16px/1 var(--display);
    letter-spacing: 0.06em;
    color: var(--ink);
    border: 3px solid var(--ink);
    padding: 5px 10px;
    transform: skew(-6deg);
  }
  h1 {
    font-size: 30px;
  }
  .row {
    display: flex !important;
    gap: 8px;
    margin: 0 !important;
  }
  .row input {
    flex: 1;
    min-width: 0;
  }
  .ver {
    font-size: 13px;
    padding: 4px 10px;
  }
  .lead {
    color: var(--mut);
    margin: 6px 0 22px;
  }
  code {
    font-family: var(--mono);
    font-size: 12px;
  }
</style>
