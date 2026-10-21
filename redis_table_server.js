require('dotenv').config();
const express = require('express');
const { createClient } = require('redis');

const app = express();
const PORT = process.env.PORT || 3000;
const REDIS_URL = process.env.REDIS_URL;

if (!REDIS_URL) {
  console.error('[AVISO] Configure a variável REDIS_URL no arquivo .env');
}

const client = createClient({ url: REDIS_URL || 'redis://localhost:6379' });
client.on('error', (err) => console.error('Erro no Redis:', err.message));

app.get('/', async (req, res) => {
  try {
    if (!client.isOpen) await client.connect();

    // 1. Busca todas as chaves "pesquisa:*"
    const keys = await client.keys('pesquisa:*');

    // Ordena as chaves numericamente: pesquisa:1, pesquisa:2 ... pesquisa:72
    keys.sort((a, b) => {
      const numA = parseInt(a.split(':')[1]) || 0;
      const numB = parseInt(b.split(':')[1]) || 0;
      return numA - numB;
    });

    // 2. Extrai os dados em formato Hash (HGETALL) de cada chave
    const records = await Promise.all(
      keys.map(async (key) => {
        const data = await client.hGetAll(key);
        return { key, ...data };
      })
    );

    // 3. Renderiza a Tabela HTML Limpa e Responsiva
    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Respostas da Pesquisa - Redis Cloud</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    h1 { font-size: 20px; margin-bottom: 8px; }
    p { color: #94a3b8; font-size: 13px; margin-top: 0; margin-bottom: 20px; }
    .table-container { overflow-x: auto; background: #1e293b; border-radius: 8px; border: 1px solid #334155; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; text-align: left; }
    th { background: #0f172a; color: #38bdf8; padding: 12px 14px; border-bottom: 2px solid #334155; white-space: nowrap; }
    td { padding: 10px 14px; border-bottom: 1px solid #334155; color: #cbd5e1; }
    tr:hover td { background: #273549; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-weight: 600; font-size: 11px; background: #0369a1; color: #e0f2fe; }
  </style>
</head>
<body>
  <h1>Respostas da Pesquisa (${records.length} registros encontrados no Redis)</h1>
  <p>Fonte: Redis Cloud (Hash Keys: pesquisa:1 a pesquisa:72)</p>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th>Chave</th>
          ${records[0] ? Object.keys(records[0]).filter(k => k !== 'key').map(k => `<th>${k}</th>`).join('') : '<th>Dados</th>'}
        </tr>
      </thead>
      <tbody>
        ${records.map(r => `
          <tr>
            <td><span class="badge">${r.key}</span></td>
            ${Object.entries(r).filter(([k]) => k !== 'key').map(([_, val]) => `<td>${val || '-'}</td>`).join('')}
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    res.status(500).send(`<h2>Erro ao carregar dados do Redis:</h2><pre>${err.message}</pre>`);
  }
});

app.listen(PORT, () => {
  console.log(`Servidor rodando em: http://localhost:${PORT}`);
});
