# PromptQuest — Frontend

Interface web do jogo. HTML + CSS + JavaScript puro (sem framework).

## Estrutura

```
frontend/
├── index.html    # Estrutura das 5 telas
├── style.css     # Tema "Editorial Terminal"
└── script.js     # Lógica, estado e chamadas à API
```

## Pré-requisitos

O backend precisa estar rodando antes em `http://localhost:3000`.
Veja `backend/README.md` se ainda não subiu.

## Como rodar

Por causa do CORS e do `fetch`, é melhor servir os arquivos por um servidor local em vez de abrir `index.html` direto pelo Finder/Explorador.

**Opção 1 — Python (vem instalado na maioria dos sistemas):**
```bash
cd frontend
python3 -m http.server 8000
```
Acesse `http://localhost:8000`.

**Opção 2 — Node.js:**
```bash
cd frontend
npx serve .
```

**Opção 3 — Live Server (VS Code):**
Instale a extensão "Live Server" e clique com botão direito em `index.html` → "Open with Live Server".

## Mudando a URL do backend

Se rodar o backend em outra porta ou em produção, edite a primeira linha de `script.js`:

```javascript
const API_BASE = 'http://localhost:3000';
```

## Fluxo das 5 telas

| Tela | ID | O que faz |
|------|----|-----------|
| Home | `viewHome` | Apresentação do jogo + botão de início |
| Catálogo | `viewSelect` | Grid com os 10 desafios |
| Jogo | `viewGame` | Briefing à esquerda, editor de prompt à direita |
| Resultado | `viewResult` | Loading animado → comparação prompt/resposta + feedback |
| Final | `viewFinal` | Placar com rank baseado na pontuação |

## Atalhos de teclado

- **Ctrl/Cmd + Enter** dentro do editor de prompt → submete

## Estado

Tudo fica em memória (objeto `state` em `script.js`). Refresh apaga progresso.
Se quiser persistir entre sessões, basta substituir os reads/writes por `localStorage`.

## Decisões de design

- **Tema escuro editorial:** Fraunces (serif display) + Geist (sans body) + JetBrains Mono (código)
- **Acentos coral e amber** sobre preto-café quente — destaca no vídeo de apresentação
- **Animações sutis:** stagger no load das views, "bump" no score quando aumenta, anel de loading orgânico durante chamada à Claude
- **Sem framework:** facilita debugging e mostra que dá pra fazer coisa boa com vanilla JS

## Onde mexer pra customizar

| Quero mudar… | Lugar |
|---|---|
| Cores | `:root` em `style.css` |
| Textos da Home | `viewHome` em `index.html` |
| Mensagens de rank final | `calcularRank()` em `script.js` |
| Layout dos cards de desafio | `.challenge-card` em `style.css` |
