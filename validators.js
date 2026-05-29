// validators.js
// Implementa os 5 tipos de validadores definidos no challenges.json:
// regex, linhas, json, ia_juiz, hibrido

const { avaliarComJuizIA } = require('./claudeClient');

/**
 * Ponto de entrada principal. Roteia para o validador correto
 * baseado no campo "tipo" do desafio.
 */
async function validar(resposta, desafio) {
  const config = desafio.validador;

  switch (config.tipo) {
    case 'regex':
      return validarRegex(resposta, config);
    case 'linhas':
      return validarLinhas(resposta, config);
    case 'json':
      return validarJSON(resposta, config);
    case 'ia_juiz':
      return await validarComJuizIA(resposta, config);
    case 'hibrido':
      return await validarHibrido(resposta, config);
    default:
      return {
        passou: false,
        feedback: `Tipo de validador desconhecido: ${config.tipo}`,
        detalhes: []
      };
  }
}

// ─────────────────────────────────────────────────────────────
// VALIDADOR 1: REGEX
// ─────────────────────────────────────────────────────────────
function validarRegex(resposta, config) {
  const texto = config.trim ? resposta.trim() : resposta;
  const flags = config.case_insensitive ? 'i' : '';
  const regex = new RegExp(config.padrao, flags);
  const passou = regex.test(texto);

  return {
    passou,
    feedback: passou
      ? 'Resposta no formato exato esperado.'
      : 'A resposta não bateu com o padrão esperado. Reveja o formato pedido no briefing.',
    detalhes: [`Padrão testado: ${config.padrao}`]
  };
}

// ─────────────────────────────────────────────────────────────
// VALIDADOR 2: LINHAS
// ─────────────────────────────────────────────────────────────
function validarLinhas(resposta, config) {
  const linhas = resposta
    .split('\n')
    .map(l => l.trim())
    .filter(l => config.linha_nao_vazia ? l.length > 0 : true);

  const detalhes = [];
  let passou = true;

  // Verifica quantidade exata
  if (config.quantidade_exata !== undefined) {
    if (linhas.length !== config.quantidade_exata) {
      passou = false;
      detalhes.push(`Esperado ${config.quantidade_exata} linhas, recebido ${linhas.length}.`);
    }
  }

  // Verifica ausência de numeração (1., 2), 1-, etc)
  if (config.proibir_numeracao) {
    const regexNumeracao = /^\s*\d+[.)\-:]\s/;
    const temNumeracao = linhas.some(l => regexNumeracao.test(l));
    if (temNumeracao) {
      passou = false;
      detalhes.push('Foi detectada numeração nas linhas (ex: "1.", "2)", "3-").');
    }
  }

  // Verifica ausência de marcadores (-, *, •)
  if (config.proibir_marcadores) {
    const regexMarcador = /^\s*[-*•·]\s/;
    const temMarcador = linhas.some(l => regexMarcador.test(l));
    if (temMarcador) {
      passou = false;
      detalhes.push('Foram detectados marcadores nas linhas (ex: "-", "*", "•").');
    }
  }

  return {
    passou,
    feedback: passou
      ? 'Formato de lista correto.'
      : 'A formatação da lista não atendeu aos requisitos. Reveja a estrutura pedida.',
    detalhes
  };
}

// ─────────────────────────────────────────────────────────────
// VALIDADOR 3: JSON
// ─────────────────────────────────────────────────────────────
function validarJSON(resposta, config) {
  const textoLimpo = resposta.trim();
  const detalhes = [];

  // Se proíbe texto externo, verifica se começa com { e termina com }
  if (config.proibir_texto_externo) {
    if (!textoLimpo.startsWith('{') || !textoLimpo.endsWith('}')) {
      return {
        passou: false,
        feedback: 'A resposta deve ser APENAS um JSON, sem texto antes ou depois (e sem ```json).',
        detalhes: ['Detectado texto fora do JSON.']
      };
    }
  }

  // Tenta fazer parse
  let obj;
  try {
    obj = JSON.parse(textoLimpo);
  } catch (erro) {
    return {
      passou: false,
      feedback: 'O JSON é inválido e não pôde ser parseado.',
      detalhes: [`Erro de parse: ${erro.message}`]
    };
  }

  // Verifica campos obrigatórios e tipos
  let passou = true;
  for (const campo of config.campos_obrigatorios) {
    if (!(campo.nome in obj)) {
      passou = false;
      detalhes.push(`Campo obrigatório "${campo.nome}" está ausente.`);
      continue;
    }
    const valor = obj[campo.nome];
    const tipoReal = Array.isArray(valor) ? 'array' : typeof valor;
    if (tipoReal !== campo.tipo) {
      passou = false;
      detalhes.push(`Campo "${campo.nome}" deveria ser ${campo.tipo}, mas é ${tipoReal}.`);
    }
  }

  // Verifica campos extras (se proibidos)
  if (config.permitir_campos_extras === false) {
    const nomesPermitidos = config.campos_obrigatorios.map(c => c.nome);
    const camposExtras = Object.keys(obj).filter(k => !nomesPermitidos.includes(k));
    if (camposExtras.length > 0) {
      passou = false;
      detalhes.push(`Campos não permitidos: ${camposExtras.join(', ')}.`);
    }
  }

  return {
    passou,
    feedback: passou
      ? 'JSON válido com todos os campos corretos.'
      : 'O JSON foi parseado mas tem problemas estruturais.',
    detalhes
  };
}

// ─────────────────────────────────────────────────────────────
// VALIDADOR 4: IA JUIZ
// ─────────────────────────────────────────────────────────────
async function validarComJuizIA(resposta, config) {
  const avaliacao = await avaliarComJuizIA(resposta, config.criterios_juiz);

  return {
    passou: avaliacao.passou,
    feedback: avaliacao.feedback || (avaliacao.passou
      ? 'Todos os critérios subjetivos foram atendidos.'
      : 'Nem todos os critérios foram cumpridos.'),
    detalhes: [
      ...avaliacao.criterios_atendidos.map(c => `✓ ${c}`),
      ...avaliacao.criterios_falhos.map(c => `✗ ${c}`)
    ]
  };
}

// ─────────────────────────────────────────────────────────────
// VALIDADOR 5: HÍBRIDO (código + IA juiz)
// ─────────────────────────────────────────────────────────────
async function validarHibrido(resposta, config) {
  // Roda primeiro a validação por código
  const validacaoCodigo = validarValidacaoEspecifica(resposta, config.validacao_codigo);

  // Roda também a validação por IA juiz
  const validacaoIA = await avaliarComJuizIA(resposta, config.criterios_juiz);

  // Ambas precisam passar
  const passou = validacaoCodigo.passou && validacaoIA.passou;

  return {
    passou,
    feedback: passou
      ? 'Tanto a estrutura quanto o conteúdo atenderam aos critérios.'
      : 'A resposta falhou em pelo menos uma das verificações (estrutural ou de conteúdo).',
    detalhes: [
      `[Estrutura] ${validacaoCodigo.passou ? '✓' : '✗'} ${validacaoCodigo.feedback}`,
      ...validacaoCodigo.detalhes,
      ...validacaoIA.criterios_atendidos.map(c => `[Conteúdo] ✓ ${c}`),
      ...validacaoIA.criterios_falhos.map(c => `[Conteúdo] ✗ ${c}`)
    ]
  };
}

/**
 * Sub-validador usado pelo híbrido. Atualmente trata "acrostico".
 * Pode ser estendido para outros tipos específicos.
 */
function validarValidacaoEspecifica(resposta, config) {
  if (config.tipo === 'acrostico') {
    return validarAcrostico(resposta, config);
  }
  return { passou: true, feedback: 'Sem validação adicional.', detalhes: [] };
}

function validarAcrostico(resposta, config) {
  const paragrafos = resposta
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const detalhes = [];
  let passou = true;

  if (paragrafos.length !== config.paragrafos_exatos) {
    passou = false;
    detalhes.push(`Esperado ${config.paragrafos_exatos} parágrafos, recebido ${paragrafos.length}.`);
  }

  const palavraAlvo = config.case_insensitive
    ? config.palavra_alvo.toUpperCase()
    : config.palavra_alvo;

  const palavraFormada = paragrafos
    .map(p => config.case_insensitive ? p[0]?.toUpperCase() : p[0])
    .join('');

  if (palavraFormada !== palavraAlvo) {
    passou = false;
    detalhes.push(`Acróstico formado: "${palavraFormada}". Esperado: "${palavraAlvo}".`);
  } else {
    detalhes.push(`Acróstico correto: "${palavraFormada}".`);
  }

  return {
    passou,
    feedback: passou ? 'Estrutura do acróstico correta.' : 'Estrutura do acróstico incorreta.',
    detalhes
  };
}

module.exports = { validar };
