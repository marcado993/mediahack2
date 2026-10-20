<script>
  import { slugify } from "./lib.js";

  let { tenants, selected, dirty, oncreate, onselect } = $props();
  let creating = $state(false);
  let nombre = $state("");
  let slug = $state("");
  let slugTouched = $state(false);
  let busy = $state(false);
  let error = $state("");

  $effect(() => {
    if (!slugTouched) slug = slugify(nombre);
  });

  async function submit(e) {
    e.preventDefault();
    busy = true;
    error = "";
    try {
      await oncreate(nombre.trim(), slug);
      creating = false;
      nombre = slug = "";
      slugTouched = false;
    } catch (err) {
      error = err.message;
    } finally {
      busy = false;
    }
  }
</script>

<nav aria-label="Medios">
  <div class="head">
    <h2>Medios</h2>
    <button class="btn ghost small" type="button" onclick={() => (creating = !creating)} aria-expanded={creating}>{creating ? "Cancelar" : "Nuevo medio"}</button>
  </div>

  {#if creating}
    <form onsubmit={submit} class="new">
      <label class="field">
        <span>Nombre del medio</span>
        <input type="text" bind:value={nombre} required maxlength="80" placeholder="Diario La Hora" />
      </label>
      <label class="field">
        <span>Identificador</span>
        <input type="text" class="mono" bind:value={slug} oninput={() => (slugTouched = true)} required pattern="[a-z0-9]([a-z0-9\-]*[a-z0-9])?" maxlength="40" />
        <small>Va en el enlace: <span class="mono">/?medio={slug || "…"}</span>. No se puede cambiar después.</small>
      </label>
      {#if error}<p class="msg-err" role="alert">{error}</p>{/if}
      <button class="btn red" type="submit" disabled={busy || !nombre.trim() || slug.length < 2}>{busy ? "Creando…" : "Crear medio"}</button>
    </form>
  {/if}

  <ul>
    {#each tenants as t (t.slug)}
      <li>
        <button type="button" class="row" class:sel={t.slug === selected} aria-current={t.slug === selected ? "true" : undefined} onclick={() => onselect(t.slug)}>
          <span class="chipcolor" style="background:{t.color}"></span>
          <span class="meta">
            <span class="name">{t.nombre}{#if t.slug === selected && dirty}<mark>sin guardar</mark>{/if}</span>
            <span class="sub mono">{t.slug === "default" ? "base · lo que ven todos por defecto" : t.slug}</span>
          </span>
          {#if !t.publicado}<span class="draft">Borrador</span>{/if}
        </button>
      </li>
    {/each}
  </ul>
</nav>

<style>
  nav {
    padding: 18px 0;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0 18px 12px;
  }
  h2 {
    font-size: 18px;
  }
  .small {
    padding: 5px 10px;
    font-size: 12.5px;
  }
  .new {
    padding: 14px 18px 4px;
    background: var(--card);
    border-block: 1px solid var(--line);
    margin-bottom: 8px;
  }
  .new .btn {
    margin-bottom: 14px;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 11px;
    text-align: left;
    padding: 11px 18px;
    background: transparent;
    border: 0;
    border-left: 4px solid transparent;
    cursor: pointer;
  }
  .row:hover {
    background: rgba(255, 255, 255, 0.6);
  }
  .row.sel {
    background: var(--card);
    border-left-color: var(--red);
  }
  .chipcolor {
    flex: none;
    width: 14px;
    height: 34px;
    border-radius: 2px;
  }
  .meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .sub {
    font-size: 11.5px;
    color: var(--mut);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  mark {
    background: var(--hl);
    color: var(--ink);
    font-size: 11px;
    font-weight: 600;
    padding: 1px 6px;
    margin-left: 8px;
    border-radius: 2px;
  }
  .draft {
    font-size: 11px;
    font-weight: 600;
    border: 1.5px solid var(--mut);
    color: var(--mut);
    padding: 0 6px;
    border-radius: 3px;
  }
</style>
