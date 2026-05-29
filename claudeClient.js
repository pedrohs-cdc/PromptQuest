// claudeClient.js
// Encapsula todas as chamadas à API da Claude para facilitar manutenção

const Anthropic = require('@anthropic-ai/sdk');

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5-20251001';

/**
 * Chama a Claude com o prompt do jogador + a pergunta de teste do desafio.
 * O prompt do jogador é usado como system prompt, e a pergunta como user message.
 * Essa separação é importante: ensina o jogador a pensar em prompt de sistema.
 *
 * @param {string} promptJogador - O prompt escrito pelo jogador
 * @param {string} perguntaTeste - A mensagem do "usuário" definida no desafio
 * @returns {Promise<string>} - A resposta gerada pela Claude
 */
async function executarPromptDoJogador(promptJogador, perguntaTeste) {
  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: promptJogador,
      messages: [
        { role: 'user', content: perguntaTeste }
      ],
    });

    // A resposta vem em blocos; pegamos o texto concatenado
    const texto = response.content
      .filter(bloco => bloco.type === 'text')
      .map(bloco => bloco.text)
      .join('\n')
      .trim();

    return texto;
  } catch (erro) {
    console.error('Erro ao chamar Claude (prompt do jogador):', erro.message);
    throw new Error(`Falha na chamada à Claude: ${erro.message}`);
  }
}

/**
 * Chama a Claude como "juiz" para avaliar se uma resposta cumpre os critérios.
 * Esse é o coração do validador tipo "ia_juiz".
 * O prompt do juiz é estruturado para retornar JSON parseável.
 *
 * @param {string} resposta - A resposta gerada pelo prompt do jogador
 * @param {string[]} criterios - Lista de critérios em linguagem natural
 * @returns {Promise<{passou: boolean, criterios_atendidos: string[], criterios_falhos: string[], feedback: string}>}
 */
async function avaliarComJuizIA(resposta, criterios) {
  const promptJuiz = construirPromptDoJuiz(resposta, criterios);

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [
        { role: 'user', content: promptJuiz }
      ],
    });

    const textoJuiz = response.content
      .filter(bloco => bloco.type === 'text')
      .map(bloco => bloco.text)
      .join('\n')
      .trim();

    // Tenta extrair JSON da resposta (às vezes vem com markdown)
    const jsonLimpo = extrairJSON(textoJuiz);
    const avaliacao = JSON.parse(jsonLimpo);

    return {
      passou: Boolean(avaliacao.passou),
      criterios_atendidos: avaliacao.criterios_atendidos || [],
      criterios_falhos: avaliacao.criterios_falhos || [],
      feedback: avaliacao.feedback_construtivo || avaliacao.feedback || ''
    };
  } catch (erro) {
    console.error('Erro ao chamar juiz IA:', erro.message);
    // Falha do juiz não deve travar o jogo — retorna avaliação "neutra"
    return {
      passou: false,
      criterios_atendidos: [],
      criterios_falhos: criterios,
      feedback: 'Não foi possível avaliar automaticamente. Tente reformular seu prompt.'
    };
  }
}

/**
 * Constrói o prompt do juiz. ESTA É A v1 — vocês vão iterar essa versão
 * durante o projeto e mostrar a evolução no vídeo (prompt engineering!).
 */
function construirPromptDoJuiz(resposta, criterios) {
  const criteriosFormatados = criterios
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `Você é um avaliador automático de respostas geradas por IA. Sua única função é determinar se a RESPOSTA abaixo cumpre TODOS os critérios listados.

Seja rigoroso: se um único critério falhou, o resultado deve ser "passou": false.

CRITÉRIOS A AVALIAR:
${criteriosFormatados}

RESPOSTA A AVALIAR:
"""
${resposta}
"""

Responda EXCLUSIVAMENTE com um objeto JSON válido neste formato exato, sem markdown, sem backticks, sem explicações antes ou depois:

{
  "passou": true ou false,
  "criterios_atendidos": ["critério 1 cumprido", "critério 2 cumprido"],
  "criterios_falhos": ["critério X que falhou e por quê"],
  "feedback_construtivo": "Uma frase curta sugerindo como melhorar o prompt original."
}`;
}

/**
 * Remove markdown e extrai apenas o JSON da resposta do juiz.
 * Necessário porque mesmo instruindo, a IA às vezes envolve em ```json ... ```
 */
function extrairJSON(texto) {
  // Remove blocos markdown ```json ... ``` ou ``` ... ```
  let limpo = texto.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  // Se houver texto antes/depois, tenta pegar do primeiro { ao último }
  const primeiroChave = limpo.indexOf('{');
  const ultimoChave = limpo.lastIndexOf('}');
  if (primeiroChave !== -1 && ultimoChave !== -1) {
    limpo = limpo.substring(primeiroChave, ultimoChave + 1);
  }

  return limpo;
}

module.exports = {
  executarPromptDoJogador,
  avaliarComJuizIA,
};
