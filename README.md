# NoSQL Key-Value Store (Redis Simulator) & Pesquisa de Carreira - FECAP 2026

Aplicação Web Interativa (Single Page Application - SPA) desenvolvida para apresentação de trabalho acadêmico de **Big Data** na **Fundação Escola de Comércio Álvares Penteado (FECAP)**.

A aplicação integra a fundamentação teórica de bancos de dados NoSQL do tipo **Chave-Valor (Key-Value Store)** com a análise prática e interativa dos dados coletados através do formulário de pesquisa **"PLANEJAMENETO DO FUTURO E CARREIRA.csv"** (72 estudantes pesquisados).

---

## 🚀 Como Executar

### Opção 1: Execução Direta no Navegador (Sem servidor necessário)
Basta dar um duplo clique no arquivo [`index.html`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/index.html) em qualquer navegador moderno (Chrome, Edge, Firefox, Brave, Safari). Todo o dataset e as bibliotecas funcionam standalone via CDN.

### Opção 2: Via Servidor Local (Python / Node / Live Server)
```bash
# Python
python -m http.server 8080

# Ou Node.js (npx)
npx serve .
```
Acesse: [http://localhost:8080](http://localhost:8080)

---

## 📁 Estrutura de Arquivos do Projeto

- [`index.html`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/index.html): Interface completa da Single Page Application com as 7 seções acadêmicas, navegação responsiva, modais e layout em tema violeta moderno.
- [`styles.css`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/styles.css): Folha de estilo personalizada com suporte a Dark/Light Mode, glassmorphism, terminal CRT/CLI styling e animações.
- [`app.js`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/app.js): Motor em memória do banco Chave-Valor (`KeyValueEngine`), interpretador de comandos Redis CLI, benchmark runner, gerador de gráficos Chart.js e visual store explorer.
- [`pesquisa_data.js`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/pesquisa_data.js): Base de dados normalizada em JavaScript (`window.PESQUISA_RAW_DATA`) extraída do arquivo CSV original.
- [`pesquisa_data.json`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/pesquisa_data.json): Dataset limpo em formato JSON para exportação e interoperabilidade.
- [`PLANEJAMENETO DO FUTURO E CARREIRA.csv`](file:///c:/Users/25011962/OneDrive%20-%20Funda%C3%A7%C3%A3o%20Escola%20de%20Com%C3%A9rcio%20%C3%81lvares%20Penteado/bigdata_keyvalue/PLANEJAMENETO%20DO%20FUTURO%20E%20CARREIRA.csv): Planilha original de respostas coletadas dos estudantes da FECAP.

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
