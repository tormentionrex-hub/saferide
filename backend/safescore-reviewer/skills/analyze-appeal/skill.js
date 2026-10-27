/**
 * skill.js — T7 analyze-appeal (STUB)
 */
module.exports = {
  name: 'analyze-appeal',
  llmRequirements: {
    preferredProvider: 'gemini',
    preferredModel: 'reasoning_long_ctx',
    fallback: ['groq', 'cerebras'],
    maxTokens: 1500,
    temperature: 0.2,
    jsonMode: true,
  },
  async execute({ input, logger }) {
    logger.info('analyze-appeal: STUB ejecutado', input);
    return { not_implemented: true, skill: 'analyze-appeal' };
  },
};
