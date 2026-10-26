#!/usr/bin/env node
/**
 * verify.js — Chequea la integridad del agente SafeScore en este backend.
 *
 * Verifica:
 *   1. Estructura de carpetas/archivos del agente
 *   2. Presencia de marcadores [SAFESCORE-AGENT] en los archivos del backend
 *   3. package.json del backend tiene las 3 deps
 *   4. .env tiene las variables del agente
 *   5. node_modules tiene las deps instaladas
 *   6. (opcional con --smoke) hace UN ping a cada provider LLM
 *
 * Uso:
 *   node safescore-reviewer/verify.js
 *   node safescore-reviewer/verify.js --smoke   # incluye llamadas reales (gasta ~50 tokens)
 */

const fs = require('fs');
const path = require('path');

// ── Helpers ────────────────────────────────────────────────────────────
const BACKEND_ROOT = path.resolve(__dirname, '..');
const AGENT_ROOT = __dirname;

const checks = [];
function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  const icon = ok ? '✅' : '❌';
  const tail = detail ? `  — ${detail}` : '';
  console.log(`${icon}  ${name}${tail}`);
}

function fileExists(p) { return fs.existsSync(p); }
function fileContains(p, marker) {
  if (!fileExists(p)) return false;
  return fs.readFileSync(p, 'utf8').includes(marker);
}

// ── Estructura del agente ───────────────────────────────────────────────
console.log('\n📂 Estructura del agente:\n');

const expectedFiles = [
  'SKILL.md', 'README.md', '.env.example',
  'agent/index.js', 'agent/listeners.js', 'agent/cronJobs.js', 'agent/emit.js',
  'agent/llm/router.js', 'agent/llm/fallbackChain.js', 'agent/llm/quotaTracker.js',
  'agent/llm/providers/groq.js', 'agent/llm/providers/gemini.js', 'agent/llm/providers/cerebras.js',
  'agent/queue/agentQueue.js', 'agent/queue/worker.js', 'agent/queue/dispatcher.js',
  'agent/models/AgentJob.js', 'agent/models/ReviewV2.js',
  'agent/controllers/agentAdminController.js',
  'agent/routes/agentAdminRoutes.js',
  'agent/utils/logger.js', 'agent/utils/jsonParser.js', 'agent/utils/promptLoader.js',
  'skills/moderate-comment/SKILL.md',
  'skills/moderate-comment/skill.js',
  'skills/moderate-comment/prompt.md',
  'skills/recompute-reputation/SKILL.md',
  'skills/recompute-reputation/skill.js',
  'skills/publish-blind-reviews/SKILL.md',
  'skills/publish-blind-reviews/skill.js',
  'skills/detect-retaliation/skill.js',
  'skills/antifraud-nightly/skill.js',
  'skills/infer-tags/skill.js',
  'skills/analyze-appeal/skill.js',
  'skills/award-badges/skill.js',
  'skills/digest-monthly/skill.js',
  'skills/draft-complaint-reply/skill.js',
];

for (const rel of expectedFiles) {
  check(`agent/  ${rel}`, fileExists(path.join(AGENT_ROOT, rel)));
}

// ── Marcadores en archivos del backend ─────────────────────────────────
console.log('\n🔖 Marcadores [SAFESCORE-AGENT] en backend:\n');

const backendMarkers = [
  { file: 'server.js',                                 expected: 1 },
  { file: 'src/jobs/scheduledJobs.js',                 expected: 2 },
  { file: 'src/routes/index.js',                       expected: 1 },
  { file: 'src/controllers/reviewController.js',       expected: 1 },
];

for (const m of backendMarkers) {
  const full = path.join(BACKEND_ROOT, m.file);
  if (!fileExists(full)) {
    check(`backend  ${m.file}`, false, 'archivo no encontrado');
    continue;
  }
  const content = fs.readFileSync(full, 'utf8');
  // Cuenta bloques: cada bloque tiene apertura "// [SAFESCORE-AGENT]" y cierre "[SAFESCORE-AGENT] — fin"
  const openings = (content.match(/\[SAFESCORE-AGENT\]/g) || []).length;
  const ok = openings >= m.expected * 2;  // cada bloque tiene 2 marcadores (apertura + cierre)
  check(`backend  ${m.file}`, ok, `marcadores encontrados: ${openings} (esperados ≥ ${m.expected * 2})`);
}

// ── package.json deps ──────────────────────────────────────────────────
console.log('\n📦 Dependencias en package.json:\n');

const pkg = JSON.parse(fs.readFileSync(path.join(BACKEND_ROOT, 'package.json'), 'utf8'));
const deps = pkg.dependencies || {};
const requiredDeps = ['groq-sdk', '@google/generative-ai', '@cerebras/cerebras_cloud_sdk', 'zod'];
for (const d of requiredDeps) {
  check(`dep    ${d}`, !!deps[d], deps[d] ? `versión: ${deps[d]}` : 'no declarada');
}

// ── node_modules ─────────────────────────────────────────────────────────
console.log('\n📥 node_modules instalados:\n');

for (const d of requiredDeps) {
  const installed = fileExists(path.join(BACKEND_ROOT, 'node_modules', d));
  check(`installed  ${d}`, installed, installed ? '' : 'falta correr npm install');
}

// ── Variables de entorno ────────────────────────────────────────────────
console.log('\n🔑 Variables de entorno:\n');

require('dotenv').config({ path: path.join(BACKEND_ROOT, '.env') });

const requiredEnvs = ['SAFESCORE_ENABLED', 'GROQ_API_KEY', 'GEMINI_API_KEY', 'CEREBRAS_API_KEY'];
for (const e of requiredEnvs) {
  const v = process.env[e];
  const ok = !!v && v.length > 0;
  check(`env   ${e}`, ok, ok ? `set (${e.includes('KEY') ? '***' + v.slice(-4) : v})` : 'no configurada');
}

// ── Smoke test opcional ─────────────────────────────────────────────────
const wantSmoke = process.argv.includes('--smoke');
if (wantSmoke) {
  console.log('\n🔥 Smoke test (UNA llamada por provider, ~50 tokens c/u):\n');
  (async () => {
    try {
      // Cargar router del agente
      const router = require('./agent/llm/router');
      const results = await router.smokeTest();
      for (const [provider, info] of Object.entries(results)) {
        check(`smoke  ${provider}`, info.ok, info.ok ? 'responde correctamente' : `error: ${info.error}`);
      }
      summary();
    } catch (err) {
      console.error('\n❌ Smoke test falló completamente:', err.message);
      process.exit(2);
    }
  })();
} else {
  summary();
}

function summary() {
  const total = checks.length;
  const ok = checks.filter(c => c.ok).length;
  const fail = total - ok;
  console.log(`\n${'═'.repeat(60)}`);
  if (fail === 0) {
    console.log(`✅ INTEGRIDAD OK — ${ok}/${total} checks pasaron. Agente listo.`);
    process.exit(0);
  } else {
    console.log(`⚠️  ${fail}/${total} checks fallaron. Revisar los ❌ arriba.`);
    process.exit(1);
  }
}
