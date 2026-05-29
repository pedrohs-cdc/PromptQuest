// judgePrompts.js
// As 4 versões evolutivas do prompt do juiz, exportadas como funções.
// Cada função recebe (resposta, criterios) e retorna a string do prompt.
//
// Para usar uma versão no jogo, importe e troque o valor no claudeClient.js:
//   const { JUDGE_PROMPTS } = require('./judgePrompts');
//   const VERSAO_DO_JUIZ = 'v4'; // 'v1' | 'v2' | 'v3' | 'v4'

// ──────────────────────────────────────────────
// V1 — INGÊNUA
// ──────────────────────────────────────────────
function v1(resposta, criterios) {
  return `Avalie se a resposta abaixo está boa.

Resposta:
${resposta}

A resposta passa?`;
}

// ──────────────────────────────────────────────
// V2 — ESTRUTURADA
// ──────────────────────────────────────────────
function v2(resposta, criterios) {
  const criteriosFormatados = criterios
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `Você é um avaliador. Determine se a RESPOSTA cumpre TODOS os critérios.
Seja rigoroso: se UM critério falhou, a resposta NÃO passa.

CRITÉRIOS:
${criteriosFormatados}

RESPOSTA:
"""
${resposta}
"""

Retorne APENAS um JSON neste formato:
{
  "passou": true ou false,
  "criterios_atendidos": [],
  "criterios_falhos": [],
  "feedback_construtivo": "uma frase"
}`;
}

// ──────────────────────────────────────────────
// V3 — FEW-SHOT
// ──────────────────────────────────────────────
function v3(resposta, criterios) {
  const criteriosFormatados = criterios
    .map((c, i) => `${i + 1}. ${c}`)
    .join('\n');

  return `Você é um avaliador automatizado de respostas geradas por IA.
Sua função: determinar se uma RESPOSTA cumpre TODOS os critérios listados.

REGRA FUNDAMENTAL: Só retorne "passou: true" se LITERALMENTE todos os critérios foram cumpridos. Em caso de dúvida, reprove.

──── EXEMPLOS DE COMO AVALIAR ────

EXEMPLO 1 — Caso de aprovação:
Critérios:
  1. A resposta contém exatamente 3 itens
  2. Cada item está em uma linha separada
  3. Não há numeração ou marcadores
Resposta:
"""
Maçã
Banana
Laranja
"""
Avaliação correta:
{
  "passou": true,
  "criterios_atendidos": [
    "Contém 3 itens (Maçã, Banana, Laranja)",
    "Cada item em linha separada",
    "Sem numeração ou marcadores"
  ],
  "criterios_falhos": [],
  "feedback_construtivo": "Formato perfeito."
}

EXEMPLO 2 — Caso de reprovação por detalhe sutil:
Critérios:
  1. A resposta contém exatamente 3 itens
  2. Cada item está em uma linha separada
  3. Não há numeração ou marcadores
Resposta:
"""
- Maçã
- Banana
- Laranja
"""
Avaliação correta:
{
  "passou": false,
  "criterios_atendidos": [
    "Contém 3 itens",
    "Cada item em linha separada"
  ],
  "criterios_falhos": [
    "Há marcadores (traços) antes de cada item"
  ],
  "feedback_construtivo": "Instrua a IA a NÃO usar marcadores como traços ou asteriscos."
}

──── AGORA AVALIE ────

CRITÉRIOS:
${criteriosFormatados}

RESPOSTA:
"""
${resposta}
"""

Retorne EXCLUSIVAMENTE um JSON válido no mesmo formato dos exemplos. Sem markdown, sem \`\`\`json, sem texto antes ou depois.`;
}

// ──────────────────────────────────────────────
// V4 — CHAIN-OF-THOUGHT + FEW-SHOT + ROLE
// ──────────────────────────────────────────────
function v4(resposta, criterios) {
  const criteriosFormatados = criterios
    .map((c, i) => `  ${i + 1}. ${c}`)
    .join('\n');

  return `# PAPEL
Você é um avaliador automatizado rigoroso de respostas geradas por IA.
Sua única função é determinar, de forma auditável, se uma RESPOSTA cumpre TODOS os critérios.

# PRINCÍPIOS OPERACIONAIS
1. Avalie cada critério INDEPENDENTEMENTE, na ordem listada.
2. Para critérios quantitativos (contar palavras, linhas, parágrafos), CONTE explicitamente.
3. Para critérios qualitativos, cite o trecho da resposta que justifica seu julgamento.
4. Em caso de ambiguidade, REPROVE. A confiança alta na aprovação vem da clareza.
5. "passou: true" exige que TODOS os critérios sejam atendidos sem exceção.

# FORMATO DE SAÍDA
Você raciocina passo a passo no campo "raciocinio" antes de chegar à decisão final.
Retorne EXCLUSIVAMENTE um JSON válido, sem markdown, sem cercas \`\`\`, sem texto antes ou depois.

──── EXEMPLO 1: APROVAÇÃO ────

CRITÉRIOS:
  1. A resposta contém exatamente 3 itens
  2. Cada item está em uma linha separada
  3. Não há numeração ou marcadores

RESPOSTA:
"""
Maçã
Banana
Laranja
"""

SAÍDA CORRETA:
{
  "raciocinio": "Critério 1: conto as linhas não vazias — 'Maçã', 'Banana', 'Laranja' = 3 itens. ATENDIDO. Critério 2: cada item ocupa sua própria linha, separados por \\\\n. ATENDIDO. Critério 3: nenhum item começa com número (1., 2., 3.) ou marcador (-, *, •). ATENDIDO. Todos os 3 critérios passaram.",
  "passou": true,
  "criterios_atendidos": [
    "Contém exatamente 3 itens",
    "Cada item em linha separada",
    "Sem numeração ou marcadores"
  ],
  "criterios_falhos": [],
  "feedback_construtivo": "Formato exato como pedido."
}

──── EXEMPLO 2: REPROVAÇÃO ────

CRITÉRIOS:
  1. A resposta tem no máximo 20 palavras
  2. A resposta menciona o nome 'Maria'
  3. A resposta não começa com 'Aqui está' ou similar

RESPOSTA:
"""
Aqui está o resumo: Maria foi uma cientista brilhante que ganhou dois prêmios Nobel ao longo de sua carreira científica notável.
"""

SAÍDA CORRETA:
{
  "raciocinio": "Critério 1: contando as palavras — 'Aqui'(1) 'está'(2) 'o'(3) 'resumo'(4) 'Maria'(5) 'foi'(6) 'uma'(7) 'cientista'(8) 'brilhante'(9) 'que'(10) 'ganhou'(11) 'dois'(12) 'prêmios'(13) 'Nobel'(14) 'ao'(15) 'longo'(16) 'de'(17) 'sua'(18) 'carreira'(19) 'científica'(20) 'notável'(21) = 21 palavras. Excede 20. FALHOU. Critério 2: 'Maria' aparece literalmente. ATENDIDO. Critério 3: a resposta começa com 'Aqui está o resumo:' — exatamente o padrão proibido. FALHOU. Como 2 critérios falharam, passou = false.",
  "passou": false,
  "criterios_atendidos": [
    "Critério 2: 'Maria' está mencionada"
  ],
  "criterios_falhos": [
    "Critério 1: a resposta tem 21 palavras, excede o limite de 20",
    "Critério 3: começa com 'Aqui está o resumo:', padrão proibido"
  ],
  "feedback_construtivo": "Instrua a IA a ir direto ao ponto, sem frases de introdução, e a contar palavras antes de responder."
}

──── AGORA AVALIE ────

CRITÉRIOS:
${criteriosFormatados}

RESPOSTA:
"""
${resposta}
"""

Retorne EXCLUSIVAMENTE o JSON. Comece com \`{\` e termine com \`}\`. Nada mais.`;
}

// ──────────────────────────────────────────────
// EXPORTS
// ──────────────────────────────────────────────
const JUDGE_PROMPTS = { v1, v2, v3, v4 };

module.exports = { JUDGE_PROMPTS };
