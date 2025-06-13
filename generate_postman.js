const fs = require('fs');
const path = require('path');

const baseUrlVar = '{{baseUrl}}';
const collection = {
  info: {
    name: 'MC API',
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
  },
  item: [],
  variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }]
};

const routesDir = path.join(__dirname, 'src', 'routes', 'api');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));

files.forEach(file => {
  const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
  const folder = { name: file.replace(/\.js$/, ''), item: [] };
  const regex = /router\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"?]+)['"]/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const method = match[1];
    const route = match[2];
    folder.item.push({
      name: `${method.toUpperCase()} ${route}`,
      request: {
        method: method.toUpperCase(),
        header: [],
        url: {
          raw: `${baseUrlVar}${route}`,
          host: [baseUrlVar],
          path: route.replace(/^\//, '').split('/').filter(Boolean)
        }
      }
    });
  }
  if (folder.item.length) collection.item.push(folder);
});

fs.writeFileSync('postman_collection.json', JSON.stringify(collection, null, 2));
console.log('postman_collection.json generated with', collection.item.length, 'folders.');
