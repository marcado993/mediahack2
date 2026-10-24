<script>
  import { api } from "./api.js";
  import Login from "./Login.svelte";
  import Sidebar from "./Sidebar.svelte";
  import Editor from "./Editor.svelte";
  import Preview from "./Preview.svelte";
  import Requests from "./Requests.svelte";
  import Feedback from "./Feedback.svelte";
  import { newTenant, payload, toPublic } from "./lib.js";

  const store = {
    get: () => {
      try {
        return sessionStorage.getItem("admin_token") || "";
      } catch (_) {
        return "";
      }
    },
    set: (v) => {
      try {
        v ? sessionStorage.setItem("admin_token", v) : sessionStorage.removeItem("admin_token");
      } catch (_) {}
    },
  };

  const remembered = store.get();
  let token = $state(remembered);
  let authed = $state(false);
  let booting = $state(remembered !== "");
  let loginError = $state("");
  let loginBusy = $state(false);

  let tenants = $state([]);
  let flags = $state([]);
  let selected = $state(null);
  let draft = $state(null);
  let saved = $state(null);
  let saving = $state(false);
  let saveError = $state("");
  let view = $state("medios");
  let nuevas = $state(0);
  let retroPend = $state(0);
  let notice = $state("");
  let noticeTimer;

  const call = (path, opts = {}) =>
    api(path, { ...opts, headers: { "Content-Type": "application/json", "X-Admin-Token": token, ...opts.headers } });

  const dirty = $derived(!!draft && !!saved && JSON.stringify(payload(draft)) !== JSON.stringify(payload(saved)));
  const preview = $derived(draft && selected ? toPublic(selected, draft, flags) : null);

  function flash(msg) {
    notice = msg;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => (notice = ""), 3000);
  }

  function open(slug) {
    const t = tenants.find((x) => x.slug === slug);
    if (!t) return;
    selected = slug;
    saved = structuredClone($state.snapshot(t));
    draft = structuredClone($state.snapshot(t));
    saveError = "";
  }

  function select(slug) {
    if (slug === selected) return;
    if (dirty && !confirm("Tienes cambios sin guardar en este medio. ¿Descartarlos?")) return;
    open(slug);
  }

  async function load(initialSlug) {
    const [t, f, r] = await Promise.all([call("/api/admin/tenants"), call("/api/admin/flags"), call("/api/admin/solicitudes")]);
    tenants = t.tenants;
    flags = f.flags;
    nuevas = r.solicitudes.filter((x) => x.estado === "nueva").length;
    open(initialSlug && tenants.some((x) => x.slug === initialSlug) ? initialSlug : tenants[0]?.slug);
  }

  async function login(value) {
    token = value;
    loginBusy = true;
    loginError = "";
    try {
      await load();
      store.set(token);
      authed = true;
    } catch (e) {
      token = "";
      loginError = e.status === 401 ? "Token incorrecto. Revisa que sea el que está en el servidor." : e.message;
    } finally {
      loginBusy = false;
    }
  }

  function logout() {
    if (dirty && !confirm("Tienes cambios sin guardar. ¿Salir de todos modos?")) return;
    store.set("");
    token = "";
    authed = false;
    tenants = [];
    draft = saved = selected = null;
  }

  async function save() {
    saving = true;
    saveError = "";
    try {
      const rec = await call(`/api/admin/tenants/${selected}`, { method: "PUT", body: JSON.stringify(payload(draft)) });
      tenants = tenants.map((t) => (t.slug === selected ? rec : t));
      open(selected);
      flash("Cambios guardados. Ya se ven en el enlace del medio.");
    } catch (e) {
      saveError = e.message;
    } finally {
      saving = false;
    }
  }

  function revert() {
    open(selected);
  }

  async function create(nombre, slug) {
    const rec = await call(`/api/admin/tenants/${slug}`, { method: "POST", body: JSON.stringify(newTenant(nombre)) });
    if (dirty) revert();
    tenants = [...tenants, rec].sort((a, b) => (a.slug === "default" ? -1 : b.slug === "default" ? 1 : a.nombre.localeCompare(b.nombre, "es")));
    open(slug);
    flash(`«${nombre}» creado. Elige su color y logo.`);
  }

  async function remove() {
    const slug = selected;
    try {
      await call(`/api/admin/tenants/${slug}`, { method: "DELETE" });
      tenants = tenants.filter((t) => t.slug !== slug);
      open("default");
      flash("Medio eliminado.");
    } catch (e) {
      saveError = e.message;
    }
  }

  if (remembered) {
    load()
      .then(() => (authed = true))
      .catch(() => {
        store.set("");
        token = "";
      })
      .finally(() => (booting = false));
  }

  $effect(() => {
    const warn = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  });
</script>

{#if booting}
  <p class="boot" role="status">Cargando…</p>
{:else if !authed}
  <Login onlogin={login} error={loginError} busy={loginBusy} />
{:else if draft}
  <div class="shell">
    <header class="top">
      <h1>Panel de medios</h1>
      <nav class="views" aria-label="Secciones del panel">
        <button type="button" class:on={view === "medios"} aria-current={view === "medios" ? "page" : undefined} onclick={() => (view = "medios")}>Medios</button>
        <button type="button" class:on={view === "solicitudes"} aria-current={view === "solicitudes" ? "page" : undefined} onclick={() => (view = "solicitudes")}>
          Solicitudes{#if nuevas}<mark>{nuevas}</mark>{/if}
        </button>
        <button type="button" class:on={view === "retro"} aria-current={view === "retro" ? "page" : undefined} onclick={() => (view = "retro")}>
          Retroalimentación{#if retroPend}<mark>{retroPend}</mark>{/if}
        </button>
      </nav>
      <span class="sub"></span>
      <button class="btn ghost out" type="button" onclick={logout}>Salir</button>
    </header>
    {#if view === "solicitudes"}
      <div class="scroll"><Requests {call} oncount={(n) => (nuevas = n)} /></div>
    {:else if view === "retro"}
      <div class="scroll"><Feedback {call} {tenants} oncount={(n) => (retroPend = n)} /></div>
    {:else}
    <div class="cols">
      <aside><Sidebar {tenants} {selected} {dirty} oncreate={create} onselect={select} /></aside>
      <Editor
        slug={selected}
        bind:draft
        {flags}
        {dirty}
        {saving}
        error={saveError}
        onsave={save}
        ondelete={remove}
        onrevert={revert}
      />
      <Preview slug={selected} config={preview} />
    </div>
    {/if}
  </div>
{/if}

<div class="toast" class:on={!!notice} role="status" aria-live="polite">{notice}</div>

<style>
  .boot {
    padding: 40px;
    color: var(--mut);
  }
  .shell {
    height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .top {
    display: flex;
    align-items: baseline;
    gap: 14px;
    padding: 12px 22px;
    background: var(--ink);
    color: #fff;
    border-bottom: 4px solid var(--red);
  }
  .top h1 {
    font-size: 20px;
  }
  .sub {
    font-size: 12.5px;
    opacity: 0.7;
    flex: 1;
  }
  .views {
    display: flex;
    gap: 4px;
    margin-left: 12px;
  }
  .views button {
    border: 0;
    background: transparent;
    color: #fff;
    opacity: 0.7;
    font-weight: 600;
    font-size: 14px;
    padding: 4px 12px;
    cursor: pointer;
    border-bottom: 3px solid transparent;
  }
  .views button.on {
    opacity: 1;
    border-bottom-color: var(--hl);
  }
  .views button:focus-visible {
    outline-color: #fff;
  }
  .views mark {
    background: var(--hl);
    color: var(--ink);
    font-size: 11.5px;
    padding: 0 6px;
    margin-left: 6px;
    border-radius: 9px;
  }
  .scroll {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
  }
  .out {
    color: #fff;
    border-color: rgba(255, 255, 255, 0.5);
    padding: 5px 12px;
    align-self: center;
  }
  .out:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.12) !important;
  }
  .cols {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 270px minmax(380px, 460px) minmax(0, 1fr);
  }
  aside {
    overflow-y: auto;
  }
  .toast {
    position: fixed;
    left: 50%;
    bottom: 22px;
    transform: translate(-50%, 14px);
    background: var(--ink);
    color: #fff;
    font-size: 13.5px;
    padding: 10px 16px;
    border-left: 5px solid var(--hl);
    border-radius: 4px;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.15s, transform 0.15s;
    max-width: calc(100vw - 32px);
  }
  .toast.on {
    opacity: 1;
    transform: translate(-50%, 0);
  }
  @media (max-width: 1100px) {
    .shell {
      height: auto;
      min-height: 100vh;
    }
    .cols {
      grid-template-columns: minmax(0, 1fr);
    }
    aside {
      border-bottom: 1px solid var(--line);
    }
    :global(section[aria-label^="Vista previa"]) {
      height: 80vh !important;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .toast {
      transition: none;
    }
  }
</style>
