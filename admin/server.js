const http = require('http');
const fs = require('fs');
const path = require('path');
const { URL } = require('url');

const PORT = 3333;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'studio2026';
const SRC = path.join(__dirname, '..', 'src');
const PROJECTS_DIR = path.join(SRC, 'projects');
const DATA_DIR = path.join(SRC, '_data');
const IMAGES_DIR = path.join(SRC, 'assets', 'images');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

function checkAuth(req) {
  const auth = req.headers['x-admin-password'];
  return auth === ADMIN_PASSWORD;
}

function json(res, data, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function error(res, msg, status = 400) {
  json(res, { error: msg }, status);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
}

async function readJsonBody(req) {
  const buf = await readBody(req);
  return JSON.parse(buf.toString());
}

function parseYamlFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };
  const yamlStr = match[1];
  const body = content.slice(match[0].length).trim();

  const fm = {};
  fm.title = (yamlStr.match(/^title:\s*(.+)$/m) || [])[1] || '';
  fm.year = (yamlStr.match(/^year:\s*"?(.+?)"?\s*$/m) || [])[1] || '';
  fm.layout = (yamlStr.match(/^layout:\s*(.+)$/m) || [])[1] || 'project.njk';
  const summaryMatch = yamlStr.match(/^summary:\s*(.+)$/m);
  if (summaryMatch) fm.summary = summaryMatch[1];

  fm.images = [];
  const imageBlocks = yamlStr.split(/\n  - src:/);
  for (let i = 1; i < imageBlocks.length; i++) {
    const block = '  - src:' + imageBlocks[i];
    const img = {};
    const srcMatch = block.match(/src:\s*(.+)/);
    const titleMatch = block.match(/title:\s*(.+)/);
    const mediumMatch = block.match(/medium:\s*(.+)/);
    const dimMatch = block.match(/dimensions:\s*(.+)/);
    const dateMatch = block.match(/date:\s*"?(.+?)"?\s*$/m);
    const collMatch = block.match(/collection:\s*(.+)/);

    img.src = srcMatch ? srcMatch[1].trim() : '';
    img.title = titleMatch ? titleMatch[1].trim() : '';
    img.medium = mediumMatch ? mediumMatch[1].trim() : '';
    img.dimensions = dimMatch ? dimMatch[1].trim() : '';
    img.date = dateMatch ? dateMatch[1].trim() : '';
    img.collection = collMatch ? collMatch[1].trim() : '';

    if (img.src) fm.images.push(img);
  }

  return { frontmatter: fm, body };
}

function buildNjkContent(fm) {
  let yaml = `---\ntitle: ${fm.title}\nyear: "${fm.year}"\nlayout: ${fm.layout || 'project.njk'}\n`;
  if (fm.summary) yaml += `summary: ${fm.summary}\n`;
  yaml += 'images:\n';

  for (const img of fm.images) {
    yaml += `  - src: ${img.src}\n`;
    yaml += `    title: ${img.title}\n`;
    yaml += `    medium: ${img.medium}\n`;
    yaml += `    dimensions: ${img.dimensions}\n`;
    yaml += `    date: "${img.date}"\n`;
    yaml += `    collection: ${img.collection || ''}\n`;
  }

  yaml += '---';
  return yaml;
}

function getProjects() {
  const files = fs.readdirSync(PROJECTS_DIR).filter(f => f.endsWith('.njk') && f !== 'index.njk');
  return files.map(f => {
    const content = fs.readFileSync(path.join(PROJECTS_DIR, f), 'utf8');
    const { frontmatter } = parseYamlFrontmatter(content);
    return { slug: f.replace('.njk', ''), ...frontmatter };
  });
}

function readJsonFile(name) {
  const filepath = path.join(DATA_DIR, name);
  if (!fs.existsSync(filepath)) return null;
  return JSON.parse(fs.readFileSync(filepath, 'utf8'));
}

function writeJsonFile(name, data) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(data, null, 2) + '\n');
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Admin-Password');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (pathname.startsWith('/api/')) {
    if (!checkAuth(req)) return error(res, 'Unauthorized', 401);

    // GET /api/projects
    if (pathname === '/api/projects' && req.method === 'GET') {
      return json(res, getProjects());
    }

    // GET /api/project/:slug
    if (pathname.startsWith('/api/project/') && req.method === 'GET') {
      const slug = pathname.split('/')[3];
      const filepath = path.join(PROJECTS_DIR, `${slug}.njk`);
      if (!fs.existsSync(filepath)) return error(res, 'Not found', 404);
      const content = fs.readFileSync(filepath, 'utf8');
      const { frontmatter } = parseYamlFrontmatter(content);
      return json(res, { slug, ...frontmatter });
    }

    // PUT /api/project/:slug
    if (pathname.startsWith('/api/project/') && req.method === 'PUT') {
      const slug = pathname.split('/')[3];
      const data = await readJsonBody(req);
      const filepath = path.join(PROJECTS_DIR, `${slug}.njk`);
      fs.writeFileSync(filepath, buildNjkContent(data));
      return json(res, { ok: true });
    }

    // POST /api/project (create new)
    if (pathname === '/api/project' && req.method === 'POST') {
      const data = await readJsonBody(req);
      const slug = data.slug || data.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const filepath = path.join(PROJECTS_DIR, `${slug}.njk`);
      if (fs.existsSync(filepath)) return error(res, 'Project already exists');

      const imgDir = path.join(IMAGES_DIR, slug);
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      fs.writeFileSync(filepath, buildNjkContent({ ...data, layout: 'project.njk' }));
      return json(res, { ok: true, slug });
    }

    // DELETE /api/project/:slug
    if (pathname.startsWith('/api/project/') && req.method === 'DELETE') {
      const slug = pathname.split('/')[3];
      const filepath = path.join(PROJECTS_DIR, `${slug}.njk`);
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      return json(res, { ok: true });
    }

    // POST /api/upload/:slug - upload image
    if (pathname.startsWith('/api/upload/') && req.method === 'POST') {
      const slug = pathname.split('/')[3];
      const imgDir = path.join(IMAGES_DIR, slug);
      if (!fs.existsSync(imgDir)) fs.mkdirSync(imgDir, { recursive: true });

      const filename = url.searchParams.get('filename');
      if (!filename) return error(res, 'Missing filename parameter');

      const safeName = filename.toLowerCase().replace(/[^a-z0-9._-]/g, '');
      const buf = await readBody(req);
      fs.writeFileSync(path.join(imgDir, safeName), buf);
      return json(res, { ok: true, path: `/assets/images/${slug}/${safeName}` });
    }

    // GET /api/homepage-order
    if (pathname === '/api/homepage-order' && req.method === 'GET') {
      return json(res, readJsonFile('projects.json') || []);
    }

    // PUT /api/homepage-order
    if (pathname === '/api/homepage-order' && req.method === 'PUT') {
      const data = await readJsonBody(req);
      writeJsonFile('projects.json', data);
      return json(res, { ok: true });
    }

    // GET /api/ephemera
    if (pathname === '/api/ephemera' && req.method === 'GET') {
      return json(res, readJsonFile('ephemera.json') || []);
    }

    // PUT /api/ephemera
    if (pathname === '/api/ephemera' && req.method === 'PUT') {
      const data = await readJsonBody(req);
      writeJsonFile('ephemera.json', data);
      return json(res, { ok: true });
    }

    // GET /api/exhibitions
    if (pathname === '/api/exhibitions' && req.method === 'GET') {
      return json(res, readJsonFile('exhibitions.json') || { shows: [], education: [] });
    }

    // PUT /api/exhibitions
    if (pathname === '/api/exhibitions' && req.method === 'PUT') {
      const data = await readJsonBody(req);
      writeJsonFile('exhibitions.json', data);
      return json(res, { ok: true });
    }

    return error(res, 'Not found', 404);
  }

  // Serve source images from /assets/
  if (pathname.startsWith('/assets/')) {
    const imgPath = path.join(SRC, pathname);
    if (fs.existsSync(imgPath)) {
      const ext = path.extname(imgPath);
      const mime = MIME[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': mime });
      fs.createReadStream(imgPath).pipe(res);
      return;
    }
  }

  // Serve static admin files
  let filePath = pathname === '/' ? '/index.html' : pathname;
  filePath = path.join(__dirname, filePath);

  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const ext = path.extname(filePath);
  const mime = MIME[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mime });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`\n  Admin server running at http://localhost:${PORT}`);
  console.log(`  Password: ${ADMIN_PASSWORD}\n`);
});
