<script>
  import { createMedia, deleteMedia } from "../utils/api";

  export let province = null;
  export let outlets = [];
  export let onChange = () => {};
  export let onClose = () => {};

  let showForm = false;
  let name = "";
  let type = "tv";
  let criteria = {
    cites_official_sources: false,
    separates_opinion_from_facts: false,
    has_public_editorial_policy: false,
    corrects_errors_publicly: false,
    not_previously_flagged_by_factcheckers: false,
  };
  let saving = false;

  async function submit() {
    if (!name.trim()) return;
    saving = true;
    try {
      await createMedia({ province, name: name.trim(), type, criteria });
      name = "";
      showForm = false;
      onChange();
    } finally {
      saving = false;
    }
  }

  async function remove(id) {
    await deleteMedia(id);
    onChange();
  }
</script>

<div class="backdrop" on:click={onClose}>
  <div class="modal" on:click|stopPropagation>
    <div class="modal-head">
      <h3>Medios — {province}</h3>
      <button class="close" on:click={onClose}>×</button>
    </div>

    {#if outlets.length === 0}
      <div class="empty">Sin medios registrados todavía. La capa de encuesta se usa sola hasta que se agreguen.</div>
    {:else}
      <ul class="outlets">
        {#each outlets as o}
          <li>
            <span class="type">{o.type}</span>
            <span class="name">{o.name}</span>
            <span class="score">{o.credibility_score}/100</span>
            <button class="del" on:click={() => remove(o.id)} title="Eliminar">×</button>
          </li>
        {/each}
      </ul>
    {/if}

    {#if showForm}
      <form on:submit|preventDefault={submit} class="form">
        <input placeholder="Nombre del medio" bind:value={name} required />
        <select bind:value={type}>
          <option value="tv">TV</option>
          <option value="radio">Radio</option>
          <option value="newspaper">Prensa</option>
          <option value="online">Online</option>
          <option value="other">Otro</option>
        </select>
        <div class="checks">
          <label><input type="checkbox" bind:checked={criteria.cites_official_sources} /> Cita fuentes oficiales</label>
          <label><input type="checkbox" bind:checked={criteria.separates_opinion_from_facts} /> Separa opinión de info</label>
          <label><input type="checkbox" bind:checked={criteria.has_public_editorial_policy} /> Política editorial pública</label>
          <label><input type="checkbox" bind:checked={criteria.corrects_errors_publicly} /> Corrige errores públicamente</label>
          <label><input type="checkbox" bind:checked={criteria.not_previously_flagged_by_factcheckers} /> No marcado por fact-checkers</label>
        </div>
        <button type="submit" class="save" disabled={saving}>{saving ? "Guardando…" : "Guardar"}</button>
      </form>
    {:else}
      <button class="add" on:click={() => (showForm = true)}>+ agregar medio</button>
    {/if}
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgba(7, 10, 13, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
  }
  .modal {
    background: var(--panel);
    border: 1px solid var(--hairline-bright);
    border-radius: 10px;
    padding: 18px 20px;
    width: 380px;
    max-height: 80vh;
    overflow-y: auto;
  }
  .modal-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
  }
  h3 {
    font-family: var(--display);
    font-size: 15px;
    margin: 0;
    color: var(--text-hi);
  }
  .close {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 20px;
    cursor: pointer;
    line-height: 1;
  }
  .empty {
    font-size: 12px;
    color: var(--text-dim);
    font-style: italic;
  }
  .outlets {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .outlets li {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    padding: 5px 0;
    border-bottom: 1px solid var(--hairline);
    color: var(--text-mid);
  }
  .type {
    text-transform: uppercase;
    font-size: 9.5px;
    background: var(--panel-raised);
    color: var(--signal-mid);
    padding: 2px 6px;
    border-radius: 4px;
    font-family: var(--mono);
  }
  .name {
    flex: 1;
    color: var(--text-hi);
  }
  .score {
    font-family: var(--mono);
    color: var(--text-mid);
  }
  .del {
    border: none;
    background: none;
    color: var(--signal-high);
    cursor: pointer;
    font-size: 15px;
  }
  .add {
    background: none;
    border: 1px dashed var(--hairline-bright);
    color: var(--signal-mid);
    border-radius: 6px;
    padding: 7px;
    width: 100%;
    cursor: pointer;
    font-size: 12px;
  }
  .form {
    display: flex;
    flex-direction: column;
    gap: 6px;
    border-top: 1px dashed var(--hairline);
    padding-top: 10px;
    margin-top: 4px;
  }
  .form input:not([type="checkbox"]),
  .form select {
    font-size: 12px;
    padding: 6px 8px;
    border: 1px solid var(--hairline-bright);
    border-radius: 4px;
    background: var(--panel-raised);
    color: var(--text-hi);
  }
  .checks {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px;
    font-size: 10.5px;
    color: var(--text-mid);
  }
  .checks label {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .save {
    align-self: flex-start;
    background: var(--signal-mid);
    color: #1a1206;
    border: none;
    padding: 7px 16px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .save:disabled {
    opacity: 0.6;
  }
</style>
