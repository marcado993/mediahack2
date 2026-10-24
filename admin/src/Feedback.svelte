<script>
  let { call, tenants = [], oncount } = $props();

  let rows = $state([]);
  let resumen = $state({});
  let loading = $state(true);
  let error = $state("");
  let medio = $state("");
  let tipo = $state("medio");
  let soloPendientes = $state(true);
  let notas = $state({});
  let savingId = $state("");

  const MOTIVOS = {
    falto_dato: "Faltó un dato",
    dificil_entender: "Difícil de entender",
    no_sirve_nota: "No encaja en su nota",
    error_dato: "Cree que hay un error",
    otro: "Otro motivo",
  };
  const CONTEXTOS = {
    cita_ficha: "Párrafo de la ficha",
    frase_ficha: "Frase corta",
    datos_nota: "Datos para la nota",
    cita_mapa: "Cita del mapa",
    cita_resumen: "Cita del resumen rápido",
    comparacion: "Comparación",
  };
  const ROLES = { reportero: "Reportería", editor: "Edición", verificador: "Verificación", datos: "Datos", direccion: "Dirección", otro: "Otro" };
  const MODULOS = { nota: "Preparar mi nota", mapa: "Mapa", comparar: "Comparar", escucha: "Escucha digital", datos_abiertos: "Datos abiertos", solicitudes: "Solicitudes" };

  const nombreMedio = (slug) => tenants.find((t) => t.slug === slug)?.nombre ?? slug;
  const shown = $derived(rows.filter((r) => (!medio || r.medio === medio) && r.tipo === tipo && (!soloPendientes || !r.revisada)));
  const pendientes = $derived(rows.filter((r) => r.tipo === "medio" && !r.revisada).length);
  const medios = $derived(Object.keys(resumen).sort((a, b) => (a === "default" ? -1 : b === "default" ? 1 : nombreMedio(a).localeCompare(nombreMedio(b), "es"))));

  $effect(() => {
    oncount(pendientes);
  });

  async function load() {
    loading = true;
    error = "";
    try {
      const data = await call("/api/admin/retroalimentacion");
      rows = data.retroalimentacion;
      resumen = data.resumen;
      notas = Object.fromEntries(rows.map((r) => [r.id, r.nota]));
    } catch (e) {
      error = e.message;
    } finally {
      loading = false;
    }
  }
  load();

  async function marcar(r, revisada) {
    savingId = r.id;
    error = "";
    try {
      const rec = await call(`/api/admin/retroalimentacion/${r.id}`, { method: "PUT", body: JSON.stringify({ revisada, nota: notas[r.id] ?? "" }) });
      rows = rows.map((x) => (x.id === r.id ? rec : x));
    } catch (e) {
      error = e.message;
    } finally {
      savingId = "";
    }
  }

  const topMotivo = (m) => {
    const e = Object.entries(m.motivos || {}).sort((a, b) => b[1] - a[1])[0];
    return e ? `${MOTIVOS[e[0]] ?? e[0]} (${e[1]})` : "—";
  };
  const fecha = (iso) => new Date(iso).toLocaleString("es-EC", { dateStyle: "medium", timeStyle: "short" });
</script>

<main>
  <header>
    <div>
      <h2>Retroalimentación de los medios</h2>
      <p>Qué les sirve, qué les falta y qué tan útil les resulta la herramienta, separado por medio. Úsalo para decidir qué construir y qué módulos ofrecer a cada cliente.</p>
    </div>
    <button class="btn ghost" type="button" onclick={load} disabled={loading}>Actualizar</button>
  </header>

  {#if error}<p class="msg-err" role="alert">{error}</p>{/if}

  {#if !loading && medios.length}
    <table class="res">
      <caption>Resumen por medio</caption>
      <thead><tr><th scope="col">Medio</th><th scope="col">«¿Te sirvió?»</th><th scope="col">% útil</th><th scope="col">Motivo más citado</th><th scope="col">Formularios</th><th scope="col">Utilidad media</th></tr></thead>
      <tbody>
        {#each medios as m (m)}
          {@const s = resumen[m]}
          <tr>
            <th scope="row"><button type="button" class="link" aria-pressed={medio === m} onclick={() => (medio = medio === m ? "" : m)}>{nombreMedio(m)}</button></th>
            <td>{s.usos}</td>
            <td>{s.pct_util == null ? "—" : `${s.pct_util} %`}</td>
            <td>{topMotivo(s)}</td>
            <td>{s.formularios}</td>
            <td>{s.valoracion_media == null ? "—" : `${s.valoracion_media} / 5`}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}

  <div class="bar">
    <div class="seg" role="group" aria-label="Tipo">
      <button type="button" aria-pressed={tipo === "medio"} onclick={() => (tipo = "medio")}>Formularios del medio</button>
      <button type="button" aria-pressed={tipo === "uso"} onclick={() => (tipo = "uso")}>«¿Te sirvió?»</button>
    </div>
    <label class="chk"><input type="checkbox" bind:checked={soloPendientes} /> Solo sin revisar</label>
    {#if medio}<button type="button" class="link" onclick={() => (medio = "")}>Ver todos los medios (ahora: {nombreMedio(medio)})</button>{/if}
  </div>

  {#if loading}
    <p class="empty">Cargando…</p>
  {:else if !shown.length}
    <p class="empty">{rows.length ? "Nada por aquí con estos filtros." : "Todavía no llega retroalimentación. Aparecerá cuando una redacción responda «¿Te sirvió?» o envíe el formulario del pie de página."}</p>
  {:else}
    <ul>
      {#each shown as r (r.id)}
        <li class:pend={!r.revisada} class:neg={r.tipo === "uso" && !r.util}>
          <div class="top">
            {#if r.tipo === "medio"}
              <strong>{r.nombre}</strong><span>{r.organizacion}</span><span class="mono">{ROLES[r.rol] ?? r.rol}</span>
              <span class="score" title="Utilidad declarada">{r.valoracion} / 5</span>
            {:else}
              <strong>{r.util ? "Le sirvió" : "No del todo"}</strong><span>{CONTEXTOS[r.contexto] ?? r.contexto}</span>
              {#if r.provincia}<span class="mono">{r.provincia}</span>{/if}
            {/if}
            <span class="when">{fecha(r.creada)} · {nombreMedio(r.medio)}</span>
          </div>
          {#if r.tipo === "medio"}
            <dl>
              <dt>Necesita</dt><dd>{r.necesidad}</dd>
              <dt>Usa</dt><dd>{r.modulos.length ? r.modulos.map((m) => MODULOS[m] ?? m).join(", ") : "No lo indicó"}</dd>
            </dl>
          {:else if r.motivo || r.comentario}
            <dl>
              {#if r.motivo}<dt>Motivo</dt><dd>{MOTIVOS[r.motivo] ?? r.motivo}</dd>{/if}
              {#if r.comentario}<dt>Comentario</dt><dd>{r.comentario}</dd>{/if}
            </dl>
          {/if}
          <div class="edit">
            <label class="wide">
              <span>Nota interna</span>
              <input type="text" bind:value={notas[r.id]} maxlength="1000" placeholder="Qué haremos con esto" />
            </label>
            <div class="acts">
              {#if r.tipo === "medio" && r.correo}<a class="btn ghost" href="mailto:{r.correo}?subject={encodeURIComponent('Gracias por tu retroalimentación al observatorio')}">Escribir a {r.correo}</a>{:else}<span></span>{/if}
              <button class="btn red" type="button" disabled={savingId === r.id} onclick={() => marcar(r, !r.revisada)}>
                {savingId === r.id ? "Guardando…" : r.revisada ? "Marcar como pendiente" : "Marcar como revisada"}
              </button>
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</main>

<style>
  main {
    max-width: 980px;
    margin: 0 auto;
    padding: 22px 22px 60px;
  }
  header {
    display: flex;
    justify-content: space-between;
    gap: 16px;
    align-items: flex-end;
    flex-wrap: wrap;
    margin-bottom: 16px;
  }
  h2 {
    font-size: 24px;
  }
  header p {
    margin: 4px 0 0;
    color: var(--mut);
    max-width: 62ch;
  }
  .res {
    width: 100%;
    border-collapse: collapse;
    background: var(--card);
    border: 1px solid var(--line);
    margin-bottom: 18px;
    font-size: 13.5px;
  }
  .res caption {
    text-align: left;
    font-weight: 700;
    padding: 0 0 6px;
  }
  .res th,
  .res td {
    padding: 8px 10px;
    border-bottom: 1px solid var(--line);
    text-align: left;
  }
  .res thead th {
    font-size: 12px;
    color: var(--mut);
    font-weight: 600;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    font: inherit;
    font-weight: 650;
    color: var(--ink);
    text-decoration: underline;
    cursor: pointer;
  }
  .link[aria-pressed="true"] {
    background: var(--hl);
  }
  .bar {
    display: flex;
    gap: 14px;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .chk {
    display: flex;
    gap: 6px;
    align-items: center;
    font-size: 13.5px;
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
    padding: 7px 13px;
    font-weight: 600;
    font-size: 13px;
    cursor: pointer;
  }
  .seg button[aria-pressed="true"] {
    background: var(--ink);
    color: #fff;
  }
  .empty {
    padding: 40px 0;
    color: var(--mut);
    text-align: center;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 14px;
  }
  li {
    background: var(--card);
    border: 1px solid var(--line);
    border-left: 5px solid var(--line);
    padding: 14px 18px 16px;
  }
  li.pend {
    border-left-color: var(--red);
  }
  li.neg .top strong {
    color: var(--red);
  }
  .top {
    display: flex;
    gap: 6px 14px;
    flex-wrap: wrap;
    align-items: baseline;
    margin-bottom: 8px;
  }
  .top strong {
    font-family: var(--display);
    font-size: 17px;
  }
  .score {
    font-weight: 700;
    background: var(--hl);
    padding: 0 7px;
    border-radius: 9px;
  }
  .when {
    margin-left: auto;
    color: var(--mut);
    font-size: 12.5px;
  }
  dl {
    margin: 0 0 12px;
    display: grid;
    grid-template-columns: 90px 1fr;
    gap: 4px 12px;
  }
  dt {
    font-weight: 600;
    font-size: 12.5px;
    color: var(--mut);
  }
  dd {
    margin: 0;
    white-space: pre-wrap;
  }
  .edit {
    display: grid;
    gap: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--paper);
  }
  .edit label span {
    display: block;
    font-size: 12px;
    font-weight: 600;
    margin-bottom: 3px;
  }
  .edit input {
    width: 100%;
    padding: 8px 10px;
    border: 1.5px solid var(--line);
    border-radius: 6px;
    background: var(--card);
  }
  .edit input:focus {
    border-color: var(--ink);
    outline: none;
    box-shadow: 0 0 0 3px var(--hl);
  }
  .acts {
    display: flex;
    gap: 8px;
    justify-content: space-between;
    flex-wrap: wrap;
  }
  .acts a {
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
</style>
