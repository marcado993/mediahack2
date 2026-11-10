// Module: boveda-cripto. Encrypted vault, 100 % in the browser (WebCrypto). Nothing here touches the server.
// Same format as the Periodismo Seguro vault (same labels, same file layout), so an exported vault opens in either.
//
//  password --PBKDF2-SHA256--> wrapping key --> (unwraps) 256-bit master key
//  master key --HKDF--> content key + names key
//  each file: its own random key, wrapped with the content key, encrypted in 32 KiB chunks (AES-GCM)

const enc = new TextEncoder();
const dec = new TextDecoder();

export function aB64u(bytes) {
  const datos = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let texto = "";
  for (let i = 0; i < datos.length; i += 0x8000) texto += String.fromCharCode(...datos.subarray(i, i + 0x8000));
  return btoa(texto).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function deB64u(texto) {
  const binario = atob(texto.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) out[i] = binario.charCodeAt(i);
  return out;
}

const unir = (...partes) => {
  const out = new Uint8Array(partes.reduce((acumulado, parte) => acumulado + parte.length, 0));
  let posicion = 0;
  for (const parte of partes) {
    out.set(parte, posicion);
    posicion += parte.length;
  }
  return out;
};
const u32 = (numero) => new Uint8Array([(numero >>> 24) & 255, (numero >>> 16) & 255, (numero >>> 8) & 255, numero & 255]);

export const ITERACIONES = 600_000; // OWASP recommendation for PBKDF2-SHA256
export const TROZO = 32 * 1024;
const MAGIA = enc.encode("PSB1");
const CUBOS_META = [256, 512, 1024];

const aleatorio = (cantidad) => crypto.getRandomValues(new Uint8Array(cantidad));
const iguales = (primero, segundo) => primero.length === segundo.length && primero.every((byte, posicion) => byte === segundo[posicion]);

async function claveEnvoltura(contrasena, sal, iter) {
  const base = await crypto.subtle.importKey("raw", enc.encode(String(contrasena).normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt: sal, iterations: iter }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function hkdf(maestra, info) {
  const base = await crypto.subtle.importKey("raw", maestra, "HKDF", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "HKDF", hash: "SHA-256", salt: new Uint8Array(0), info: enc.encode(info) }, base, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

async function claves(maestra) {
  return { contenido: await hkdf(maestra, "ps-boveda-contenido"), nombres: await hkdf(maestra, "ps-boveda-nombres") };
}

async function envolver(maestra, contrasena, iter) {
  const sal = aleatorio(16);
  const iv = aleatorio(12);
  const claveDeEnvoltura = await claveEnvoltura(contrasena, sal, iter);
  const textoCifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode("ps-boveda-v1") }, claveDeEnvoltura, maestra));
  return { v: 1, kdf: "PBKDF2-SHA256", iter, sal: aB64u(sal), iv: aB64u(iv), maestra: aB64u(textoCifrado) };
}

/** Creates a new vault. `iter` is only lowered in tests. */
export async function crearBoveda(contrasena, iter = ITERACIONES) {
  if (typeof contrasena !== "string" || contrasena.length < 1) throw new Error("CONTRASENA_VACIA");
  const maestra = aleatorio(32);
  return { cabecera: await envolver(maestra, contrasena, iter), sesion: { maestra, ...(await claves(maestra)) } };
}

/** Opens the vault. A wrong password makes AES-GCM authentication fail. */
export async function abrirBoveda(cabecera, contrasena) {
  try {
    const claveDeEnvoltura = await claveEnvoltura(contrasena, deB64u(cabecera.sal), cabecera.iter);
    const maestra = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: deB64u(cabecera.iv), additionalData: enc.encode("ps-boveda-v1") }, claveDeEnvoltura, deB64u(cabecera.maestra)));
    return { maestra, ...(await claves(maestra)) };
  } catch {
    throw new Error("CLAVE_INCORRECTA");
  }
}

/** Changes the password without re-encrypting the files: only the master key is wrapped again. */
export async function cambiarContrasena(cabecera, actual, nueva, iter = cabecera.iter) {
  const sesion = await abrirBoveda(cabecera, actual);
  return envolver(sesion.maestra, nueva, iter);
}

/** Format: "PSB1" | wrapped file key (60 B) | [iv(12) | encrypted chunk]... Each chunk's AAD binds the wrapped key (ties it to the
 *  file), its position (no reordering) and whether it is the last one (no truncation). */
export async function cifrarArchivo(sesion, datos) {
  const claveArchivo = aleatorio(32);
  const ivClave = aleatorio(12);
  const envuelta = unir(ivClave, new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: ivClave, additionalData: enc.encode("ps-archivo-clave") }, sesion.contenido, claveArchivo)));
  const claveDeCifrado = await crypto.subtle.importKey("raw", claveArchivo, "AES-GCM", false, ["encrypt"]);
  const total = Math.max(1, Math.ceil(datos.length / TROZO));
  const partes = [MAGIA, envuelta];
  for (let i = 0; i < total; i++) {
    const iv = aleatorio(12);
    const datosAdicionales = unir(envuelta, u32(i), new Uint8Array([i === total - 1 ? 1 : 0]));
    const textoCifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: datosAdicionales }, claveDeCifrado, datos.subarray(i * TROZO, (i + 1) * TROZO)));
    partes.push(iv, textoCifrado);
  }
  return unir(...partes);
}

export async function descifrarArchivo(sesion, blob) {
  try {
    if (blob.length < 4 + 60 + 12 + 16 || !iguales(blob.subarray(0, 4), MAGIA)) throw new Error("formato");
    const envuelta = blob.subarray(4, 64);
    const claveArchivo = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: envuelta.subarray(0, 12), additionalData: enc.encode("ps-archivo-clave") }, sesion.contenido, envuelta.subarray(12)));
    const claveDeDescifrado = await crypto.subtle.importKey("raw", claveArchivo, "AES-GCM", false, ["decrypt"]);
    const tamTrozoCifrado = 12 + TROZO + 16;
    const cuerpo = blob.subarray(64);
    const total = Math.ceil(cuerpo.length / tamTrozoCifrado);
    const salida = [];
    for (let i = 0; i < total; i++) {
      const trozo = cuerpo.subarray(i * tamTrozoCifrado, (i + 1) * tamTrozoCifrado);
      const datosAdicionales = unir(envuelta, u32(i), new Uint8Array([i === total - 1 ? 1 : 0]));
      salida.push(new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: trozo.subarray(0, 12), additionalData: datosAdicionales }, claveDeDescifrado, trozo.subarray(12))));
    }
    return unir(...salida);
  } catch {
    throw new Error("ARCHIVO_ALTERADO");
  }
}

/** Names and descriptive data: encrypted and padded to a fixed size. */
export async function cifrarMeta(sesion, objeto) {
  const datos = enc.encode(JSON.stringify(objeto));
  const cubo = CUBOS_META.find((tamano) => tamano >= datos.length + 2);
  if (!cubo) throw new Error("META_LARGA");
  const buf = new Uint8Array(cubo);
  buf[0] = datos.length >> 8;
  buf[1] = datos.length & 255;
  buf.set(datos, 2);
  const iv = aleatorio(12);
  const textoCifrado = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv, additionalData: enc.encode("ps-meta") }, sesion.nombres, buf));
  return aB64u(unir(iv, textoCifrado));
}

export async function descifrarMeta(sesion, texto) {
  try {
    const raw = deB64u(texto);
    const buf = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: raw.subarray(0, 12), additionalData: enc.encode("ps-meta") }, sesion.nombres, raw.subarray(12)));
    const longitud = (buf[0] << 8) | buf[1];
    return JSON.parse(dec.decode(buf.subarray(2, 2 + longitud)));
  } catch {
    throw new Error("ARCHIVO_ALTERADO");
  }
}

/** Export / import (everything stays encrypted). */
export function empaquetar(cabecera, objetos) {
  return JSON.stringify({ formato: "ps-boveda-1", cabecera, objetos: objetos.map((objeto) => ({ id: objeto.id, meta: objeto.meta, datos: aB64u(objeto.datos) })) });
}

export function desempaquetar(texto) {
  const copia = JSON.parse(texto);
  if (copia?.formato !== "ps-boveda-1" || !copia.cabecera || !Array.isArray(copia.objetos)) throw new Error("FORMATO_INVALIDO");
  return { cabecera: copia.cabecera, objetos: copia.objetos.map((objeto) => ({ id: String(objeto.id), meta: String(objeto.meta), datos: deB64u(objeto.datos) })) };
}

/** Simple password-strength estimate (no libraries, no external data). */
export function fortaleza(contrasena) {
  const texto = String(contrasena);
  const clases = [/[a-z]/, /[A-Z]/, /\d/, /[^\w\s]/, /\s/].filter((patron) => patron.test(texto)).length;
  const unicos = new Set(texto).size; // repeated characters add almost nothing
  const bits = unicos * Math.log2(Math.max(2, clases * 13)) + (texto.length - unicos);
  if (texto.length < 12 || bits < 50) return "debil";
  return bits < 75 ? "aceptable" : "fuerte";
}

export const nuevoId = () => Array.from(aleatorio(16), (byte) => byte.toString(16).padStart(2, "0")).join("");
