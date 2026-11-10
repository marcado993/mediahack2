// Module: boveda-almacen. Local store of the vault (IndexedDB). Only encrypted text is kept here:
// never keys, passwords or names in the clear.

const BASE = "ovade-boveda";

function abrir() {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, 1);
    peticion.onupgradeneeded = () => {
      const bd = peticion.result;
      bd.createObjectStore("cabecera");
      bd.createObjectStore("objetos", { keyPath: "id" }); // { id, meta (encrypted), tam }
      bd.createObjectStore("datos", { keyPath: "id" }); // { id, bytes (encrypted) }
    };
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

async function con(almacenes, modo, fn) {
  const bd = await abrir();
  return new Promise((resolver, rechazar) => {
    const transaccion = bd.transaction(almacenes, modo);
    const resultado = fn(...almacenes.map((nombre) => transaccion.objectStore(nombre)));
    transaccion.oncomplete = () => {
      bd.close();
      resolver(resultado?.result);
    };
    transaccion.onerror = transaccion.onabort = () => {
      bd.close();
      rechazar(transaccion.error);
    };
  });
}

export const leerCabecera = () => con(["cabecera"], "readonly", (t) => t.get("actual"));
export const guardarCabecera = (cabecera) => con(["cabecera"], "readwrite", (t) => t.put(cabecera, "actual"));
export const listar = () => con(["objetos"], "readonly", (t) => t.getAll());
export const leerDatos = (id) => con(["datos"], "readonly", (t) => t.get(id)).then((r) => r?.bytes);
export const guardarObjeto = ({ id, meta, bytes }) =>
  con(["objetos", "datos"], "readwrite", (objetos, datos) => {
    objetos.put({ id, meta, tam: bytes.length });
    datos.put({ id, bytes });
  });
export const borrarObjeto = (id) =>
  con(["objetos", "datos"], "readwrite", (objetos, datos) => {
    objetos.delete(id);
    datos.delete(id);
  });
export const borrarTodo = () =>
  con(["cabecera", "objetos", "datos"], "readwrite", (cabecera, objetos, datos) => {
    cabecera.clear();
    objetos.clear();
    datos.clear();
  });

/** Replaces everything (import). */
export const reemplazar = (cabecera, objetos) =>
  con(["cabecera", "objetos", "datos"], "readwrite", (tCab, tObj, tDat) => {
    tCab.clear();
    tObj.clear();
    tDat.clear();
    tCab.put(cabecera, "actual");
    for (const o of objetos) {
      tObj.put({ id: o.id, meta: o.meta, tam: o.datos.length });
      tDat.put({ id: o.id, bytes: o.datos });
    }
  });
