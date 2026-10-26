/**
 * promptLoader.js — Carga prompts desde archivos .md de las skills.
 *
 * Convención: cada skill que use LLM tiene un archivo `prompt.md` en su carpeta.
 * Este módulo lo lee una sola vez (cache en memoria) y permite interpolar
 * variables con sintaxis {{var}}.
 *
 * Beneficios:
 *   - Prompts versionables como archivos Markdown legibles
 *   - Editables sin redeploy si están en disco
 *   - Cache evita I/O repetido
 *   - Interpolación segura (no usa eval ni template literals raros)
 */

const fs = require('fs');
const path = require('path');

const cache = new Map();

/**
 * Carga el prompt de una skill. La ruta es relativa a skills/.
 *
 * @param {string} skillName — nombre de carpeta, ej. 'moderate-comment'
 * @returns {string} contenido del prompt
 */
function loadPrompt(skillName) {
  if (cache.has(skillName)) return cache.get(skillName);

  const promptPath = path.resolve(__dirname, '..', '..', 'skills', skillName, 'prompt.md');
  if (!fs.existsSync(promptPath)) {
    throw new Error(`Prompt no encontrado para skill '${skillName}' en ${promptPath}`);
  }

  const content = fs.readFileSync(promptPath, 'utf8');
  cache.set(skillName, content);
  return content;
}

/**
 * Interpola {{variable}} en un prompt con valores. Sanitiza para evitar
 * que el contenido del usuario rompa el JSON esperado o inyecte instrucciones.
 *
 * @param {string} prompt — prompt con placeholders {{nombre}}
 * @param {object} vars   — { nombre: 'valor', ... }
 * @returns {string}
 */
function interpolate(prompt, vars) {
  return prompt.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = vars[key];
    if (v === undefined || v === null) return '';
    // Escapar comillas para evitar romper JSON cuando el prompt pide formato JSON
    return String(v).replace(/\r\n/g, '\n').trim();
  });
}

/**
 * Helper: carga + interpola en un solo paso.
 */
function loadAndInterpolate(skillName, vars) {
  return interpolate(loadPrompt(skillName), vars);
}

/**
 * Para tests / hot reload: vacía el cache.
 */
function clearCache() {
  cache.clear();
}

module.exports = { loadPrompt, interpolate, loadAndInterpolate, clearCache };
