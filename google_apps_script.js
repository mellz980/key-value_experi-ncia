/**
 * ==============================================================================
 * GOOGLE APPS SCRIPT - SINCRONIZADOR AUTOMÁTICO GOOGLE FORMS -> REDIS BACKEND
 * FECAP - Big Data & NoSQL Key-Value Store 2026
 * Aluna: Melissa Nunes de Oliveira (RA: 25011962)
 * ==============================================================================
 *
 * COMO INSTALAR ESTE SCRIPT NO SEU GOOGLE FORMS OU GOOGLE SHEETS:
 *
 * 1. Abra a sua Planilha de Respostas no Google Sheets vinculada ao Google Forms.
 * 2. No menu superior, clique em "Extensões" > "Apps Script".
 * 3. Apague qualquer código existente e cole todo o conteúdo deste arquivo.
 * 4. Altere a variável BACKEND_URL abaixo para o endereço do seu backend (ex: no Render, Railway ou ngrok).
 * 5. Clique no ícone de "Salvar" (disquete).
 * 6. Para envio automático a cada nova resposta:
 *    - No menu lateral esquerdo do Apps Script, clique no ícone de Relógio ("Acionadores" / "Triggers").
 *    - Clique em "+ Adicionar acionador" (no canto inferior direito).
 *    - Escolha a função: "onFormSubmit"
 *    - Selecione a fonte do evento: "Da planilha"
 *    - Selecione o tipo de evento: "Ao enviar formulário" (On Form Submit)
 *    - Clique em "Salvar" e conceda as permissões solicitadas.
 *
 * Pronto! Cada nova resposta enviada no formulário será enviada instantaneamente
 * ao backend e gravada no Redis Cloud sem duplicatas!
 */

// Configure a URL pública do seu backend (onde o server.js está hospedado)
const BACKEND_URL = "https://seu-backend.onrender.com/api/webhook/google-forms";
const WEBHOOK_SECRET = "fecap-bigdata-secret-2026";

/**
 * Disparado automaticamente sempre que alguém envia uma resposta no Google Forms.
 */
function onFormSubmit(e) {
  try {
    let payload = {};

    if (e && e.namedValues) {
      // Quando acionado a partir de uma planilha do Google Sheets vinculada
      const nv = e.namedValues;
      payload = {
        timestamp: nv["Carimbo de data/hora"] ? nv["Carimbo de data/hora"][0] : new Date().toISOString(),
        nome: nv["Qual o seu nome?"] ? nv["Qual o seu nome?"][0] : "",
        ra: nv["Qual seu RA?"] ? nv["Qual seu RA?"][0] : "",
        curso: nv["Qual seu técnico? "] ? nv["Qual seu técnico? "][0] : (nv["Qual seu técnico?"] ? nv["Qual seu técnico?"][0] : ""),
        ano: nv["Qual a seu ano?"] ? nv["Qual a seu ano?"][0] : "",
        objetivo: nv["1-Qual é o seu objetivo principal logo após concluir o ensino técnico?"] ? nv["1-Qual é o seu objetivo principal logo após concluir o ensino técnico?"][0] : "",
        mesma_area: nv["2- Você pretende atuar profissionalmente na mesma área do seu curso técnico atual?"] ? nv["2- Você pretende atuar profissionalmente na mesma área do seu curso técnico atual?"][0] : "",
        vestibular: nv["3- Você pretende prestar vestibulares até o final do curso?"] ? nv["3- Você pretende prestar vestibulares até o final do curso?"][0] : "",
        vestibulares_quais: nv["Se sim, Quais vestibulares pretende prestar?"] ? nv["Se sim, Quais vestibulares pretende prestar?"][0] : "",
        fator_carreira: nv["4- Qual o fator mais importante para você ao escolher sua carreira ou primeiro emprego?"] ? nv["4- Qual o fator mais importante para você ao escolher sua carreira ou primeiro emprego?"][0] : "",
        preparo_curso: nv["5- Como você avalia o preparo do seu curso técnico para o mercado de trabalho?"] ? nv["5- Como você avalia o preparo do seu curso técnico para o mercado de trabalho?"][0] : "",
        trabalhar_exterior: nv["6- Você tem interesse em trabalhar para empresas do exterior no futuro?"] ? nv["6- Você tem interesse em trabalhar para empresas do exterior no futuro?"][0] : "",
        busca_oportunidades: nv["7- Como você costuma buscar oportunidades ou informações sobre a sua área?"] ? nv["7- Como você costuma buscar oportunidades ou informações sobre a sua área?"][0] : "",
        horas_estudo: nv["8-Quantas horas por semana você dedica a projetos do curso ou estudos fora do horário de aula?"] ? nv["8-Quantas horas por semana você dedica a projetos do curso ou estudos fora do horário de aula?"][0] : "",
        fator_escolha_curso: nv["9-Qual foi o principal fator que determinou a sua escolha por este curso técnico?"] ? nv["9-Qual foi o principal fator que determinou a sua escolha por este curso técnico?"][0] : "",
        satisfacao: nv["10- Em geral, qual é o seu nível de satisfação com o curso técnico que você está cursando?"] ? nv["10- Em geral, qual é o seu nível de satisfação com o curso técnico que você está cursando?"][0] : ""
      };
    } else if (e && e.values) {
      // Fallback para array de valores da linha
      const v = e.values;
      payload = {
        timestamp: v[0] || new Date().toISOString(),
        nome: v[1] || "",
        ra: v[2] || "",
        curso: v[3] || "",
        ano: v[4] || "",
        objetivo: v[5] || "",
        mesma_area: v[6] || "",
        vestibular: v[7] || "",
        vestibulares_quais: v[8] || "",
        fator_carreira: v[9] || "",
        preparo_curso: v[10] || "",
        trabalhar_exterior: v[11] || "",
        busca_oportunidades: v[12] || "",
        horas_estudo: v[13] || "",
        fator_escolha_curso: v[14] || "",
        satisfacao: v[15] || ""
      };
    }

    const options = {
      method: "post",
      contentType: "application/json",
      headers: {
        "x-webhook-secret": WEBHOOK_SECRET
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(BACKEND_URL, options);
    Logger.log("Resposta do Backend: " + response.getContentText());
  } catch (err) {
    Logger.log("Erro ao enviar resposta para o Redis: " + err.toString());
  }
}

/**
 * Função utilitária para sincronizar todas as respostas existentes na planilha de uma só vez
 */
function syncAllResponses() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  if (data.length <= 1) return;

  const headers = data[0];
  const rows = data.slice(1);
  const records = [];

  rows.forEach(row => {
    records.push({
      timestamp: row[0],
      nome: row[1],
      ra: String(row[2]),
      curso: row[3],
      ano: row[4],
      objetivo: row[5],
      mesma_area: row[6],
      vestibular: row[7],
      vestibulares_quais: row[8],
      fator_carreira: row[9],
      preparo_curso: row[10],
      trabalhar_exterior: row[11],
      busca_oportunidades: row[12],
      horas_estudo: row[13],
      fator_escolha_curso: row[14],
      satisfacao: row[15]
    });
  });

  const syncUrl = BACKEND_URL.replace("/api/webhook/google-forms", "/api/sync/batch");
  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      "x-webhook-secret": WEBHOOK_SECRET
    },
    payload: JSON.stringify({ records: records }),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(syncUrl, options);
  Logger.log("Sincronização em lote: " + response.getContentText());
}
