<script>
  // The preview is the real public site (a separate deploy) in an iframe. Unsaved edits are pushed
  // into it with postMessage, so what the editor sees is what the audience gets,
  // not a mock-up that can drift from the product.
  import { PUBLIC_URL, PUBLIC_ORIGIN } from "./config.js";

  let { slug, config } = $props();
  let frame = $state();
  let ready = $state(false);
  let device = $state("desktop");

  $effect(() => {
    slug; // a new medio loads a new iframe: wait for its own "ready"
    ready = false;
  });

  $effect(() => {
    const onMsg = (e) => {
      if (e.origin === PUBLIC_ORIGIN && e.source === frame?.contentWindow && e.data?.type === "preview-ready") ready = true;
    };
    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  });

  $effect(() => {
    const cfg = $state.snapshot(config);
    if (ready && frame?.contentWindow) frame.contentWindow.postMessage({ type: "preview-tenant", config: cfg }, PUBLIC_ORIGIN);
  });
</script>

<section aria-label="Vista previa en vivo">
  <header>
    <div>
      <h2>Así lo ve tu audiencia</h2>
      <p>{ready ? "Los cambios sin guardar ya se ven aquí." : "Cargando la plataforma…"}</p>
    </div>
    <div class="seg" role="group" aria-label="Tamaño de pantalla">
      <button type="button" aria-pressed={device === "desktop"} onclick={() => (device = "desktop")}>Escritorio</button>
      <button type="button" aria-pressed={device === "mobile"} onclick={() => (device = "mobile")}>Móvil</button>
    </div>
  </header>
  <div class="stage">
    {#key slug}
      <iframe
        bind:this={frame}
        title="Plataforma de {config.nombre}"
        src="{PUBLIC_URL}/?medio={encodeURIComponent(slug)}&preview=1&admin={encodeURIComponent(location.origin)}"
        class:mobile={device === "mobile"}
      ></iframe>
    {/key}
  </div>
</section>

<style>
  section {
    display: flex;
    flex-direction: column;
    min-width: 0;
    height: 100%;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding: 18px 22px 12px;
  }
  h2 {
    font-size: 18px;
  }
  p {
    margin: 2px 0 0;
    font-size: 12.5px;
    color: var(--mut);
  }
  .seg {
    display: flex;
    border: 1.5px solid var(--ink);
    border-radius: 6px;
    overflow: hidden;
  }
  .seg button {
    border: 0;
    background: transparent;
    padding: 6px 12px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .seg button[aria-pressed="true"] {
    background: var(--ink);
    color: #fff;
  }
  .stage {
    flex: 1;
    min-height: 0;
    padding: 0 22px 22px;
    display: flex;
    justify-content: center;
  }
  iframe {
    width: 100%;
    height: 100%;
    border: 1.5px solid var(--ink);
    background: #fff;
    border-radius: 4px;
  }
  iframe.mobile {
    width: 390px;
    max-width: 100%;
  }
</style>
