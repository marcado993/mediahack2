<script>
  // Propagation graph for a claim: who published it, in what order, how far
  // apart.
  //
  // The wording here is load-bearing and deliberately un-exciting. It says
  // "primera aparición registrada", never "origen". We can order
  // publications by timestamp; we cannot prove one outlet copied another,
  // and labelling a real, named publisher as the origin of a rumour on that
  // evidence would be precisely the kind of false attribution this project
  // exists to fight. The chain is a starting point for a journalist's own
  // attribution work, not a conclusion.
  export let origin = null; // { claim, cadena, sin_fecha, primera_aparicion, advertencia }

  const KIND_COLOR = {
    verificador: "var(--brand)",
    medio: "var(--ink-mid)",
    red: "var(--tier-alto)",
  };

  const ROW = 46;
  $: chain = origin?.cadena ?? [];
  $: height = Math.max(chain.length * ROW + 12, 60);
  // Horizontal offset by elapsed time, so a burst of near-simultaneous
  // pickups reads differently from a slow drip.
  $: maxHours = Math.max(1, ...chain.map((n) => n.horas_desde_primera ?? 0));
</script>

{#if origin}
  <div class="origin">
    <div class="head">
      <span class="eyebrow">CADENA DE PROPAGACIÓN</span>
      <span class="meta">{origin.total_encontrado} publicaciones</span>
    </div>

    {#if !chain.length}
      <p class="note">
        Ninguna publicación con fecha utilizable para "{origin.claim}". Sin fechas no se puede
        ordenar una secuencia.
      </p>
    {:else}
      <svg viewBox="0 0 300 {height}" class="graph" role="img" aria-label="Secuencia de publicación">
        <line x1="16" y1="14" x2="16" y2={chain.length * ROW - 20} stroke="var(--hairline-strong)" stroke-width="1.5" />
        {#each chain as node, i}
          {@const y = 14 + i * ROW}
          {@const x = 16 + ((node.horas_desde_primera ?? 0) / maxHours) * 44}
          {#if i > 0}
            <line
              x1="16"
              y1={14 + (i - 1) * ROW}
              x2={x}
              y2={y}
              stroke="var(--hairline-strong)"
              stroke-width="1"
              stroke-dasharray="2 3"
            />
          {/if}
          <circle cx={x} cy={y} r={i === 0 ? 7 : 5} fill={KIND_COLOR[node.kind] ?? "var(--ink-mid)"} stroke="#fff" stroke-width="1.6" />
          <text x={x + 13} y={y - 2} class="src">{node.source}</text>
          <text x={x + 13} y={y + 9} class="when">
            {i === 0 ? "primera aparición registrada" : `+${node.horas_desde_primera}h`}
          </text>
        {/each}
      </svg>

      <ol class="list">
        {#each chain as node, i}
          <li>
            <a href={node.link} target="_blank" rel="noopener noreferrer">
              <span class="dot" style="background:{KIND_COLOR[node.kind] ?? 'var(--ink-mid)'}"></span>
              <span class="txt">{node.title}</span>
            </a>
          </li>
        {/each}
      </ol>
    {/if}

    {#if origin.sin_fecha?.length}
      <p class="note">
        {origin.sin_fecha.length} publicaciones en redes sin fecha utilizable quedan fuera de la
        secuencia — no se ubican en una posición inventada.
      </p>
    {/if}

    <p class="warn">{origin.advertencia}</p>
  </div>
{/if}

<style>
  .origin {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .eyebrow {
    font-family: var(--mono);
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.06em;
    color: var(--brand);
  }
  .meta {
    font-family: var(--mono);
    font-size: 9.5px;
    color: var(--ink-dim);
  }
  .graph {
    width: 100%;
    height: auto;
  }
  .src {
    font-family: var(--body);
    font-size: 8.5px;
    font-weight: 600;
    fill: var(--ink);
  }
  .when {
    font-family: var(--mono);
    font-size: 7px;
    fill: var(--ink-dim);
  }
  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .list a {
    display: flex;
    align-items: flex-start;
    gap: 7px;
    background: var(--card);
    border: 1px solid var(--hairline);
    border-radius: 6px;
    padding: 6px 9px;
    text-decoration: none;
  }
  .list a:hover {
    border-color: var(--brand);
  }
  .dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
    margin-top: 4px;
  }
  .txt {
    font-size: 11.5px;
    line-height: 1.4;
    color: var(--ink);
  }
  .note,
  .warn {
    margin: 0;
    font-size: 10px;
    line-height: 1.45;
    color: var(--ink-dim);
  }
  .warn {
    border-top: 1px dashed var(--hairline);
    padding-top: 7px;
  }
</style>
