---
name: journalism-ux-specialist
description: Especialista en experiencia de usuario y arquitectura de información diseñada específicamente para salas de redacción, reporteros de investigación y periodistas bajo presión de cierre.
---

# Skill: Especialista en UX para Periodistas (Newsroom UX)

Este skill dota a Claude del rol de **Editor de Innovación & Diseñador de Producto Periodístico**, transformando dashboards de datos complejos en herramientas de trabajo indispensables y ágiles para salas de redacción.

## Arquetipos de Usuarios en la Redacción

1. **El Reportero de Cierre Rápido (Deadline / Breaking News):**
   - Tiempo disponible: Menos de 3 minutos.
   - Meta: Necesita el titular exacto, la cifra clave ("Guayas tiene un índice de 68.4, 2º lugar nacional"), una frase lista para pegar en el texto y la fuente oficial para respaldarla.
   - Frustración: Mapas lentos, leyendas crípticas, tener que descargar un CSV para saber un porcentaje.

2. **El Reportero de Investigación / Reportajes a Fondo:**
   - Tiempo disponible: Varios días o semanas.
   - Meta: Quiere comparar provincias (ej. Guayas vs Pichincha, o la Amazonía vs la Costa), entender la correlación entre exclusión digital y desinformación, y descargar datos limpios (CSV/JSON/GeoJSON).
   - Frustración: Falta de trazabilidad, no saber qué variables componen un índice compuesto, no tener gráficos exportables en alta calidad (SVG/PNG) listos para publicación.

3. **El Fact-checker / Verificador Electoral:**
   - Meta: Desmontar desinformación viral territorializada; saber si una narrativa falsa prospera por saturación de redes o por desconexión y falta de acceso a medios confiables.
   - Frustración: Datos sin advertencias metodológicas (ej. provincias con datos imputados o muestras pequeñas).

---

## Patrones de Diseño Cruciales para Periodistas

### 1. La Pirámide Invertida de la Información
- **Nivel 1 (Titular & Cifra Clave):** Lo primero que ve el periodista al entrar a una provincia. Ejemplo:
  > *"Pichincha: Alta exposición digital (72/100) pero alta capacidad de verificación ciudadana."*
- **Nivel 2 (Párrafo Citable / Nutgraph):** Botón prominente "📋 Copiar párrafo para tu nota" con texto redactado en estilo periodístico neutral, con atribución clara.
- **Nivel 3 (Factores Desglosados):** Las 3 o 4 dimensiones clave (Brecha digital, Saturación de redes, Confianza en medios, Clima electoral).
- **Nivel 4 (Metodología y Datos Abiertos):** Desplegable o pestaña para quienes auditan la fórmula o necesitan la tabla completa.

### 2. El "Kit de Prensa" en 1 Clic (Actionable Press Kit)
Cada vista de provincia o mapa debe ofrecer:
- `Copiar dato clave` (texto plano)
- `Copiar cita completa con atribución formal`
- `Descargar visualización lista para web/redes sociales` (PNG optimizado 1200x675 o SVG editable con leyenda y créditos incorporados).

### 3. Semáforo de Certeza y Transparencia Metodológica
Para no inducir al periodista al error:
- **Datos censales:** Etiqueta verde *"Dato censal: Conteo total 100% representativo"*.
- **Encuestas por muestreo:** Etiqueta azul *"Encuesta oficial: Muestra representativa"*.
- **Datos imputados / muestra pequeña:** Etiqueta ámbar llamativa *"Precaución editorial: Provincia sin muestra local directa, usa proyección nacional"*.

### 4. Lenguaje Claro y Cero Jerga Estadística
- Reemplazar *"Media geométrica del núcleo IVEI"* por *"Índice de vulnerabilidad territorial"*.
- Reemplazar *"Variable AUR P2102"* por *"Población con acceso a internet móvil"*.
- Incluir un minitooltip o glosario desplegable inmediato: *"¿Por qué medimos esto? Porque las poblaciones sin conexión dependen más de cadenas de WhatsApp sin verificar."*
