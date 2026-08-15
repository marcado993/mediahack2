# Ficha de Gobernanza Ética del Proyecto

**MediaHack II: Inteligencia Artificial, Democracia y Desinformación Electoral**

> Estado: borrador para revisión del equipo. Los campos marcados con `⚠️ COMPLETAR`
> requieren datos que solo el equipo tiene (nombres, integrantes).

---

## 1. Información general

| Campo | Valor |
|---|---|
| **Nombre del proyecto** | Mapa de Vulnerabilidad a Desinformación por Territorio (IVD Ecuador) |
| **Equipo** | ⚠️ COMPLETAR |
| **Integrantes** | ⚠️ COMPLETAR |
| **Repositorio** | https://github.com/marcado993/mediahack2 |
| **API en producción** | https://mediahack-api.apiprueba.online |
| **Frontend** | ⚠️ COMPLETAR (URL de Vercel) |

---

## 2. Contexto del proyecto

**¿Qué problema busca resolver el proyecto?**

La desinformación electoral no golpea igual a todo el país. No existe una forma rápida de
saber qué territorios son más vulnerables ni qué circula en ellos. El periodista debe cruzar
datos dispersos a mano, y en cierre no alcanza el tiempo.

**¿Quiénes utilizarían principalmente la solución?**

Periodistas de investigación y verificadores de datos ecuatorianos; medios locales que
cubren territorio con equipos pequeños.

**Describa brevemente cómo funciona la solución.**

Calcula un Índice de Vulnerabilidad ante la Desinformación (IVD) por provincia con datos
INEC y Latinobarómetro, y lo muestra en un mapa. Al elegir una provincia, centraliza en una
sola búsqueda las publicaciones recientes de verificadores, medios y redes sociales.

**¿El proyecto utiliza inteligencia artificial?** → **Sí**

Se usa un modelo de lenguaje (DeepSeek) para **interpretar y resumir** resultados de
búsqueda, nunca para generar los hechos. Las publicaciones citadas provienen siempre de
fuentes reales con su enlace original.

---

## 3. Gobernanza ética

### 3.1 Supervisión humana

**¿Qué decisiones o resultados genera automáticamente la herramienta?**

Calcula el índice IVD por provincia, ordena provincias por vulnerabilidad, recupera
publicaciones reales de las fuentes y redacta un resumen de esas publicaciones.

**¿Qué debe revisar o aprobar una persona antes de que esos resultados se utilicen o
publiquen?**

Todo. La herramienta no publica nada. El periodista debe abrir cada enlace original y
verificar antes de citar. El resumen de IA se muestra siempre junto a las publicaciones que
lo sustentan y con la advertencia de verificar antes de publicar.

**Autoevaluación: ✅ Cumple**

---

### 3.2 Transparencia

**¿Cómo funciona la herramienta? (para persona no técnica)**

Combina dos cosas. Primero, un mapa que colorea cada provincia según qué tan vulnerable es
a la desinformación, usando datos públicos de pobreza, educación y desconfianza en
instituciones. Segundo, un buscador que revisa a la vez verificadores, medios y redes, y
devuelve las publicaciones con su enlace.

**¿Cuáles son las principales limitaciones de la herramienta?**

- Las búsquedas solo cubren lo publicado **recientemente**, no son un archivo histórico.
- Tres provincias (Napo, Pastaza, Zamora Chinchipe) tienen **cero encuestados** en
  Latinobarómetro: su valor es **imputado** del promedio nacional y así se marca en el mapa.
- Galápagos queda **fuera del índice**: el INEC no reporta pobreza para esa provincia.
- 18 de 23 provincias tienen muestra baja (n<50); el dashboard lo indica en cada ficha.
- Las tendencias son un conteo sobre una muestra pequeña, **no una medición de opinión**.

**Autoevaluación: ✅ Cumple**

---

### 3.3 Neutralidad política

**¿Qué medidas incorpora para evitar favorecer o perjudicar a candidatos, partidos o
posiciones?**

- El índice se calcula con **indicadores socioeconómicos y de confianza institucional**, sin
  variable partidista alguna.
- El filtro de relevancia política usa términos **simétricos**: incluye por igual actores de
  gobierno y de oposición (ADN, Revolución Ciudadana, Pachakutik, PSC), sin ponderación.
- No se puntúa, califica ni ordena a candidatos ni partidos en ninguna parte del producto.
- Las fuentes priorizadas son **verificadores acreditados** (Lupa Media, Ecuador Chequea),
  no medios con línea editorial marcada.

**¿Cómo verificará el equipo que estas medidas se cumplan?**

Revisión del listado de términos del filtro para mantener la simetría entre bloques
políticos, y revisión manual de resultados por provincia buscando sesgo sistemático hacia
un actor. El código es abierto y auditable.

**Autoevaluación: ✅ Cumple**

---

### 3.4 Manejo responsable de datos

**¿Qué datos utiliza la herramienta?**

Datos agregados y públicos: INEC (pobreza, educación) y Latinobarómetro 2024, ambos a nivel
**provincial**, sin registros individuales. Además, publicaciones **públicas** de medios,
verificadores y redes sociales.

**Si utiliza datos personales, ¿qué medidas aplica?**

- **No se almacena ningún dato personal.** No hay base de datos de personas ni registro de
  usuarios.
- Las credenciales de acceso a redes **no están en el repositorio** (`.gitignore`) y viven
  solo en el servidor con permisos restringidos.
- Las publicaciones se guardan en caché temporal (30–45 min) únicamente para no sobrecargar
  las plataformas; no se construye histórico de personas.
- **Minimización aplicada:** se eliminó la agregación de menciones a cuentas individuales
  (ver 3.5 y 3.7).

**Autoevaluación: ✅ Cumple**

---

### 3.5 Riesgos y limitaciones

**¿Cuál es el principal riesgo de un uso incorrecto?**

Que alguien cite el índice como si midiera "cuánta desinformación hay" en una provincia, o
que use el conteo de tendencias como si fuera opinión pública medida. El índice mide
**vulnerabilidad estructural** (condiciones que facilitan la desinformación), no la
desinformación observada.

**¿Qué medida concreta reduce ese riesgo?**

- Cada provincia muestra su **confiabilidad de muestra** y marca visualmente los datos
  imputados con trama diagonal.
- La sección de tendencias lleva una advertencia explícita: *"no es una medición de opinión
  pública; úsalo como pista para reportear, no como dato citable"*.
- El botón "Copiar cita con fuente" genera la cita **con la fuente y el nivel de
  confiabilidad incluidos**, para que no se propague fuera de contexto.

**Autoevaluación: ✅ Cumple**

---

### 3.6 Documentación y apertura

**¿Qué información entregará el equipo en fase de incubación?**

Código completo en repositorio público, metodología de cálculo del IVD (dimensiones, fuentes
y tratamiento de datos faltantes), documentación de la arquitectura y de cada fuente
consultada, e instrucciones de despliegue.

**¿Compartiría públicamente código y documentación?** → **Sí**

El repositorio ya es público. Las credenciales y cookies de sesión quedan excluidas por
seguridad, no por reserva del método.

---

### 3.7 Usos no permitidos

**¿La herramienta incluye alguna función que pueda usarse para vigilancia, perfilamiento
político, manipulación de audiencias, favorecimiento de actores o amplificación de
desinformación?**

→ **No** (tras corrección documentada abajo)

#### ⚠️ Riesgo identificado y corregido durante el desarrollo

Una versión intermedia de la función de tendencias **agregaba y rankeaba las cuentas de X
más mencionadas** en la conversación política de cada provincia. Al revisar los resultados
reales, esas cuentas correspondían mayoritariamente a **ciudadanos particulares**, no a
figuras públicas.

Contar y ordenar a personas por su actividad política encaja en **"elaboración de perfiles
políticos de ciudadanos"**, uso prohibido por el Marco.

**Corrección aplicada:** se eliminó por completo la agregación de menciones a cuentas. No se
sustituyó por un filtro de "cuentas públicas" porque no existe forma automática confiable de
distinguir a un funcionario de un ciudadano. La sección "Actores" ahora reconoce únicamente
**instituciones y cargos públicos** (Gobierno, CNE, Alcaldía, Fiscalía…), nunca individuos.

**Decisión pendiente de criterio editorial:** las publicaciones de ejemplo sí muestran el
nombre de la cuenta que las publicó, junto al enlace al post público original. Se mantuvo
porque sin atribución el periodista no puede verificar la fuente, que es el propósito de la
herramienta. Se documenta aquí explícitamente para que el jurado lo evalúe.

Otras verificaciones:
- **No amplifica desinformación:** no republica ni difunde; muestra enlaces al original para
  que el periodista verifique.
- **No manipula audiencias:** no tiene componente de distribución ni de recomendación
  personalizada.
- **No hace vigilancia:** no rastrea personas ni guarda histórico individual.

---

## Declaración

Confirmamos que la información registrada corresponde al estado actual del prototipo y que
el equipo revisará los aspectos identificados antes de la evaluación.

**Riesgo identificado y ya corregido:** perfilamiento político de ciudadanos vía agregación
de menciones (sección 3.7).
