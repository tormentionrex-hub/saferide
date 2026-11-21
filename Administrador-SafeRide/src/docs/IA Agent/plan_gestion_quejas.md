# Plan Estratégico: Sistema Inteligente de Gestión de Quejas (Email-to-Admin)

Este documento define la arquitectura implementada para integrar reportes de soporte enviados al correo `saferidefwd@gmail.com` directamente dentro del Admin Panel de SafeRide, utilizando un agente de procesamiento inteligente (IA).

## 1. Objetivo del Sistema
Centralizar la atención de incidencias sin modificar la infraestructura actual de Node.js, transformando correos electrónicos en registros visuales gestionables.

## 2. Estado de Implementación
*   **Fase 1 — Frontend:** ✅ **COMPLETADA**. Interfaz premium creada en `/pages/QuejasPage`.
*   **Fase 2 — Agente IA:** ✅ **COMPLETADA**. Script `sync_complaints.cjs` funcional con Gemini 1.5 Flash.
*   **Fase 3 — Optimización:** ⏳ **EN CURSO**. Automatización de tareas y logs.

## 3. Arquitectura del Agente (Orquestador)
El agente funciona de forma desacoplada:
*   **Monitor:** Conexión vía IMAP a Gmail.
*   **Cerebro:** Google Gemini 1.5 Flash Lite para análisis de sentimiento y categorización.
*   **Persistencia:** Almacenamiento local en `src/data/complaints.json` para actualización HMR (Hot Module Replacement).

## 4. Estructura de Datos Actualizada
Cada correo se convierte en este objeto estándar:
```json
{
  "id": "CMP-XXXX",
  "user": "Nombre del Usuario",
  "email": "correo@usuario.com",
  "category": "Pagos | Conducta | Seguridad | Soporte Técnico",
  "tripId": "TRIP-XXXXX | N/A",
  "subject": "Título resumido por IA",
  "message": "Resumen ejecutivo generado por Gemini",
  "status": "Pendiente | En Revisión | Atendido",
  "createdAt": "ISO-Date"
}
```

## 5. Herramientas Utilizadas
*   **Frontend:** React, Lucide-React, SweetAlert2.
*   **Agente:** Node.js, `imap`, `mailparser`.
*   **IA:** `@google/generative-ai` (Gemini SDK).
*   **Configuración:** `dotenv` para gestión de secretos.

## 6. Mantenimiento y Fallos
En caso de interrupción del servicio, referirse al documento:
`[manual_agente_quejas.md](../manual_agente_quejas.md)`

---
**Actualizado el 15 de Mayo, 2026**