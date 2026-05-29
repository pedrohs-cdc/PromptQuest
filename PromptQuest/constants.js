// constants.js
// Constantes compartilhadas entre frontend e backend

const GAME_CONSTANTS = {
  // Identidade visual do projeto
  THEME: {
    ACCENT: '#7B61FF',      // Roxo Elétrico — botões, ícones e destaques
    SUCCESS: '#00D1FF',     // Ciano Brilhante — passou no teste / sucesso
    BACKGROUND: '#05070A',  // Azul-marinho quase preto — fundo principal
  },

  // Multiplicadores de pontuação por tentativa
  SCORING_MULTIPLIERS: [1.0, 0.7, 0.5, 0.3],

  // Limites de prompt
  PROMPT_MIN_LENGTH: 5,
  PROMPT_MAX_LENGTH: 4000,

  // Thresholds de rank (wins, score mínimo para Mestre)
  RANKS: [
    { wins: 10, score: 140, label: 'Mestre', emphasis: 'Mestre dos Prompts', msg: 'Você domina a arte de instruir IAs. Impressionante.' },
    { wins: 8, label: 'Engenheiro', emphasis: 'Engenheiro de Prompts', msg: 'Você entende como pensar em camadas e antecipar comportamentos do modelo.' },
    { wins: 5, label: 'Praticante', emphasis: 'Praticante Avançado', msg: 'Você já consegue domar a IA na maioria dos casos. Continue refinando.' },
    { wins: 2, label: 'Aprendiz', emphasis: 'Aprendiz de Prompt', msg: 'Você está começando a entender como falar com IAs. Há muito a explorar.' },
    { wins: 0, label: 'Iniciante', emphasis: 'Iniciante', msg: 'Cada falha é um aprendizado sobre como modelos pensam. Tente de novo!' },
  ],

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: 60 * 1000, // 1 minuto
  RATE_LIMIT_MAX_REQUESTS: 10,

  // API timeouts
  API_TIMEOUT_MS: 30000,
};

// Funções utilitárias
GAME_CONSTANTS.getMultiplier = (attempt) => {
  return GAME_CONSTANTS.SCORING_MULTIPLIERS[Math.min(attempt - 1, GAME_CONSTANTS.SCORING_MULTIPLIERS.length - 1)];
};

GAME_CONSTANTS.calculatePoints = (maxPoints, attempt) => {
  return Math.round(maxPoints * GAME_CONSTANTS.getMultiplier(attempt));
};

GAME_CONSTANTS.getRank = (score, wins) => {
  for (const rank of GAME_CONSTANTS.RANKS) {
    if (wins >= rank.wins && (rank.score === undefined || score >= rank.score)) {
      return {
        rank: `<em>${rank.emphasis}</em>`,
        msg: rank.msg
      };
    }
  }
  return GAME_CONSTANTS.RANKS[GAME_CONSTANTS.RANKS.length - 1]; // Iniciante
};

module.exports = GAME_CONSTANTS;
