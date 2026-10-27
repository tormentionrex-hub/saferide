// Utilidad de prueba local: login con usuario del seed y llamadas a la API.
const fs = require('fs');
const path = require('path');
const seed = fs.readFileSync(process.env.SEED || path.resolve(__dirname, '..', '..', 'src', 'scripts', 'initDatabase.js'), 'utf8');
const pw = seed.match(/bcrypt\.hash\('([^']+)'/)[1];
const base = 'http://localhost:8080/api/v1';
async function login(email) {
  const r = await (await fetch(base + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: pw }) })).json();
  return r.data?.accessToken || r.data?.token;
}
async function call(token, method, path, body) {
  const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  let j; try { j = await r.json(); } catch { j = null; }
  return { status: r.status, body: j };
}
module.exports = { login, call, base };
