# Guía de prompts del agente

## Principios

1. **Prompt en archivos `.md`**, no hardcodeados en JS
2. **Interpolación con `{{variable}}`**, sin template literals
3. **JSON output obligatorio** para parseo determinístico
4. **Few-shot examples** en español (mínimo 3 ejemplos diversos)
5. **Instrucciones explícitas** de formato y rango de valores

## Estructura recomendada de prompt

```markdown
Eres un [ROL] para SafeRide, una plataforma de [CONTEXTO].

Tu tarea es [QUÉ HACER ESPECÍFICAMENTE].

CATEGORÍAS / OPCIONES:
- [opción 1]: definición
- [opción 2]: definición

EJEMPLOS:

Input: "ejemplo 1"
Respuesta: {"key": "value", ...}

Input: "ejemplo 2"
Respuesta: {"key": "value", ...}

REGLAS:
- [regla específica 1]
- [regla específica 2]
- valor debe estar entre X e Y

AHORA PROCESA:

Input: "{{variable_a_interpolar}}"

Responde SOLO con el JSON:
```

## Por qué este formato

- **Role + Context** ancla al modelo en su tarea
- **CATEGORÍAS** evita que invente etiquetas
- **EJEMPLOS** (few-shot) baja drásticamente la varianza
- **REGLAS** captura edge cases que vendrían de quejas del equipo
- **"Responde SOLO con el JSON"** reduce texto explicativo no deseado

## Anti-patrones

❌ **NO uses temperature alto** (>0.5) en clasificación. Determinismo > creatividad.

❌ **NO pidas markdown** si querés JSON. El modelo te va a poner ```json fences
y vas a tener que limpiarlos. Mejor: "Responde SOLO con el objeto JSON crudo".

❌ **NO pongas instrucciones contradictorias.** El modelo va a obedecer la
última. Ordená por importancia.

❌ **NO uses tokens innecesarios.** Cada palabra del prompt es input tokens.
Sé conciso.

❌ **NO confíes ciegamente en JSON mode.** Validá con `safeParseJSON` y un
schema Zod. Los modelos chicos a veces meten texto antes del JSON.

## Versionado de prompts

Cuando edites un prompt:

1. Probalo con fixtures en `tests/fixtures/` ANTES de deployar
2. Anotá el cambio en el header del archivo `prompt.md`:

```markdown
<!-- v1.1 — 2026-06-15 — Agregado ejemplo de sarcasmo borderline -->
```

3. Si el cambio es grande, considerá A/B test guardando ambas versiones y
   midiendo accuracy con tu dataset de fixtures.

## Token budget por skill

| Skill | Prompt tokens (input) | Output max | Total estimado por job |
|-------|----------------------|------------|------------------------|
| moderate-comment | ~250 | 200 | ~330 |
| detect-retaliation | ~400 | 300 | ~600 |
| infer-tags | ~300 | 150 | ~400 |
| draft-complaint-reply | ~500 | 1000 | ~1300 |
| analyze-appeal | ~2000 (historial) | 1500 | ~3000 |
| antifraud-nightly | ~5000 (batch) | 2000 | ~7000 |
| digest-monthly | ~8000 (batch) | 3000 | ~10000 |

Con cuotas free tier sumadas (~2M tokens/día), podés ejecutar todas las
skills MVP del agente para SafeRide a escala de cientos de reviews/día sin
saturar.

## Tips finales

1. **Cuanto más específico el ejemplo, mejor.** No metas ejemplos genéricos
   ("buen viaje") — metelos realistas con detalles de Costa Rica, jerga local,
   tipos de quejas reales.

2. **Cuando un modelo falle en un caso edge**, agrega ese caso como ejemplo
   al prompt. Es la forma más simple de "fine-tuning sin fine-tuning".

3. **JSON mode no es perfecto.** Siempre tené el `safeParseJSON` tolerante
   como red de seguridad.

4. **Modela el JSON output con cuidado.** Campos opcionales pueden quedar
   como `null` o no estar — sé explícito en el prompt sobre cuáles son
   obligatorios.
