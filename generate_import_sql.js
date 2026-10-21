const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const csvRaw = fs.readFileSync('PLANEJAMENETO DO FUTURO E CARREIRA.csv', 'utf-8');

function parseCsv(text) {
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
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentToken.trim());
      currentToken = '';
      if (row.some(cell => cell.length > 0)) lines.push(row);
      row = [];
    } else {
      currentToken += char;
    }
  }
  if (currentToken.length > 0 || row.length > 0) {
    row.push(currentToken.trim());
    if (row.some(cell => cell.length > 0)) lines.push(row);
  }
  return lines;
}

const lines = parseCsv(csvRaw);
const commands = [];

commands.push('# =========================================================');
commands.push('# FECAP 2026 - NoSQL Big Data - Key-Value Store');
commands.push('# Comandos de Importacao para o Redis Cloud (cloud.redis.io)');
commands.push('# Cole estes comandos no Workbench/CLI do Redis Cloud');
commands.push('# =========================================================\n');

commands.push('SET "metrics:instituicao" "FECAP - Ensino Medio e Tecnico"');
commands.push('SET "metrics:pesquisa:total_respondentes" "' + (lines.length - 1) + '"');
commands.push('SET "metrics:data_extracao" "2026-10-14"');
commands.push('SET "metrics:last_sync_timestamp" "' + new Date().toISOString() + '"');
commands.push('SET "metrics:total_synced_responses" "' + (lines.length - 1) + '"');

for (let i = 1; i < lines.length; i++) {
  const v = lines[i];
  const record = {
    timestamp: v[0] || '',
    nome: v[1] || '',
    ra: v[2] || '',
    curso: v[3] || '',
    ano: v[4] || '',
    objetivo: v[5] || '',
    mesma_area: v[6] || '',
    vestibular: v[7] || '',
    vestibulares_quais: v[8] || '',
    fator_carreira: v[9] || '',
    preparo_curso: v[10] || '',
    trabalhar_exterior: v[11] || '',
    busca_oportunidades: v[12] || '',
    horas_estudo: v[13] || '',
    fator_escolha_curso: v[14] || '',
    satisfacao: v[15] || ''
  };

  const id = crypto.createHash('sha256').update(record.timestamp + '_' + record.ra + '_' + record.nome).digest('hex').substring(0, 16);
  record.id = id;

  const jsonStr = JSON.stringify(record).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  
  commands.push('SET "form:response:' + id + '" "' + jsonStr + '"');
  commands.push('SADD "form:responses:all_ids" "' + id + '"');
  if (record.ra) {
    commands.push('SET "user:' + record.ra + ':carreira" "' + jsonStr + '"');
  }
}

fs.writeFileSync('import_redis_cloud.txt', commands.join('\n'), 'utf-8');
console.log('Arquivo import_redis_cloud.txt gerado com sucesso! Total de comandos:', commands.length);
