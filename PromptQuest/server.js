// server.js (PRODUÇÃO)
// Mudanças vs versão local:
//   - CORS restrito (apenas localhost e a URL configurada do Vercel)
//   - Rate limiting (protege saldo da API)
//   - Lê PORT do ambiente (obrigatório no Render)
//   - trust proxy (necessário atrás do load balancer do Render)

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');

const { executarPromptDoJogador } = require('./claudeClient');
const { validar } = require('./validators');

const app = express();
const PORT = process.env.PORT || 3000;

// Necessário em produção: Render usa proxy reverso e rate-limit precisa do IP real
app.set('trust proxy', 1);

// ─────────────────────────────────────────────────────────────
// CORS RESTRITO
// ─────────────────────────────────────────────────────────────
const allowedOrigins = [
  // Localhost (qualquer porta) — pra desenvolvimento
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
];

// Adiciona a URL de produção do Vercel se configurada via env var
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    const ok = allowedOrigins.some(allowed =>
      allowed instanceof RegExp ? allowed.test(origin) : allowed === origin
    );
    if (ok) {
      callback(null, true);
    } else {
      console.warn(`CORS bloqueou origem: ${origin}`);
      callback(new Error('Origem não permitida pelo CORS'));
    }
  },
}));

app.use(express.json({ limit: '10kb' }));

// ─────────────────────────────────────────────────────────────
// RATE LIMITING (protege saldo da Claude)
// ─────────────────────────────────────────────────────────────
const submitLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,  // janela de 5 minutos
  max: 15,                  // até 15 submissões por IP nessa janela
  message: { erro: 'Você fez muitas tentativas. Espere alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Log básico
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// ─────────────────────────────────────────────────────────────
// CARREGA OS DESAFIOS
// ─────────────────────────────────────────────────────────────
const challengesPath = path.join(__dirname, 'challenges.json');
let DESAFIOS = [];
try {
  DESAFIOS = JSON.parse(fs.readFileSync(challengesPath, 'utf-8')).desafios;
  console.log(`✓ ${DESAFIOS.length} desafios carregados.`);
} catch (erro) {
  console.error('✗ Erro ao carregar challenges.json:', erro.message);
  process.exit(1);
}

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('✗ ANTHROPIC_API_KEY não está definida');
  process.exit(1);
}
console.log('✓ API key da Anthropic configurada.');

// ─────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────
function calcularPontuacao(pontosMax, tentativa) {
  if (tentativa === 1) return pontosMax;
  if (tentativa === 2) return Math.round(pontosMax * 0.7);
  if (tentativa === 3) return Math.round(pontosMax * 0.5);
  return Math.round(pontosMax * 0.3);
}

function desafioPublico(d) {
  return {
    id: d.id,
    titulo: d.titulo,
    dificuldade: d.dificuldade,
    pontos_max: d.pontos_max,
    briefing: d.briefing,
    pergunta_teste: d.pergunta_teste,
  };
}

// ─────────────────────────────────────────────────────────────
// ROTAS
// ─────────────────────────────────────────────────────────────

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    servico: 'PromptQuest Backend',
    desafios_disponiveis: DESAFIOS.length,
  });
});

app.get('/api/challenges', (req, res) => {
  res.json({ total: DESAFIOS.length, desafios: DESAFIOS.map(desafioPublico) });
});

app.get('/api/challenges/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const desafio = DESAFIOS.find(d => d.id === id);
  if (!desafio) return res.status(404).json({ erro: 'Desafio não encontrado.' });
  res.json(desafioPublico(desafio));
});

app.get('/api/challenges/:id/dica', (req, res) => {
  const id = parseInt(req.params.id, 10);
  const desafio = DESAFIOS.find(d => d.id === id);
  if (!desafio) return res.status(404).json({ erro: 'Desafio não encontrado.' });
  res.json({ dica: desafio.dica });
});

// Endpoint principal com rate limit
app.post('/api/submit', submitLimiter, async (req, res) => {
  const { challengeId, userPrompt, numeroTentativa } = req.body;

  if (!challengeId || !userPrompt) {
    return res.status(400).json({ erro: 'Campos obrigatórios: challengeId, userPrompt.' });
  }

  if (userPrompt.length > 4000) {
    return res.status(400).json({ erro: 'Prompt muito longo (máximo 4000 caracteres).' });
  }

  const desafio = DESAFIOS.find(d => d.id === challengeId);
  if (!desafio) return res.status(404).json({ erro: 'Desafio não encontrado.' });

  const tentativa = numeroTentativa || 1;

  try {
    console.log(`  → Executando prompt (desafio ${challengeId}, tentativa ${tentativa})`);
    const respostaIA = await executarPromptDoJogador(userPrompt, desafio.pergunta_teste);

    console.log(`  → Validando (tipo: ${desafio.validador.tipo})`);
    const resultado = await validar(respostaIA, desafio);

    const pontos = resultado.passou ? calcularPontuacao(desafio.pontos_max, tentativa) : 0;

    res.json({
      passou: resultado.passou,
      resposta_ia: respostaIA,
      pontos_ganhos: pontos,
      pontos_max: desafio.pontos_max,
      tentativa_numero: tentativa,
      feedback: resultado.feedback,
      detalhes: resultado.detalhes,
    });
  } catch (erro) {
    console.error('  ✗ Erro:', erro.message);
    res.status(500).json({ erro: 'Erro ao processar.', detalhe: erro.message });
  }
});

// Erro global
app.use((erro, req, res, next) => {
  console.error('Erro não tratado:', erro);
  res.status(500).json({ erro: 'Erro interno do servidor.' });
});

// ─────────────────────────────────────────────────────────────
// START
// ─────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════╗');
  console.log('║       PromptQuest Backend rodando      ║');
  console.log('╠════════════════════════════════════════╣');
  console.log(`║  Porta:   ${String(PORT).padEnd(28)} ║`);
  console.log(`║  Modelo:  ${(process.env.CLAUDE_MODEL || 'claude-haiku-4-5').padEnd(28)} ║`);
  console.log(`║  CORS:    ${(process.env.FRONTEND_URL || 'apenas localhost').padEnd(28)} ║`);
  console.log('╚════════════════════════════════════════╝');
  console.log('');
});
