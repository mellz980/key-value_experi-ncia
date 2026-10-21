# NoSQL Key-Value Store (Redis Simulator) & Pesquisa de Carreira - FECAP 2026

Aplicação Web Interativa (Single Page Application - SPA) desenvolvida para apresentação de trabalho acadêmico de **Big Data** na **Fundação Escola de Comércio Álvares Penteado (FECAP)**.

A aplicação integra a fundamentação teórica de bancos de dados NoSQL do tipo **Chave-Valor (Key-Value Store)** com a análise prática e interativa dos dados coletados através do formulário de pesquisa **"PLANEJAMENETO DO FUTURO E CARREIRA.csv"** (72 estudantes pesquisados).

---

## 🚀 Como Executar

### Opção 1: Execução com Servidor Backend Completo (Node.js + Redis Cloud)
```bash
# 1. Instalar as dependências
npm install

# 2. Configurar o arquivo .env com suas credenciais do Redis Cloud
# (utilize o template .env.example como base)

# 3. Iniciar o servidor
npm start
```
Acesse no navegador: [http://localhost:3000](http://localhost:3000)

### Opção 2: Execução Direta no Navegador (Standalone / GitHub Pages)
Abra o arquivo `index.html` diretamente em qualquer navegador moderno. O frontend funciona tanto standalone quanto conectado ao backend Node.js.

---

## 📁 Estrutura de Arquivos do Projeto

- `index.html`: Interface completa da Single Page Application com as seções acadêmicas, navegação responsiva, modais, painel de telemetria "Meu Banco de Dados" e tabela de "Respostas do Google Forms".
- `styles.css`: Folha de estilo personalizada com suporte a Dark/Light Mode, glassmorphism e animações.
- `app.js`: Motor em memória (`KeyValueEngine`), CLI Redis didático, controladores de telemetria do Redis Cloud, paginação, busca e proteção de privacidade LGPD.
- `server.js`: Backend Node.js (Express + cliente oficial Redis) com rotas para consulta de status, sincronização com Google Sheets/CSV, webhook para Google Apps Script e prevenção de duplicatas.
- `google_apps_script.js`: Script pronto para colar no Google Sheets / Google Forms para envio automático de respostas em tempo real.
- `.env.example`: Modelo de variáveis de ambiente seguras (porta, host, porta, senha/API key do Redis Cloud e URL do Sheets).
- `pesquisa_data.js`: Base de dados normalizada em JavaScript (`window.PESQUISA_RAW_DATA`).
- `pesquisa_data.json`: Dataset limpo em formato JSON para exportação e interoperabilidade.
- `PLANEJAMENETO DO FUTURO E CARREIRA.csv`: Planilha original de respostas coletadas dos estudantes da FECAP.

---

## 🧠 Conteúdo e Seções Acadêmicas

1. **Introdução**:
   - Definição de Bancos de Dados NoSQL e principais distinções em relação a bancos relacionais (SQL).
   - Por que estudar NoSQL no cenário de Big Data (Os 5 Vs: Volume, Velocidade, Variedade, Veracidade, Valor).
   - Objetivos do trabalho e escopo prático.

2. **Conceitos Fundamentais (Key-Value)**:
   - Anatomia do par Chave-Valor e tipos de dados suportados (Strings, Hashes, Lists, Sets, Sorted Sets, JSON).
   - Estruturas de dados internas na memória RAM: Hash Tables e complexidade de busca constante $O(1)$.
   - Simulador didático de função hash (DJB2/CRC16) mapeando chaves para buckets e ponteiros de memória em tempo real.
   - Comandos clássicos do Redis: `SET`, `GET`, `DEL`, `EXPIRE`, `TTL`, `HSET`, `HGETALL`, `INCR`.

3. **Características e Benefícios**:
   - Escalabilidade horizontal (Sharding, Consistent Hashing Ring) vs. escalabilidade vertical.
   - Desempenho sub-milissegundo in-memory (< 0.5 ms) e throughput massivo.
   - Esquema dinâmico (Schema-less / Schemaless).
   - Teorema CAP e o posicionamento de bancos Chave-Valor (Redis, DynamoDB, Riak).
   - Mecanismos de persistência em disco: Snapshots RDB vs. Append-Only File (AOF).

4. **Casos de Uso e Mercado**:
   - Casos reais de gigantes da indústria: Twitter/X (Timelines e contadores), Amazon (DynamoDB no carrinho do Prime Day), GitHub (Rate limiting e jobs), Uber (Geolocalização em tempo real).
   - Cenários fundamentais: Caching de sessão, carrinhos de e-commerce, rankings/leaderboards com Sorted Sets, filas e Pub/Sub.

5. **Demonstração Prática Interativa & Análise da Pesquisa**:
   - **Terminal Interativo Redis CLI**: Console funcional no navegador com histórico de comandos (Setas ↑/↓), coloração de sintaxe e comandos reais (`GET`, `SET`, `KEYS`, `DEL`, `HGETALL`, `INFO`, `DBSIZE`, `BENCHMARK`).
   - **Visual Store Explorer**: Interface visual com cards das chaves em memória, filtros dinâmicos por curso técnico, busca por RA/Nome, inspeção de JSON com modal e suporte a expiração (TTL).
   - **Live In-Browser Benchmark Suite**: Executa 1.000 operações de leitura e escrita medindo throughput (ops/sec), latência média em microssegundos e percentil P99.
   - **Dashboards com Chart.js**:
     * Gráfico 1: Distribuição dos Cursos Técnicos (IA, Cibersegurança, Pleno, Informática, etc.).
     * Gráfico 2: Objetivo Principal Pós-Formação (Faculdade na área vs. Emprego imediato).
     * Gráfico 3: Interesse em Empresas do Exterior vs. Preparo do Curso Técnico.
     * Gráfico 4: Dedicação Extracurricular Semanal em Horas de Estudo.

6. **Comparação com Outros Bancos de Dados**:
   - Matriz comparativa entre **Chave-Valor** vs. **Relacional (SQL)** vs. **Documentos (MongoDB)** vs. **Colunar (Cassandra)** vs. **Grafos (Neo4j)** avaliando modelo, escalabilidade, expressividade de queries e cenários ideais.

7. **Conclusão & Tendências**:
   - Síntese de prós e contras.
   - Novas fronteiras: Busca Vetorial integrada (Vector Search para IA / RAG em LLMs), memórias persistentes NVMe/CXL e Serverless Key-Value na borda (Cloudflare KV, Upstash).

---

## 🎓 Identificação Acadêmica
- **Instituição:** FECAP - Fundação Escola de Comércio Álvares Penteado
- **Disciplina:** Big Data & Arquitetura de Dados
- **Autora / RA:** Melissa Nunes de Oliveira (RA: 25011962) & Equipe Técnica
- **Curso:** Técnico em Inteligência Artificial / Ensino Médio
- **Ano:** 2026
