#!/usr/bin/env node
/**
 * install.js — Aplica los cambios del agente a un backend que NO los tenga.
 *
 * Útil cuando el equipo te pasa una nueva versión del backend (vía .zip)
 * y querés reaplicar el agente sin hacer los cambios a mano.
 *
 * Idempotente: si los marcadores ya están, no duplica.
 *
 * Uso: node safescore-reviewer/install.js
 */

const fs = require('fs');
const path = require('path');

const BACKEND_ROOT = path.resolve(__dirname, '..');

// Patches (anchor → insert) en archivos del backend.
// Cada patch tiene `marker` único para detectar si ya fue aplicado.
const PATCHES = [
  {
    file: 'server.js',
    marker: '[SAFESCORE-AGENT]',
    anchor: `    // Initialize scheduled jobs
    if (process.env.NODE_ENV !== 'test') {
      initScheduledJobs();
    }`,
    insertAfter: `

    // [SAFESCORE-AGENT] — Inicializar agente SafeScore si SAFESCORE_ENABLED=true.
    // El try/catch hace que la ausencia de la carpeta safescore-reviewer/ NO rompa el backend.
    // Ver safescore-reviewer/README.md
    try {
      const safescoreAgent = require('./safescore-reviewer/agent');
      safescoreAgent.init();
    } catch (err) {
      logger.warn('[SAFESCORE-AGENT] no disponible: ' + (err.message || err));
    }
    // [SAFESCORE-AGENT] — fin`,
  },
  // Más patches automáticos podrían agregarse acá. Por simplicidad inicial,
  // si install.js no logra aplicar todos los patches, el usuario completa
  // los faltantes manualmente siguiendo el MANIFEST.md (que voy a crear en F14).
];

function applyPatch({ file, marker, anchor, insertAfter }) {
  const fullPath = path.join(BACKEND_ROOT, file);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  ${file} — no existe, skip`);
    return { ok: false, reason: 'file_not_found' };
  }

  const content = fs.readFileSync(fullPath, 'utf8');

  if (content.includes(marker)) {
    console.log(`✅ ${file} — ya tiene marcador ${marker}, idempotente OK`);
    return { ok: true, already: true };
  }

  if (!content.includes(anchor)) {
    console.log(`❌ ${file} — no encontré el anchor exacto. Revisar manualmente.`);
    return { ok: false, reason: 'anchor_not_found' };
  }

  const updated = content.replace(anchor, anchor + insertAfter);
  fs.writeFileSync(fullPath, updated, 'utf8');
  console.log(`✅ ${file} — patch aplicado`);
  return { ok: true, already: false };
}

(async () => {
  console.log('\n🔧 SafeScore Agent — Installer\n');
  console.log('Aplicando patches en archivos del backend...\n');

  let totalOk = 0;
  let totalFail = 0;
  for (const patch of PATCHES) {
    const r = applyPatch(patch);
    if (r.ok) totalOk++; else totalFail++;
  }

  console.log('\n📊 Resumen:\n');
  console.log(`   Patches OK: ${totalOk}`);
  console.log(`   Patches con problema: ${totalFail}`);
  console.log('');
  console.log('IMPORTANTE: install.js solo cubre los patches simples. Los demás');
  console.log('(scheduledJobs.js, routes/index.js, reviewController.js, package.json, .env)');
  console.log('están documentados en MANIFEST.md y deben verificarse manualmente la primera vez.');
  console.log('');
  console.log('Después de instalar:');
  console.log('  1. npm install      ← para que las nuevas deps estén disponibles');
  console.log('  2. node safescore-reviewer/verify.js   ← chequeo completo');
  console.log('  3. npm run dev      ← arrancar backend con agente activo');
})();
