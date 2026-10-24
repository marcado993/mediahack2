<script>
  import { untrack } from "svelte";
  import Switch from "./Switch.svelte";
  import { contrast, onColor, isHex, DEFAULT_TITULO, DEFAULT_LEMA } from "./lib.js";
  import { PUBLIC_URL } from "./config.js";

  let { slug, draft = $bindable(), flags, dirty, saving, error, onsave, ondelete, onrevert } = $props();

  let tab = $state("marca");
  let confirmDelete = $state(false);
  let confirmText = $state("");
  let logoError = $state("");
  let copied = $state(false);
  let dominiosText = $state("");

  // Editorial colours, all checked for >= 4.5:1 on white (the server enforces it too).
  const PRESETS = [
    ["Tinta azul", "#1b3a5c"],
    ["Azul marino", "#0f2f6b"],
    ["Rojo editorial", "#b3141f"],
    ["Vino", "#7a1f3d"],
    ["Verde diario", "#1f6b4a"],
    ["Ocre tinta", "#7a5200"],
    ["Negro prensa", "#1c1c1c"],
    ["Pizarra", "#3d4a5c"],
  ];

  $effect(() => {
    slug; // reset local state only when another medio is opened
    untrack(() => {
      dominiosText = draft.dominios.join("\n");
      confirmDelete = false;
      confirmText = "";
      logoError = "";
      tab = "marca";
    });
  });

  const isDefault = $derived(slug === "default");
  const colorOk = $derived(isHex(draft.color));
  const onBrand = $derived(colorOk ? onColor(draft.color) : "#ffffff");
  const headerRatio = $derived(colorOk ? contrast(draft.color, onBrand) : 0);
  const whiteRatio = $derived(colorOk ? contrast(draft.color, "#ffffff") : 0);
  const tooLight = $derived(colorOk && whiteRatio < 4.5);

  const groups = $derived.by(() => {
    const by = new Map();
    for (const f of flags) {
      if (!by.has(f.grupo)) by.set(f.grupo, []);
      by.get(f.grupo).push(f);
    }
    return [...by];
  });
  const flagOn = (f) => (f.locked ? true : (draft.flags[f.key] ?? f.default));
  const activeCount = $derived(flags.filter(flagOn).length);
  const link = $derived(`${PUBLIC_URL}/?medio=${slug}`);

  function setFlag(f, v) {
    draft.flags = { ...draft.flags, [f.key]: v };
  }

  function onLogoFile(e) {
    logoError = "";
    const file = e.currentTarget.files?.[0];
    e.currentTarget.value = "";
    if (!file) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type)) {
      logoError = "Usa una imagen PNG, JPG, WebP o SVG.";
      return;
    }
    if (file.size > 200_000) {
      logoError = `Pesa ${Math.round(file.size / 1000)} KB; el máximo es 200 KB. Reduce la imagen e inténtalo de nuevo.`;
      return;
    }
    const reader = new FileReader();
    reader.onload = () => (draft.logo = String(reader.result));
    reader.onerror = () => (logoError = "No se pudo leer el archivo.");
    reader.readAsDataURL(file);
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(link);
      copied = true;
      setTimeout(() => (copied = false), 1800);
    } catch (_) {}
  }
</script>

<section aria-label="Editor de {draft.nombre}">
  <header>
    <div class="title">
      <h2>{draft.nombre || "Sin nombre"}</h2>
      <span class="mono slug">{slug}</span>
    </div>
    <div class="actions">
      {#if dirty}<button class="btn ghost" type="button" onclick={onrevert} disabled={saving}>Descartar</button>{/if}
      <button class="btn red" type="button" onclick={onsave} disabled={!dirty || saving || tooLight || !colorOk}>{saving ? "Guardando…" : "Guardar cambios"}</button>
    </div>
  </header>
  {#if error}<p class="msg-err top" role="alert">{error}</p>{/if}

  <div class="tabs" role="tablist" aria-label="Secciones del medio">
    {#each [["marca", "Marca"], ["funciones", `Funciones (${activeCount}/${flags.length})`], ["publicacion", "Publicación"]] as [id, label]}
      <button type="button" role="tab" aria-selected={tab === id} class:on={tab === id} onclick={() => (tab = id)}>{label}</button>
    {/each}
  </div>

  <div class="body">
    {#if tab === "marca"}
      <label class="field">
        <span>Nombre del medio</span>
        <input type="text" bind:value={draft.nombre} maxlength="80" />
      </label>
      <label class="field">
        <span>Título de la plataforma</span>
        <input type="text" bind:value={draft.titulo} maxlength="120" placeholder={DEFAULT_TITULO} />
        <small>Aparece en el encabezado y en la pestaña del navegador.</small>
      </label>
      <label class="field">
        <span>Lema (opcional)</span>
        <input type="text" bind:value={draft.lema} maxlength="200" placeholder={DEFAULT_LEMA} />
        <small>Si lo dejas vacío se muestra la línea de fuentes del Observatorio.</small>
      </label>

      <fieldset class="field">
        <legend>Color institucional</legend>
        <div class="swatches" role="group" aria-label="Colores editoriales">
          {#each PRESETS as [name, hex]}
            <button type="button" class="sw" class:on={draft.color.toLowerCase() === hex} style="background:{hex}" title="{name} {hex}" aria-label="{name} {hex}" aria-pressed={draft.color.toLowerCase() === hex} onclick={() => (draft.color = hex)}></button>
          {/each}
        </div>
        <div class="colorrow">
          <input type="color" aria-label="Elegir color" value={colorOk ? draft.color : "#1b3a5c"} oninput={(e) => (draft.color = e.currentTarget.value)} />
          <input type="text" class="mono" bind:value={draft.color} maxlength="7" aria-label="Código hexadecimal" aria-invalid={!colorOk || tooLight} />
        </div>
        {#if !colorOk}
          <small class="msg-err">Escribe un color hexadecimal de 6 dígitos, como #1b3a5c.</small>
        {:else if tooLight}
          <small class="msg-err">Demasiado claro (contraste {whiteRatio.toFixed(1)}:1 sobre blanco). Los enlaces y botones no se leerían; elige uno más oscuro.</small>
        {:else}
          <small>Texto del encabezado en {onBrand === "#ffffff" ? "blanco" : "tinta"} (contraste {headerRatio.toFixed(1)}:1). El color de los mapas no cambia: es dato, no marca.</small>
        {/if}
      </fieldset>

      <div class="field">
        <span>Logo</span>
        <div class="logorow">
          <div class="logoprev" class:placa={draft.logo_placa} style="background:{draft.logo_placa ? '#fff' : colorOk ? draft.color : '#1b3a5c'}">
            {#if draft.logo}<img src={draft.logo} alt="Logo actual" />{:else}<em>Sin logo</em>{/if}
          </div>
          <div class="logoctl">
            <label class="btn ghost filebtn">
              Subir imagen
              <input type="file" class="sr" accept="image/png,image/jpeg,image/webp,image/svg+xml" onchange={onLogoFile} />
            </label>
            {#if draft.logo}<button type="button" class="btn ghost" onclick={() => (draft.logo = "")}>Quitar</button>{/if}
          </div>
        </div>
        <label class="check"><input type="checkbox" bind:checked={draft.logo_placa} /> Mostrar sobre placa blanca <small>(para logos a color pensados para fondo claro)</small></label>
        {#if logoError}<small class="msg-err">{logoError}</small>{:else}<small>PNG, JPG, WebP o SVG, hasta 200 KB. Sin logo se usa la marca del Observatorio.</small>{/if}
      </div>

      <fieldset class="field">
        <legend>Tipografía de los títulos</legend>
        <div class="radios">
          <label><input type="radio" name="fuente" value="serif" bind:group={draft.fuente_titulos} /> <span class="serif">Serif editorial</span></label>
          <label><input type="radio" name="fuente" value="sans" bind:group={draft.fuente_titulos} /> <span>Sans neutra</span></label>
        </div>
      </fieldset>

      <label class="field">
        <span>Sitio del medio</span>
        <input type="url" bind:value={draft.sitio_url} placeholder="https://www.tumedio.ec" />
        <small>Se muestra como enlace «Volver a {draft.nombre || "tu medio"}» en el pie.</small>
      </label>
      <label class="field">
        <span>Línea del pie</span>
        <textarea bind:value={draft.pie} maxlength="240" rows="2" placeholder="Un proyecto de la redacción de datos de…"></textarea>
        <small>Debajo siempre aparece el crédito de datos y metodología del Observatorio; no se puede quitar.</small>
      </label>
    {:else if tab === "funciones"}
      <p class="lead">Lo que apagues desaparece de la plataforma de este medio. Las vistas marcadas «Siempre activa» sostienen la transparencia del índice.</p>
      {#each groups as [grupo, items]}
        <h3>{grupo}</h3>
        <ul class="flags">
          {#each items as f (f.key)}
            <li>
              <div class="ftxt">
                <span class="fname">{f.nombre}</span>
                <span class="fdet">{f.detalle}</span>
              </div>
              {#if f.locked}
                <span class="locked">Siempre activa</span>
              {:else}
                <Switch checked={flagOn(f)} label={f.nombre} onchange={(v) => setFlag(f, v)} />
              {/if}
            </li>
          {/each}
        </ul>
      {/each}
    {:else}
      <div class="field">
        <span>Enlace para tu audiencia</span>
        <div class="linkrow">
          <input type="text" class="mono" readonly value={link} onfocus={(e) => e.currentTarget.select()} aria-label="Enlace" />
          <button class="btn ghost" type="button" onclick={copyLink}>{copied ? "Copiado" : "Copiar"}</button>
          <a class="btn ghost" href={link} target="_blank" rel="noopener">Abrir</a>
        </div>
        <small>Compártelo tal cual o inclúyelo en un iframe en el sitio del medio.</small>
      </div>

      <div class="field">
        <span>Estado</span>
        <label class="check pub">
          <Switch bind:checked={draft.publicado} disabled={isDefault} label="Publicado" />
          <span>{draft.publicado ? "Publicado" : "Borrador"}</span>
        </label>
        <small>{isDefault ? "La configuración base siempre está publicada: es lo que ve cualquiera que llegue sin un medio." : draft.publicado ? "El enlace muestra la marca de este medio." : "En borrador el enlace muestra la marca del Observatorio, no la de este medio."}</small>
      </div>

      <label class="field">
        <span>Dominios propios</span>
        <textarea
          class="mono"
          rows="3"
          bind:value={dominiosText}
          oninput={() => (draft.dominios = dominiosText.split(/[\s,]+/).filter(Boolean))}
          placeholder="mapa.tumedio.ec"
        ></textarea>
        <small>Uno por línea. Cuando alguien abre la plataforma desde ese dominio, ve esta marca sin necesidad de <span class="mono">?medio=</span>. El dominio debe apuntar a la plataforma en tu proveedor de hosting.</small>
      </label>

      {#if !isDefault}
        <div class="danger">
          <h3>Eliminar medio</h3>
          {#if !confirmDelete}
            <p>Borra su marca y configuración. Los enlaces con <span class="mono">?medio={slug}</span> pasarán a mostrar la marca del Observatorio.</p>
            <button class="btn danger" type="button" onclick={() => (confirmDelete = true)}>Eliminar…</button>
          {:else}
            <label class="field">
              <span>Escribe <span class="mono">{slug}</span> para confirmar</span>
              <input type="text" class="mono" bind:value={confirmText} autocomplete="off" />
            </label>
            <div class="actions">
              <button class="btn danger" type="button" disabled={confirmText !== slug} onclick={ondelete}>Eliminar para siempre</button>
              <button class="btn ghost" type="button" onclick={() => (confirmDelete = false)}>Cancelar</button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</section>

<style>
  section {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-inline: 1px solid var(--line);
    min-width: 0;
  }
  header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 18px 22px 12px;
    flex-wrap: wrap;
  }
  .title {
    min-width: 0;
  }
  h2 {
    font-size: 22px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slug {
    font-size: 12px;
    color: var(--mut);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .top {
    margin: 0;
    padding: 0 22px 10px;
  }
  .tabs {
    display: flex;
    gap: 2px;
    padding: 0 14px;
    border-bottom: 1.5px solid var(--ink);
  }
  .tabs button {
    border: 0;
    background: none;
    padding: 9px 12px;
    font-weight: 600;
    font-size: 13.5px;
    color: var(--mut);
    cursor: pointer;
    border-bottom: 4px solid transparent;
    margin-bottom: -1.5px;
  }
  .tabs button.on {
    color: var(--ink);
    border-bottom-color: var(--red);
  }
  .body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 22px 40px;
  }
  .lead {
    margin: 0 0 14px;
    color: var(--mut);
    font-size: 13px;
  }
  fieldset {
    border: 0;
    padding: 0;
    margin: 0 0 16px;
    min-width: 0;
  }
  .swatches {
    display: flex;
    gap: 7px;
    flex-wrap: wrap;
    margin-bottom: 10px;
  }
  .sw {
    width: 30px;
    height: 30px;
    border-radius: 4px;
    border: 2px solid var(--card);
    box-shadow: 0 0 0 1.5px var(--line);
    cursor: pointer;
    padding: 0;
  }
  .sw.on {
    box-shadow: 0 0 0 2.5px var(--ink);
  }
  .colorrow {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .colorrow input[type="color"] {
    width: 44px;
    height: 38px;
    padding: 2px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: var(--card);
    cursor: pointer;
  }
  .colorrow input[type="text"] {
    width: 110px;
    padding: 9px 11px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
  }
  .colorrow input[aria-invalid="true"] {
    border-color: var(--red);
  }
  .logorow {
    display: flex;
    gap: 12px;
    align-items: center;
    margin-bottom: 8px;
  }
  .logoprev {
    width: 150px;
    height: 56px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border: 1.5px solid var(--line);
  }
  .logoprev img {
    max-width: 130px;
    max-height: 40px;
    object-fit: contain;
  }
  .logoprev em {
    font-size: 12px;
    color: #fff;
    opacity: 0.75;
    font-style: normal;
  }
  .logoprev.placa em {
    color: var(--mut);
  }
  .logoctl {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .filebtn {
    display: inline-block;
    position: relative;
  }
  .filebtn:focus-within {
    outline: 2.5px solid var(--ink);
    outline-offset: 2px;
  }
  .check {
    display: flex;
    gap: 8px;
    align-items: center;
    font-size: 13px;
    margin: 6px 0;
  }
  .check small {
    display: inline;
    margin: 0;
  }
  .pub {
    font-weight: 600;
    margin-bottom: 4px;
  }
  .radios {
    display: flex;
    gap: 22px;
    font-size: 15px;
  }
  .serif {
    font-family: var(--display);
    font-weight: 700;
  }
  h3 {
    font-size: 15px;
    margin: 22px 0 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--line);
  }
  .flags {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .flags li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 16px;
    padding: 11px 0;
    border-bottom: 1px solid var(--paper);
  }
  .ftxt {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .fname {
    font-weight: 600;
  }
  .fdet {
    font-size: 12.5px;
    color: var(--mut);
    line-height: 1.4;
  }
  .locked {
    flex: none;
    font-size: 11.5px;
    font-weight: 600;
    color: var(--ok);
    border: 1.5px solid var(--ok);
    padding: 1px 8px;
    border-radius: 3px;
  }
  .linkrow {
    display: flex;
    gap: 8px;
  }
  .linkrow input {
    flex: 1;
    min-width: 0;
    padding: 9px 11px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: var(--paper);
  }
  .linkrow a.btn {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  .danger {
    margin-top: 28px;
    padding: 14px 16px;
    border: 1.5px solid var(--red);
    border-radius: 6px;
  }
  .danger h3 {
    margin: 0 0 6px;
    border: 0;
    color: var(--red-ink);
  }
  .danger p {
    margin: 0 0 12px;
    font-size: 13px;
  }
</style>
