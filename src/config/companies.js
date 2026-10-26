// Empresas con convenio de SafeRide. Es la única fuente: la usan la
// validación del modelo User y GET /users/companies, que consumen la app y el
// panel. Agregar una empresa aquí la habilita en todos lados sin publicar una
// versión nueva de la app.
const COMPANIES = [
  'Intel',
  'Cargill',
  'Deloitte',
  'Citi',
  'Experian',
  '3M',
  'DHL',
  'Bill Gosling Outsourcing (BGO)',
  'WeWork Costa Rica',
  'Concentrix',
  'Nestlé Costa Rica',
];

module.exports = { COMPANIES };
