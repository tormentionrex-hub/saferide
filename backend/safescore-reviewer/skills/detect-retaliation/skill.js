/**
 * skill.js — T2 detect-retaliation (STUB)
 *
 * IMPLEMENTACIÓN PENDIENTE. Ver SKILL.md.
 *
 * Comportamiento actual: devuelve { not_implemented: true } sin gastar tokens.
 * El worker lo marca como done (no failed) para no acumular retries.
 */

module.exports = {
  name: 'detect-retaliation',

  llmRequirements: {
    preferredProvider: 'groq',
    preferredModel: 'reasoning_primary',   // Llama 4 Scout
    fallback: ['cerebras', 'gemini'],
    maxTokens: 300,
    temperature: 0.2,
    jsonMode: true,
  },

  async execute({ input, logger }) {
    logger.info('detect-retaliation: STUB ejecutado (no implementado todavía)', input);
    return {
      not_implemented: true,
      skill: 'detect-retaliation',
      hint: 'Ver SKILL.md para roadmap de implementación',
    };
  },
};
