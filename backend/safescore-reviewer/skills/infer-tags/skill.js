/**
 * skill.js — T6 infer-tags (STUB)
 */
module.exports = {
  name: 'infer-tags',
  llmRequirements: {
    preferredProvider: 'groq',
    preferredModel: 'reasoning_fast',
    fallback: ['cerebras'],
    maxTokens: 150,
    temperature: 0.2,
    jsonMode: true,
  },
  async execute({ input, logger }) {
    logger.info('infer-tags: STUB ejecutado', input);
    return { not_implemented: true, skill: 'infer-tags' };
  },
};
