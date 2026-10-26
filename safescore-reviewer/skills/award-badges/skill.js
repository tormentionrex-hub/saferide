/**
 * skill.js — T8 award-badges (STUB)
 */
module.exports = {
  name: 'award-badges',
  llmRequirements: {
    preferredProvider: 'none',
    fallback: [],
  },
  async execute({ input, logger }) {
    logger.info('award-badges: STUB ejecutado', input);
    return { not_implemented: true, skill: 'award-badges' };
  },
};
