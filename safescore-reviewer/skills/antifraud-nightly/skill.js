/**
 * skill.js — T5 antifraud-nightly (STUB)
 */
module.exports = {
  name: 'antifraud-nightly',
  llmRequirements: {
    preferredProvider: 'gemini',
    preferredModel: 'reasoning_long_ctx',
    fallback: ['groq', 'cerebras'],
    maxTokens: 2000,
    temperature: 0.1,
    jsonMode: true,
  },
  async execute({ input, logger }) {
    logger.info('antifraud-nightly: STUB ejecutado (no implementado todavía)', input);
    return { not_implemented: true, skill: 'antifraud-nightly' };
  },
};
