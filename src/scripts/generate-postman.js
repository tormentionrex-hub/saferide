const fs = require('fs');
const path = require('path');
const swaggerSpec = require('../config/swagger');

// Save as JSON
const specPath = path.join(process.cwd(), 'swagger-spec.json');
fs.writeFileSync(specPath, JSON.stringify(swaggerSpec, null, 2));

console.log('✅ Swagger spec saved to swagger-spec.json');
console.log('');
console.log('To convert to Postman collection, run:');
console.log('openapi2postmanv2 -s swagger-spec.json -o postman-collection.json -p');