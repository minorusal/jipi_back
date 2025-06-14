const fs = require('fs');
const path = require('path');

// Base URL variable name for the collection
const baseUrlVar = '{{dev}}';
const collection = {
  info: {
    name: 'MC API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [],
  // Default value for the development server
  variable: [{ key: 'dev', value: 'http://localhost:3000' }]
};

const routesDir = path.join(__dirname, 'src', 'routes', 'api');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const fileName = file.replace(/\.js$/, '');
  const basePath = `/api/${fileName}`;
  const folder = { name: fileName, item: [] };
  const regex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"?]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1];
    const route = match[2];
    const fullRoute = `${basePath}${route}`;
    folder.item.push({
      name: `${method.toUpperCase()} ${fullRoute}`,
      request: {
        method: method.toUpperCase(),
        header: [],
        url: {
          raw: `${baseUrlVar}${fullRoute}`,
          host: [baseUrlVar],
          path: fullRoute.replace(/^\//, '').split('/')
        },
        ...(method !== 'get' && method !== 'delete'
          ? { body: { mode: 'raw', raw: '{}' } }
          : {})
      }
    });
  }
  if (folder.item.length) collection.item.push(folder);
});

fs.writeFileSync('postman_collection.json', JSON.stringify(collection, null, 2));
console.log('postman_collection.json generated with', collection.item.length, 'folders.');
