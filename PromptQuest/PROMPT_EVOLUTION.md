# A Evolução do Prompt do Juiz

> Este documento mostra como o prompt que avalia as respostas dentro do PromptQuest evoluiu da v1 ingênua à v4 rigorosa. É o **artefato central** que o grupo apresenta no vídeo como prova de engenharia de prompt aplicada.

---

## Por que iterar este prompt?

Dentro do jogo, sempre que um desafio usa validação subjetiva (`ia_juiz` ou `hibrido`), o backend faz uma segunda chamada à Claude pedindo para ela avaliar se a resposta cumpriu os critérios. Esse "juiz" é tão crítico quanto qualquer juiz humano: se ele for **leniente**, jogadores ganham pontos sem merecer; se for **rigoroso demais**, jogadores desistem injustamente.

A diferença entre v1 e v4 é a diferença entre "acho que tá ok" e uma avaliação confiável e auditável.

---

## V1 — A Ingênua

A primeira coisa que vem à cabeça quando você quer usar IA pra avaliar algo.

```text
Avalie se a resposta abaixo está boa.

Resposta:
{resposta}

A resposta passa?
```

### Técnicas usadas
- Pergunta direta em linguagem natural

### Problemas

| Problema | Consequência |
|---|---|
| "Está boa" é subjetivo | Cada chamada interpreta o critério de forma diferente |
| Não recebe os critérios reais do desafio | Avalia no vácuo, sem saber o que importa |
| Saída em texto livre | O backend não consegue parsear de forma confiável |
| Sem viés explícito anti-leniência | Modelos tendem a ser "simpáticos" e aprovar |
| Sem raciocínio forçado | A decisão é uma intuição instantânea, não uma avaliação |

### Exemplo concreto de falha

Para o **Desafio #1** (resposta apenas "sim" ou "não"), se a resposta gerada for:

> "Sim, com certeza! O céu costuma ser azul durante o dia, exceto quando há nuvens densas."

A v1 provavelmente diria: *"Sim, a resposta está boa, responde corretamente à pergunta."* — ignorando completamente que o requisito era **apenas** uma palavra. **Falso positivo.**

---

## V2 — Estruturada

Aqui você começa a perceber que precisa estruturar a tarefa.

```text
Você é um avaliador. Determine se a RESPOSTA cumpre TODOS os critérios.
Seja rigoroso: se UM critério falhou, a resposta NÃO passa.

CRITÉRIOS:
{lista de critérios}

RESPOSTA:
"""
{resposta}
"""

Retorne APENAS um JSON neste formato:
{
  "passou": true ou false,
  "criterios_atendidos": [],
  "criterios_falhos": [],
  "feedback": "uma frase"
}
```

### Técnicas adicionadas
- **Persona/papel** ("Você é um avaliador")
- **Critérios explícitos** injetados no prompt
- **Instrução de rigor** ("se UM critério falhou…")
- **Saída estruturada em JSON** — parseável pelo backend
- **Delimitadores** (`"""…"""`) para separar conteúdo de instrução

### O que melhorou

Agora o juiz sabe **o que avaliar**. Para o Desafio #1, com o critério "A resposta contém apenas a palavra 'sim' ou 'não', sem qualquer texto adicional", ele vai dizer não — e o backend consegue parsear isso.

### Problemas que sobraram

| Problema | Consequência |
|---|---|
| Sem exemplos do que é "passar" e "não passar" | O juiz tem que inferir o padrão de rigor |
| Sem raciocínio forçado | Decisão ainda é gestalt, sem auditoria |
| Casos limítrofes inconsistentes | Mesma entrada às vezes passa, às vezes não |
| Modelo pode "compactar" o JSON em markdown | `` ```json...``` `` quebra o parse |

### Exemplo concreto de falha residual

Para o **Desafio #6** (manter personagem Yoda mesmo se o usuário pedir pra parar), se a resposta for:

> "Hmm, persistir devo, mesmo difícil isso ser. Falar normalmente, peça você. Mas Yoda, sempre será. Plantas, a fotossíntese fazem, quando luz do Sol absorvem elas, sim."

A v2 olha pra lista — critério "está em estilo Yoda? sim. Não quebrou o personagem? sim. Tem informação correta sobre fotossíntese? sim." — e aprova. Mas o crítico ali era a **persistência** sob pressão, e a v2 não sabe ponderar isso.

---

## V3 — Com Few-Shot

A grande virada. Você ensina o juiz pelo exemplo.

```text
Você é um avaliador automatizado de respostas geradas por IA.
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
  "feedback": "Formato perfeito."
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
  "feedback": "Instrua a IA a NÃO usar marcadores como traços ou asteriscos."
}

──── AGORA AVALIE ────

CRITÉRIOS:
{lista de critérios}

RESPOSTA:
"""
{resposta}
"""

Retorne EXCLUSIVAMENTE um JSON válido no mesmo formato dos exemplos. Sem markdown, sem ```json, sem texto antes ou depois.
```

### Técnicas adicionadas
- **Few-shot learning** com 2 exemplos
- **Exemplo de aprovação** estabelece o teto
- **Exemplo de reprovação por detalhe sutil** calibra o rigor (essa é a virada de chave)
- **Demarcadores visuais** (`────`) separam seções
- **Reforço da regra fundamental** logo no topo

### O que melhorou

O juiz agora tem **referência concreta** de quanto é rigoroso o suficiente. O exemplo 2 é especialmente importante: mostra que "quase certo" não é o mesmo que "certo". Isso transfere para todos os outros desafios.

### Problemas que sobraram

| Problema | Consequência |
|---|---|
| Decisão ainda é direta, sem raciocínio explícito | Difícil debugar quando erra |
| Pode pattern-match os exemplos literalmente | Trata todo caso como se fosse uma lista de frutas |
| Não força contagem/verificação item a item | Em critérios numéricos (50 palavras, 3 parágrafos), pode "achar" sem contar |

### Exemplo concreto de falha residual

Para o **Desafio #5** (resumo de até 50 palavras com todos os nomes próprios), se a resposta tiver 58 palavras, a v3 pode aprovar — porque "parece curto", e o juiz não foi forçado a contar.

---

## V4 — Chain-of-Thought + Few-Shot + Role

A versão final. Aqui você força o juiz a **mostrar o trabalho** antes de decidir.

```text
# PAPEL
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
Retorne EXCLUSIVAMENTE um JSON válido, sem markdown, sem cercas ```, sem texto antes ou depois.

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
  "raciocinio": "Critério 1: conto as linhas não vazias — 'Maçã', 'Banana', 'Laranja' = 3 itens. ATENDIDO. Critério 2: cada item ocupa sua própria linha, separados por \\n. ATENDIDO. Critério 3: nenhum item começa com número (1., 2., 3.) ou marcador (-, *, •). ATENDIDO. Todos os 3 critérios passaram.",
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
{lista de critérios}

RESPOSTA:
"""
{resposta}
"""

Retorne EXCLUSIVAMENTE o JSON. Comece com `{` e termine com `}`. Nada mais.
```

### Técnicas adicionadas

| Técnica | Onde aparece | O que faz |
|---|---|---|
| **Chain-of-thought explícito** | Campo `raciocinio` antes de `passou` | Força avaliação passo a passo, expõe o raciocínio |
| **Princípios operacionais numerados** | Topo do prompt | Dão regras hard-coded, sobrepõem-se a vieses do modelo |
| **Contagem explícita exigida** | Princípio 2 | Mata falsos positivos em critérios numéricos |
| **Citação obrigatória do trecho** | Princípio 3 | Em critérios qualitativos, força ancoragem na resposta |
| **Regra de ambiguidade** | Princípio 4 | "Na dúvida, reprove" — anti-leniência |
| **Exemplos com raciocínio visível** | Both shots | Modelo aprende não só o quê, mas o como pensar |
| **Saída ancorada** | "Comece com `{` e termine com `}`" | Reduz drift pra markdown |

### Por que isso funciona

A diferença mental entre v3 e v4: na v3 você diz **"avalie como nesses exemplos"**, na v4 você diz **"raciocine como nesses exemplos antes de avaliar"**. O modelo é forçado a executar a computação explícita (contar, citar, verificar) em vez de chutar pela primeira impressão. E como o raciocínio fica salvo no JSON, vocês podem auditar quando o juiz erra e refinar mais ainda.

---

## Tabela comparativa

| Técnica | V1 | V2 | V3 | V4 |
|---|:-:|:-:|:-:|:-:|
| Persona/papel | ✗ | ✓ | ✓ | ✓✓ |
| Critérios explícitos | ✗ | ✓ | ✓ | ✓ |
| Saída em JSON estruturado | ✗ | ✓ | ✓ | ✓ |
| Delimitadores claros | ✗ | ✓ | ✓ | ✓ |
| Instrução anti-leniência | ✗ | ✓ | ✓ | ✓✓ |
| Few-shot examples | ✗ | ✗ | ✓ | ✓ |
| Caso de reprovação como exemplo | ✗ | ✗ | ✓ | ✓ |
| Chain-of-thought | ✗ | ✗ | ✗ | ✓ |
| Contagem/citação forçada | ✗ | ✗ | ✗ | ✓ |
| Auditável (raciocínio salvo) | ✗ | ✗ | ✗ | ✓ |

---

## Como demonstrar isso no vídeo (segmento de ~90 segundos)

Esse segmento é o coração da entrega "Qualidade da engenharia de prompt" (0,75 pt). Sugestão de roteiro:

**0:00 — 0:15 — Setup do problema**
> "Pra avaliar respostas subjetivas, criamos um 'juiz IA' — outra chamada à Claude. Mas o primeiro prompt que escrevemos era inocente demais."

Mostrar V1 na tela.

**0:15 — 0:35 — A falha da V1**
> "Quando testamos com este desafio, a V1 aprovou a resposta errada. Olhem o problema: ela diz que está 'tudo bem', mas o critério era resposta de UMA palavra."

Mostrar exemplo de falso positivo lado a lado.

**0:35 — 0:55 — Evolução pra V2 e V3**

Mostrar V2 (estrutura + JSON) e V3 (few-shot), narrando rapidamente o que cada técnica adiciona.

**0:55 — 1:20 — A virada da V4**
> "A V4 trouxe a maior mudança: chain-of-thought. Em vez de só dizer 'passou ou não', o juiz precisa ESCREVER o raciocínio antes. Olhem o que acontece quando ele é forçado a contar as palavras…"

Mostrar campo `raciocinio` no JSON de saída.

**1:20 — 1:30 — Fechamento**
> "Mesma entrada, V1 aprovou, V4 reprovou corretamente. A engenharia de prompt não foi cosmética — mudou o resultado funcional do jogo."

---

## Como usar no código

O backend já tem a v1 implementada. Para trocar pela v4, abra `backend/claudeClient.js` e substitua a função `construirPromptDoJuiz` pelo conteúdo da v4 deste documento.

O arquivo `judgePrompts.js` (entregue junto) já tem as 4 versões prontas pra importar. Para alternar entre elas durante a demo do vídeo:

```javascript
// No topo de claudeClient.js
const { JUDGE_PROMPTS } = require('./judgePrompts');
const VERSAO_DO_JUIZ = 'v4';  // troque pra 'v1', 'v2', 'v3' ou 'v4'

function construirPromptDoJuiz(resposta, criterios) {
  return JUDGE_PROMPTS[VERSAO_DO_JUIZ](resposta, criterios);
}
```

Trocar uma string e ver o comportamento mudar em tempo real é um momento ÓTIMO pro vídeo.
