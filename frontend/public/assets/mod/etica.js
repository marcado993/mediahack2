// Module: etica. The commitment that goes with the open data: it asks for agreement when
// the data package is downloaded, and never blocks reading anything.

export const COMPROMISO = "Uso los datos del observatorio para proteger y fortalecer la democracia: no para señalar personas, medios ni candidatos, ni para dirigir propaganda o desinformación a un territorio.";
export const NOTA_DESCARGA = "Datos abiertos con resolución provincial, por diseño. Uso ético: protección y fortalecimiento de la democracia. Cita: Observatorio de Vulnerabilidad ante la Desinformación Electoral.";

const KEY = "ovade.etica.v1";
const aceptado = () => {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch (_) {
    return false;
  }
};

/** Resolves true once the person has agreed (now or on an earlier visit), false if they cancel. */
export function pedirAcuerdo() {
  if (aceptado()) return Promise.resolve(true);
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.setAttribute("aria-labelledby", "eticaTitulo");
    dlg.innerHTML = `<form method="dialog">
      <h2 id="eticaTitulo">Antes de descargar</h2>
      <p class="note" style="margin:6px 0 14px">Los datos son abiertos. Pedimos un compromiso de uso.</p>
      <label class="chk"><input type="checkbox" id="eticaOk" required> <span>${COMPROMISO}</span></label>
      <div class="cita-act" style="margin-top:16px"><button class="btn" id="eticaSi" type="submit" disabled>Aceptar y descargar</button><button class="btn gh" id="eticaNo" type="button">Ahora no</button></div>
      <p class="note" style="margin-top:12px">Puedes leer todo el sitio sin aceptar.</p>
    </form>`;
    document.body.appendChild(dlg);
    const ok = dlg.querySelector("#eticaOk");
    const si = dlg.querySelector("#eticaSi");
    ok.onchange = () => (si.disabled = !ok.checked);
    let resultado = false;
    dlg.querySelector("form").onsubmit = () => {
      resultado = ok.checked;
      if (resultado) {
        try {
          localStorage.setItem(KEY, "1");
        } catch (_) {}
      }
    };
    dlg.querySelector("#eticaNo").onclick = () => dlg.close();
    dlg.addEventListener("close", () => {
      dlg.remove();
      resolve(resultado);
    });
    dlg.showModal();
  });
}
