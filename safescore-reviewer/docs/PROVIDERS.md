# Providers LLM — Cuándo usar qué

## Reglas de elección

```
🥇 Groq Llama 3.1 8B Instant    → Clasificación rápida, output corto
🥇 Groq Llama 4 Scout 17B       → Razonamiento medio, decisiones con justificación
🥈 Cerebras Llama 3.3 70B       → Fallback de Groq cuando satura
🧠 Gemini 2.5 Flash             → Solo cuando necesito leer texto largo (1M ctx)
```

## Free tier verificado (mayo 2026)

| Provider | Modelo | RPD | TPM | Velocidad |
|----------|--------|-----|-----|-----------|
| Groq | llama-3.1-8b-instant | 14,400 | 30K | **840 tok/s** |
| Groq | llama-4-scout-17b | 1,000 | 30K | 594 tok/s |
| Groq | deepseek-r1-distill-llama-70b | 1,000 | 30K | rápido |
| Gemini | gemini-2.5-flash | 500 | n/a | ~80 tok/s |
| Gemini | gemini-2.5-flash-lite | 1,000 | n/a | rápido |
| Cerebras | llama-3.3-70b | 1,700 | 60K | **~2000 tok/s** |
| Cerebras | llama3.1-8b | 14,400 | 30K | rápido |

## Por skill

| Skill | Provider primario | Razón |
|-------|------------------|-------|
| T1 moderate-comment | groq llama-3.1-8b | clasificación 3 categorías, JSON corto |
| T2 detect-retaliation | groq llama-4-scout | razonamiento medio sobre 2 textos + contexto ride |
| T6 infer-tags | groq llama-3.1-8b | mapear texto → códigos de catálogo, output corto |
| T10 draft-complaint-reply | groq llama-4-scout | redactar respuesta empática + resumen |
| T5 antifraud-nightly | gemini 2.5-flash | batch grande de reviews (necesita ctx largo) |
| T7 analyze-appeal | gemini 2.5-flash | leer historial + ride + review |
| T9 digest-monthly | gemini 2.5-flash | generar reporte largo y estructurado |

## NO usar

- **NO usar Gemini para tareas conversacionales**: es ineficiente para esto
  (output truncado con thinking tokens, latencia mayor).
- **NO usar Groq para batches grandes**: 30K TPM se llena rápido.
- **NO usar gemini-2.0-flash**: bloqueado en cuentas nuevas (verificado).

## Configuración de modelos

Los modelos están aliasados en cada provider con nombres semánticos:

```js
groq.MODELS = {
  reasoning_fast:    'llama-3.1-8b-instant',
  reasoning_primary: 'meta-llama/llama-4-scout-17b-16e-instruct',
  reasoning_deep:    'deepseek-r1-distill-llama-70b',
};

gemini.MODELS = {
  reasoning_long_ctx: 'gemini-2.5-flash',
  reasoning_fast:     'gemini-2.5-flash-lite',
  reasoning_deep:     'gemini-2.5-pro',
};

cerebras.MODELS = {
  reasoning_fast:    'llama3.1-8b',
  reasoning_primary: 'llama-3.3-70b',
  reasoning_deep:    'llama-3.3-70b',
};
```

Las skills piden el alias (`reasoning_fast`), el provider lo traduce
al nombre real. Así si Groq cambia el modelo en su catálogo, solo
actualizamos el alias y todas las skills se benefician.
