// ═══════════════════════════════════════════════════════════
// PromptQuest — Frontend (PRODUÇÃO)
// ═══════════════════════════════════════════════════════════

const API_BASE = window.API_BASE || 'http://localhost:3000';

// ──────────────────────────────────────────────
// PERSISTÊNCIA — localStorage
// ──────────────────────────────────────────────
const STORAGE_KEY = 'promptquest_save';

function salvarProgresso() {
  const save = {
    playerName: state.playerName,
    sessionScore: state.sessionScore,
    completedIds: [...state.completedIds],
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(save));
}

function carregarProgresso() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const save = JSON.parse(raw);
    if (save.playerName)   state.playerName   = save.playerName;
    if (save.sessionScore) state.sessionScore = save.sessionScore;
    if (Array.isArray(save.completedIds)) {
      state.completedIds = new Set(save.completedIds);
    }
  } catch (e) {
    console.warn('Erro ao carregar save:', e);
    localStorage.removeItem(STORAGE_KEY);
  }
}

function limparProgresso() {
  localStorage.removeItem(STORAGE_KEY);
}

// ──────────────────────────────────────────────
// ESTADO GLOBAL DA SESSÃO
// ──────────────────────────────────────────────
const state = {
  challenges: [],
  currentChallenge: null,
  currentAttempt: 1,
  sessionScore: 0,
  playerName: 'Visitante',
  completedIds: new Set(),
  views: ['Home', 'Select', 'Game', 'Result', 'Final'],
};

// ──────────────────────────────────────────────
// REFERÊNCIAS AO DOM
// ──────────────────────────────────────────────
const $ = (id) => document.getElementById(id);

const els = {
  scoreValue: $('scoreValue'),
  views: {
    Home: $('viewHome'),
    Select: $('viewSelect'),
    Game: $('viewGame'),
    Result: $('viewResult'),
    Final: $('viewFinal'),
  },
  btnLogoHome: $('btnLogoHome'),
  btnStartGame: $('btnStartGame'),
  btnBackToSelect: $('btnBackToSelect'),
  btnTryAgain: $('btnTryAgain'),
  btnNextChallenge: $('btnNextChallenge'),
  btnPlayAgain: $('btnPlayAgain'),
  btnSubmitPrompt: $('btnSubmitPrompt'),
  challengesGrid: $('challengesGrid'),
  gameChallengeId: $('gameChallengeId'),
  gameChallengeDif: $('gameChallengeDif'),
  gameChallengePoints: $('gameChallengePoints'),
  gameChallengeTitle: $('gameChallengeTitle'),
  gameChallengeBriefing: $('gameChallengeBriefing'),
  gameChallengeTest: $('gameChallengeTest'),
  gameAttempt: $('gameAttempt'),
  gameMultiplier: $('gameMultiplier'),
  hintBox: $('hintBox'),
  hintText: $('hintText'),
  userPromptInput: $('userPromptInput'),
  charCount: $('charCount'),
  resultLoading: $('resultLoading'),
  resultContent: $('resultContent'),
  resultBanner: $('resultBanner'),
  resultIcon: $('resultIcon'),
  resultTitle: $('resultTitle'),
  resultSubtitle: $('resultSubtitle'),
  resultUserPrompt: $('resultUserPrompt'),
  resultIAResponse: $('resultIAResponse'),
  resultFeedback: $('resultFeedback'),
  resultDetails: $('resultDetails'),
  btnNextLabel: $('btnNextLabel'),
  finalRank: $('finalRank'),
  finalMessage: $('finalMessage'),
  finalScore: $('finalScore'),
  finalWins: $('finalWins'),
  finalPlayerNameDisplay: $('finalPlayerNameDisplay'),
  toast: $('toast'),
  playerNameInput: $('playerNameInput'),
  playerNameDisplay: $('playerNameDisplay'),
};

// ──────────────────────────────────────────────
// HELPERS
// ──────────────────────────────────────────────
function showView(name) {
  Object.values(els.views).forEach(v => v.classList.remove('active'));
  els.views[name].classList.add('active');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function showToast(mensagem, duracao = 4000) {
  els.toast.textContent = mensagem;
  els.toast.classList.add('show');
  setTimeout(() => els.toast.classList.remove('show'), duracao);
}

function updateScore(novoValor) {
  state.sessionScore = novoValor;
  els.scoreValue.textContent = novoValor;
  els.scoreValue.classList.add('bump');
  setTimeout(() => els.scoreValue.classList.remove('bump'), 500);
  salvarProgresso(); // ← persiste sempre que o score muda
}

function multiplicadorDaTentativa(numero) {
  if (numero === 1) return 1.0;
  if (numero === 2) return 0.7;
  if (numero === 3) return 0.5;
  return 0.3;
}

async function apiCall(path, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      const erro = await response.json().catch(() => ({}));
      throw new Error(erro.erro || `Erro ${response.status}`);
    }

    return await response.json();
  } catch (erro) {
    if (erro.message.includes('Failed to fetch')) {
      throw new Error('Não foi possível conectar ao servidor. Tente novamente em alguns instantes.');
    }
    throw erro;
  }
}

// ──────────────────────────────────────────────
// CARD BÔNUS
// ──────────────────────────────────────────────
const BONUS_UNLOCK_THRESHOLD = 9;

function renderizarCardBonus() {
  const desafiosNormaisCompletos = [...state.completedIds].filter(id => id !== 10).length;
  const desbloqueado = desafiosNormaisCompletos >= BONUS_UNLOCK_THRESHOLD;
  const faltam = BONUS_UNLOCK_THRESHOLD - desafiosNormaisCompletos;

  if (desbloqueado) {
    const d = state.challenges.find(c => c.id === 10);
    if (d) {
      const completado = state.completedIds.has(10) ? 'completed' : '';
      return `
        <article class="challenge-card challenge-card--bonus ${completado}" data-id="10">
          <div class="card-top">
            <span class="card-id">#10</span>
            <span class="card-dif card-dif--bonus">BÔNUS</span>
          </div>
          <h3 class="card-title">${escapeHTML(d.titulo)}</h3>
          <p class="card-brief">${escapeHTML(d.briefing)}</p>
          <div class="card-footer">
            <span class="card-points">${d.pontos_max} pts</span>
            <span class="card-go">jogar →</span>
          </div>
        </article>
      `;
    }
  }

  return `
    <article class="challenge-card challenge-card--locked" data-id="bonus-locked" aria-disabled="true">
      <div class="card-top">
        <span class="card-id">#10</span>
        <span class="card-dif card-dif--bonus">BÔNUS</span>
      </div>
      <h3 class="card-title">??? Desafio Secreto</h3>
      <p class="card-brief">Complete todos os 9 desafios para desbloquear este desafio especial.</p>
      <div class="bonus-progress">
        <div class="bonus-progress-bar">
          <div class="bonus-progress-fill" style="width: ${(desafiosNormaisCompletos / BONUS_UNLOCK_THRESHOLD) * 100}%"></div>
        </div>
        <span class="bonus-progress-label">
          ${desafiosNormaisCompletos}/9 concluídos${faltam > 0 ? ` — faltam ${faltam}` : ''}
        </span>
      </div>
      <div class="card-footer">
        <span class="card-points">? pts</span>
        <span class="lock-icon">🔒</span>
      </div>
    </article>
  `;
}

// ──────────────────────────────────────────────
// CARREGAMENTO DE DESAFIOS
// ──────────────────────────────────────────────
async function carregarDesafios() {
  try {
    const data = await apiCall('/api/challenges');
    state.challenges = data.desafios;
    renderizarGridDeDesafios();
  } catch (erro) {
    console.error(erro);
    els.challengesGrid.innerHTML = `
      <div class="loading-state">
        <p style="color: var(--color-fail);">⚠ ${erro.message}</p>
        <button class="btn btn--ghost" onclick="carregarDesafios()">Tentar novamente</button>
      </div>
    `;
  }
}

function renderizarGridDeDesafios() {
  const desafiosNormais = state.challenges.filter(d => d.id !== 10);

  const htmlNormais = desafiosNormais.map(d => {
    const completado = state.completedIds.has(d.id) ? 'completed' : '';
    const difLabel = {
      facil: 'Fácil',
      medio: 'Médio',
      dificil: 'Difícil',
      bonus: 'Bônus'
    }[d.dificuldade] || d.dificuldade;

    return `
      <article class="challenge-card ${completado}" data-id="${d.id}">
        <div class="card-top">
          <span class="card-id">#${String(d.id).padStart(2, '0')}</span>
          <span class="card-dif card-dif--${d.dificuldade}">${difLabel}</span>
        </div>
        <h3 class="card-title">${escapeHTML(d.titulo)}</h3>
        <p class="card-brief">${escapeHTML(d.briefing)}</p>
        <div class="card-footer">
          <span class="card-points">${d.pontos_max} pts</span>
          <span class="card-go">jogar →</span>
        </div>
      </article>
    `;
  }).join('');

  els.challengesGrid.innerHTML = htmlNormais + renderizarCardBonus();

  document.querySelectorAll('.challenge-card:not(.challenge-card--locked)').forEach(card => {
    card.addEventListener('click', () => {
      iniciarDesafio(parseInt(card.dataset.id, 10));
    });
  });

  const cardBloqueado = document.querySelector('.challenge-card--locked');
  if (cardBloqueado) {
    cardBloqueado.addEventListener('click', () => {
      const faltam = BONUS_UNLOCK_THRESHOLD - [...state.completedIds].filter(id => id !== 10).length;
      showToast(`Complete mais ${faltam} desafio${faltam > 1 ? 's' : ''} para desbloquear o bônus.`);
    });
  }
}

function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ──────────────────────────────────────────────
// FLUXO DO JOGO
// ──────────────────────────────────────────────
function iniciarDesafio(id) {
  const desafio = state.challenges.find(d => d.id === id);
  if (!desafio) {
    showToast('Desafio não encontrado.');
    return;
  }

  state.currentChallenge = desafio;
  state.currentAttempt = 1;

  preencherTelaDeJogo(desafio);
  els.userPromptInput.value = '';
  atualizarContadorCaracteres();
  els.hintBox.style.display = 'none';

  showView('Game');
  els.userPromptInput.focus();
}

function preencherTelaDeJogo(d) {
  els.gameChallengeId.textContent = `#${String(d.id).padStart(2, '0')}`;
  els.gameChallengeDif.textContent = d.dificuldade.toUpperCase();
  els.gameChallengePoints.textContent = d.pontos_max;
  els.gameChallengeTitle.textContent = d.titulo;
  els.gameChallengeBriefing.textContent = d.briefing;
  els.gameChallengeTest.textContent = d.pergunta_teste;
  atualizarTentativa();
}

function atualizarTentativa() {
  els.gameAttempt.textContent = state.currentAttempt;
  const mult = multiplicadorDaTentativa(state.currentAttempt);
  els.gameMultiplier.textContent = `×${mult.toFixed(1)}`;
}

function atualizarContadorCaracteres() {
  els.charCount.textContent = els.userPromptInput.value.length;
}

async function submeterPrompt() {
  const userPrompt = els.userPromptInput.value.trim();

  if (userPrompt.length < 5) {
    showToast('Escreva um prompt mais detalhado.');
    return;
  }

  showView('Result');
  els.resultLoading.style.display = 'flex';
  els.resultContent.style.display = 'none';

  try {
    const data = await apiCall('/api/submit', {
      method: 'POST',
      body: JSON.stringify({
        challengeId: state.currentChallenge.id,
        userPrompt,
        numeroTentativa: state.currentAttempt,
      }),
    });

    mostrarResultado(data, userPrompt);

    if (data.passou && !state.completedIds.has(state.currentChallenge.id)) {
      state.completedIds.add(state.currentChallenge.id);
      updateScore(state.sessionScore + data.pontos_ganhos); // ← já salva via updateScore

      const normaisCompletos = [...state.completedIds].filter(id => id !== 10).length;
      if (normaisCompletos === BONUS_UNLOCK_THRESHOLD) {
        setTimeout(() => {
          showToast('🔓 Desafio bônus desbloqueado! Volte ao catálogo para jogar.', 5000);
        }, 1500);
      }
    }

    if (!data.passou) await liberarDica();

  } catch (erro) {
    console.error(erro);
    showToast(erro.message);
    showView('Game');
  }
}

async function liberarDica() {
  try {
    const data = await apiCall(`/api/challenges/${state.currentChallenge.id}/dica`);
    els.hintText.textContent = data.dica;
    els.hintBox.style.display = 'block';
  } catch (erro) {
    console.error('Erro ao buscar dica:', erro);
  }
}

function mostrarResultado(data, userPrompt) {
  els.resultLoading.style.display = 'none';
  els.resultContent.style.display = 'flex';

  els.resultBanner.classList.remove('passed', 'failed');
  if (data.passou) {
    els.resultBanner.classList.add('passed');
    els.resultIcon.textContent = '✓';
    els.resultTitle.textContent = 'Você passou!';
    els.resultSubtitle.textContent = `+${data.pontos_ganhos} pontos conquistados (tentativa ${data.tentativa_numero})`;
  } else {
    els.resultBanner.classList.add('failed');
    els.resultIcon.textContent = '×';
    els.resultTitle.textContent = 'Ainda não.';
    els.resultSubtitle.textContent = `Tentativa ${data.tentativa_numero} — refine seu prompt e tente de novo`;
  }

  els.resultUserPrompt.textContent = userPrompt;
  els.resultIAResponse.textContent = data.resposta_ia || '(sem resposta)';
  els.resultFeedback.textContent = data.feedback || 'Sem feedback adicional.';

  els.resultDetails.innerHTML = (data.detalhes || [])
    .map(d => `<li>${escapeHTML(d)}</li>`)
    .join('');

  els.btnNextLabel.textContent = data.passou ? 'Próximo desafio' : 'Pular este desafio';
}

function tentarNovamente() {
  state.currentAttempt += 1;
  atualizarTentativa();
  showView('Game');
  els.userPromptInput.focus();
}

function proximoDesafio() {
  const idAtual = state.currentChallenge.id;
  const idxAtual = state.challenges.findIndex(d => d.id === idAtual);

  for (let i = 1; i <= state.challenges.length; i++) {
    const idx = (idxAtual + i) % state.challenges.length;
    const d = state.challenges[idx];
    if (!state.completedIds.has(d.id)) {
      iniciarDesafio(d.id);
      return;
    }
  }

  mostrarPlacarFinal();
}

function mostrarPlacarFinal() {
  els.finalScore.textContent = state.sessionScore;
  els.finalWins.textContent = state.completedIds.size;

  if (els.finalPlayerNameDisplay) {
    els.finalPlayerNameDisplay.textContent = state.playerName;
  }

  const { rank, msg } = calcularRank(state.sessionScore, state.completedIds.size);
  els.finalRank.innerHTML = rank;
  els.finalMessage.textContent = msg;

  showView('Final');
}

function calcularRank(score, wins) {
  if (wins === 10 && score >= 140) {
    return { rank: '<em>Mestre</em> dos Prompts', msg: 'Você domina a arte de instruir IAs. Impressionante.' };
  }
  if (wins >= 8) {
    return { rank: '<em>Engenheiro</em> de Prompts', msg: 'Você entende como pensar em camadas e antecipar comportamentos do modelo.' };
  }
  if (wins >= 5) {
    return { rank: '<em>Praticante</em> Avançado', msg: 'Você já consegue domar a IA na maioria dos casos. Continue refinando.' };
  }
  if (wins >= 2) {
    return { rank: '<em>Aprendiz</em> de Prompt', msg: 'Você está começando a entender como falar com IAs. Há muito a explorar.' };
  }
  return { rank: '<em>Iniciante</em>', msg: 'Cada falha é um aprendizado sobre como modelos pensam. Tente de novo!' };
}

function jogarDeNovo() {
  state.currentChallenge = null;
  state.currentAttempt = 1;
  state.sessionScore = 0;
  state.completedIds.clear();
  limparProgresso(); // ← apaga o save ao reiniciar
  updateScore(0);
  renderizarGridDeDesafios();
  showView('Select');
}

// ──────────────────────────────────────────────
// EVENT LISTENERS
// ──────────────────────────────────────────────
function setupListeners() {
  if (els.btnLogoHome) {
    els.btnLogoHome.addEventListener('click', () => showView('Home'));
  }

  els.btnStartGame.addEventListener('click', () => {
    const name = els.playerNameInput.value.trim();
    if (name) {
      state.playerName = name;
      salvarProgresso(); // ← persiste o nome ao começar
    }

    if (els.playerNameDisplay) {
      els.playerNameDisplay.textContent = `${state.playerName.toUpperCase()} - PONTOS`;
    }

    showView('Select');
    if (state.challenges.length === 0) carregarDesafios();
  });

  els.btnBackToSelect.addEventListener('click', () => showView('Select'));
  els.btnSubmitPrompt.addEventListener('click', submeterPrompt);
  els.btnTryAgain.addEventListener('click', tentarNovamente);
  els.btnNextChallenge.addEventListener('click', proximoDesafio);
  els.btnPlayAgain.addEventListener('click', jogarDeNovo);

  els.userPromptInput.addEventListener('input', atualizarContadorCaracteres);
  els.userPromptInput.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      submeterPrompt();
    }
  });
}

// ──────────────────────────────────────────────
// INIT
// ──────────────────────────────────────────────
function init() {
  carregarProgresso(); // ← restaura save antes de tudo

  setupListeners();

  // Se já tem save, preenche o campo de nome e vai direto pro catálogo
  if (state.completedIds.size > 0 || state.sessionScore > 0) {
    if (els.playerNameInput) els.playerNameInput.value = state.playerName;
    if (els.playerNameDisplay) {
      els.playerNameDisplay.textContent = `${state.playerName.toUpperCase()} - PONTOS`;
    }
    updateScore(state.sessionScore);
    carregarDesafios().then(() => showView('Select'));
    showToast(`Bem-vindo de volta, ${state.playerName}! 👋 Progresso restaurado.`, 4000);
  } else {
    showView('Home');
    carregarDesafios();
  }
}

document.addEventListener('DOMContentLoaded', init);