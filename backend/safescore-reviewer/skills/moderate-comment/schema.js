/**
 * schema.js — Validación de input/output para moderate-comment.
 */

let z;
try { z = require('zod'); } catch (_) { z = null; }

const inputSchema = z ? z.object({
  reviewId: z.string().min(1),
}) : null;

const outputSchema = z ? z.object({
  decision: z.enum(['safe', 'borderline', 'toxic']),
  toxicity_score: z.number().min(0).max(1),
  reason: z.string().min(1).max(300),
}) : null;

function validateInput(input) {
  if (!inputSchema) return { ok: true, data: input };
  const r = inputSchema.safeParse(input);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.message };
}

function validateOutput(output) {
  if (!outputSchema) return { ok: true, data: output };
  const r = outputSchema.safeParse(output);
  return r.success ? { ok: true, data: r.data } : { ok: false, error: r.error.message };
}

module.exports = { inputSchema, outputSchema, validateInput, validateOutput };
