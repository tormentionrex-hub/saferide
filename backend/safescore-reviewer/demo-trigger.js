#!/usr/bin/env node
/**
 * demo-trigger.js — Script de demo para mostrar el agente en vivo.
 *
 * Crea una review v2 con un comentario tóxico real y encola el job
 * moderate-comment. Después espera 5 segundos y muestra el resultado.
 *
 * Ideal para presentaciones: mostrá en una pantalla el terminal del backend
 * (con los logs [SAFESCORE] apareciendo) y en otra Compass viendo el job
 * cambiar de pending → running → done con tokens reales gastados.
 *
 * Uso:
 *   node safescore-reviewer/demo-trigger.js
 *   node safescore-reviewer/demo-trigger.js --safe        ← comentario inocente
 *   node safescore-reviewer/demo-trigger.js --borderline  ← caso ambiguo
 *   node safescore-reviewer/demo-trigger.js --toxic       ← default
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');

const CASES = {
  safe: 'Excelente conductor, muy puntual y amable. El auto estaba impecable, viaje muy cómodo. Lo recomiendo totalmente.',
  borderline: 'No me gustó el conductor, pasajera mentirosa según él, dudosa actitud. Una experiencia mala pero sin agresión directa.',
  toxic: 'Manejaba como un imbécil, casi nos mata en la curva. Es un idiota que no debería tener licencia. Pésima persona.',
};

const arg = process.argv.find(a => a.startsWith('--'));
const caseKey = arg ? arg.replace('--', '') : 'toxic';
const comment = CASES[caseKey] || CASES.toxic;

(async () => {
  await mongoose.connect(process.env.COSMOS_CONNECTION_STRING, { dbName: process.env.COSMOS_DATABASE });

  console.log('\n🎬 SafeScore Demo — caso: ' + caseKey.toUpperCase());
  console.log('═'.repeat(60));
  console.log('Comentario: "' + comment + '"');
  console.log('═'.repeat(60) + '\n');

  // 1. Crear review v2 real
  const reviewId = new mongoose.Types.ObjectId();
  await mongoose.connection.db.collection('reviews_v2').insertOne({
    _id: reviewId,
    ride_id: new mongoose.Types.ObjectId(),
    reviewer_id: new mongoose.Types.ObjectId(),
    reviewee_id: new mongoose.Types.ObjectId(),
    reviewer_role: 'passenger',
    overall: caseKey === 'safe' ? 5 : caseKey === 'borderline' ? 3 : 1,
    ratings: { safety: caseKey === 'safe' ? 5 : 1 },
    positive_tags: caseKey === 'safe' ? ['smooth_driving', 'clean_car'] : [],
    negative_tags: caseKey === 'safe' ? [] : ['aggressive_driving'],
    comment,
    status: 'pending_blind',
    visibility_at: new Date(Date.now() + 24 * 3600 * 1000),
    weight: 1.0,
    moderation: { decision: 'pending' },
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('1️⃣  Review v2 creada → _id: ' + reviewId);

  // 2. Encolar moderate-comment con priority alta
  const job = await mongoose.connection.db.collection('agent_jobs').insertOne({
    task: 'moderate-comment',
    payload: { reviewId: reviewId.toString() },
    status: 'pending',
    priority: 9,
    scheduled_for: new Date(),
    attempts: 0,
    max_attempts: 3,
    tags: ['demo', caseKey],
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  console.log('2️⃣  Job moderate-comment encolado → _id: ' + job.insertedId);
  console.log('     priority: 9 (alta)');
  console.log('     payload.reviewId: ' + reviewId);
  console.log('');
  console.log('⏳ Mirá el terminal del backend AHORA — el worker procesará en <2s.');
  console.log('   Tambien refrescá Compass en agent_jobs para verlo pasar de pending → running → done.\n');

  // 3. Esperar a que el worker termine
  let attempts = 0;
  let processedJob = null;
  while (attempts < 30) {
    await new Promise(r => setTimeout(r, 500));
    processedJob = await mongoose.connection.db.collection('agent_jobs').findOne({ _id: job.insertedId });
    if (processedJob.status === 'done' || processedJob.status === 'failed') break;
    attempts++;
  }

  // 4. Mostrar resultado
  console.log('═'.repeat(60));
  console.log('📊 RESULTADO');
  console.log('═'.repeat(60));
  console.log('Job status:        ' + processedJob.status);
  console.log('Duration:          ' + processedJob.duration_ms + ' ms');
  console.log('LLM provider:      ' + (processedJob.llm_provider_used || '(ninguno)'));
  console.log('LLM model:         ' + (processedJob.llm_model_used || '(ninguno)'));
  console.log('LLM tokens used:   ' + processedJob.llm_tokens_used);
  console.log('');
  console.log('Decisión del agente:');
  console.log(JSON.stringify(processedJob.result, null, 2));
  console.log('');

  // 5. Ver review actualizada
  const updated = await mongoose.connection.db.collection('reviews_v2').findOne({ _id: reviewId });
  console.log('═'.repeat(60));
  console.log('📝 La review v2 también se actualizó');
  console.log('═'.repeat(60));
  console.log('status:    ' + updated.status + ' (era pending_blind)');
  console.log('moderation:');
  console.log(JSON.stringify(updated.moderation, null, 2));
  console.log('');

  // 6. Cleanup opcional
  const keepData = process.argv.includes('--keep');
  if (!keepData) {
    await mongoose.connection.db.collection('reviews_v2').deleteOne({ _id: reviewId });
    await mongoose.connection.db.collection('agent_jobs').deleteOne({ _id: job.insertedId });
    console.log('🧹 Cleanup OK (review y job borrados). Usá --keep para conservarlos.');
  } else {
    console.log('💾 Data conservada en MongoDB para inspección.');
    console.log('   review_v2 _id: ' + reviewId);
    console.log('   agent_jobs _id: ' + job.insertedId);
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch(err => { console.error('❌ Error:', err.message); process.exit(1); });
