---
id: T10
name: draft-complaint-reply
description: |
  Cuando llega una queja al admin, el agente lee el caso (queja + ride + 
  historial del denunciado) y prepara un draft de respuesta empática para
  el admin más una recomendación de acción.
trigger: event 'safescore.complaint.created' (modelo Complaint a crear)
provider: groq (Llama 4 Scout)
status: STUB
---

# T10 — draft-complaint-reply (STUB)

## Lógica a implementar

1. Cargar Complaint, ride relacionado, perfil del reportante y reportado
2. Cargar quejas previas del reportado (¿es recurrente?)
3. Pasar contexto al LLM con prompt pidiendo:
   - Draft de email empático al reportante (español neutro)
   - Resumen ejecutivo para el admin (5-7 bullets)
   - Severidad sugerida (baja / media / alta)
   - Acción recomendada (notificar / advertencia / suspensión)
4. Guardar en `Complaint.ai_draft` y `Complaint.ai_summary`
5. Notificar admin con el caso listo para revisar

## Pendiente

- Crear modelo `Complaint` (no existe aún en el backend del equipo)
- Crear collection `complaints`
- Decidir umbral de auto-envío (probablemente nunca — siempre humano)
