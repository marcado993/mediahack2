// Run with:  node --test frontend/tests
import test from "node:test";
import assert from "node:assert/strict";
import * as C from "../public/assets/mod/boveda-cripto.js";

const ITER = 1000; // low only for tests
// getRandomValues accepts at most 64 KiB per call
const azar = (n) => {
  const b = new Uint8Array(n);
  for (let i = 0; i < n; i += 65536) crypto.getRandomValues(b.subarray(i, Math.min(n, i + 65536)));
  return b;
};

test("crear y abrir con la contraseña correcta; la incorrecta falla", async () => {
  const { cabecera, sesion } = await C.crearBoveda("una frase larga y rara", ITER);
  const abierta = await C.abrirBoveda(cabecera, "una frase larga y rara");
  assert.deepEqual(abierta.maestra, sesion.maestra);
  await assert.rejects(() => C.abrirBoveda(cabecera, "otra"), /CLAVE_INCORRECTA/);
});

test("un archivo de varios trozos vuelve igual", async () => {
  const { sesion } = await C.crearBoveda("x".repeat(12), ITER);
  const datos = azar(C.TROZO * 2 + 123);
  const cifrado = await C.cifrarArchivo(sesion, datos);
  assert.ok(cifrado.length > datos.length);
  assert.deepEqual(await C.descifrarArchivo(sesion, cifrado), datos);
});

test("archivo vacío y archivo alterado", async () => {
  const { sesion } = await C.crearBoveda("x".repeat(12), ITER);
  assert.equal((await C.descifrarArchivo(sesion, await C.cifrarArchivo(sesion, new Uint8Array(0)))).length, 0);
  const cifrado = await C.cifrarArchivo(sesion, new TextEncoder().encode("secreto"));
  cifrado[cifrado.length - 3] ^= 1;
  await assert.rejects(() => C.descifrarArchivo(sesion, cifrado), /ARCHIVO_ALTERADO/);
});

test("quitar el último trozo se detecta", async () => {
  const { sesion } = await C.crearBoveda("x".repeat(12), ITER);
  const cifrado = await C.cifrarArchivo(sesion, azar(C.TROZO * 3));
  const trozo = 12 + C.TROZO + 16;
  await assert.rejects(() => C.descifrarArchivo(sesion, cifrado.subarray(0, cifrado.length - trozo)), /ARCHIVO_ALTERADO/);
});

test("nombres cifrados y rellenados al mismo tamaño", async () => {
  const { sesion } = await C.crearBoveda("x".repeat(12), ITER);
  const a = await C.cifrarMeta(sesion, { nombre: "a", tipo: "nota", creado: 1 });
  const b = await C.cifrarMeta(sesion, { nombre: "un nombre bastante más largo que el otro", tipo: "nota", creado: 1 });
  assert.equal(a.length, b.length);
  assert.equal((await C.descifrarMeta(sesion, b)).nombre, "un nombre bastante más largo que el otro");
});

test("cambiar la contraseña no toca los archivos", async () => {
  const { cabecera, sesion } = await C.crearBoveda("primera contraseña larga", ITER);
  const cifrado = await C.cifrarArchivo(sesion, new TextEncoder().encode("hola"));
  const nueva = await C.cambiarContrasena(cabecera, "primera contraseña larga", "segunda contraseña larga", ITER);
  await assert.rejects(() => C.abrirBoveda(nueva, "primera contraseña larga"), /CLAVE_INCORRECTA/);
  const reabierta = await C.abrirBoveda(nueva, "segunda contraseña larga");
  assert.equal(new TextDecoder().decode(await C.descifrarArchivo(reabierta, cifrado)), "hola");
});

test("exportar e importar", async () => {
  const { cabecera, sesion } = await C.crearBoveda("x".repeat(12), ITER);
  const datos = await C.cifrarArchivo(sesion, new TextEncoder().encode("contenido"));
  const meta = await C.cifrarMeta(sesion, { nombre: "n", tipo: "nota", creado: 2 });
  const { cabecera: c2, objetos } = C.desempaquetar(C.empaquetar(cabecera, [{ id: "1", meta, datos }]));
  const s2 = await C.abrirBoveda(c2, "x".repeat(12));
  assert.equal(new TextDecoder().decode(await C.descifrarArchivo(s2, objetos[0].datos)), "contenido");
  assert.throws(() => C.desempaquetar('{"formato":"otro"}'), /FORMATO_INVALIDO/);
});

test("fortaleza de la contraseña", () => {
  assert.equal(C.fortaleza("corta"), "debil");
  assert.equal(C.fortaleza("aaaaaaaaaaaaaaaaaaaa"), "debil");
  assert.notEqual(C.fortaleza("una frase de varias palabras 2026!"), "debil");
});
