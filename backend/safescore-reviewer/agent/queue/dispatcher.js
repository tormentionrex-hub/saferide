/**
 * dispatcher.js — Mapea task name → módulo de skill y la ejecuta.
 *
 * Las skills viven en safescore-reviewer/skills/<task>/skill.js
 * y exportan execute({ input, llm, db, logger }).
 *
 * Este dispatcher:
 *   1. Resuelve qué skill cargar según job.task
 *   2. Le pasa el contexto estándar (llm router, db, logger)
 *   3. Captura excepciones y las marca como failed en la cola
 *   4. Registra métricas de LLM usado para que la cola lo persista
 */

const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const router = require('../llm/router');
const logger = require('../utils/logger');

// Mapa task → ruta de skill. Si una skill no existe físicamente,
// el dispatcher la marca como `skill_not_implemented`.
const SKILLS_DIR = path.resolve(__dirname, '..', '..', 'skills');

const cache = new Map();   // task → skillModule (lazy load)

function loadSkill(task) {
  if (cache.has(task)) return cache.get(task);

  const skillPath = path.join(SKILLS_DIR, task, 'skill.js');
  if (!fs.existsSync(skillPath)) {
    cache.set(task, null);
    return null;
  }

  // Require fresh para que ediciones en dev se reflejen sin reiniciar
  delete require.cache[require.resolve(skillPath)];
  const skill = require(skillPath);

  // Validación mínima del contrato de skill
  if (typeof skill.execute !== 'function') {
    throw new Error(`Skill '${task}' no exporta execute()`);
  }

  cache.set(task, skill);
  return skill;
}

/**
 * Ejecuta el job. Devuelve { result, metrics } o lanza error.
 *
 * @param {object} job — documento AgentJob
 * @returns {Promise<{result, metrics}>}
 */
async function dispatch(job) {
  const skill = loadSkill(job.task);
  if (!skill) {
    throw new Error(`skill_not_implemented:${job.task}`);
  }

  // Contexto que se le pasa a la skill — interfaz estable
  const llmMetrics = { tokens: 0, provider: null, model: null };

  // Wrapper del router que captura métricas para reportarlas al cola
  const llmProxy = {
    async complete(params) {
      const finalParams = {
        ...params,
        requirements: skill.llmRequirements || params.requirements,
      };
      const r = await router.complete(finalParams);
      llmMetrics.tokens += r.tokensUsed || 0;
      llmMetrics.provider = r.provider;
      llmMetrics.model = r.model;
      return r;
    },
    smokeTest: router.smokeTest,
  };

  const ctx = {
    input: job.payload || {},
    llm: llmProxy,
    db: mongoose,
    logger,
    job, // por si la skill necesita inspeccionar attempts, scheduled_for, etc.
  };

  const result = await skill.execute(ctx);

  return {
    result,
    metrics: {
      llm_provider_used: llmMetrics.provider,
      llm_model_used: llmMetrics.model,
      llm_tokens_used: llmMetrics.tokens,
    },
  };
}

/**
 * Útil para tests / herramientas dev: limpia el cache.
 */
function clearCache() {
  cache.clear();
}

module.exports = { dispatch, loadSkill, clearCache, SKILLS_DIR };
