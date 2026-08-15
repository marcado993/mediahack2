<script>
  import { onMount } from "svelte";
  import { getSegmentadoresMapa, getSegmentadoresProvincias } from "../../utils/api";
  import ObservatoryMap from "./ObservatoryMap.svelte";
  import ObservatoryProfile from "./ObservatoryProfile.svelte";
  import ObservatoryCompare from "./ObservatoryCompare.svelte";
  import ObservatoryTable from "./ObservatoryTable.svelte";
  import ObservatoryMethodology from "./ObservatoryMethodology.svelte";

  const VIEWS = [
    { key: "mapas", label: "Mapas" },
    { key: "perfil", label: "Perfil" },
    { key: "comparar", label: "Comparar" },
    { key: "datos", label: "Datos" },
    { key: "meto", label: "Metodología" },
  ];

  let view = "mapas";
  let mapa = null;
  let provincias = [];
  let loading = true;
  let error = false;
  let selectedProvince = null;
  let compareB = null;

  onMount(async () => {
    try {
      const [mapaRes, provRes] = await Promise.all([getSegmentadoresMapa(), getSegmentadoresProvincias()]);
      mapa = mapaRes;
      provincias = provRes.provincias;
    } catch (e) {
      error = true;
    } finally {
      loading = false;
    }
  });

  function goToProfile(name) {
    selectedProvince = name;
    view = "perfil";
  }

  function goToCompareWith(name) {
    compareB = name;
    view = "comparar";
  }
</script>

<div class="observatory">
  <nav>
    {#each VIEWS as v}
      <button class:on={view === v.key} on:click={() => (view = v.key)}>{v.label}</button>
    {/each}
  </nav>

  {#if loading}
    <div class="loading">Cargando observatorio…</div>
  {:else if error}
    <div class="loading">No se pudo conectar con el backend.</div>
  {:else}
    <div class="content">
      {#if view === "mapas"}
        <ObservatoryMap {mapa} onSelect={goToProfile} />
      {:else if view === "perfil"}
        {#if selectedProvince}
          <div class="picker-row">
            <select bind:value={selectedProvince}>
              {#each provincias as p}<option value={p}>{p}</option>{/each}
            </select>
            <button class="link" on:click={() => goToCompareWith(selectedProvince)}>Comparar esta provincia →</button>
          </div>
          <ObservatoryProfile province={selectedProvince} />
        {:else}
          <div class="picker-row">
            <select bind:value={selectedProvince}>
              <option value={null} disabled selected>Elige una provincia…</option>
              {#each provincias as p}<option value={p}>{p}</option>{/each}
            </select>
          </div>
          <p class="hint">O haz clic en una provincia desde la pestaña Mapas.</p>
        {/if}
      {:else if view === "comparar"}
        <ObservatoryCompare {provincias} initialA={selectedProvince} initialB={compareB} />
      {:else if view === "datos"}
        <ObservatoryTable onSelect={goToProfile} />
      {:else if view === "meto"}
        <ObservatoryMethodology />
      {/if}
    </div>
  {/if}
</div>

<style>
  .observatory {
    display: flex;
    flex-direction: column;
    gap: 14px;
    /* This is a flex item of .app (flex-direction: column). `margin: 0
       auto` centers it once max-width caps out on large screens, but auto
       side-margins on a flex item also opt it out of cross-axis stretch -
       without an explicit width:100% it sized to its widest descendant's
       content instead of the viewport, forcing the whole page wider than
       the screen on mobile. */
    width: 100%;
    min-width: 0;
    padding: 14px 18px 40px;
    max-width: 1280px;
    margin: 0 auto;
    box-sizing: border-box;
  }
  nav {
    display: flex;
    gap: 2px;
    flex-wrap: wrap;
    border-bottom: 1px solid var(--hairline);
  }
  nav button {
    background: none;
    border: none;
    color: var(--ink-mid);
    padding: 9px 15px;
    cursor: pointer;
    font: inherit;
    font-size: 13px;
    font-weight: 500;
    border-bottom: 3px solid transparent;
  }
  nav button:hover {
    color: var(--ink);
  }
  nav button.on {
    color: var(--brand);
    font-weight: 700;
    border-bottom-color: var(--brand);
  }
  .loading {
    padding: 40px;
    text-align: center;
    color: var(--ink-dim);
    font-size: 13px;
  }
  .content {
    min-height: 0;
  }
  .picker-row {
    display: flex;
    align-items: center;
    gap: 14px;
    margin-bottom: 12px;
  }
  select {
    font: inherit;
    font-size: 13px;
    padding: 7px 11px;
    border: 1px solid var(--hairline-strong);
    border-radius: 8px;
    background: var(--card);
    color: var(--ink);
  }
  .link {
    font: inherit;
    font-size: 12px;
    color: var(--brand);
    background: none;
    border: none;
    cursor: pointer;
    text-decoration: underline;
  }
  .hint {
    font-size: 12.5px;
    color: var(--ink-dim);
  }
</style>
