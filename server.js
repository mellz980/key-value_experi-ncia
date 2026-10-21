/**
 * ==============================================================================
 * BACKEND EXPRESS & REDIS CLOUD INTEGRATION
 * NoSQL Key-Value Store & Google Forms Real-Time Sync
 * FECAP - Big Data & Analytics 2026
 * Aluna / RA: Melissa Nunes de Oliveira (25011962)
 * ==============================================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('redis');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir frontend estático na raiz
app.use(express.static(path.join(__dirname)));

// Estado da Conexão em Memória
let redisClient = null;
let isRedisConnected = false;
let redisConnectionError = null;
let lastSyncTimestamp = null;
let lastPingLatency = null;

// Normalização de Perguntas do Google Forms
const FORM_FIELDS = [
  { key: 'timestamp', label: 'Carimbo de data/hora' },
  { key: 'nome', label: 'Qual o seu nome?' },
  { key: 'ra', label: 'Qual seu RA?' },
  { key: 'curso', label: 'Qual seu técnico? ' },
  { key: 'ano', label: 'Qual a seu ano?' },
  { key: 'objetivo', label: '1-Qual é o seu objetivo principal logo após concluir o ensino técnico?' },
  { key: 'mesma_area', label: '2- Você pretende atuar profissionalmente na mesma área do seu curso técnico atual?' },
  { key: 'vestibular', label: '3- Você pretende prestar vestibulares até o final do curso?' },
  { key: 'vestibulares_quais', label: 'Se sim, Quais vestibulares pretende prestar?' },
  { key: 'fator_carreira', label: '4- Qual o fator mais importante para você ao escolher sua carreira ou primeiro emprego?' },
  { key: 'preparo_curso', label: '5- Como você avalia o preparo do seu curso técnico para o mercado de trabalho?' },
  { key: 'trabalhar_exterior', label: '6- Você tem interesse em trabalhar para empresas do exterior no futuro?' },
  { key: 'busca_oportunidades', label: '7- Como você costuma buscar oportunidades ou informações sobre a sua área?' },
  { key: 'horas_estudo', label: '8-Quantas horas por semana você dedica a projetos do curso ou estudos fora do horário de aula?' },
  { key: 'fator_escolha_curso', label: '9-Qual foi o principal fator que determinou a sua escolha por este curso técnico?' },
  { key: 'satisfacao', label: '10- Em geral, qual é o seu nível de satisfação com o curso técnico que você está cursando?' }
];

/**
 * Constrói a URL de conexão para o Redis Cloud
 */
function buildRedisUrl() {
  if (process.env.REDIS_URL && process.env.REDIS_URL.trim() !== '') {
    return process.env.REDIS_URL.trim();
  }

  const host = process.env.REDIS_HOST ? process.env.REDIS_HOST.trim() : '';
  const port = process.env.REDIS_PORT ? process.env.REDIS_PORT.trim() : '';
  const password = process.env.REDIS_PASSWORD ? process.env.REDIS_PASSWORD.trim() : (process.env.REDIS_API_KEY ? process.env.REDIS_API_KEY.trim() : '');
  const username = process.env.REDIS_USERNAME ? process.env.REDIS_USERNAME.trim() : 'default';

  if (!host || !port) {
    return null;
  }

  if (password) {
    return `redis://${username}:${encodeURIComponent(password)}@${host}:${port}`;
  }
  return `redis://${host}:${port}`;
}

/**
 * Inicializa a conexão com o Redis Cloud
 */
async function initRedis() {
  const url = buildRedisUrl();
  if (!url) {
    isRedisConnected = false;
    redisConnectionError = 'Host e Porta do Redis Cloud não configurados no arquivo .env.';
    console.log('[REDIS] ' + redisConnectionError);
    return;
  }

  try {
    if (redisClient) {
      try { await redisClient.disconnect(); } catch (e) {}
    }

    console.log('[REDIS] Tentando conectar ao Redis Cloud...');
    redisClient = createClient({
      url: url,
      socket: {
        connectTimeout: 7000,
        reconnectStrategy: (retries) => {
          if (retries > 3) {
            console.log('[REDIS] Máximo de tentativas de reconexão atingido.');
            return new Error('Falha contínua de conexão');
          }
          return Math.min(retries * 1000, 3000);
        }
      }
    });

    redisClient.on('error', (err) => {
      isRedisConnected = false;
      redisConnectionError = err.message || 'Erro de conexão com Redis Cloud';
      console.error('[REDIS ERROR]', err.message);
    });

    redisClient.on('connect', () => {
      console.log('[REDIS] Socket conectado ao servidor.');
    });

    redisClient.on('ready', () => {
      isRedisConnected = true;
      redisConnectionError = null;
      console.log('[REDIS READY] Conexão com Redis Cloud estabelecida com sucesso!');
    });

    redisClient.on('end', () => {
      isRedisConnected = false;
      console.log('[REDIS END] Conexão encerrada.');
    });

    await redisClient.connect();

    // Testa Ping inicial
    const startPing = Date.now();
    const pong = await redisClient.ping();
    lastPingLatency = Date.now() - startPing;
    console.log(`[REDIS PING] Resposta: ${pong} (${lastPingLatency}ms)`);
    isRedisConnected = true;
    redisConnectionError = null;
  } catch (err) {
    isRedisConnected = false;
    redisConnectionError = err.message || 'Falha ao conectar ao Redis Cloud';
    console.error('[REDIS INIT FAILED]', redisConnectionError);
  }
}

/**
 * Parser simples e robusto de CSV para extrair respostas
 */
function parseCsvContent(text) {
  const lines = [];
  let row = [];
  let inQuotes = false;
  let currentToken = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentToken += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentToken.trim());
      currentToken = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentToken.trim());
      currentToken = '';
      if (row.some(cell => cell.length > 0)) {
        lines.push(row);
      }
      row = [];
    } else {
      currentToken += char;
    }
  }

  if (currentToken.length > 0 || row.length > 0) {
    row.push(currentToken.trim());
    if (row.some(cell => cell.length > 0)) {
      lines.push(row);
    }
  }

  if (lines.length < 2) return [];

  const headers = lines[0];
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    const record = {
      timestamp: values[0] || '',
      nome: values[1] || '',
      ra: values[2] || '',
      curso: values[3] || '',
      ano: values[4] || '',
      objetivo: values[5] || '',
      mesma_area: values[6] || '',
      vestibular: values[7] || '',
      vestibulares_quais: values[8] || '',
      fator_carreira: values[9] || '',
      preparo_curso: values[10] || '',
      trabalhar_exterior: values[11] || '',
      busca_oportunidades: values[12] || '',
      horas_estudo: values[13] || '',
      fator_escolha_curso: values[14] || '',
      satisfacao: values[15] || ''
    };
    records.push(record);
  }

  return records;
}

/**
 * Gera um ID único e determinístico para cada resposta para evitar duplicidade
 */
function generateRecordId(record) {
  const uniqueString = `${record.timestamp || ''}_${record.ra || ''}_${record.nome || ''}`;
  return crypto.createHash('sha256').update(uniqueString).digest('hex').substring(0, 16);
}

// ==============================================================================
// ROTAS DA API
// ==============================================================================

/**
 * 1. GET /api/status - Retorna o estado real da conexão com o Redis Cloud
 */
app.get('/api/status', async (req, res) => {
  let dbsize = 0;
  let currentLatency = null;
  let actualConnected = false;

  if (redisClient && redisClient.isOpen) {
    try {
      const start = Date.now();
      const pong = await redisClient.ping();
      currentLatency = Date.now() - start;
      lastPingLatency = currentLatency;
      dbsize = await redisClient.dbSize();
      actualConnected = (pong === 'PONG');
      isRedisConnected = actualConnected;
      redisConnectionError = null;
    } catch (err) {
      actualConnected = false;
      isRedisConnected = false;
      redisConnectionError = err.message;
    }
  }

  const rawHost = process.env.REDIS_HOST || '';
  const maskedHost = rawHost ? rawHost.replace(/^(...).*(...:[0-9]+)$/, '$1***$2') : 'Não configurado';
  const hasApiKey = Boolean(process.env.REDIS_API_KEY || process.env.REDIS_PASSWORD);

  // Consulta total de respostas sincronizadas no Redis se conectado
  let totalSyncedInRedis = 0;
  if (actualConnected) {
    try {
      totalSyncedInRedis = await redisClient.sCard('form:responses:all_ids');
    } catch (e) {
      totalSyncedInRedis = 0;
    }
  }

  res.json({
    connected: actualConnected,
    statusText: actualConnected ? 'Conectado ao Redis Cloud' : (redisConnectionError || 'Aguardando configuração de Host e Porta no .env'),
    hostConfigured: Boolean(rawHost),
    maskedHost: rawHost ? `${rawHost.substring(0, 8)}...` : 'Nenhum',
    portConfigured: Boolean(process.env.REDIS_PORT),
    apiKeyConfigured: hasApiKey,
    latencyMs: currentLatency,
    dbsize: dbsize,
    totalSyncedResponses: totalSyncedInRedis,
    lastSyncTimestamp: lastSyncTimestamp,
    officialRedisCloudUrl: 'https://cloud.redis.io/',
    googleSheetConfigured: Boolean(process.env.GOOGLE_SHEET_CSV_URL && process.env.GOOGLE_SHEET_CSV_URL.trim() !== '')
  });
});

/**
 * 2. POST /api/redis/reconnect - Força tentativa de reconexão
 */
app.post('/api/redis/reconnect', async (req, res) => {
  await initRedis();
  res.json({
    connected: isRedisConnected,
    error: redisConnectionError,
    latencyMs: lastPingLatency
  });
});

/**
 * 3. GET /api/respostas - Consulta as respostas armazenadas no Redis Cloud
 */
app.get('/api/respostas', async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = (req.query.search || '').toLowerCase().trim();
  const cursoFilter = (req.query.curso || 'todos').toLowerCase().trim();

  // Se o Redis Cloud estiver conectado, busca os dados reais armazenados nele
  if (isRedisConnected && redisClient && redisClient.isOpen) {
    try {
      // 1. Prioridade: busca chaves no formato Hash "pesquisa:*" (pesquisa:1 a pesquisa:72)
      let pesquisaKeys = await redisClient.keys('pesquisa:*');
      let records = [];

      if (pesquisaKeys && pesquisaKeys.length > 0) {
        pesquisaKeys.sort((a, b) => (parseInt(a.split(':')[1]) || 0) - (parseInt(b.split(':')[1]) || 0));
        records = await Promise.all(
          pesquisaKeys.map(async (k) => {
            const hash = await redisClient.hGetAll(k);
            return {
              id: k,
              timestamp: hash.timestamp || hash['Carimbo de data/hora'] || '',
              nome: hash.nome || hash['Qual o seu nome?'] || '',
              ra: hash.ra || hash['Qual seu RA?'] || '',
              curso: hash.curso || hash['Qual seu técnico? '] || hash['Qual seu técnico?'] || '',
              ano: hash.ano || hash['Qual a seu ano?'] || '',
              objetivo: hash.objetivo || hash['1-Qual é o seu objetivo principal logo após concluir o ensino técnico?'] || '',
              mesma_area: hash.mesma_area || hash['2- Você pretende atuar profissionalmente na mesma área do seu curso técnico atual?'] || '',
              vestibular: hash.vestibular || hash['3- Você pretende prestar vestibulares até o final do curso?'] || '',
              vestibulares_quais: hash.vestibulares_quais || hash['Se sim, Quais vestibulares pretende prestar?'] || '',
              fator_carreira: hash.fator_carreira || hash['4- Qual o fator mais importante para você ao escolher sua carreira ou primeiro emprego?'] || '',
              preparo_curso: hash.preparo_curso || hash['5- Como você avalia o preparo do seu curso técnico para o mercado de trabalho?'] || '',
              trabalhar_exterior: hash.trabalhar_exterior || hash['6- Você tem interesse em trabalhar para empresas do exterior no futuro?'] || '',
              busca_oportunidades: hash.busca_oportunidades || hash['7- Como você costuma buscar oportunidades ou informações sobre a sua área?'] || '',
              horas_estudo: hash.horas_estudo || hash['8-Quantas horas por semana você dedica a projetos do curso ou estudos fora do horário de aula?'] || '',
              fator_escolha_curso: hash.fator_escolha_curso || hash['9-Qual foi o principal fator que determinou a sua escolha por este curso técnico?'] || '',
              satisfacao: hash.satisfacao || hash['10- Em geral, qual é o seu nível de satisfação com o curso técnico que você está cursando?'] || '',
              ...hash
            };
          })
        );
      } else {
        // Fallback: chaves em formato JSON form:response:*
        const ids = await redisClient.sMembers('form:responses:all_ids');
        if (ids && ids.length > 0) {
          const keys = ids.map(id => `form:response:${id}`);
          const jsonStrings = await redisClient.mGet(keys);
          records = jsonStrings
            .filter(Boolean)
            .map(str => {
              try { return JSON.parse(str); } catch (e) { return null; }
            })
            .filter(Boolean);
        }
      }

      // Ordena pelas mais recentes
      records.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // Filtros
      let filtered = records;
      if (cursoFilter !== 'todos') {
        filtered = filtered.filter(r => (r.curso || '').toLowerCase().includes(cursoFilter));
      }
      if (search) {
        filtered = filtered.filter(r =>
          (r.nome || '').toLowerCase().includes(search) ||
          (r.ra || '').toLowerCase().includes(search) ||
          (r.curso || '').toLowerCase().includes(search) ||
          (r.objetivo || '').toLowerCase().includes(search)
        );
      }

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginatedRecords = filtered.slice(startIndex, startIndex + limit);

      return res.json({
        source: 'redis-cloud',
        connected: true,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
        lastSyncTimestamp,
        records: paginatedRecords
      });
    } catch (err) {
      console.error('[ERRO AO BUSCAR NO REDIS]', err);
    }
  }

  // Se o Redis não estiver conectado, informa explicitamente sem fingir conexão
  // Permitimos fallback apenas se solicitado para que o usuário consiga ver a estrutura
  const allowFallback = req.query.fallback === 'true' || req.query.preview === 'true';

  if (!allowFallback) {
    return res.status(503).json({
      source: 'none',
      connected: false,
      error: 'Redis Cloud desconectado. Conecte o banco de dados ou sincronize as respostas.',
      records: [],
      total: 0,
      page: 1,
      totalPages: 1
    });
  }

  // Fallback didático: lê os dados da pesquisa local arquivada
  try {
    const csvPath = path.join(__dirname, 'PLANEJAMENETO DO FUTURO E CARREIRA.csv');
    if (fs.existsSync(csvPath)) {
      const csvRaw = fs.readFileSync(csvPath, 'utf-8');
      let records = parseCsvContent(csvRaw);

      if (cursoFilter !== 'todos') {
        filtered = records.filter(r => (r.curso || '').toLowerCase().includes(cursoFilter));
      } else {
        filtered = records;
      }
      if (search) {
        filtered = filtered.filter(r =>
          (r.nome || '').toLowerCase().includes(search) ||
          (r.ra || '').toLowerCase().includes(search) ||
          (r.curso || '').toLowerCase().includes(search)
        );
      }

      const total = filtered.length;
      const startIndex = (page - 1) * limit;
      const paginated = filtered.slice(startIndex, startIndex + limit);

      return res.json({
        source: 'local-file-preview',
        connected: false,
        warning: 'Exibindo arquivo local (Redis Cloud não conectado no momento).',
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
        limit,
        records: paginated
      });
    }
  } catch (err) {
    return res.status(500).json({ error: 'Erro ao ler arquivo local: ' + err.message });
  }

  res.status(503).json({
    source: 'none',
    connected: false,
    error: 'Redis Cloud desconectado.',
    records: []
  });
});

/**
 * 4. POST /api/sync - Sincroniza respostas reais com o Redis Cloud (evita duplicatas)
 */
app.post('/api/sync', async (req, res) => {
  if (!isRedisConnected || !redisClient || !redisClient.isOpen) {
    return res.status(503).json({
      success: false,
      error: 'O Redis Cloud não está conectado. Configure o REDIS_HOST e REDIS_PORT no arquivo .env para que o backend envie os dados ao banco.',
      details: redisConnectionError
    });
  }

  try {
    let recordsToSync = [];
    let sourceDescription = '';

    // Prioridade 1: Planilha do Google Sheets publicada em CSV via URL no .env
    const sheetUrl = process.env.GOOGLE_SHEET_CSV_URL ? process.env.GOOGLE_SHEET_CSV_URL.trim() : '';

    if (sheetUrl && sheetUrl.startsWith('http')) {
      sourceDescription = 'Google Sheets (Live CSV)';
      console.log(`[SYNC] Fazendo download da planilha Google Sheets em: ${sheetUrl}`);
      const response = await fetch(sheetUrl);
      if (!response.ok) {
        throw new Error(`Falha ao acessar Google Sheets (${response.status}: ${response.statusText})`);
      }
      const csvText = await response.text();
      recordsToSync = parseCsvContent(csvText);
    } else {
      // Prioridade 2: Respostas reais do arquivo de pesquisa do Google Forms arquivado no projeto
      sourceDescription = 'Arquivo do Google Forms (PLANEJAMENETO DO FUTURO E CARREIRA.csv)';
      const csvPath = path.join(__dirname, 'PLANEJAMENETO DO FUTURO E CARREIRA.csv');
      if (fs.existsSync(csvPath)) {
        const csvRaw = fs.readFileSync(csvPath, 'utf-8');
        recordsToSync = parseCsvContent(csvRaw);
      } else {
        throw new Error('Nenhuma fonte de dados configurada e arquivo CSV não encontrado.');
      }
    }

    if (!recordsToSync || recordsToSync.length === 0) {
      return res.json({
        success: true,
        message: 'Nenhum registro encontrado para sincronizar.',
        syncedCount: 0,
        alreadyExistingCount: 0
      });
    }

    let addedCount = 0;
    let existingCount = 0;

    // Processamento e envio para o Redis Cloud com deduplicação
    for (const record of recordsToSync) {
      const recordId = generateRecordId(record);
      record.id = recordId;

      const redisKey = `form:response:${recordId}`;

      // Verifica se a chave já existe no Redis Cloud
      const exists = await redisClient.exists(redisKey);

      if (exists) {
        existingCount++;
      } else {
        // Salva a resposta no Redis como string JSON
        await redisClient.set(redisKey, JSON.stringify(record));

        // Adiciona ao Set de todos os IDs para queries eficientes
        await redisClient.sAdd('form:responses:all_ids', recordId);

        // Cria também a chave no padrão user:<RA>:carreira para integração com o simulador
        if (record.ra) {
          const userKey = `user:${record.ra}:carreira`;
          await redisClient.set(userKey, JSON.stringify(record));
        }

        addedCount++;
      }
    }

    lastSyncTimestamp = new Date().toISOString();
    await redisClient.set('metrics:last_sync_timestamp', lastSyncTimestamp);
    await redisClient.set('metrics:total_synced_responses', (await redisClient.sCard('form:responses:all_ids')).toString());

    console.log(`[SYNC SUCESSO] Fonte: ${sourceDescription}. Novos: ${addedCount}, Já existentes: ${existingCount}`);

    return res.json({
      success: true,
      message: `Sincronização realizada com sucesso via ${sourceDescription}!`,
      source: sourceDescription,
      syncedCount: addedCount,
      alreadyExistingCount: existingCount,
      totalInDatabase: await redisClient.sCard('form:responses:all_ids'),
      timestamp: lastSyncTimestamp
    });

  } catch (err) {
    console.error('[SYNC ERRO]', err);
    return res.status(500).json({
      success: false,
      error: 'Falha durante a sincronização: ' + err.message
    });
  }
});

/**
 * 5. POST /api/webhook/google-forms - Webhook para Google Apps Script receber novas respostas em tempo real
 */
app.post('/api/webhook/google-forms', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  const expectedSecret = process.env.WEBHOOK_SECRET || 'fecap-bigdata-secret-2026';

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Não autorizado: token do webhook inválido.' });
  }

  const record = req.body;
  if (!record || (!record.timestamp && !record.ra)) {
    return res.status(400).json({ error: 'Payload de resposta inválido.' });
  }

  if (!isRedisConnected || !redisClient || !redisClient.isOpen) {
    return res.status(503).json({ error: 'Redis Cloud desconectado no servidor.' });
  }

  try {
    const recordId = generateRecordId(record);
    record.id = recordId;
    const redisKey = `form:response:${recordId}`;

    const exists = await redisClient.exists(redisKey);
    await redisClient.set(redisKey, JSON.stringify(record));
    await redisClient.sAdd('form:responses:all_ids', recordId);

    if (record.ra) {
      await redisClient.set(`user:${record.ra}:carreira`, JSON.stringify(record));
    }

    lastSyncTimestamp = new Date().toISOString();
    await redisClient.set('metrics:last_sync_timestamp', lastSyncTimestamp);

    res.json({
      success: true,
      recordId,
      isNew: !exists,
      message: exists ? 'Registro atualizado no Redis Cloud.' : 'Nova resposta gravada no Redis Cloud com sucesso!'
    });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao gravar no Redis: ' + err.message });
  }
});

/**
 * 6. POST /api/sync/batch - Sincronização em lote via Google Apps Script
 */
app.post('/api/sync/batch', async (req, res) => {
  const secret = req.headers['x-webhook-secret'];
  const expectedSecret = process.env.WEBHOOK_SECRET || 'fecap-bigdata-secret-2026';

  if (secret !== expectedSecret) {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const records = req.body.records;
  if (!Array.isArray(records)) {
    return res.status(400).json({ error: 'Campo records deve ser uma lista.' });
  }

  if (!isRedisConnected || !redisClient || !redisClient.isOpen) {
    return res.status(503).json({ error: 'Redis Cloud desconectado.' });
  }

  try {
    let added = 0;
    let existing = 0;

    for (const record of records) {
      const recordId = generateRecordId(record);
      record.id = recordId;
      const redisKey = `form:response:${recordId}`;

      const exists = await redisClient.exists(redisKey);
      if (exists) {
        existing++;
      } else {
        added++;
      }

      await redisClient.set(redisKey, JSON.stringify(record));
      await redisClient.sAdd('form:responses:all_ids', recordId);

      if (record.ra) {
        await redisClient.set(`user:${record.ra}:carreira`, JSON.stringify(record));
      }
    }

    lastSyncTimestamp = new Date().toISOString();
    await redisClient.set('metrics:last_sync_timestamp', lastSyncTimestamp);

    res.json({
      success: true,
      added,
      existing,
      total: await redisClient.sCard('form:responses:all_ids')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Inicialização do Servidor
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor FECAP NoSQL & Redis Cloud rodando na porta ${PORT}`);
  console.log(`👉 Acesse a aplicação em: http://localhost:${PORT}`);
  console.log(`👉 Link oficial Redis Cloud: https://cloud.redis.io/`);
  console.log(`=======================================================`);

  // Conectar ao Redis
  await initRedis();
});
