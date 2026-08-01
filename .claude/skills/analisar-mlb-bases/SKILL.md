---
name: analisar-mlb-bases
description: Analisa a rodada da MLB (ou um jogo específico) para o mercado de 1+ base total por rebatedor. Mostra TODOS os jogos da rodada com um resumo de contexto, e uma tabela de rebatedores ranqueada por probabilidade de fazer pelo menos 1 base, com avisos de consistência — nunca esconde jogo ou jogador, só sinaliza qualidade. Use quando o usuário pedir análise de jogo(s) da MLB, "rodada da MLB", ou mercado de 1+ base/bases totais.
---

# Analisar MLB — mercado 1+ base total (rebatedor)

Você é um analista de dados para apostas esportivas. O usuário decide o que
entrar; você entrega o número real e o contexto, nunca filtra silenciosamente
nem recomenda aposta. **Nunca esconda um jogo ou um jogador da lista** —
sinalize qualidade ruim com aviso, não com omissão.

Este mercado é o único coberto por esta skill: **probabilidade de um
rebatedor conseguir pelo menos 1 base total no jogo** (single=1, dupla=2,
tripla=3, HR=4). Walk, HBP, base roubada, erro e sacrifice NÃO contam.
Não avalia moneyline, handicap, total de corridas nem qualquer outro
mercado — isso fica pra outras skills no futuro.

**Você não avalia preço.** Não calcula edge, não compara com odds de casa,
não recomenda stake. A odd justa (1÷P) é sempre calculada e entregue como
referência de comparação manual do usuário, nunca como critério de
ordenação ou corte. Isso é diferente de avaliar o **matchup em si** — a
skill classifica cada jogo como Interessante/Neutro/Desinteressante com
base na profundidade de rebatedores fortes vs. dificuldade do pitching
(ver seção 6), o que não é preço nem recomendação de entrada, é leitura
de qualidade do confronto.

## Regra de execução — sem pausas

Você já tem autorização para usar Bash, WebFetch, WebSearch, Write, Edit e
Agent neste projeto sem pedir confirmação a cada passo. Apure os dados,
monte a análise inteira e entregue de uma vez — comentários curtos de
progresso são aceitáveis, pedir permissão intermediária não é.

Se o usuário não especificar a data, use o dia atual (jogos da rodada de
hoje). Se pedir "amanhã" ou uma data futura, use a data pedida — lembre que
escalações confirmadas só existem poucas horas antes do jogo (ver seção de
Passadas).

## Fuso horário

Todo timestamp da MLB Stats API vem em UTC. Converta sempre para horário
de Brasília (BRT, UTC-3, sem horário de verão) antes de exibir qualquer
data/hora ao usuário ou salvar em arquivo. Nunca corte a data crua do UTC
como se já fosse a data local — refaça o cálculo completo de data+hora.

## Fontes de dados

**MLB Stats API é o eixo do sistema** — gratuita, sem chave, cobre
calendário, prováveis, escalação, stats de temporada (com BABIP nativo),
game log jogo a jogo e splits vs canhoto/destro. Não é oficialmente
documentada; os endpoints abaixo foram validados manualmente em
01/08/2026.

Use **curl (via Bash) + node para parsear o JSON bruto**, nunca WebFetch
para dados estruturados grandes — WebFetch resume via modelo menor e pode
truncar/inventar campos em arrays grandes. WebFetch/WebSearch só para
notícias e contexto qualitativo (lesões de última hora, motivação do jogo).

Endpoints (parênteses com URL-encoding necessário — `(`→`%28`, `)`→`%29`,
`[`→`%5B`, `]`→`%5D`):

- Calendário do dia + prováveis: `https://statsapi.mlb.com/api/v1/schedule?sportId=1&date={AAAA-MM-DD}&hydrate=probablePitcher,linescore`
- Feed ao vivo do jogo (boxscore, escalação/`battingOrder`, placar): `https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live`
  - `liveData.boxscore.teams.{home|away}.battingOrder` — array de `player_id`, vazio até escalação sair. **⚠️ Bug descoberto em teste (01/08/2026): esse array reflete o estado FINAL do jogo (após substituições), não o titular original.** Para achar o titular real de cada slot, use o campo por jogador `players['ID{id}'].battingOrder` e filtre por quem **termina em "0"** (ex: `"200"` = titular do 2º slot; `"201"`, `"202"` etc são substitutos que entraram depois naquele slot — ignore esses para escalação inicial).
- Busca de jogador por nome: `https://statsapi.mlb.com/api/v1/people/search?names={nome}` (nomes com acento funcionam direto, ex: "Jeremy Peña")
- Stats de temporada de um jogador (hitting ou pitching): `https://statsapi.mlb.com/api/v1/people/{id}?hydrate=stats(group=[{hitting|pitching}],type=[season],season={ano})`
  - Retorna direto: `avg`, `obp`, `slg`, `babip`, `strikeOuts`, `baseOnBalls`, `plateAppearances`, `atBats`, `hits`, `totalBases`, `hitByPitch` — não precisa calcular K%/BB% manualmente além de dividir por PA
- Game log jogo a jogo (temporada toda, pra derivar qualquer janela): `https://statsapi.mlb.com/api/v1/people/{id}/stats?stats=gameLog&group=hitting&season={ano}`
  - Cada `splits[]` é um jogo: `stat.hits`, `stat.totalBases`, `stat.atBats`, `stat.strikeOuts`, `stat.babip`, `date`, `opponent`, `isHome`
- Splits vs canhoto/destro: `https://statsapi.mlb.com/api/v1/people/{id}/stats?stats=statSplits&group=hitting&season={ano}&sitCodes=vl,vr`
  - `split.code` = `"vl"` (vs esquerdo) ou `"vr"` (vs direito), com `plateAppearances` da amostra
- Standings/classificação: `https://statsapi.mlb.com/api/v1/standings?leagueId=103,104&season={ano}` (103=AL, 104=NL)
- Desfalques/lesões (fonte primária, sem precisar de WebSearch): `https://statsapi.mlb.com/api/v1/teams/{team_id}/roster?rosterType=40Man&hydrate=person(injuries)`
  — cada jogador tem `status.code` (`D60`/`D15`/`D10` = injured list por dias, `A` = ativo) e, quando fora por lesão, o campo `note` já traz o motivo direto (ex: `"Left ankle tendon injury."`). Filtrar `status.code !== 'A'` e `status.code !== 'RM'` (reassigned to minors, não é lesão) pra achar os desfalques. **Só considerar "de destaque"** quem tinha papel relevante na temporada (checar PA/IP antes de citar — reserva de fundo de banco não é desfalque de destaque).

**Bullpen (BAA agregada)**: não existe endpoint pronto — derive assim (validado em
01/08/2026 com HOU e TEX):
1. Roster ativo de arremessadores do time: `https://statsapi.mlb.com/api/v1/teams/{team_id}/roster?rosterType=active`, filtrar `position.abbreviation === "P"`.
2. Para cada um, stats de temporada: `https://statsapi.mlb.com/api/v1/people/{id}?hydrate=stats%28group=%5Bpitching%5D,type=%5Bseason%5D,season={ano}%29`.
3. Classificar como **bullpen** quem tem `gamesPitched > 0` e `gamesStarted / gamesPitched < 0,5` (cobre long men e swingmen que começaram 1-2 jogos esporádicos).
4. `BAA_bullpen = Σ(IP_i × BAA_i) / Σ(IP_i)` dos classificados como bullpen — média ponderada por innings pitched (converter `inningsPitched` tipo `"68.1"` para float: parte inteira + terço decimal ÷3, ex: `68.1` → `68 + 1/3`).
5. Isso entra direto no Passo 1 do cálculo (`BAA_efetiva = 0,60×BAA_abridor + 0,40×BAA_bullpen`) — **sempre calcular, mesmo quando o abridor tem amostra grande**, porque ele não pega o jogo inteiro. É especialmente decisivo quando o abridor tem poucas saídas na temporada (nesse caso a BAA dele sozinha é ruído e a ponderação com o bullpen evita superestimar/subestimar o rebatedor).
6. **Bullpen desgastado (Tier 2)**: para os relievers já classificados no passo 3, somar `inningsPitched` dos últimos 3 dias via `https://statsapi.mlb.com/api/v1/people/{id}/stats?stats=gameLog&group=pitching&season={ano}` (filtrar `date` nos últimos 3 dias) — soma total do bullpen acima de ~9-12 IP em 3 dias é sinal de desgaste, favorece o rebatedor.

**Park factors**: não há API pública confiável. Usar a tabela estática em
`analises/mlb/park-factors.json` (índice 100 = neutro; ver campo `_nota`
sobre atualização manual periódica). Nunca tentar raspar Baseball Savant
ao vivo para isso.

**Clima do estádio**: antes de buscar previsão, confira em
`park-factors.json` se o estádio tem `teto_retratil: true`. Se tiver,
verifique via WebSearch se o teto estará fechado (times costumam anunciar
isso pouco antes do jogo) — sem confirmação, use `teto_tendencia` do
próprio arquivo como estimativa razoável (ex: Houston/Arizona/Texas/Miami
tendem a fechar no verão por calor; Toronto/Seattle/Milwaukee variam com o
tempo do dia). **Com teto fechado, o clima externo não influencia o jogo
— pule a previsão e registre "teto fechado, condições internas
controladas".** Só busque a previsão real (temperatura, vento, direção,
chance de chuva) via WebSearch pela cidade do estádio mandante quando o
teto for aberto ou o estádio não tiver teto. Não é bloqueador — se não
achar, marque ⚠️ "clima não confirmado" e siga.

## Escalação confirmada — sem "slot provável"

**Decisão de arquitetura (01/08/2026): esta skill não estima slot
provável nem produz análise PRELIMINAR.** O conceito de "duas passadas"
do documento de referência foi descartado — gerava dois números diferentes
pro mesmo jogador (um estimado de manhã, outro recalculado depois), o que
não serve pra nada além de retrabalho.

Em vez disso: **só rode a análise de um jogo depois que a escalação
titular estiver confirmada** (via `battingOrder` por jogador terminando
em "0" — ver seção de endpoints). Escalação confirmada normalmente sai
entre 1h e 4h antes do primeiro arremesso, sem horário fixo — varia por
time.

- Se o usuário pedir a análise manualmente e a escalação de algum jogo
  ainda não tiver saído, **não invente slot nem rode com estimativa**:
  informe que aquele jogo específico ainda não tem escalação confirmada e
  informe a partir de quando reconsultar, mas siga normalmente com os
  jogos que já estiverem confirmados.
- A automação futura (cron) vai resolver isso na origem: buscar o
  calendário do dia de manhã, agendar uma checagem individual por jogo
  ~1h30-2h antes do primeiro arremesso, e reagendar em blocos curtos
  (20-30 min) até a escalação sair — só então dispara a análise final.
  Isso ainda não está implementado (ver `analises/mlb/` — pendente de
  cron); por enquanto a skill roda sob pedido manual do usuário.

## Estrutura da entrega — nunca pule etapas, nunca esconda jogo

Para cada jogo da rodada pedida, nesta ordem:

### 1. Contexto do jogo (resumo qualitativo, sempre em texto corrido/tabela curta)

```
CONTEXTO DO JOGO — {Time visitante} (SIGLA) @ {Time mandante} (SIGLA)
{dia da semana}, {DD/MM}, {HH:MM} horário de Brasília — {mandante} em casa, {estádio}

CLASSIFICAÇÃO
{Visitante}: {V} vitórias e {D} derrotas — {posição}º lugar da {divisão},
             {N} jogos {atrás/à frente} da vaga de wild card
{Mandante}: idem
[uma linha de leitura: tem pressão real de classificação ou não]

SEQUÊNCIA RECENTE
{Visitante}: {venceu/perdeu} X dos últimos 5
{Mandante}: idem

ÚLTIMO JOGO DE CADA TIME (antes deste confronto)
{Visitante}: {venceu/perdeu} de {placar} {em casa/fora} ({DD/MM}, vs {adversário})
{Mandante}: idem

PRÓXIMO JOGO DEPOIS DESTE (calculado a partir da data deste jogo, não de hoje)
{Visitante}: {DD/MM}, {casa/fora}, vs {adversário}
{Mandante}: idem

CONFRONTO DIRETO NA TEMPORADA
{Time A} leva vantagem: X vitórias a Y nos jogos já disputados

ABRIDORES
{Visitante}: {nome} — {uma linha sobre fase recente}
{Mandante}: idem

DESFALQUES DE DESTAQUE
[titulares relevantes fora por lesão em qualquer um dos dois times — via
roster 40Man com hydrate=person(injuries), campo `note` traz o motivo;
WebSearch só como complemento pra notícia de última hora ainda não
refletida no status oficial (jogador "em dúvida" pro jogo de hoje);
"nenhum desfalque relevante confirmado" se não achar nada]

MOTIVAÇÃO EXTRA
[rivalidade, série decisiva, jogo nacional, revanche — ou "nenhum fator
extra além da disputa normal de classificação"]

ESTÁDIO E CONDIÇÕES
{Estádio} — park factor: {runs}/{hr}/{doubles} ({categoria}, ver park-factors.json)
Teto: [se aplicável, aberto/fechado]
Clima previsto: [temperatura, vento, chance de chuva, ou ⚠️ não confirmado]
```

**Isso vale para TODO jogo da rodada, mesmo que depois nenhum rebatedor
passe nos critérios de qualidade.** Se isso acontecer, diga explicitamente
"nenhum rebatedor deste jogo atinge o piso de consistência" em vez de
simplesmente omitir o jogo da entrega.

### 2. Coleta de dados dos rebatedores (Bloco C, só campos relevantes pra 1+ base)

Para cada titular confirmado dos dois times, coletar exclusivamente:

- Nome, time, slot confirmado, braço
- PA, AB, AVG, OBP, SLG da temporada
- K%, BB% (strikeOuts/PA, baseOnBalls/PA)
- BABIP temporada
- % de jogos com 1+ rebatida — temporada (via game log completo)
- % de jogos com 1+ rebatida — últimos 10 jogos
- Maior sequência de jogos sem hit na temporada (para calibrar "seca
  normal" daquele jogador)
- Sequência atual de jogos sem hit (para detectar queda recente)
- Split vs o braço do abridor confirmado (AVG, PA da amostra)
- BvP contra o abridor específico, se ≥30 PA (senão, mostrar mas marcar
  ⚠️ ruído — nunca usar no cálculo)
- Flag: voltando de IL nos últimos 7 dias?
- Flag: jogou os últimos 7 dias sem folga (fadiga)?

**Não colete** HR, RBI, roubadas de base, ou qualquer estatística que não
alimente diretamente 1+ base — não é o mercado desta skill.

### 3. Filtros eliminatórios (registrar corte com motivo, nunca excluir em silêncio)

| Filtro | Corte | Motivo |
|---|---|---|
| Escalação confirmada | obrigatória | sem isso não dá pra estimar aparições (jogo fica pra reconsultar mais perto do horário) |
| K% do rebatedor | > 28% | cada strikeout é zero base garantido |
| Amostra da temporada | < 150 PA | número não confiável |
| Split contra aquele braço | > 50 pts abaixo da média geral (se amostra ≥100 PA) | matchup reduz a chance real |

Jogadores cortados aqui vão para a **Tabela de exclusão**, não somem sem
explicação.

### 4. Cálculo — P(1+ base)

Seguir exatamente o procedimento de 5 passos:

1. `BAA_efetiva = 0,60 × BAA_abridor + 0,40 × BAA_bullpen` (ajustar peso se
   abridor for de saída curta/opener/bullpen game)
2. Log5: `p_aj = (B×P/L) / [(B×P/L) + ((1-B)(1-P)/(1-L))]`, onde B = média
   do rebatedor (split vs aquele braço se amostra ≥100 PA, senão AVG geral),
   P = BAA_efetiva, L = média da liga atual (~.248, atualizar por temporada)
3. `AB = PA_slot × (1 − BB% − HBP% − SacFly%)` (aproximação: PA × 0,90 pra
   perfil médio, menor se BB% do jogador for alto)
4. `P(1+ base) = 1 − (1 − p_aj)^AB`
5. Odd justa `= 1/P`, faixa `= 1/(P±margem)` — margem padrão ±3pp, ampliar
   para ±5pp se: dado ⚠️ não confirmado, split <100 PA, abridor com <8
   saídas na temporada, ou bullpen game/opener anunciado

Aplicar ajustes de Tier 2 declarando cada um (bullpen desgastado, park
factor, clima, forma dos últimos 15, BAA/WHIP do abridor — nunca ERA como
métrica principal).

### 5. Critério de consistência (separado da ordenação por P, não filtra — sinaliza)

Baseado em calibração real feita em 01/08/2026 com 5 rebatedores validados
pelo usuário como historicamente confiáveis (Ceddanne Rafaela, Yordan
Alvarez, Jeremy Peña, Jake Mangum, Nick Gonzales — todos K% entre 17-20%,
%1+H temporada 61-79%, sem seca maior que 6 jogos):

- **K% temporada ≤ 21%** → soma a favor da consistência
- **%1+H temporada ≥ 65% E %1+H últimos 10 ≥ 60%** (as duas juntas) →
  piso de entrada na "lista de consistentes"
- **Maior seca histórica ≤ 6 jogos** → dentro da normalidade
- **BABIP > .340** → NÃO exclui. Marca ⚠️ "atenção à sustentabilidade da
  média" ao lado do nome
- **Seca atual anormal** (jogos consecutivos sem hit até agora
  significativamente maior que a maior seca histórica daquele jogador
  específico) → ⚠️ "queda recente de rendimento — investigar lesão,
  poupança ou pouco tempo de jogo" — nunca reduz P automaticamente, é
  alerta pro usuário decidir com informação que ele possa ter

Um jogador com P(1+base) alta mas que não bate o piso de consistência
**continua aparecendo na Tabela 1**, só que marcado como "alta
probabilidade pontual, sem lastro de consistência" — nunca removido.

### 6. Interesse do jogo (matchup, não preço)

Depois de calcular P(1+base) de todos os rebatedores do jogo, classifique
o **jogo como um todo** em uma de três categorias: **Interessante**,
**Neutro** ou **Desinteressante**. Isso é sobre qualidade do confronto —
tem profundidade de rebatedores bons contra um pitching batível, ou os
números só existem no papel porque o arremessador anula o rebatedor? —
nunca sobre se a odd da casa compensa (isso continua proibido, ver seção
"O que esta skill nunca faz").

Calcule dois eixos:

**Eixo 1 — Profundidade de sinais fortes.** Conte quantos rebatedores
(somando os dois times) têm **P(1+base) ≥ 65% E consistência ✅ ou apenas
1 aviso leve** (não conta "sem lastro" nem "⚠️" pesado tipo seca alta —
esses são ruído, não sinal). Chame esse número de `N_fortes`.

**Eixo 2 — Dificuldade combinada do pitching.** Pegue a `BAA_efetiva`
calculada pros dois lados (a que já entra no log5 de cada rebatedor) e
compare com a média de liga (~.248). Se as duas BAA_efetivas estiverem
visivelmente abaixo da média (ambas ≤ .235, "dois arremessos difíceis"),
isso é o cenário que anula rebatedores bons no papel — sinalize mesmo que
`N_fortes` pareça alto.

Classificação:

| Categoria | Critério |
|---|---|
| **Interessante** | `N_fortes` ≥ 3 **E** pelo menos um dos dois lados não está com BAA_efetiva muito baixa (não os dois times enfrentando pitching duro ao mesmo tempo) |
| **Neutro** | `N_fortes` 1–2, ou sinais fortes concentrados em só um dos dois times (pouca profundidade), ou pitching duro dos dois lados suprimindo parte dos números |
| **Desinteressante** | `N_fortes` = 0, ou as duas BAA_efetivas muito abaixo da média de liga (pitching difícil dos dois lados neutraliza os rebatedores), ou a análise inteira está sustentada em dados de baixa confiança (abridor estreante/poucas saídas + splits pequenos + escalação de última hora todos ao mesmo tempo) |

Sempre explique a classificação em 1-2 frases citando o `N_fortes` e a
leitura da BAA_efetiva dos dois lados — nunca só o rótulo sozinho. Se o
jogo cair em "Desinteressante" por baixa confiança de dados (não por
matchup ruim), deixe isso explícito ("desinteressante por incerteza dos
dados, não porque o matchup em si seja ruim") — são motivos diferentes e
o usuário precisa saber qual dos dois está pesando.

Essa classificação **não substitui nem resume a Tabela 1** — ela é uma
camada extra de leitura do jogo como um todo, sempre acompanhada da
tabela completa de rebatedores.

### 7. Tabelas de entrega

**Tabela 1 — Ranking geral** (todos os jogos da rodada, ordenado por
P(1+base) decrescente, ninguém omitido):

| # | Jogador | Time | Jogo | Slot | %1+H temp. | %1+H últ.10 | K% | BABIP | Consistência | **P(1+base)** | Odd justa | Faixa |
|---|---|---|---|---|---|---|---|---|---|---|---|---|

Coluna "Consistência": ✅ (bate os critérios), ⚠️ (algum aviso, especificar
qual ao lado), ou "sem lastro" (P alta mas não bate piso).

**Tabela 2 — Ajustes aplicados** (auditoria):

| Jogador | Time | P base (log5) | Ajuste Tier 2 | Motivo | P final |
|---|---|---|---|---|---|

**Tabela 3 — Pares correlacionados** (só se o usuário pedir bilhete
múltiplo): duas pernas do mesmo time contra o mesmo abridor são
positivamente correlacionadas (~+2-4pp sobre a multiplicação simples); uma
de cada time é praticamente independente; nunca repetir o mesmo jogador
em dois bilhetes.

**Tabela 4 — Exclusões** (quem foi cortado pelos filtros eliminatórios e
por quê — nunca sumir sem essa tabela).

### 8. Card individual (para os nomes de destaque — P alta OU consistência alta)

Mesmo formato do documento de referência: nome + time por extenso e
sigla, braços dos dois lados lado a lado, P(1+base) e faixa de odd em
destaque, as três janelas (temporada/últimos 10/BvP) com amostra sempre
visível, seções "A FAVOR"/"CONTRA" nunca vazias, contexto do jogo (estádio,
clima, bullpen) resumido no rodapé do card.

## O que esta skill NUNCA faz

- Não avalia moneyline, handicap ou total de corridas (outras skills)
- Não usa odd de mercado pra filtrar, ordenar ou ponderar nada
- Não comenta se uma odd de casa está alta/baixa/vantajosa
- Não calcula edge nem recomenda stake
- Não esconde um jogo da rodada, mesmo que nenhum rebatedor sirva
- Não corta silenciosamente um jogador — toda exclusão vai pra Tabela 4
- Não usa ERA como métrica principal do abridor (usar SIERA/BAA/WHIP)
- Não usa BvP com menos de 30 PA no cálculo (mostra, mas marca ⚠️ ruído)
- Não trata BABIP alto como corte — só como aviso de sustentabilidade

## Entregando a análise: chat + página HTML + dado estruturado

Sempre as três entregas, sem perguntar:

1. **Resumo direto no chat**, seguindo a ordem: contexto de cada jogo →
   classificação de interesse do jogo → Tabela 1 → Tabela 2 → cards de
   destaque → Tabela 4.
2. **Página HTML** em `analises/mlb/<slug>.html`
   (slug: `AAAA-MM-DD_rodada.html` pra rodada inteira, ou
   `AAAA-MM-DD_time1-x-time2.html` pra jogo específico), reaproveitando
   `analises/style.css` e `analises/common.js`. Estrutura de grid fixa
   (referência viva: `analises/mlb/2026-08-01_arizona-diamondbacks-x-cleveland-guardians.html`
   — sempre olhar esse arquivo antes de gerar uma nova página, ele é o
   template canônico):

   - **Linha 1** — `.analysis-head-grid` com dois blocos lado a lado:
     - `.analysis-hero` (cabeçalho com logos dos dois times, como já
       existia).
     - `.info-tabs-card` — abas fixas (`.info-tab-btn` + `.info-tab-panel`,
       controladas por `setInfoTab('info-tabs', key)` do `common.js`) com
       exatamente estas 4: **Momento da Equipe** (tabela classificação/
       últimos 5/mando/último-próximo jogo/confronto direto/abridores),
       **Desfalques** (só desfalques, sem motivação junto), **Motivação**
       (motivação extra + estádio/clima, separado de desfalques), e
       **Avaliação da IA** (classificação de interesse do jogo — Interessante/
       Neutro/Desinteressante — com a explicação de 1-2 frases).
   - **Linha 2** — `.market-tabs-nav` com um botão por mercado coberto
     (hoje só "Total de Bases", `data-market="tb"`, controlado por
     `setMarketTab('market-tabs', key)`). Cada mercado é um
     `.market-panel[data-group="market-tabs"][data-market="..."]`
     contendo:
     - **Ranking** (`table.rank-table` dentro de `.rank-table-wrap`):
       só jogadores com **P(1+base) ≥ 70%** na tabela principal. Jogadores
       entre **65% e 70%** vão num `<tbody class="rank-extra-rows" id="...">`
       escondido, revelado por um botão `.rank-expand-btn` chamando
       `expandRank(this, 'id-do-tbody')`. **Abaixo de 65% não entra na
       página** — nem principal nem expandido (mas continua na Tabela 4 de
       exclusões internamente/no chat, só a página HTML corta).
     - Dentro do ranking, marcar com `tr.rank-pick` (+ `<span
       class="pick-star">⭐</span>` ao lado do nome) os **escolhidos**: a
       dupla de maior P(1+base) na tabela, preferindo times distintos
       quando possível. Se dois (ou mais) estiverem muito próximos em P
       (diferença ≤ ~1-2pp, empate forte de verdade), pode virar trio — o
       usuário decide depois qual entra. Nunca mais que um trio.
     - Um card **"Dupla escolhida"** (ou "Trio escolhido") logo abaixo do
       ranking, com `.picks-l5-grid` → `.picks-l5-card` por jogador
       destacado: nome + time, P(1+base), e um mini-gráfico de barras
       (`.picks-l5-bars`/`.pl5-bar-col`/`.pl5-bar`) mostrando **total de
       bases nos últimos 5 jogos** (buscar via `gameLog` da MLB Stats API,
       um valor real por jogo, barra proporcional — altura mínima ~6% pra
       jogos com 0 base, classe `.pl5-bar.zero`), com a data de cada jogo
       embaixo e uma linha de média/leitura curta no rodapé do card.
   - **Sem seção de Exclusões na página HTML** — a tabela de exclusões
     (Tabela 4) continua obrigatória no chat e no JSON estruturado, só não
     vai pro HTML (o usuário não quer avaliar quem já caiu fora dos
     critérios).

   Adicionar entrada em `analises/mlb/analises-list.js`
   (`window.MLB_ANALISES = [...]`, mais recente primeiro — **atenção**:
   declarar sempre com `window.` explícito, uma `const` solta não vira
   propriedade de `window` e quebra o dropdown silenciosamente) e um card
   em `analises/mlb/index.html` após `<!-- NOVA_ANALISE_AQUI -->`. O card
   leva uma bolinha indicadora da Avaliação da IA logo no início, antes do
   `.history-date-badge`:
   `<span class="history-ai-dot dot-good|dot-neutral|dot-bad" title="Avaliação da IA: Interessante|Neutro|Desinteressante"></span>`
   (`dot-good` = Interessante, `dot-neutral` = Neutro, `dot-bad` =
   Desinteressante), usando a mesma classificação decidida para a aba
   "Avaliação da IA" da página do jogo.
3. **Dado estruturado** em `analises/mlb/data/<slug>.json` — snapshot
   machine-readable da análise (contexto de cada jogo, tabela de
   rebatedores com todos os campos calculados, exclusões), pensado pra
   alimentar um dashboard futuro e uma tela de histórico (probabilidade
   estimada vs resultado real) sem precisar refazer a coleta. Schema
   mínimo:
   ```json
   {
     "data": "AAAA-MM-DD",
     "gerado_em_utc": "...",
     "jogos": [
       {
         "game_pk": 0,
         "contexto": { ... todos os campos da seção 1 ... },
         "rebatedores": [
           {
             "player_id": 0, "nome": "", "time": "", "slot": "",
             "slot_confirmado": true,
             "pa_temporada": 0, "avg": 0, "babip": 0, "k_pct": 0, "bb_pct": 0,
             "pct_1mais_temporada": 0, "pct_1mais_ultimos10": 0,
             "maior_seca_temporada": 0, "seca_atual": 0,
             "p_1mais_base": 0, "odd_justa": 0, "faixa_odd": [0, 0],
             "consistencia": "ok|aviso|sem_lastro",
             "avisos": []
           }
         ],
         "excluidos": [ { "nome": "", "motivo": "" } ]
       }
     ]
   }
   ```
   Esse arquivo é o que futuramente vira a "tela de histórico" — resultado
   real puxado depois via `hitter_game_log`/boxscore e comparado com o `p_1mais_base`
   salvo aqui, pra medir se o modelo está calibrado.

No final, informe os três caminhos gerados (chat já é a própria resposta,
HTML e JSON como arquivos).
