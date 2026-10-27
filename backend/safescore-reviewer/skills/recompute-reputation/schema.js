/**
 * schema.js — Validación Zod de input/output para recompute-reputation.
 *
 * Esto NO es bloqueante para el agente — si Zod no está disponible
 * o el input no valida, la skill log warn pero intenta procesar igual.
 * Zod nos da defensa contra payloads malformados desde la cola.
 */

let z;
try {
  z = require('zod');
} catch (_) {
  z = null;
}

const inputSchema = z ? z.object({
  userIds: z.array(z.string()).min(1),
}) : null;

const outputSchema = z ? z.object({
  recomputed: z.number().int().nonnegative(),
  snapshots: z.array(z.object({
    userId: z.string(),
    overall: z.number().nullable(),
    samples: z.number().int().nonnegative(),
    level: z.enum(['rookie', 'driver', 'pro', 'champion']),
  })),
}) : null;

function validateInput(input) {
  if (!inputSchema) return { ok: true, data: input };
  const r = inputSchema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error };
}

function validateOutput(output) {
  if (!outputSchema) return { ok: true, data: output };
  const r = outputSchema.safeParse(output);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error };
}

module.exports = { inputSchema, outputSchema, validateInput, validateOutput };
