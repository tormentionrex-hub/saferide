/**
 * skill.js — T9 digest-monthly (STUB)
 */
module.exports = {
  name: 'digest-monthly',
  llmRequirements: {
    preferredProvider: 'gemini',
    preferredModel: 'reasoning_long_ctx',
    fallback: [],
    maxTokens: 3000,
    temperature: 0.3,
  },
  async execute({ input, logger }) {
    logger.info('digest-monthly: STUB ejecutado', input);
    return { not_implemented: true, skill: 'digest-monthly' };
  },
};
