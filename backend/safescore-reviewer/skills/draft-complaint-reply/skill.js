/**
 * skill.js — T10 draft-complaint-reply (STUB)
 */
module.exports = {
  name: 'draft-complaint-reply',
  llmRequirements: {
    preferredProvider: 'groq',
    preferredModel: 'reasoning_primary',
    fallback: ['cerebras', 'gemini'],
    maxTokens: 1000,
    temperature: 0.3,
    jsonMode: true,
  },
  async execute({ input, logger }) {
    logger.info('draft-complaint-reply: STUB ejecutado', input);
    return { not_implemented: true, skill: 'draft-complaint-reply' };
  },
};
