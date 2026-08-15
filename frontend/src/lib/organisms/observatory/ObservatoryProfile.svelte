<script>
  import { onMount } from "svelte";
  import { getSegmentadoresPerfil } from "../../utils/api";
  import HBar from "../../molecules/observatory/HBar.svelte";
  import StatCard from "../../molecules/observatory/StatCard.svelte";

  export let province;

  let data = null;
  let loading = false;
  let failed = false;

  async function load(p) {
    if (!p) return;
    loading = true;
    failed = false;
    data = null;
    const requested = p;
    try {
      const res = await getSegmentadoresPerfil(p);
      if (requested === province) data = res;
    } catch (e) {
      if (requested === province) failed = true;
    } finally {
      if (requested === province) loading = false;
    }
  }

  $: load(province);

  const ETNIA_COLOR = {
    et_mestizo: "#4a6fa5",
    et_indigena: "#c4823a",
    et_montubio: "#5b9e79",
    et_afro: "#8c5aa8",
    et_blanco: "#98a5b5",
    et_otro: "#c9d2dc",
  };
</script>

{#if loading}
  <div class="loading">Cargando perfil de {province}…</div>
{:else if failed}
  <div class="loading">No se pudo cargar el perfil. <button on:click={() => load(province)}>Reintentar</button></div>
{:else if data}
  <div class="profile">
    <div class="grid g2">
      <div class="card">
        <h3>Vulnerabilidad electoral integrada</h3>
        <div class="headline">
          <div class="big">{data.ivei.indice?.toFixed(1)}</div>
          <div>
            <span class="pill">{data.ivei.nivel}</span>
            <div class="sub">Puesto {data.ivei.puesto} de 24 · promedio nacional {data.ivei.nacional?.toFixed(1)}</div>
          </div>
        </div>
        <div class="dims">
          {#each data.dimensiones as d}
            <HBar label={d.nombre} value={d.valor} nacional={d.nacional} color={d.color} decimals={1} unit="" />
          {/each}
        </div>
        <p class="note">La marca vertical indica el promedio nacional de cada dimensión.</p>
      </div>
      <div class="card">
        <h3>Perfil territorial</h3>
        <h2>{data.perfil_territorial.tipo}</h2>
        <p class="desc">{data.perfil_territorial.descripcion}</p>
        <div class="grid g2 tight">
          <StatCard label="Población" value={data.identificacion.poblacion} nacional={null} unit="hab." absolute />
          <StatCard label="Densidad" value={data.identificacion.densidad} nacional={null} unit="hab/km²" absolute />
          <StatCard label="Población rural" value={data.identificacion.pct_rural} decimals={1} />
          <StatCard label="65 años y más" value={data.demografia.edades.find((e) => e.key === "pct_65")?.valor} nacional={data.demografia.edades.find((e) => e.key === "pct_65")?.nacional} direction={1} />
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Diagnóstico territorial</h2>
      <h3 class="sub-h">¿Por qué esta provincia presenta este nivel?</h3>
      {#each data.diagnostico as line}
        <p class="diag">{line}</p>
      {/each}
    </div>

    <div class="grid g2">
      <div class="card">
        <h3>Estructura por edad</h3>
        {#each data.demografia.edades as e}
          <HBar label={e.label} value={e.valor} nacional={e.nacional} color="#4a6fa5" />
        {/each}
        <p class="note">Barras: provincia. Marca vertical: promedio nacional. Censo 2022.</p>
      </div>
      <div class="card">
        <h3>Autoadscripción étnica</h3>
        <div class="stack">
          {#each data.demografia.etnias.filter((e) => (e.valor ?? 0) > 0.5) as e}
            <div class="stack-seg" style="width:{e.valor}%; background:{ETNIA_COLOR[e.key]}" title="{e.label}: {e.valor?.toFixed(1)}%">
              {#if e.valor > 9}{e.valor.toFixed(0)}%{/if}
            </div>
          {/each}
        </div>
        <div class="legend">
          {#each data.demografia.etnias.filter((e) => (e.valor ?? 0) > 0.4) as e}
            <span><span class="sw" style="background:{ETNIA_COLOR[e.key]}"></span>{e.label} {e.valor?.toFixed(1)}%</span>
          {/each}
        </div>
        <p class="note">Censo de Población y Vivienda 2022 (INEC).</p>
      </div>
    </div>

    <div class="card">
      <h2>Perfil digital</h2>
      <h3 class="sub-h">Acceso, uso y capacidades</h3>
      <div class="grid g4 tight">
        {#each data.digital.acceso as m}
          <StatCard label={m.label} value={m.valor} nacional={m.nacional} unit={m.unit} source={m.source} direction={m.direction} />
        {/each}
      </div>
      <div class="grid g2">
        <div>
          <h4>Brecha interna</h4>
          {#each data.digital.brecha as m}
            <HBar label={m.label} value={m.valor} nacional={m.nacional} color="#1d6a96" />
          {/each}
        </div>
        <div>
          <h4>Mecanismo predominante</h4>
          <HBar label="Exclusión digital" value={data.digital.mecanismo.exclusion} nacional={data.digital.mecanismo.nacional_exclusion} color="#b3541e" />
          <HBar label="Hiperexposición digital" value={data.digital.mecanismo.hiperexposicion} nacional={data.digital.mecanismo.nacional_hiperexposicion} color="#b3541e" />
          <p class="note">{data.digital.mecanismo.nota}</p>
        </div>
      </div>
    </div>

    <div class="card">
      <h2>Dieta informativa de {data.provincia}</h2>
      <h3 class="sub-h">Plataformas digitales · % de la población conectada</h3>
      {#each Object.entries(data.dieta_informativa.plataformas).filter(([, v]) => v != null && v > 2).sort((a, b) => b[1] - a[1]) as [nombre, valor]}
        <HBar label={nombre} value={valor} color="#2f7d52" />
      {/each}
      <div class="grid g4 tight" style="margin-top:10px">
        <StatCard label="Usa redes sociales" value={data.dieta_informativa.usa_redes.valor} nacional={data.dieta_informativa.usa_redes.nacional} />
        <StatCard label="Plataformas por persona" value={data.dieta_informativa.n_plataformas.valor} nacional={data.dieta_informativa.n_plataformas.nacional} unit="" decimals={1} />
        <StatCard label="Usa mensajería (WhatsApp)" value={data.dieta_informativa.mensajeria.valor} nacional={data.dieta_informativa.mensajeria.nacional} />
        <StatCard label="Percibe información falsa" value={data.dieta_informativa.conciencia.valor} nacional={data.dieta_informativa.conciencia.nacional} direction={-1} />
      </div>
      <div class="warn">{data.dieta_informativa.advertencia}</div>
    </div>

    <div class="grid g2">
      <div class="card">
        <h2>Resiliencia informativa</h2>
        <h3 class="sub-h">Capacidades de detección y contraste</h3>
        <HBar label="Escolaridad (años)" value={data.resiliencia.escolaridad.valor} nacional={data.resiliencia.escolaridad.nacional} max={20} unit=" años" color="#2f7d52" />
        {#each data.resiliencia.componentes as m}
          <HBar label={m.label} value={m.valor} nacional={m.nacional} color="#2f7d52" />
        {/each}
        <p class="note">{data.resiliencia.nota}</p>
      </div>
      <div class="card">
        <h2>Presión coyuntural</h2>
        <h3 class="sub-h">Capa dinámica, actualizable ante cada elección</h3>
        {#each data.presion_coyuntural.componentes as m}
          <HBar label={m.label} value={m.valor} nacional={m.nacional} color="#7a4a9e" />
        {/each}
        <p class="note">{data.presion_coyuntural.nota}</p>
      </div>
    </div>

    <div class="card">
      <h2>Condiciones socioeconómicas y educativas</h2>
      <div class="grid g4 tight" style="margin-top:8px">
        {#each data.socioeconomico as m}
          <StatCard label={m.label} value={m.valor} nacional={m.nacional} unit={m.unit} source={m.source} direction={m.direction} decimals={m.unit === "años" || m.unit === "índice" ? 2 : 1} />
        {/each}
      </div>
    </div>

    <div class="card">
      <h2>¿Qué debería considerar quien informa en {data.provincia}?</h2>
      <h3 class="sub-h">Derivado de los indicadores de la provincia - no es una evaluación de personas ni candidatos</h3>
      {#each data.recomendaciones_periodismo as r}
        <div class="reco">
          <b>{r.titulo}</b>
          <p>{r.texto}</p>
        </div>
      {/each}
    </div>
  </div>
{:else}
  <div class="loading">Selecciona una provincia en el mapa.</div>
{/if}

<style>
  .loading {
    padding: 24px;
    color: var(--ink-dim);
    font-size: 13px;
  }
  .loading button {
    font: inherit;
    color: var(--brand);
    background: none;
    border: none;
    text-decoration: underline;
    cursor: pointer;
  }
  .profile {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .grid {
    display: grid;
    gap: 14px;
  }
  .grid.g2 {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
  .grid.g4 {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
  .grid.tight {
    gap: 8px;
  }
  .card {
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 10px;
    padding: 14px 16px;
  }
  .card h2 {
    font-family: var(--display);
    font-size: 15px;
    margin: 0 0 3px;
    color: var(--ink);
    font-weight: 700;
  }
  .card h3 {
    font-size: 11px;
    margin: 0 0 10px;
    font-weight: 600;
    color: var(--ink-dim);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .card h3.sub-h {
    margin-top: 0;
  }
  .card h4 {
    font-size: 11px;
    color: var(--ink-dim);
    margin: 0 0 6px;
    font-weight: 600;
  }
  .headline {
    display: flex;
    align-items: baseline;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 14px;
  }
  .big {
    font-family: var(--display);
    font-size: 40px;
    font-weight: 700;
    color: var(--brand);
    letter-spacing: -0.02em;
    line-height: 1;
  }
  .pill {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
    color: #fff;
    background: var(--brand);
  }
  .sub {
    font-size: 11.5px;
    color: var(--ink-dim);
    margin-top: 4px;
  }
  .dims {
    margin-top: 6px;
  }
  .desc {
    font-size: 13px;
    color: var(--ink-mid);
    margin: 0 0 12px;
    line-height: 1.5;
  }
  .note {
    font-size: 10.5px;
    color: var(--ink-dim);
    margin: 6px 0 0;
    line-height: 1.4;
  }
  .diag {
    font-size: 13px;
    line-height: 1.55;
    color: var(--ink);
    margin: 0 0 8px;
    max-width: 78ch;
  }
  .stack {
    display: flex;
    height: 22px;
    border-radius: 5px;
    overflow: hidden;
  }
  .stack-seg {
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
  }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 8px;
    font-size: 10.5px;
    color: var(--ink-mid);
  }
  .sw {
    display: inline-block;
    width: 9px;
    height: 9px;
    border-radius: 2px;
    margin-right: 5px;
    vertical-align: -1px;
  }
  .warn {
    margin-top: 12px;
    font-size: 11px;
    line-height: 1.5;
    color: var(--ink-mid);
    background: var(--card-alt);
    border: 1px solid var(--hairline);
    border-radius: 8px;
    padding: 10px 12px;
  }
  .reco {
    margin-bottom: 13px;
  }
  .reco b {
    font-size: 13px;
    color: var(--ink);
  }
  .reco p {
    font-size: 13px;
    color: var(--ink-mid);
    margin: 3px 0 0;
    line-height: 1.5;
    max-width: 82ch;
  }
  @media (max-width: 900px) {
    .grid.g2,
    .grid.g4 {
      grid-template-columns: minmax(0, 1fr);
    }
  }
</style>
