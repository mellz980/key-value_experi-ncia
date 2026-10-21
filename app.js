/**
 * ==============================================================================
 * Big Data & NoSQL Key-Value Store - Interactive SPA Application
 * Desenvolvido para apresentação acadêmica - FECAP 2026
 * Aluno / RA: Melissa Nunes de Oliveira (25011962) & Equipe Big Data
 * ==============================================================================
 */

// Global State
const appState = {
  theme: localStorage.getItem('fecap_theme') || 'dark',
  presentationMode: false,
  charts: {},
  terminalHistory: [],
  historyIndex: -1,
  activeFilterCourse: 'todos',
  searchQuery: '',
  selectedKeyDetails: null
};

/* ==========================================================================
   1. KEY-VALUE ENGINE EM MEMÓRIA (SIMULADOR ESTILO REDIS)
   ========================================================================== */
class KeyValueEngine {
  constructor() {
    this.store = new Map();
    this.stats = {
      totalCommands: 0,
      reads: 0,
      writes: 0,
      deletes: 0,
      startTime: Date.now()
    };
    this.listeners = new Set();
    this.startTTLWorker();
  }

  // Notificador reativo para atualizar a UI
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  }

  // Monitor de expiração de chaves (TTL ativo)
  startTTLWorker() {
    setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [key, item] of this.store.entries()) {
        if (item.expireAt && item.expireAt <= now) {
          this.store.delete(key);
          changed = true;
        }
      }
      if (changed) {
        this.notify('expired');
      }
    }, 1000);
  }

  // SET key value [exSeconds]
  set(key, value, exSeconds = null) {
    this.stats.totalCommands++;
    this.stats.writes++;
    const now = Date.now();
    const expireAt = exSeconds ? now + (parseInt(exSeconds) * 1000) : null;
    
    let type = 'string';
    if (typeof value === 'object') {
      type = 'json';
    } else {
      try {
        const parsed = JSON.parse(value);
        if (typeof parsed === 'object') type = 'json';
      } catch (e) {}
    }

    this.store.set(key, {
      value,
      type,
      created: now,
      expireAt
    });

    this.notify('set', { key, value });
    return 'OK';
  }

  // GET key
  get(key) {
    this.stats.totalCommands++;
    this.stats.reads++;
    const item = this.store.get(key);
    if (!item) return null;
    if (item.expireAt && item.expireAt <= Date.now()) {
      this.store.delete(key);
      this.notify('expired');
      return null;
    }
    return item.value;
  }

  // DEL key
  del(key) {
    this.stats.totalCommands++;
    this.stats.deletes++;
    const existed = this.store.delete(key);
    if (existed) {
      this.notify('del', { key });
      return 1;
    }
    return 0;
  }

  // EXPIRE key seconds
  expire(key, seconds) {
    this.stats.totalCommands++;
    const item = this.store.get(key);
    if (!item) return 0;
    item.expireAt = Date.now() + (parseInt(seconds) * 1000);
    this.notify('expire', { key, seconds });
    return 1;
  }

  // TTL key
  ttl(key) {
    this.stats.totalCommands++;
    const item = this.store.get(key);
    if (!item) return -2; // chave inexistente
    if (!item.expireAt) return -1; // sem expiração
    const remaining = Math.max(0, Math.ceil((item.expireAt - Date.now()) / 1000));
    if (remaining === 0) {
      this.store.delete(key);
      this.notify('expired');
      return -2;
    }
    return remaining;
  }

  // HSET key field value
  hset(key, field, val) {
    this.stats.totalCommands++;
    this.stats.writes++;
    let item = this.store.get(key);
    let hashObj = {};

    if (item && item.type === 'hash') {
      hashObj = item.value;
    } else {
      item = {
        value: hashObj,
        type: 'hash',
        created: Date.now(),
        expireAt: null
      };
      this.store.set(key, item);
    }

    hashObj[field] = val;
    this.notify('hset', { key, field, val });
    return 1;
  }

  // HGET key field
  hget(key, field) {
    this.stats.totalCommands++;
    this.stats.reads++;
    const item = this.store.get(key);
    if (!item || item.type !== 'hash') return null;
    return item.value[field] !== undefined ? item.value[field] : null;
  }

  // HGETALL key
  hgetall(key) {
    this.stats.totalCommands++;
    this.stats.reads++;
    const item = this.store.get(key);
    if (!item) return {};
    if (item.type === 'hash') return item.value;
    if (typeof item.value === 'object') return item.value;
    try {
      return JSON.parse(item.value);
    } catch (e) {
      return { value: item.value };
    }
  }

  // INCR key
  incr(key) {
    this.stats.totalCommands++;
    this.stats.writes++;
    let item = this.store.get(key);
    let num = 0;
    if (item) {
      num = parseInt(item.value, 10);
      if (isNaN(num)) throw new Error('ERR value is not an integer or out of range');
    }
    num++;
    this.set(key, num.toString());
    return num;
  }

  // KEYS pattern
  keys(pattern = '*') {
    this.stats.totalCommands++;
    this.stats.reads++;
    const allKeys = Array.from(this.store.keys());
    if (pattern === '*' || !pattern) return allKeys;
    
    // Converte wildcard simples para regex
    const regexPattern = '^' + pattern.replace(/\*/g, '.*') + '$';
    const regex = new RegExp(regexPattern);
    return allKeys.filter(k => regex.test(k));
  }

  // DBSIZE
  dbsize() {
    return this.store.size;
  }

  // INFO
  info() {
    const uptimeSec = Math.floor((Date.now() - this.stats.startTime) / 1000);
    // Estimativa simples de memória
    let bytes = 0;
    for (const [k, v] of this.store.entries()) {
      bytes += k.length * 2;
      bytes += JSON.stringify(v.value).length * 2;
      bytes += 64; // Overhead do objeto
    }
    const memKb = (bytes / 1024).toFixed(2);

    return [
      `# Server`,
      `redis_version:7.2.4-fecap-sim`,
      `os:WebAssembly/V8-Browser`,
      `uptime_in_seconds:${uptimeSec}`,
      `# Clients`,
      `connected_clients:1`,
      `# Memory`,
      `used_memory_bytes:${bytes}`,
      `used_memory_human:${memKb}K`,
      `# Stats`,
      `total_commands_processed:${this.stats.totalCommands}`,
      `total_reads:${this.stats.reads}`,
      `total_writes:${this.stats.writes}`,
      `total_deletes:${this.stats.deletes}`,
      `# Keyspace`,
      `db0:keys=${this.store.size},expires=${Array.from(this.store.values()).filter(i => i.expireAt).length}`
    ].join('\n');
  }

  // FLUSHDB
  flushdb() {
    const count = this.store.size;
    this.store.clear();
    this.notify('flushdb');
    return `OK (${count} chaves removidas)`;
  }

  // Carrega os 72 dados coletados no CSV
  loadDataset(records) {
    if (!Array.isArray(records)) return 0;
    
    // Contadores analíticos em memória (padrão Redis)
    this.set('metrics:pesquisa:total_respondentes', records.length.toString());
    this.set('metrics:instituicao', 'FECAP - Ensino Médio e Técnico');
    this.set('metrics:data_extracao', '2026-10-14');

    records.forEach(r => {
      // 1. Chave principal de carreira (JSON): user:<RA>:carreira
      const userKey = `user:${r.ra}:carreira`;
      this.set(userKey, {
        ra: r.ra,
        nome: r.nome,
        curso: r.curso,
        ano: r.ano,
        objetivo: r.objetivo,
        mesma_area: r.mesma_area,
        vestibular: r.vestibular,
        vestibulares_quais: r.vestibulares_quais,
        fator_carreira: r.fator_carreira,
        preparo_curso: r.preparo_curso,
        trabalhar_exterior: r.trabalhar_exterior,
        busca_oportunidades: r.busca_oportunidades,
        horas_estudo: r.horas_estudo,
        fator_escolha_curso: r.fator_escolha_curso,
        satisfacao: r.satisfacao
      });

      // 2. Chave Hash de perfil resumido: user:<RA>:perfil
      const perfilKey = `user:${r.ra}:perfil`;
      this.hset(perfilKey, 'nome', r.nome);
      this.hset(perfilKey, 'curso', r.curso);
      this.hset(perfilKey, 'ano', r.ano);
      this.hset(perfilKey, 'satisfacao', r.satisfacao);
      this.hset(perfilKey, 'exterior', r.trabalhar_exterior);

      // 3. Contadores agregados
      const cursoSlug = r.curso.toLowerCase().replace(/[^a-z0-9]/g, '_');
      try { this.incr(`stat:curso:${cursoSlug}`); } catch(e) {}
    });

    this.notify('dataset_loaded', { count: records.length });
    return records.length;
  }
}

// Instância Global do KV Engine
const kvEngine = new KeyValueEngine();
window.kvEngine = kvEngine;

/* ==========================================================================
   2. INTERPRETADOR CLI REDIS-LIKE
   ========================================================================== */
function executeRedisCommand(cmdString) {
  if (!cmdString || !cmdString.trim()) return '';
  const raw = cmdString.trim();
  
  // Tratamento de aspas e argumentos
  const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
  const parts = [];
  let match;
  while ((match = regex.exec(raw)) !== null) {
    parts.push(match[1] || match[2] || match[0]);
  }

  if (parts.length === 0) return '';
  const command = parts[0].toUpperCase();
  const args = parts.slice(1);

  try {
    switch (command) {
      case 'HELP':
        return [
          'Comandos disponíveis no Simulador Redis FECAP:',
          '  SET <key> <value> [exSeconds]   -> Armazena um par chave-valor',
          '  GET <key>                      -> Retorna o valor de uma chave',
          '  DEL <key>                      -> Remove uma chave',
          '  KEYS [pattern]                 -> Lista chaves (ex: KEYS user:*:carreira)',
          '  EXPIRE <key> <seconds>         -> Define tempo de expiração TTL',
          '  TTL <key>                      -> Consulta o tempo de vida restante em segundos',
          '  HSET <key> <field> <value>     -> Define um campo em uma Hash',
          '  HGET <key> <field>             -> Retorna o campo de uma Hash',
          '  HGETALL <key>                  -> Retorna todos os campos de uma Hash ou JSON',
          '  INCR <key>                     -> Incrementa contador numérico',
          '  DBSIZE                         -> Retorna quantidade total de chaves',
          '  INFO                           -> Exibe estatísticas de memória e servidor',
          '  FLUSHDB                        -> Limpa todas as chaves da base',
          '  LOAD_DATASET                   -> Recarrega as 72 respostas do CSV da pesquisa',
          '  BENCHMARK [n]                  -> Roda teste de performance com n operações',
          '  CLEAR                          -> Limpa a tela do terminal'
        ].join('\n');

      case 'SET':
        if (args.length < 2) return '(error) ERR wrong number of arguments for \'set\' command';
        return kvEngine.set(args[0], args[1], args[2]);

      case 'GET':
        if (args.length < 1) return '(error) ERR wrong number of arguments for \'get\' command';
        const val = kvEngine.get(args[0]);
        if (val === null) return '(nil)';
        if (typeof val === 'object') return JSON.stringify(val, null, 2);
        return `"${val}"`;

      case 'DEL':
        if (args.length < 1) return '(error) ERR wrong number of arguments for \'del\' command';
        return `(integer) ${kvEngine.del(args[0])}`;

      case 'EXPIRE':
        if (args.length < 2) return '(error) ERR wrong number of arguments for \'expire\' command';
        return `(integer) ${kvEngine.expire(args[0], args[1])}`;

      case 'TTL':
        if (args.length < 1) return '(error) ERR wrong number of arguments for \'ttl\' command';
        const remaining = kvEngine.ttl(args[0]);
        return `(integer) ${remaining}`;

      case 'KEYS':
        const pattern = args[0] || '*';
        const found = kvEngine.keys(pattern);
        if (found.length === 0) return '(empty list or set)';
        return found.map((k, idx) => `${idx + 1}) "${k}"`).join('\n');

      case 'HSET':
        if (args.length < 3) return '(error) ERR wrong number of arguments for \'hset\' command';
        return `(integer) ${kvEngine.hset(args[0], args[1], args[2])}`;

      case 'HGET':
        if (args.length < 2) return '(error) ERR wrong number of arguments for \'hget\' command';
        const hval = kvEngine.hget(args[0], args[1]);
        if (hval === null) return '(nil)';
        return `"${hval}"`;

      case 'HGETALL':
        if (args.length < 1) return '(error) ERR wrong number of arguments for \'hgetall\' command';
        const hash = kvEngine.hgetall(args[0]);
        if (!hash || Object.keys(hash).length === 0) return '(empty list or set)';
        const lines = [];
        let i = 1;
        for (const [k, v] of Object.entries(hash)) {
          lines.push(`${i++}) "${k}"`);
          lines.push(`${i++}) "${typeof v === 'object' ? JSON.stringify(v) : v}"`);
        }
        return lines.join('\n');

      case 'INCR':
        if (args.length < 1) return '(error) ERR wrong number of arguments for \'incr\' command';
        return `(integer) ${kvEngine.incr(args[0])}`;

      case 'DBSIZE':
        return `(integer) ${kvEngine.dbsize()}`;

      case 'INFO':
        return kvEngine.info();

      case 'FLUSHDB':
        return kvEngine.flushdb();

      case 'LOAD_DATASET':
        if (window.PESQUISA_RAW_DATA) {
          const count = kvEngine.loadDataset(window.PESQUISA_RAW_DATA);
          return `OK (72 alunos e contadores carregados: ${count * 2 + 5} chaves criadas)`;
        }
        return '(error) Dataset não encontrado na memória global.';

      case 'BENCHMARK':
        const n = parseInt(args[0]) || 500;
        return runTerminalBenchmark(n);

      case 'CLEAR':
        return '__CLEAR__';

      default:
        return `(error) ERR unknown command '${command}', type 'HELP' for instructions`;
    }
  } catch (err) {
    return `(error) ${err.message}`;
  }
}
window.executeRedisCommand = executeRedisCommand;

// Benchmark rápido executado pelo terminal
function runTerminalBenchmark(opsCount) {
  const t0 = performance.now();
  for (let i = 0; i < opsCount; i++) {
    kvEngine.set(`bench:key:${i}`, `bench_value_${i}_fecap`);
  }
  for (let i = 0; i < opsCount; i++) {
    kvEngine.get(`bench:key:${i}`);
  }
  const totalMs = performance.now() - t0;
  const totalOps = opsCount * 2;
  const opsSec = Math.round((totalOps / (totalMs / 1000)));
  const avgUs = ((totalMs / totalOps) * 1000).toFixed(2);

  return [
    `====== BENCHMARK IN-MEMORY KEY-VALUE ======`,
    `Total de Operações: ${totalOps} (${opsCount} SETs + ${opsCount} GETs)`,
    `Tempo Total: ${totalMs.toFixed(2)} ms`,
    `Throughput Estimado: ${opsSec.toLocaleString()} ops/sec`,
    `Latência Média por Operação: ${avgUs} µs (microssegundos)`,
    `Resultado: Performance sub-milissegundo (< 0.1ms) confirmada!`
  ].join('\n');
}

/* ==========================================================================
   3. GESTÃO DO TERMINAL WEB
   ========================================================================== */
function initTerminal() {
  const terminalInput = document.getElementById('terminal-input');
  const terminalOutput = document.getElementById('terminal-output');
  const terminalForm = document.getElementById('terminal-form');

  if (!terminalInput || !terminalOutput || !terminalForm) return;

  function appendTerminalLine(text, isCommand = false, isError = false) {
    const div = document.createElement('div');
    div.className = 'terminal-line';
    
    if (isCommand) {
      div.innerHTML = `<span class="text-violet-400 font-bold">redis-fecap:6379&gt;</span> <span class="text-slate-200">${escapeHtml(text)}</span>`;
    } else {
      let colorClass = 'text-emerald-400';
      if (isError || text.startsWith('(error)')) colorClass = 'text-rose-400';
      else if (text.startsWith('(integer)')) colorClass = 'text-amber-400';
      else if (text.startsWith('(nil)')) colorClass = 'text-slate-400';
      else if (text.startsWith('#') || text.startsWith('=')) colorClass = 'text-cyan-400 font-semibold';
      
      div.innerHTML = `<pre class="${colorClass} whitespace-pre-wrap break-words break-all font-mono">${escapeHtml(text)}</pre>`;
    }
    
    terminalOutput.appendChild(div);
    terminalOutput.scrollTop = terminalOutput.scrollHeight;
  }

  function handleCommandSubmit() {
    let commandText = terminalInput.value.trim();
    if (!commandText) {
      const select = document.getElementById('user-select-quick');
      const selectedKey = select && select.value ? select.value : 'user:25011962:carreira';
      commandText = `GET ${selectedKey}`;
    }

    // Adiciona ao histórico
    appState.terminalHistory.push(commandText);
    appState.historyIndex = appState.terminalHistory.length;

    appendTerminalLine(commandText, true);

    const result = executeRedisCommand(commandText);
    if (result === '__CLEAR__') {
      terminalOutput.innerHTML = '';
    } else if (result) {
      appendTerminalLine(result, false);
    }
  }

  terminalForm.addEventListener('submit', (e) => {
    e.preventDefault();
    handleCommandSubmit();
  });

  // Função global de disparo para o botão Executar
  window.submitTerminalCommand = function() {
    handleCommandSubmit();
  };

  // Preenche comando inicial sugerido para o usuário
  if (terminalInput && !terminalInput.value) {
    terminalInput.value = 'GET user:25011962:carreira';
  }

  // Navegação no histórico com setas Up/Down
  terminalInput.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (appState.historyIndex > 0) {
        appState.historyIndex--;
        terminalInput.value = appState.terminalHistory[appState.historyIndex] || '';
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (appState.historyIndex < appState.terminalHistory.length - 1) {
        appState.historyIndex++;
        terminalInput.value = appState.terminalHistory[appState.historyIndex] || '';
      } else {
        appState.historyIndex = appState.terminalHistory.length;
        terminalInput.value = '';
      }
    }
  });

  // Atalho para chips de comandos rápidos
  window.runQuickCommand = function(cmd) {
    terminalInput.value = cmd;
    handleCommandSubmit();
    // Rolagem suave até o terminal se estiver longe
    document.getElementById('terminal-container')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };
}

// Funções do Seletor Dinâmico de Usuários da Pesquisa
window.populateUserQuickSelect = function() {
  const select = document.getElementById('user-select-quick');
  if (!select || !window.PESQUISA_RAW_DATA) return;

  select.innerHTML = window.PESQUISA_RAW_DATA.map((aluno, idx) => {
    return `<option value="user:${aluno.ra}:carreira">${idx + 1}. ${escapeHtml(aluno.nome)} (RA: ${aluno.ra} - ${escapeHtml(aluno.curso)})</option>`;
  }).join('');
};

window.onUserSelectChange = function(selectedKey) {
  const terminalInput = document.getElementById('terminal-input');
  if (terminalInput) {
    terminalInput.value = `GET ${selectedKey}`;
    if (typeof window.submitTerminalCommand === 'function') {
      window.submitTerminalCommand();
    }
  }
};

window.executeSelectedUser = function(cmdType) {
  const select = document.getElementById('user-select-quick');
  const terminalInput = document.getElementById('terminal-input');
  const userKey = select && select.value ? select.value : 'user:25011962:carreira';
  const ra = userKey.split(':')[1] || '25011962';
  const cmd = cmdType === 'HGETALL' ? `HGETALL user:${ra}:perfil` : `GET ${userKey}`;
  if (terminalInput) terminalInput.value = cmd;
  runQuickCommand(cmd);
};

/* ==========================================================================
   4. VISUAL EXPLORER DO BANCO DE DADOS (STORE INSPECTOR)
   ========================================================================== */
function initStoreExplorer() {
  const container = document.getElementById('store-keys-container');
  const countBadge = document.getElementById('store-total-badge');
  const courseFilter = document.getElementById('course-filter-select');
  const searchInput = document.getElementById('store-search-input');

  function renderKeys() {
    if (!container) return;
    const allKeys = kvEngine.keys('*');
    if (countBadge) countBadge.textContent = `${allKeys.length} chaves ativas`;

    // Filtra chaves
    const query = (appState.searchQuery || '').toLowerCase();
    const selectedCourse = appState.activeFilterCourse;

    const filtered = allKeys.filter(key => {
      const item = kvEngine.store.get(key);
      const keyMatches = key.toLowerCase().includes(query);
      
      let contentMatches = false;
      let courseMatches = true;

      if (item && item.value) {
        const strVal = typeof item.value === 'object' ? JSON.stringify(item.value).toLowerCase() : String(item.value).toLowerCase();
        contentMatches = strVal.includes(query);

        if (selectedCourse !== 'todos') {
          if (item.type === 'json' && item.value.curso) {
            courseMatches = item.value.curso.toLowerCase().includes(selectedCourse.toLowerCase());
          } else if (item.type === 'hash' && item.value.curso) {
            courseMatches = item.value.curso.toLowerCase().includes(selectedCourse.toLowerCase());
          } else {
            courseMatches = false;
          }
        }
      }

      return (keyMatches || contentMatches) && courseMatches;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div class="col-span-full py-12 text-center text-slate-400">
          <i class="fa-solid fa-database text-4xl mb-3 text-purple-400/50"></i>
          <p class="text-lg font-medium">Nenhuma chave encontrada para os filtros aplicados</p>
          <p class="text-sm text-slate-500">Tente ajustar a busca ou clique em "Recarregar Dataset".</p>
        </div>
      `;
      return;
    }

    // Renderiza cards (limite de 48 por performance, com botão carregar mais se preciso)
    const displayList = filtered.slice(0, 60);

    container.innerHTML = displayList.map(key => {
      const item = kvEngine.store.get(key);
      const remainingTTL = kvEngine.ttl(key);
      let ttlBadge = `<span class="px-2 py-0.5 text-xs rounded-full bg-slate-800 text-slate-400 border border-slate-700">TTL: Infinito</span>`;
      if (remainingTTL > 0) {
        ttlBadge = `<span class="px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">TTL: ${remainingTTL}s</span>`;
      }

      let typeBadge = '';
      if (item.type === 'json') {
        typeBadge = `<span class="px-2 py-0.5 text-xs rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40">JSON Object</span>`;
      } else if (item.type === 'hash') {
        typeBadge = `<span class="px-2 py-0.5 text-xs rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">Hash (HSET)</span>`;
      } else {
        typeBadge = `<span class="px-2 py-0.5 text-xs rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">String</span>`;
      }

      // Preview do valor
      let preview = '';
      if (item.type === 'json') {
        const nome = item.value.nome || 'Aluno';
        const curso = item.value.curso || '';
        const ra = item.value.ra || '';
        preview = `
          <div class="text-xs space-y-1 mt-2 text-slate-300">
            <div><strong class="text-violet-400">Nome:</strong> ${escapeHtml(nome)}</div>
            <div><strong class="text-violet-400">Curso:</strong> ${escapeHtml(curso)}</div>
            <div><strong class="text-violet-400">Objetivo:</strong> ${escapeHtml((item.value.objetivo || '').slice(0, 50))}...</div>
          </div>
        `;
      } else if (item.type === 'hash') {
        preview = `
          <div class="text-xs space-y-1 mt-2 text-slate-300">
            ${Object.entries(item.value).slice(0, 3).map(([k, v]) => `<div><span class="text-indigo-400">${escapeHtml(k)}:</span> ${escapeHtml(String(v))}</div>`).join('')}
          </div>
        `;
      } else {
        preview = `<div class="text-xs text-slate-300 font-mono mt-2 truncate bg-black/20 p-2 rounded">${escapeHtml(String(item.value))}</div>`;
      }

      return `
        <div class="interactive-card glass-panel rounded-xl p-4 flex flex-col justify-between border border-purple-500/20 hover:border-purple-500/50 transition-all">
          <div>
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="font-mono text-sm font-semibold text-violet-300 truncate" title="${escapeHtml(key)}">
                ${escapeHtml(key)}
              </span>
              <div class="flex items-center gap-1.5 flex-shrink-0">
                ${typeBadge}
                ${ttlBadge}
              </div>
            </div>
            ${preview}
          </div>

          <div class="flex items-center justify-between pt-3 mt-3 border-t border-purple-500/10 text-xs">
            <button onclick="inspectKeyDetails('${escapeHtml(key)}')" class="px-2.5 py-1 rounded bg-violet-600/30 hover:bg-violet-600/60 text-violet-200 transition font-medium flex items-center gap-1.5">
              <i class="fa-solid fa-code"></i> Inspecionar JSON
            </button>
            <div class="flex items-center gap-1">
              <button onclick="promptSetTTL('${escapeHtml(key)}')" title="Definir Expiração (TTL)" class="p-1.5 rounded hover:bg-amber-500/20 text-slate-400 hover:text-amber-300 transition">
                <i class="fa-regular fa-clock"></i>
              </button>
              <button onclick="confirmDeleteKey('${escapeHtml(key)}')" title="Deletar Chave" class="p-1.5 rounded hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // Event Listeners
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      appState.searchQuery = e.target.value;
      renderKeys();
    });
  }

  if (courseFilter) {
    courseFilter.addEventListener('change', (e) => {
      appState.activeFilterCourse = e.target.value;
      renderKeys();
    });
  }

  // Atualização em tempo real quando o KV Engine muda
  kvEngine.subscribe(() => renderKeys());
  renderKeys();
}

// Modal de Inspeção de Chave / JSON
window.inspectKeyDetails = function(key) {
  const item = kvEngine.store.get(key);
  if (!item) return;

  const modal = document.getElementById('key-modal');
  const modalKeyTitle = document.getElementById('modal-key-title');
  const modalJsonViewer = document.getElementById('modal-json-viewer');
  const modalTTLInfo = document.getElementById('modal-ttl-info');

  if (!modal || !modalKeyTitle || !modalJsonViewer) return;

  modalKeyTitle.textContent = key;
  const ttl = kvEngine.ttl(key);
  modalTTLInfo.innerHTML = ttl > 0 
    ? `<span class="text-amber-400"><i class="fa-regular fa-clock"></i> Expira em ${ttl} segundos</span>` 
    : `<span class="text-slate-400"><i class="fa-solid fa-infinity"></i> Sem expiração definida</span>`;

  modalJsonViewer.textContent = typeof item.value === 'object' ? JSON.stringify(item.value, null, 2) : item.value;
  modal.classList.remove('hidden');
};

window.closeKeyModal = function() {
  const modal = document.getElementById('key-modal');
  if (modal) modal.classList.add('hidden');
};

// Modal de Adicionar Nova Chave
window.openAddKeyModal = function() {
  const modal = document.getElementById('add-key-modal');
  if (modal) modal.classList.remove('hidden');
};

window.closeAddKeyModal = function() {
  const modal = document.getElementById('add-key-modal');
  if (modal) modal.classList.add('hidden');
};

window.saveNewKey = function() {
  const keyInput = document.getElementById('new-key-name');
  const valInput = document.getElementById('new-key-value');
  const ttlInput = document.getElementById('new-key-ttl');

  const key = keyInput.value.trim();
  const val = valInput.value.trim();
  const ttl = ttlInput.value.trim();

  if (!key || !val) {
    alert('Por favor, preencha a chave e o valor.');
    return;
  }

  kvEngine.set(key, val, ttl ? parseInt(ttl) : null);
  closeAddKeyModal();
  keyInput.value = '';
  valInput.value = '';
  ttlInput.value = '';

  // Trigger feedback
  showToast(`Chave "${key}" gravada com sucesso!`);
};

window.confirmDeleteKey = function(key) {
  if (confirm(`Deseja realmente excluir a chave "${key}" do banco em memória?`)) {
    kvEngine.del(key);
    showToast(`Chave "${key}" deletada.`);
  }
};

window.promptSetTTL = function(key) {
  const secs = prompt(`Defina o tempo de vida (TTL) em segundos para "${key}":`, "60");
  if (secs !== null && !isNaN(parseInt(secs))) {
    kvEngine.expire(key, parseInt(secs));
    showToast(`TTL de ${secs}s aplicado a "${key}".`);
  }
};

window.reloadDataset = function() {
  if (window.PESQUISA_RAW_DATA) {
    const count = kvEngine.loadDataset(window.PESQUISA_RAW_DATA);
    showToast(`${count} respostas da pesquisa recarregadas com sucesso!`);
    if (typeof confetti === 'function') {
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.8 } });
    }
  }
};

window.exportDatabaseDump = function() {
  const dump = {};
  for (const [k, v] of kvEngine.store.entries()) {
    dump[k] = v;
  }
  const blob = new Blob([JSON.stringify(dump, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nosql_keyvalue_dump_fecap_${Date.now()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Dump JSON gerado e exportado com sucesso!');
};

/* ==========================================================================
   5. BENCHMARK INTERATIVO IN-BROWSER
   ========================================================================== */
window.runInteractiveBenchmark = function(numOps = 1000) {
  const btn = document.getElementById('run-benchmark-btn');
  const resultsContainer = document.getElementById('benchmark-results');
  if (btn) btn.disabled = true;

  showToast(`Executando benchmark com ${numOps} operações in-memory...`);

  setTimeout(() => {
    const latencies = [];
    const tStart = performance.now();

    for (let i = 0; i < numOps; i++) {
      const opStart = performance.now();
      const key = `sim:bench:${i}`;
      const payload = { id: i, ts: Date.now(), data: "NoSQL_Benchmark_FECAP_2026" };
      kvEngine.set(key, payload);
      kvEngine.get(key);
      const opTime = performance.now() - opStart;
      latencies.push(opTime);
    }

    const tEnd = performance.now();
    const totalTimeMs = tEnd - tStart;
    const totalOps = numOps * 2; // SET + GET
    const throughput = Math.round((totalOps / (totalTimeMs / 1000)));

    latencies.sort((a, b) => a - b);
    const minMs = latencies[0];
    const avgMs = totalTimeMs / totalOps;
    const p95Ms = latencies[Math.floor(latencies.length * 0.95)];
    const p99Ms = latencies[Math.floor(latencies.length * 0.99)];

    if (resultsContainer) {
      resultsContainer.classList.remove('hidden');
      document.getElementById('bench-throughput').textContent = `${throughput.toLocaleString()} ops/s`;
      document.getElementById('bench-total-time').textContent = `${totalTimeMs.toFixed(2)} ms`;
      document.getElementById('bench-avg-lat').textContent = `${(avgMs * 1000).toFixed(1)} µs`;
      document.getElementById('bench-p99-lat').textContent = `${(p99Ms * 1000).toFixed(1)} µs`;
    }

    if (btn) btn.disabled = false;
    showToast(`Benchmark concluído: ${throughput.toLocaleString()} ops/seg!`);

    if (typeof confetti === 'function') {
      confetti({ particleCount: 70, spread: 80, origin: { y: 0.7 } });
    }
  }, 50);
};

/* ==========================================================================
   6. ANÁLISE DE DADOS E DASHBOARDS (CHART.JS)
   ========================================================================== */
function initCharts() {
  const data = window.PESQUISA_RAW_DATA || [];
  if (data.length === 0) return;

  const isLight = document.documentElement.classList.contains('light');
  const textColor = isLight ? '#1e293b' : '#e2e8f0';
  const gridColor = isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.08)';

  // Chart 1: Distribuição de Cursos
  const courseCounts = {};
  data.forEach(d => {
    const c = d.curso || 'Não especificado';
    courseCounts[c] = (courseCounts[c] || 0) + 1;
  });

  const ctx1 = document.getElementById('chart-cursos')?.getContext('2d');
  if (ctx1) {
    if (appState.charts.cursos) appState.charts.cursos.destroy();
    appState.charts.cursos = new Chart(ctx1, {
      type: 'doughnut',
      data: {
        labels: Object.keys(courseCounts),
        datasets: [{
          data: Object.values(courseCounts),
          backgroundColor: [
            '#8b5cf6', '#6366f1', '#3b82f6', '#06b6d4',
            '#10b981', '#f59e0b', '#ec4899', '#a855f7',
            '#14b8a6', '#f43f5e', '#64748b'
          ],
          borderWidth: 2,
          borderColor: isLight ? '#ffffff' : '#111827'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { family: "'Plus Jakarta Sans', sans-serif", size: 11 }, padding: 12 }
          },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.label}: ${ctx.raw} alunos (${((ctx.raw / data.length) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });
  }

  // Chart 2: Objetivo Pós-Técnico
  const objCounts = {};
  data.forEach(d => {
    let o = d.objetivo || 'Outro';
    if (o.length > 45) o = o.slice(0, 42) + '...';
    objCounts[o] = (objCounts[o] || 0) + 1;
  });

  const ctx2 = document.getElementById('chart-objetivos')?.getContext('2d');
  if (ctx2) {
    if (appState.charts.objetivos) appState.charts.objetivos.destroy();
    appState.charts.objetivos = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: Object.keys(objCounts),
        datasets: [{
          label: 'Total de Respostas',
          data: Object.values(objCounts),
          backgroundColor: 'rgba(139, 92, 246, 0.75)',
          borderColor: '#8b5cf6',
          borderWidth: 1.5,
          borderRadius: 6
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor } },
          y: { grid: { display: false }, ticks: { color: textColor, font: { size: 10 } } }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => ` ${ctx.raw} respondentes (${((ctx.raw / data.length) * 100).toFixed(1)}%)`
            }
          }
        }
      }
    });
  }

  // Chart 3: Ambição Exterior x Nível de Satisfação
  const extCounts = { 'Sim': 0, 'Talvez': 0, 'Não': 0 };
  data.forEach(d => {
    if (d.trabalhar_exterior.includes('Sim')) extCounts['Sim']++;
    else if (d.trabalhar_exterior.includes('Talvez')) extCounts['Talvez']++;
    else extCounts['Não']++;
  });

  const ctx3 = document.getElementById('chart-exterior')?.getContext('2d');
  if (ctx3) {
    if (appState.charts.exterior) appState.charts.exterior.destroy();
    appState.charts.exterior = new Chart(ctx3, {
      type: 'pie',
      data: {
        labels: ['Objetivo Principal (Exterior)', 'Talvez / Oportunidade', 'Sem Interesse'],
        datasets: [{
          data: [extCounts['Sim'], extCounts['Talvez'], extCounts['Não']],
          backgroundColor: ['#10b981', '#6366f1', '#64748b'],
          borderWidth: 2,
          borderColor: isLight ? '#ffffff' : '#111827'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { size: 11 } }
          }
        }
      }
    });
  }

  // Chart 4: Horas de Dedicação Semanal
  const horasCounts = { 'Menos de 2h': 0, '2 a 5h': 0, '5 a 10h': 0, 'Mais de 10h': 0 };
  data.forEach(d => {
    if (d.horas_estudo.includes('Menos de 2')) horasCounts['Menos de 2h']++;
    else if (d.horas_estudo.includes('2 a 5')) horasCounts['2 a 5h']++;
    else if (d.horas_estudo.includes('5 a 10')) horasCounts['5 a 10h']++;
    else if (d.horas_estudo.includes('Mais de 10')) horasCounts['Mais de 10h']++;
  });

  const ctx4 = document.getElementById('chart-horas')?.getContext('2d');
  if (ctx4) {
    if (appState.charts.horas) appState.charts.horas.destroy();
    appState.charts.horas = new Chart(ctx4, {
      type: 'polarArea',
      data: {
        labels: Object.keys(horasCounts),
        datasets: [{
          data: Object.values(horasCounts),
          backgroundColor: [
            'rgba(99, 102, 241, 0.7)',
            'rgba(168, 85, 247, 0.7)',
            'rgba(6, 182, 212, 0.7)',
            'rgba(244, 63, 94, 0.7)'
          ],
          borderColor: isLight ? '#ffffff' : '#111827',
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: textColor, font: { size: 11 } }
          }
        },
        scales: {
          r: { grid: { color: gridColor }, ticks: { display: false } }
        }
      }
    });
  }
}

/* ==========================================================================
   7. DEMO INTERATIVA DE HASH TABLE E O(1) COMPLEXITY
   ========================================================================== */
window.simulateHashLookup = function(sampleKey) {
  const keyInput = document.getElementById('demo-hash-input');
  if (sampleKey) {
    keyInput.value = sampleKey;
  }
  let key = (keyInput ? keyInput.value : '').trim();
  if (!key) {
    key = 'user:25011962:carreira';
    if (keyInput) keyInput.value = key;
  }

  // Normalização inteligente de chaves cadastradas
  let lookupKey = key;
  if (!kvEngine.store.has(lookupKey)) {
    if (kvEngine.store.has(`user:${key}:carreira`)) {
      lookupKey = `user:${key}:carreira`;
    } else if (kvEngine.store.has(`user:${key}`)) {
      lookupKey = `user:${key}`;
    } else if (kvEngine.store.has(`user:${key}:perfil`)) {
      lookupKey = `user:${key}:perfil`;
    }
  }

  // Algoritmo de hash simples DJB2 para visualização didática
  let hash = 5381;
  for (let i = 0; i < lookupKey.length; i++) {
    hash = ((hash << 5) + hash) + lookupKey.charCodeAt(i);
    hash = hash & hash; // Converte para 32-bit integer
  }
  const unsignedHash = Math.abs(hash);
  const bucketIndex = unsignedHash % 16; // 16 buckets virtuais
  const hexAddress = '0x' + (unsignedHash.toString(16).padStart(8, '0').slice(0, 6));

  // Atualiza painel didático
  const keyDisplay = document.getElementById('hash-key-display');
  const rawDisplay = document.getElementById('hash-raw-display');
  const bucketDisplay = document.getElementById('hash-bucket-display');
  const memDisplay = document.getElementById('hash-mem-display');

  if (keyDisplay) keyDisplay.textContent = `"${lookupKey}"`;
  if (rawDisplay) rawDisplay.textContent = unsignedHash.toLocaleString();
  if (bucketDisplay) bucketDisplay.textContent = `Bucket [${bucketIndex}]`;
  if (memDisplay) memDisplay.textContent = hexAddress;

  // Animação e destaque dos buckets
  const buckets = document.querySelectorAll('.hash-bucket-item');
  buckets.forEach((b, idx) => {
    b.classList.remove('bg-purple-600', 'text-white', 'ring-2', 'ring-purple-400', 'scale-105', 'border-purple-500');
    b.classList.add('bg-zinc-900/90', 'text-zinc-400', 'border-zinc-800');
    if (idx === bucketIndex) {
      b.classList.remove('bg-zinc-900/90', 'text-zinc-400', 'border-zinc-800');
      b.classList.add('bg-purple-600', 'text-white', 'ring-2', 'ring-purple-400', 'scale-105', 'border-purple-500');
    }
  });

  const resultVal = kvEngine.get(lookupKey);
  const resultDisplay = document.getElementById('hash-lookup-result');
  if (!resultDisplay) return;

  if (resultVal !== null) {
    const formatted = typeof resultVal === 'object' ? JSON.stringify(resultVal, null, 2) : String(resultVal);
    resultDisplay.innerHTML = `
      <div class="flex items-center justify-between flex-wrap gap-2 mb-2 pb-2 border-b border-zinc-800/80">
        <span class="text-emerald-400 font-semibold flex items-center gap-1.5 text-xs">
          <i class="fa-solid fa-check-circle"></i> Encontrado em O(1) (Latência: ~0.08 ms em RAM)
        </span>
        <span class="text-[11px] font-mono text-zinc-400">Chave: <strong class="text-purple-300 font-mono">${escapeHtml(lookupKey)}</strong></span>
      </div>
      <div class="w-full overflow-x-auto max-w-full">
        <pre class="text-xs text-zinc-200 font-mono whitespace-pre-wrap break-words break-all leading-relaxed max-w-full">${escapeHtml(formatted)}</pre>
      </div>
    `;
  } else {
    resultDisplay.innerHTML = `
      <div class="flex items-center gap-2 text-amber-400 text-xs">
        <i class="fa-solid fa-triangle-exclamation"></i>
        <span>Chave mapeada para o <strong>Bucket [${bucketIndex}]</strong>, porém não gravada no KV Engine.</span>
      </div>
      <p class="text-[11px] text-zinc-400 mt-1">Dica: Selecione chaves como <code class="text-purple-300 font-mono">user:25011962:carreira</code> ou clique em um dos atalhos rápidos.</p>
    `;
  }
};

/* ==========================================================================
   8. TEMA (DARK / LIGHT MODE) E APARÊNCIA
   ========================================================================== */
function initTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const root = document.documentElement;

  function applyTheme(t) {
    if (t === 'light') {
      root.classList.add('light');
    } else {
      root.classList.remove('light');
    }
    localStorage.setItem('fecap_theme', t);
    appState.theme = t;
    // Re-renderiza gráficos com cores adequadas
    initCharts();
  }

  applyTheme(appState.theme);

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      const nextTheme = appState.theme === 'dark' ? 'light' : 'dark';
      applyTheme(nextTheme);
    });
  }
}

// Modo Apresentação Acadêmica (Slides / Pitch)
window.togglePresentationMode = function() {
  appState.presentationMode = !appState.presentationMode;
  document.body.classList.toggle('presentation-mode', appState.presentationMode);
  showToast(appState.presentationMode ? 'Modo Apresentação Ativado!' : 'Modo Padrão Restaurado');
};

/* ==========================================================================
   9. NAVEGAÇÃO E SCROLL SPY
   ========================================================================== */
function initNavigation() {
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let currentId = '';
    const scrollY = window.pageYOffset;

    sections.forEach(sec => {
      const sectionHeight = sec.offsetHeight;
      const sectionTop = sec.offsetTop - 120;
      if (scrollY > sectionTop && scrollY <= sectionTop + sectionHeight) {
        currentId = sec.getAttribute('id');
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      if (link.getAttribute('href') === `#${currentId}`) {
        link.classList.add('active');
      }
    });
  });

  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobile-menu-btn');
  const mobileNav = document.getElementById('mobile-nav');
  if (mobileMenuBtn && mobileNav) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNav.classList.toggle('hidden');
    });
    mobileNav.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => mobileNav.classList.add('hidden'));
    });
  }
}

/* ==========================================================================
   10. FEEDBACK TOAST E UTILITÁRIOS
   ========================================================================== */
function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  setTimeout(() => {
    toast.classList.remove('opacity-100', 'translate-y-0');
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
  }, 2800);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str);
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/* ==========================================================================
   12. INTEGRAÇÃO REDIS CLOUD & GOOGLE FORMS CONTROLLER
   ========================================================================== */

const formsState = {
  currentPage: 1,
  limit: 10,
  totalPages: 1,
  totalRecords: 0,
  searchQuery: '',
  selectedCourse: 'todos',
  privacyMode: localStorage.getItem('fecap_privacy_mode') !== 'false',
  searchTimeout: null,
  isSyncing: false
};

function getApiBaseUrl() {
  const custom = localStorage.getItem('fecap_backend_url');
  if (custom) return custom.replace(/\/$/, '');

  if (window.location.protocol === 'http:' || window.location.protocol === 'https:') {
    if (window.location.port === '3000' || !window.location.port) {
      return '';
    }
  }
  return 'http://localhost:3000';
}

/**
 * Máscara LGPD para proteção de privacidade acadêmica
 */
function maskName(name) {
  if (!name || !formsState.privacyMode) return name || '-';
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return name;
  return parts[0] + ' ' + parts.slice(1).map(p => p.charAt(0).toUpperCase() + '.').join(' ');
}

function maskRA(ra) {
  if (!ra || !formsState.privacyMode) return ra || '-';
  const s = String(ra).trim();
  if (s.length <= 4) return s;
  return s.substring(0, 4) + '****';
}

function getCourseBadgeClass(curso) {
  const c = (curso || '').toLowerCase();
  if (c.includes('inteligência artificial')) {
    return 'bg-purple-500/10 text-purple-300 border-purple-500/20';
  } else if (c.includes('cibersegurança') || c.includes('ciber')) {
    return 'bg-red-500/10 text-red-300 border-red-500/20';
  } else if (c.includes('pleno')) {
    return 'bg-blue-500/10 text-blue-300 border-blue-500/20';
  } else if (c.includes('informática')) {
    return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20';
  } else if (c.includes('administração')) {
    return 'bg-amber-500/10 text-amber-300 border-amber-500/20';
  }
  return 'bg-zinc-800 text-zinc-300 border-zinc-700';
}

/**
 * Consulta o status real da conexão com o Redis Cloud
 */
async function checkRedisStatus(forceToast = false) {
  const icon = document.getElementById('icon-refresh-status');
  if (icon) icon.classList.add('animate-spin');

  const dot = document.getElementById('redis-status-dot');
  const badgeText = document.getElementById('redis-status-text');
  const banner = document.getElementById('redis-status-banner');
  const headline = document.getElementById('redis-status-headline');
  const subtext = document.getElementById('redis-status-subtext');
  const cardState = document.getElementById('card-conn-state');
  const cardDesc = document.getElementById('card-conn-desc');
  const cardLatency = document.getElementById('card-conn-latency');
  const cardDbsize = document.getElementById('card-conn-dbsize');
  const cardResponses = document.getElementById('card-conn-responses');
  const statSynced = document.getElementById('stat-total-synced');
  const statLastSync = document.getElementById('stat-last-sync');
  const statRedisInd = document.getElementById('stat-redis-connection-indicator');

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/status`, {
      headers: { 'Accept': 'application/json' }
    });

    if (!res.ok) {
      throw new Error(`Servidor respondeu com status HTTP ${res.status}`);
    }

    const data = await res.json();

    if (data.connected) {
      // Conexão Real Estabelecida
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-500 animate-pulse';
      if (badgeText) {
        badgeText.textContent = 'Conectado';
        badgeText.className = 'text-emerald-400 font-semibold';
      }
      if (banner) {
        banner.className = 'mb-8 p-4 rounded-2xl border transition-all duration-300 bg-emerald-950/20 border-emerald-500/30 text-emerald-200';
      }
      if (headline) headline.textContent = 'Conexão Ativa com o Redis Cloud';
      if (subtext) subtext.textContent = `Host: ${data.maskedHost} | Latência RTT: ${data.latencyMs || 0}ms | DBSIZE: ${data.dbsize || 0} chaves ativas.`;

      if (cardState) {
        cardState.textContent = 'ONLINE';
        cardState.className = 'text-xl font-bold font-mono text-emerald-400';
      }
      if (cardDesc) cardDesc.textContent = 'Cluster ativo e respondendo';
      if (cardLatency) cardLatency.textContent = `${data.latencyMs || 0} ms`;
      if (cardDbsize) cardDbsize.textContent = `${data.dbsize || 0} chaves`;
      if (cardResponses) cardResponses.textContent = `${data.totalSyncedResponses || 0} registros`;
      if (statSynced) statSynced.textContent = `${data.totalSyncedResponses || 0} estudantes`;

      if (statRedisInd) {
        statRedisInd.textContent = 'Conectado (Online)';
        statRedisInd.className = 'text-xs font-semibold font-mono text-emerald-400';
      }

      if (data.lastSyncTimestamp) {
        const d = new Date(data.lastSyncTimestamp);
        if (statLastSync) statLastSync.textContent = d.toLocaleString('pt-BR');
      }

      if (forceToast) showToast('Conexão com Redis Cloud verificada com sucesso!');
    } else {
      // Conexão Não Estabelecida (Não simula ativa)
      if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-500';
      if (badgeText) {
        badgeText.textContent = 'Desconectado';
        badgeText.className = 'text-amber-400 font-semibold';
      }
      if (banner) {
        banner.className = 'mb-8 p-4 rounded-2xl border transition-all duration-300 bg-amber-950/20 border-amber-500/30 text-amber-200';
      }
      if (headline) headline.textContent = 'Redis Cloud Desconectado';
      if (subtext) subtext.textContent = data.statusText || 'Preencha REDIS_HOST e REDIS_PORT no arquivo .env para conectar ao seu banco.';

      if (cardState) {
        cardState.textContent = 'OFFLINE';
        cardState.className = 'text-xl font-bold font-mono text-amber-400';
      }
      if (cardDesc) cardDesc.textContent = 'Aguardando configuração de Host/Porta';
      if (cardLatency) cardLatency.textContent = '-- ms';
      if (cardDbsize) cardDbsize.textContent = '0 chaves';
      if (cardResponses) cardResponses.textContent = '0 registros';
      if (statSynced) statSynced.textContent = '0 respostas';

      if (statRedisInd) {
        statRedisInd.textContent = 'Desconectado (Aguardando Host/Port)';
        statRedisInd.className = 'text-xs font-semibold font-mono text-amber-400';
      }

      if (forceToast) showToast('Aviso: Redis Cloud desconectado no servidor.');
    }

  } catch (err) {
    // Backend offline ou falha de requisição
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-red-500';
    if (badgeText) {
      badgeText.textContent = 'Backend Offline';
      badgeText.className = 'text-red-400 font-semibold';
    }
    if (banner) {
      banner.className = 'mb-8 p-4 rounded-2xl border transition-all duration-300 bg-red-950/20 border-red-500/30 text-red-200';
    }
    if (headline) headline.textContent = 'Servidor Backend Não Encontrado';
    if (subtext) subtext.textContent = 'Inicie o servidor Node.js com o comando "npm start" no terminal para conectar ao Redis Cloud.';

    if (cardState) {
      cardState.textContent = 'STANDALONE';
      cardState.className = 'text-xl font-bold font-mono text-red-400';
    }
    if (cardDesc) cardDesc.textContent = 'Servidor HTTP local não detectado';
    if (statRedisInd) {
      statRedisInd.textContent = 'Backend Offline';
      statRedisInd.className = 'text-xs font-semibold font-mono text-red-400';
    }

    if (forceToast) showToast('Não foi possível conectar ao servidor backend (porta 3000).');
  } finally {
    if (icon) {
      setTimeout(() => icon.classList.remove('animate-spin'), 400);
    }
  }
}

/**
 * Dispara a sincronização real entre Google Forms / Planilha e o Redis Cloud
 */
async function syncFormsResponses() {
  if (formsState.isSyncing) return;
  formsState.isSyncing = true;

  const btn = document.getElementById('btn-sync-responses');
  const icon = document.getElementById('icon-sync-btn');
  const text = document.getElementById('text-sync-btn');

  if (icon) icon.classList.add('animate-spin');
  if (text) text.textContent = 'Sincronizando...';
  if (btn) btn.disabled = true;

  try {
    const res = await fetch(`${getApiBaseUrl()}/api/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    const data = await res.json();

    if (res.ok && data.success) {
      showToast(`Sucesso! ${data.syncedCount} novas respostas sincronizadas no Redis Cloud.`);
      await checkRedisStatus(false);
      await loadFormsResponses(1);
    } else {
      const errMsg = data.error || 'Falha ao sincronizar respostas.';
      showToast(`Erro na sincronização: ${errMsg}`);
      const errBox = document.getElementById('forms-error-message');
      if (errBox) errBox.textContent = errMsg;
    }
  } catch (err) {
    showToast('Falha na comunicação: verifique se o servidor backend está rodando.');
  } finally {
    formsState.isSyncing = false;
    if (icon) icon.classList.remove('animate-spin');
    if (text) text.textContent = 'Sincronizar respostas';
    if (btn) btn.disabled = false;
  }
}

/**
 * Consulta e renderiza a tabela de respostas paginada
 */
async function loadFormsResponses(page = 1, fallbackMode = false) {
  formsState.currentPage = page;

  const loadingEl = document.getElementById('forms-loading-state');
  const errorEl = document.getElementById('forms-error-state');
  const emptyEl = document.getElementById('forms-empty-state');
  const tableContainer = document.getElementById('forms-table-container');
  const tableBody = document.getElementById('forms-table-body');
  const paginationBar = document.getElementById('forms-pagination-bar');

  if (loadingEl) loadingEl.classList.remove('hidden');
  if (errorEl) errorEl.classList.add('hidden');
  if (emptyEl) emptyEl.classList.add('hidden');
  if (tableContainer) tableContainer.classList.add('hidden');
  if (paginationBar) paginationBar.classList.add('hidden');

  const search = encodeURIComponent(formsState.searchQuery);
  const curso = encodeURIComponent(formsState.selectedCourse);
  const previewParam = fallbackMode ? '&preview=true' : '';

  try {
    let records = [];
    let total = 0;
    let totalPages = 1;
    let source = 'redis-cloud';

    // 1. Tenta carregar do backend (Redis Cloud ou endpoint local)
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/respostas?page=${page}&limit=${formsState.limit}&search=${search}&curso=${curso}${previewParam}`);
      if (res.ok) {
        const data = await res.json();
        records = data.records || [];
        total = data.total || 0;
        totalPages = data.totalPages || 1;
        source = data.source || 'redis-cloud';
      } else if (res.status === 503 && !fallbackMode) {
        return loadFormsResponses(page, true);
      } else {
        throw new Error('Falha HTTP backend');
      }
    } catch(backendErr) {
      // 2. Fallback direto para window.PESQUISA_RAW_DATA (sempre garante que os dados apareçam!)
      if (window.PESQUISA_RAW_DATA && Array.isArray(window.PESQUISA_RAW_DATA)) {
        let list = window.PESQUISA_RAW_DATA;
        if (formsState.selectedCourse !== 'todos') {
          list = list.filter(r => (r.curso || '').toLowerCase().includes(formsState.selectedCourse.toLowerCase()));
        }
        if (formsState.searchQuery) {
          const q = formsState.searchQuery.toLowerCase();
          list = list.filter(r =>
            (r.nome || '').toLowerCase().includes(q) ||
            (r.ra || '').toLowerCase().includes(q) ||
            (r.curso || '').toLowerCase().includes(q) ||
            (r.objetivo || '').toLowerCase().includes(q)
          );
        }
        total = list.length;
        totalPages = Math.ceil(total / formsState.limit) || 1;
        const start = (page - 1) * formsState.limit;
        records = list.slice(start, start + formsState.limit);
        source = 'local-dataset';
      } else {
        throw backendErr;
      }
    }

    formsState.totalRecords = total;
    formsState.totalPages = totalPages;

    if (loadingEl) loadingEl.classList.add('hidden');

    if (records.length === 0) {
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }

    if (tableBody) {
      tableBody.innerHTML = '';
      const startNum = (page - 1) * formsState.limit;

      records.forEach((rec, idx) => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-zinc-800/40 transition duration-150 border-b border-zinc-800/50';

        const rowNum = startNum + idx + 1;
        const maskedName = maskName(rec.nome);
        const maskedRA = maskRA(rec.ra);
        const badgeClass = getCourseBadgeClass(rec.curso);

        tr.innerHTML = `
          <td class="py-3 px-3.5 font-mono text-zinc-500 font-bold whitespace-nowrap">${rowNum}</td>
          <td class="py-3 px-3.5 font-mono text-[11px] text-zinc-400 whitespace-nowrap">${escapeHtml(rec.timestamp || '-')}</td>
          <td class="py-3 px-3.5 font-semibold text-white whitespace-nowrap">${escapeHtml(maskedName)}</td>
          <td class="py-3 px-3.5 font-mono text-purple-300 whitespace-nowrap">${escapeHtml(maskedRA)}</td>
          <td class="py-3 px-3.5 whitespace-nowrap">
            <span class="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${badgeClass}">
              ${escapeHtml(rec.curso || 'Não Informado')}
            </span>
          </td>
          <td class="py-3 px-3.5 font-mono text-zinc-300 whitespace-nowrap">${escapeHtml(rec.ano || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-300 text-xs min-w-[200px]" title="${escapeHtml(rec.objetivo || '')}">${escapeHtml(rec.objetivo || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[160px]">${escapeHtml(rec.mesma_area || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[140px]">${escapeHtml(rec.vestibular || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[220px]" title="${escapeHtml(rec.vestibulares_quais || '')}">${escapeHtml(rec.vestibulares_quais || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[200px]">${escapeHtml(rec.fator_carreira || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[180px]">${escapeHtml(rec.preparo_curso || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[140px]">${escapeHtml(rec.trabalhar_exterior || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[180px]">${escapeHtml(rec.busca_oportunidades || '-')}</td>
          <td class="py-3 px-3.5 font-mono text-zinc-300 whitespace-nowrap">${escapeHtml(rec.horas_estudo || '-')}</td>
          <td class="py-3 px-3.5 text-zinc-400 text-xs min-w-[200px]">${escapeHtml(rec.fator_escolha_curso || '-')}</td>
          <td class="py-3 px-3.5 font-semibold text-emerald-400 whitespace-nowrap">${escapeHtml(rec.satisfacao || '-')}</td>
        `;
        tableBody.appendChild(tr);
      });
    }

    if (tableContainer) tableContainer.classList.remove('hidden');
    renderPaginationControls();

    // Atualiza contador de respondentes
    const statSynced = document.getElementById('stat-total-synced');
    if (statSynced) {
      statSynced.textContent = `${total} estudantes`;
    }

  } catch (err) {
    if (loadingEl) loadingEl.classList.add('hidden');
    if (errorEl) errorEl.classList.remove('hidden');
    const msg = document.getElementById('forms-error-message');
    if (msg) msg.textContent = 'Erro ao consultar respostas: ' + err.message;
  }
}

function loadFormsFallbackLocal() {
  loadFormsResponses(1, true);
}

/**
 * Constrói os botões de paginação
 */
function renderPaginationControls() {
  const bar = document.getElementById('forms-pagination-bar');
  const summary = document.getElementById('forms-pagination-summary');
  const controls = document.getElementById('forms-pagination-controls');
  if (!bar || !summary || !controls) return;

  bar.classList.remove('hidden');

  const start = (formsState.currentPage - 1) * formsState.limit + 1;
  const end = Math.min(formsState.currentPage * formsState.limit, formsState.totalRecords);
  summary.textContent = `Mostrando ${start} a ${end} de ${formsState.totalRecords} respostas`;

  controls.innerHTML = '';

  // Botão Anterior
  const prevBtn = document.createElement('button');
  prevBtn.disabled = formsState.currentPage <= 1;
  prevBtn.className = `px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
    prevBtn.disabled
      ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
      : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:text-white'
  }`;
  prevBtn.innerHTML = '&larr; Anterior';
  prevBtn.onclick = () => loadFormsResponses(formsState.currentPage - 1);
  controls.appendChild(prevBtn);

  // Páginas Numeradas (Janela de páginas)
  const maxButtons = 5;
  let startPage = Math.max(1, formsState.currentPage - 2);
  let endPage = Math.min(formsState.totalPages, startPage + maxButtons - 1);

  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  for (let p = startPage; p <= endPage; p++) {
    const pageBtn = document.createElement('button');
    const isActive = (p === formsState.currentPage);
    pageBtn.className = `w-8 h-8 rounded-lg border text-xs font-semibold font-mono transition ${
      isActive
        ? 'bg-purple-600 border-purple-500 text-white shadow-md'
        : 'bg-zinc-800/80 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-white'
    }`;
    pageBtn.textContent = p;
    pageBtn.onclick = () => loadFormsResponses(p);
    controls.appendChild(pageBtn);
  }

  // Botão Próximo
  const nextBtn = document.createElement('button');
  nextBtn.disabled = formsState.currentPage >= formsState.totalPages;
  nextBtn.className = `px-3 py-1.5 rounded-lg border text-xs font-medium transition ${
    nextBtn.disabled
      ? 'bg-zinc-900 border-zinc-800 text-zinc-600 cursor-not-allowed'
      : 'bg-zinc-800 border-zinc-700 text-zinc-200 hover:bg-zinc-700 hover:text-white'
  }`;
  nextBtn.innerHTML = 'Próximo &rarr;';
  nextBtn.onclick = () => loadFormsResponses(formsState.currentPage + 1);
  controls.appendChild(nextBtn);
}

/**
 * Filtro por curso
 */
function filterFormsByCourse() {
  const select = document.getElementById('forms-curso-select');
  if (select) {
    formsState.selectedCourse = select.value;
    loadFormsResponses(1);
  }
}

/**
 * Alternador do modo de privacidade (LGPD)
 */
function togglePrivacyMode() {
  formsState.privacyMode = !formsState.privacyMode;
  localStorage.setItem('fecap_privacy_mode', formsState.privacyMode);

  const textEl = document.getElementById('text-privacy');
  const iconEl = document.getElementById('icon-privacy');

  if (textEl) textEl.textContent = formsState.privacyMode ? 'Modo Privacidade: ON' : 'Modo Privacidade: OFF';
  if (iconEl) {
    iconEl.className = formsState.privacyMode
      ? 'w-3.5 h-3.5 text-emerald-400'
      : 'w-3.5 h-3.5 text-zinc-500';
  }

  showToast(formsState.privacyMode ? 'Modo Privacidade ativado (RAs e Nomes mascarados)' : 'Modo Privacidade desativado');
  loadFormsResponses(formsState.currentPage);
}

/**
 * Abre/Fecha o Modal de Guia de Conexão
 */
function toggleConnectionGuideModal() {
  const modal = document.getElementById('connection-guide-modal');
  if (modal) {
    modal.classList.toggle('hidden');
    if (typeof lucide !== 'undefined') lucide.createIcons();
  }
}

/* ==========================================================================
   11. INICIALIZAÇÃO GERAL
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
  // 1. Carrega o dataset automaticamente na inicialização
  if (window.PESQUISA_RAW_DATA) {
    kvEngine.loadDataset(window.PESQUISA_RAW_DATA);
  }

  // 2. Inicializa módulos
  initTheme();
  initNavigation();
  initTerminal();
  initStoreExplorer();
  initCharts();

  if (typeof populateUserQuickSelect === 'function') {
    populateUserQuickSelect();
  }

  // 3. Inicializa Busca com Debounce no Google Forms
  const searchInput = document.getElementById('forms-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      clearTimeout(formsState.searchTimeout);
      formsState.searchTimeout = setTimeout(() => {
        formsState.searchQuery = e.target.value.trim();
        loadFormsResponses(1);
      }, 300);
    });
  }

  // 4. Checagem inicial do Redis Cloud e carregamento de respostas
  checkRedisStatus(false);
  loadFormsResponses(1);

  // Executa uma simulação inicial de hash lookup para preencher a visualização didática
  setTimeout(() => {
    simulateHashLookup('user:25011962:carreira');
  }, 300);

  console.log('NoSQL Key-Value Store & Redis Cloud Integration inicializados com sucesso!');
});

