#!/usr/bin/env node
/**
 * uninstall.js — Revierte todos los cambios del agente en archivos del backend.
 *
 * NO borra la carpeta safescore-reviewer/ (eso lo hace el usuario manual).
 * NO desinstala node_modules (eso requiere npm uninstall manual).
 *
 * Lo que SÍ hace:
 *   - Elimina todos los bloques // [SAFESCORE-AGENT] ... [SAFESCORE-AGENT] — fin
 *     de los 4 archivos del backend modificados.
 *   - Elimina las 4 deps del agente del package.json.
 *   - Elimina las 5 entries SAFESCORE_* y las 3 *_API_KEY del .env.
 *
 * Uso: node safescore-reviewer/uninstall.js
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BACKEND_ROOT = path.resolve(__dirname, '..');

const TARGETED_FILES = [
  'server.js',
  'src/jobs/scheduledJobs.js',
  'src/routes/index.js',
  'src/controllers/reviewController.js',
];

const AGENT_DEPS = ['groq-sdk', '@google/generative-ai', '@cerebras/cerebras_cloud_sdk', 'zod'];

const AGENT_ENV_KEYS = [
  'SAFESCORE_ENABLED', 'SAFESCORE_BLIND_WINDOW_HOURS', 'SAFESCORE_WORKER_POLL_MS',
  'SAFESCORE_MAX_ATTEMPTS', 'SAFESCORE_QUOTA_GUARD_PCT',
];

function removeMarkedBlocks(content) {
  // Patrón: cualquier línea con [SAFESCORE-AGENT] (apertura) hasta la línea con [SAFESCORE-AGENT] — fin
  // Usamos regex multilinea con DOTALL emulado vía [\s\S]
  const blockRegex = /[ \t]*\/\/ \[SAFESCORE-AGENT\][\s\S]*?\/\/ \[SAFESCORE-AGENT\][^\n]*?fin[^\n]*\n?/g;
  // Para .env también: # [SAFESCORE-AGENT] ... # [SAFESCORE-AGENT] — fin
  const envBlockRegex = /[ \t]*# \[SAFESCORE-AGENT\][\s\S]*?# \[SAFESCORE-AGENT\][^\n]*?fin[^\n]*\n?/g;
  let cleaned = content.replace(blockRegex, '');
  cleaned = cleaned.replace(envBlockRegex, '');
  return cleaned;
}

function cleanFile(absPath) {
  if (!fs.existsSync(absPath)) {
    console.log(`⚠️  ${absPath} — no existe, skip`);
    return false;
  }
  const original = fs.readFileSync(absPath, 'utf8');
  const cleaned = removeMarkedBlocks(original);
  if (cleaned === original) {
    console.log(`ℹ️  ${path.relative(BACKEND_ROOT, absPath)} — sin marcadores que limpiar`);
    return false;
  }
  fs.writeFileSync(absPath, cleaned, 'utf8');
  console.log(`✅ ${path.relative(BACKEND_ROOT, absPath)} — bloques eliminados`);
  return true;
}

function cleanPackageJson() {
  const pkgPath = path.join(BACKEND_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  let changed = false;
  for (const d of AGENT_DEPS) {
    if (pkg.dependencies && pkg.dependencies[d]) {
      delete pkg.dependencies[d];
      changed = true;
      console.log(`✅ package.json — dep '${d}' eliminada`);
    }
  }
  if (changed) {
    fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  } else {
    console.log('ℹ️  package.json — sin deps del agente para limpiar');
  }
  return changed;
}

function cleanEnv() {
  const envPath = path.join(BACKEND_ROOT, '.env');
  if (!fs.existsSync(envPath)) {
    console.log('ℹ️  .env — no existe');
    return false;
  }
  let content = fs.readFileSync(envPath, 'utf8');
  const original = content;

  // Eliminar bloques marcados con # [SAFESCORE-AGENT]
  content = removeMarkedBlocks(content);

  // Eliminar líneas sueltas SAFESCORE_* (por si el usuario las puso fuera del bloque)
  const lines = content.split('\n');
  const filtered = lines.filter(line => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    // Comentarios sobre el agente
    if (/^#.*safescore/i.test(trimmed)) return false;
    // Variables del agente
    for (const k of AGENT_ENV_KEYS) {
      if (trimmed.startsWith(`${k}=`)) return false;
    }
    // API keys (cuidado: solo borrar si la línea es exactamente de esa key)
    if (/^(GROQ_API_KEY|GEMINI_API_KEY|CEREBRAS_API_KEY)=/.test(trimmed)) return false;
    return true;
  });
  content = filtered.join('\n');

  if (content === original) {
    console.log('ℹ️  .env — sin variables del agente para limpiar');
    return false;
  }
  fs.writeFileSync(envPath, content, 'utf8');
  console.log('✅ .env — variables del agente eliminadas');
  return true;
}

async function confirm(prompt) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(prompt, (ans) => {
      rl.close();
      resolve(ans.trim().toLowerCase());
    });
  });
}

(async () => {
  console.log('\n🧹 SafeScore Agent — Uninstaller\n');
  console.log('Esto va a:');
  console.log('  • Eliminar los bloques [SAFESCORE-AGENT] de 4 archivos del backend');
  console.log('  • Eliminar 4 deps del package.json (groq-sdk, @google/generative-ai, @cerebras/cerebras_cloud_sdk, zod)');
  console.log('  • Eliminar variables SAFESCORE_* y *_API_KEY del .env');
  console.log('');
  console.log('NO va a:');
  console.log('  • Borrar la carpeta safescore-reviewer/ (hacelo manual)');
  console.log('  • Borrar las collections agent_jobs / reviews_v2 de MongoDB (hacelo con cleanup_db.js)');
  console.log('  • Correr npm uninstall (hacelo manual después)');
  console.log('');

  const answer = await confirm('¿Continuar? (yes/no): ');
  if (answer !== 'yes' && answer !== 'y' && answer !== 'si' && answer !== 'sí') {
    console.log('\nCancelado.');
    process.exit(0);
  }

  console.log('\n🔧 Limpiando archivos del backend:\n');
  for (const rel of TARGETED_FILES) {
    cleanFile(path.join(BACKEND_ROOT, rel));
  }

  console.log('\n📦 Limpiando package.json:\n');
  cleanPackageJson();

  console.log('\n🔑 Limpiando .env:\n');
  cleanEnv();

  console.log('\n✅ Uninstall completado.');
  console.log('');
  console.log('Pasos manuales restantes:');
  console.log('  1. Borrar la carpeta: rm -r safescore-reviewer/');
  console.log('  2. Limpiar node_modules: npm prune (o rm -r node_modules && npm install)');
  console.log('  3. Si querés limpiar las collections: db.agent_jobs.drop(); db.reviews_v2.drop();');
})();
