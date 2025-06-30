const fs = require('fs');
const path = require('path');

function collectRoutes(dir, prefix, paths, tags) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
  files.forEach(file => {
    const content = fs.readFileSync(path.join(dir, file), 'utf8');
    const fileName = file.replace(/\.js$/, '').replace(/\.ga$/, '');
    if (!tags.find(t => t.name === fileName)) {
      tags.push({ name: fileName });
    }
    const base = `${prefix}${fileName === 'index' ? '' : '/' + fileName}`;
    const regex = /router\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]*)['"`]/g;
    let match;
    while ((match = regex.exec(content)) !== null) {
      const method = match[1].toLowerCase();
      const route = match[2];
      const full = `${base}${route}`.replace(/\/\/+/, '/');
      if (!paths[full]) paths[full] = {};
      paths[full][method] = { tags: [fileName], responses: { 200: { description: 'Success' } } };
    }
  });
}

module.exports = function generateOpenApi(port) {
  const paths = {};
  const tags = [];
  collectRoutes(path.join(__dirname, '../routes/api'), '/api', paths, tags);
  collectRoutes(path.join(__dirname, '../routes/legacy'), '', paths, tags);
  collectRoutes(path.join(__dirname, '../routes/api_arcsa_v2'), '/api_arcsa_v2', paths, tags);

  return {
    openapi: '3.0.0',
    info: { title: 'Credibusiness', version: '1.0.0' },
    servers: [
      { url: `http://localhost:${port || 3000}`, description: 'Servidor local' }
    ],
    tags,
    paths
  };
};
