// save-prompt 本地服务：零依赖 Node 后端
// 职责：托管 public/ 静态页面、读写 data/prompts.json（原子落盘）、转发 LLM 生成简介
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DATA_FILE = path.join(ROOT, 'data', 'prompts.json');
const CONFIG_FILE = path.join(ROOT, 'config.json');
const PUBLIC_DIR = path.join(ROOT, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch {
    return { port: 5988, llm: null };
  }
}

function readBody(req, limit = 5 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > limit) { reject(new Error('请求体过大')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res, code, obj) {
  const buf = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(buf);
}

// ===== 数据层 =====
function getData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    const init = { version: 1, scenarios: [] };
    writeData(init);
    return init;
  }
}

// 先写临时文件再原子替换，断电/崩溃不会写坏数据库
function writeData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

// ===== AI 简介生成：支持 anthropic / openai 两种协议 =====
async function aiSummarize(text) {
  const cfg = loadConfig().llm;
  if (!cfg || !cfg.api_key || cfg.api_key.includes('在这里')) {
    throw new Error('未配置 LLM：请在 config.json 的 llm 段填入 api_key（参考 config.example.json）');
  }
  const clipped = text.length > 4000 ? text.slice(0, 4000) + '…' : text;
  const prompt =
    '你是提示词管理助手。阅读下面的提示词，写一段不超过 140 个字符（1 个汉字算 1 个字符）的简介，' +
    '目标是接近 140 字但不超过。内容要覆盖三件事：1. 这条提示词是干什么的；2. 什么时候/什么场景下用它；3. 有什么使用注意事项。' +
    '直接输出这段简介，不要加引号、前缀、序号或任何解释。\n\n<提示词>\n' + clipped + '\n</提示词>';
  const base = String(cfg.base_url || '').replace(/\/+$/, '');
  const protocol = cfg.protocol || 'openai';

  let res;
  if (protocol === 'anthropic') {
    res = await fetch(base + '/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': cfg.api_key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: cfg.model, max_tokens: 200, messages: [{ role: 'user', content: prompt }] }),
    });
  } else {
    res = await fetch(base + '/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + cfg.api_key },
      body: JSON.stringify({ model: cfg.model, messages: [{ role: 'user', content: prompt }] }),
    });
  }
  if (!res.ok) {
    throw new Error('LLM 服务返回 ' + res.status + '：' + (await res.text()).slice(0, 300));
  }
  const j = await res.json();
  const desc = protocol === 'anthropic'
    ? (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('')
    : (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || '';
  const out = String(desc).trim().replace(/^["「『]|["」』]$/g, '');
  if (!out) throw new Error('LLM 返回了空内容');
  return out;
}

// ===== 静态文件（防路径穿越）=====
function serveStatic(req, res, urlPath) {
  let p = decodeURIComponent(urlPath);
  if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(PUBLIC_DIR, p));
  if (!file.startsWith(PUBLIC_DIR)) { res.writeHead(403); res.end('Forbidden'); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }); res.end('Not Found'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  try {
    if (req.method === 'GET' && urlPath === '/api/data') {
      return sendJson(res, 200, getData());
    }
    if (req.method === 'PUT' && urlPath === '/api/data') {
      const body = JSON.parse(await readBody(req));
      if (!body || !Array.isArray(body.scenarios)) {
        return sendJson(res, 400, { error: '数据格式不合法：缺少 scenarios 数组' });
      }
      writeData(body);
      return sendJson(res, 200, { ok: true });
    }
    if (req.method === 'POST' && urlPath === '/api/ai/summarize') {
      const body = JSON.parse(await readBody(req));
      if (!body || !String(body.body || '').trim()) {
        return sendJson(res, 400, { error: '缺少提示词正文' });
      }
      try {
        const desc = await aiSummarize(body.body);
        return sendJson(res, 200, { desc });
      } catch (e) {
        // AI 失败不影响手动编辑保存，仅回传错误信息
        return sendJson(res, 502, { error: e.message });
      }
    }
    if (req.method === 'GET') return serveStatic(req, res, urlPath);
    res.writeHead(405); res.end();
  } catch (e) {
    sendJson(res, 500, { error: e.message });
  }
});

const port = loadConfig().port || 5988;
server.listen(port, '127.0.0.1', () => {
  console.log('提示词武器库已启动：http://localhost:' + port);
});
