const { DateTime } = require('luxon');
// Get timezone from environment or default.
//TODO: Validate if the timezone works correctly with the Front End application
const TZ = process.env.APP_TIMEZONE || process.env.TZ || 'America/Costa_Rica';
// Get current time in configured timezone
function now() {
  return DateTime.utc().setZone(TZ);
}

// Parse ISO string. If includes offset/Z, respect it and convert to configured zone.
function parseIsoToZone(isoString) {
  if (!isoString) return null;
  const hasOffset = /[Zz]|[+\-]\d{2}:\d{2}$/.test(isoString);
  return hasOffset
    ? DateTime.fromISO(isoString).setZone(TZ)
    : DateTime.fromISO(isoString, { zone: TZ });
}

// Return a Luxon DateTime in UTC
function toUTC(dt) {
  if (!dt) return null;
  if (dt instanceof Date) return DateTime.fromJSDate(dt).toUTC();
  if (dt.toUTC) return dt.toUTC();
  return null;
}

// Return ISO string in UTC
function toISO(dt) {
  const utc = toUTC(dt);
  return utc ? utc.toISO() : null;
}

// Return JavaScript Date (UTC)
function toJSDate(dt) {
  if (!dt) return null;
  if (dt instanceof Date) return dt;
  if (dt.toJSDate) return dt.toJSDate();
  // fallback: try convert from ISO
  const iso = toISO(dt);
  return iso ? new Date(iso) : null;
}

// Return configured timezone name
function zoneName() {
  return TZ;
}

module.exports = {
  now,
  parseIsoToZone,
  toUTC,
  toISO,
  toJSDate,
  zoneName,
};