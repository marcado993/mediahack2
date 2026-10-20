<script>
  let { onlogin, error = "", busy = false } = $props();
  let value = $state("");
</script>

<main>
  <form
    onsubmit={(e) => {
      e.preventDefault();
      onlogin(value.trim());
    }}
  >
    <h1>Panel de medios</h1>
    <p class="lead">Configura la marca y las funciones que ve la audiencia de cada medio.</p>
    <label class="field">
      <span>Token de administración</span>
      <input type="password" bind:value autocomplete="current-password" required />
      <small>Lo define quien administra el servidor en la variable <code>ADMIN_TOKEN</code>.</small>
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
    border-top: 5px solid var(--red);
    background: var(--card);
    padding: 28px 28px 26px;
    box-shadow: 0 1px 0 var(--line);
  }
  h1 {
    font-size: 28px;
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
