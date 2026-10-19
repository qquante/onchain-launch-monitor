# Investigação rápida: compras iniciais no Sushi Launch

Consulta pontual de 11/09/2026, concluída em 2026-09-11T20:09:42.048963+00:00. Sem carteira, assinatura, compra ou broadcast. O monitor local e a automação de cinco minutos continuam parados. A abertura pública exata não foi inferida a partir do merge.

## Resultado

É tecnicamente possível comprar assim que a criação da pool se torna executável. Há compras em transações posteriores apenas dois blocos depois do lançamento, inclusive no mesmo segundo do timestamp. Isso não garante que um novo bot seja primeiro. O criador pode usar launchAndBuy e comprar atomicamente antes que um observador externo receba o evento.

O PR V2 #2242 foi incorporado em 2026-09-11T18:10:22Z; HEAD master consultado 69c1d2c992be4f48061829ed1572a733b734ed5a. API atual: 2.659 V1 e 22 V2 indexados. Não é um novo backfill completo e não corrige por si só omissões históricas do indexador; ontem encontramos um V2 omitido. A listagem agregada de todos os providers retornou 9.565 registros, incluindo outros launchpads. Filtrar provider/factory, não pelo nome do token (há um token chamado V2 que pertence a SUSHI_V1).

## Amostra on-chain

13 tokens, 635 eventos Swap nas primeiras janelas de até 6.000 blocos e 51 compras verificadas por recibo. Seis tokens tiveram compra na própria transação de criação. Foram verificados status da criação e compra, hash canônico do bloco, emissor do evento, ABI, posições e direção do swap.

A tabela usa a primeira compra encontrada com remetente diferente do remetente da criação; não prova ausência de vínculo econômico entre as carteiras. Horários têm resolução de segundos: diferença zero não significa simultaneidade nem latência zero. O número de blocos elimina a ambiguidade de ordenação.

| Token | Provider | Criação UTC | Primeiro outro remetente | Blocos depois | Evidência |
|---|---|---|---:|---:|---|
| Plumb | SUSHI_V1 | 2026-09-11T19:57:05.000Z | 3 s | +34 | [compra](https://robinhoodchain.blockscout.com/tx/0x7bfae8014d88dbd0256eadd43bd7a1514dd777abbc87d13ae207d7c3fc636f8a) |
| Sushi-fi | SUSHI_V2 | 2026-09-11T19:56:53.000Z | 7 s | +68 | [compra](https://robinhoodchain.blockscout.com/tx/0x8c88f94f84ec3e9de21c8217b5d0022079bcd253bdb951da68f18d75df24224b) |
| Meme-fi | SUSHI_V2 | 2026-09-11T19:56:27.000Z | 2 s | +26 | [compra](https://robinhoodchain.blockscout.com/tx/0x5229289d3b13332d434849194e5d0b1a38ca902e9b7bd963135af54d6ca9cec4) |
| Plumber | SUSHI_V2 | 2026-09-11T19:55:28.000Z | 19 s | +186 | [compra](https://robinhoodchain.blockscout.com/tx/0xead51d46406a45c6b31570384e277a7d4c6a02d04ad33e03042f35675cb101c8) |
| gplumb | SUSHI_V1 | 2026-09-11T19:53:36.000Z | 8 s | +74 | [compra](https://robinhoodchain.blockscout.com/tx/0x2aaa6a4684e39074d7560a9416bcdaa1edd63facf9143807ec91948e569fb226) |
| Not a Perfect Architecture | SUSHI_V2 | 2026-09-11T19:17:04.000Z | 0 s | +2 | [compra](https://robinhoodchain.blockscout.com/tx/0x8427daad3393218e9a52713811350318eba35b985146f00e9bf8918a4e06ea54) |
| Asteroid Shiba | SUSHI_V2 | 2026-09-11T19:00:00.000Z | 3 s | +30 | [compra](https://robinhoodchain.blockscout.com/tx/0xf09d86543ca87db0824560edffb290dc1ff753fc2dec6644bf0c253063b28d8c) |
| gmoon | SUSHI_V2 | 2026-09-11T18:34:13.000Z | 1 s | +2 | [compra](https://robinhoodchain.blockscout.com/tx/0x8e8edba1703f4d33d7a6a1e771f7b5889645305703c61c886c5dc4196cd9e5d8) |
| Mooning | SUSHI_V2 | 2026-09-11T18:20:49.000Z | 0 s | +2 | [compra](https://robinhoodchain.blockscout.com/tx/0x1f13c737564be725bce035e03249b6d4a916f41f4eda799813043e72549ca160) |
| 8BallMoon | SUSHI_V2 | 2026-09-11T16:40:07.000Z | 11 s | +102 | [compra](https://robinhoodchain.blockscout.com/tx/0x5ddf3bac8f30c95849e736443417ffe285d1a7fdc7fd08376be4e98162c9058b) |
| MoonDog | SUSHI_V2 | 2026-09-11T13:32:09.000Z | 2 s | +25 | [compra](https://robinhoodchain.blockscout.com/tx/0x26c6c9eb6e8682557676cdae629b471077086763300918dbe3feb4c83587f49e) |
| V2 | SUSHI_V1 | 2026-09-11T13:28:35.000Z | 9 s | +82 | [compra](https://robinhoodchain.blockscout.com/tx/0x0afca5539741f16b2af8b351c4e94e21c317733a231e535251efb5365f856e27) |
| Osama BinHood | SUSHI_V1 | 2026-09-11T07:25:11.000Z | 4 s | +42 | [compra](https://robinhoodchain.blockscout.com/tx/0x10cf2aebb5e29b1356382e0d2441d97e320b2464725018b98ed468534faa4ba8) |

Carteira com padrão forte de automação: 0xaa68125455478adca33be2e222d169c0ea45e3bb. Entrou em Mooning, gmoon e Not a Perfect Architecture a +2 blocos; também comprou Asteroid Shiba a +30 e MoonDog a +49. Nos três casos de +2 utilizou 0x6aa80dbbed9ae5ab45fbf61f9644fada3b29326e, selector 0x1fff991f. Não foi identificado o operador, nem comprovada a independência em relação aos criadores. Não classificar velocidade isolada como prova conclusiva de bot.

Destinos das 45 compras em transações distintas da criação (recorte das primeiras cinco compras de cada token):

| Contrato chamado | Compras |
|---|---:|
| 0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc | 30 |
| 0xf2c69db0311b3ded8ec7f39e80f555a200cc2839 | 5 |
| 0xef161b8b000810944017a69af3b4bb28c87ae318 | 3 |
| 0x0000000000001ff3684f28c67538d4d072c22734 | 3 |
| 0x6aa80dbbed9ae5ab45fbf61f9644fada3b29326e | 3 |
| 0x9689992f5b5c09447f15906d8d11214944488341 | 1 |

O destino dominante 0x65050a9b7e5075a2ba5ced7b1b64ee66262c40dc recebeu 30/45, selector 0x4d819a2a. Exploradores secundários o rotulam GMGN Router, mas não obtive confirmação de identidade na documentação oficial do operador. A API de código verificado do Blockscout respondeu 403; não houve auditoria desses routers. Os endereços observados não são uma recomendação para aprovação de saldo.

## Onde e como comprar

- Interface oficial: https://www.sushi.com/robinhood/launchpad ; abrir o token pelo contrato, conferir par e usar Buy. A página individual usa /robinhood/launchpad/token/CONTRATO.
- Nas pools examinadas o par frequentemente é SUSHI; outras usam WETH, SPCX ou NVDA. A compra direta usa o quoteToken da pool, com ETH separado para gas. ETH nativo pode exigir wrap ou rota adicional quando o par não é WETH.
- A interface atual suporta rota Direct pool, com cotação V3, RedSnwapper e executor RouteProcessor 0x0e867974275cd31c25015c2753c9d75f9f355379. Esse executor não deve ser confundido com factory de criação, Quoter ou com os routers dos outros traders.
- Quoter oficial Robinhood validado por chamadas eth_call: 0x3e290e5e01818002a0b672148bdc7514d861c7b3, quoteExactInputSingle. Quoter apenas estima; não executa compra.
- Para integração própria, usar router V3 validado e o par exato. Não enviar ETH diretamente à factory esperando receber um token existente.

Fontes: [contratos V3](https://docs.sushi.com/contracts/clamm), [rota direta](https://github.com/sushi-labs/sushiswap/blob/69c1d2c992be4f48061829ed1572a733b734ed5a/apps/web/src/lib/swap/direct-pool/utils.ts), [painel de compra](https://github.com/sushi-labs/sushiswap/blob/69c1d2c992be4f48061829ed1572a733b734ed5a/apps/web/src/app/%28networks%29/%28evm%29/%5BchainId%5D/launchpad/token/%5Baddress%5D/_ui/swap-panel.tsx).

## Custos confirmados

1. Pool: fee() retornou 10000 nas 13 pools consultadas, ou 1% por swap. Já está considerado no amountOut do Quoter. Há custo novamente na venda.
2. Interface Launchpad: código atual define 0.01 (1%) e a rota direta subtrai esse valor da saída; há exceção de endereços isentos. Assim, um único salto com 1% da pool e 1% da interface reduz a saída em aproximadamente 1,99%, antes do impacto de preço e gas. Rota com outros pares pode acrescentar fees de outras pools. O código da rota também envia takeSurplus=true; o efeito sobre melhoria de execução não foi quantificado.
3. Gas: entre 0.000019532579 e 0.000048703053 ETH nas compras sem criação; mediana 0.000033518957 ETH. Aprovação de ERC20, se necessária, é outra transação. São valores históricos dessa amostra, não estimativa garantida.
4. Nos 51 recibos a quantidade transferida para fora da pool correspondeu ao tokenAmount do Swap, sem divergência. Não apareceu desconto adicional de transferência nessa saída; isso não prova ausência de taxa/restrição em todo fluxo futuro ou router.
5. InitialSushiFeeBps observado: 2000 ou 3000 (20% ou 30% da repartição das fees coletadas), não imposto de 20%/30% sobre a compra. Taxa de lançar token e divisão de fees não são a taxa paga por uma compra comum.
6. Slippage padrão da interface no código: 10%. É tolerância de execução, não outra taxa de 10%; não deve ser confundida com o custo esperado nem usada automaticamente sem limite de preço.

Fontes: [integração/fee tier](https://docs.sushi.com/launchpad/integrators), [taxa do Quick Buy](https://github.com/sushi-labs/sushiswap/blob/69c1d2c992be4f48061829ed1572a733b734ed5a/apps/web/src/app/%28networks%29/%28evm%29/%5BchainId%5D/launchpad/_lib/launchpad-swap.ts), [aplicação na saída](https://github.com/sushi-labs/sushiswap/blob/69c1d2c992be4f48061829ed1572a733b734ed5a/apps/web/src/lib/swap/direct-pool/utils.ts), [isenções](https://github.com/sushi-labs/sushiswap/blob/69c1d2c992be4f48061829ed1572a733b734ed5a/apps/web/src/lib/swap/direct-pool/use-direct-pool-context.ts).

## Velocidade e o que seria necessário

A rede documenta ordem por chegada ao sequenciador; não há leilão de prioridade que permita ultrapassar a fila pagando mais. [Documentação Robinhood](https://docs.robinhood.com/chain/).

O lançamento não exige aguardar aparecer na API ou haver graduação. Seis criações da amostra já incluíram compra atômica. As compras de outra transação a +2 blocos provam que uma espera de vários segundos não é obrigatória para esses tokens.

Cotações via eth_call no RPC público, nesta máquina, levaram 1,70–2,58 segundos (12 consultas de compra). Uma chamada de leitura ao endpoint oficial /api/direct-pool/quote retornou HTTP 200 e cotação em aproximadamente 370 ms; a latência foi medida até os headers, antes da leitura completa do corpo. Isso não mede detecção, assinatura, envio e inclusão, nem garante a latência futura. Nenhuma latência ponta a ponta de compra própria foi testada.

O monitor existente consulta HTTP em ciclos nominais de 2,5 segundos e está parado. Serve como base de detecção persistente, mas exige outro caminho de execução para competir a +2 blocos: RPC WebSocket de baixa latência, eventos da factory, estado da pool, quote pronta/cálculo local validado, saldo/allowance do quoteToken preparados, nonce controlado e limites aplicados antes do envio. A ordem rápida deve respeitar amountOutMinimum, deadline, gasto máximo e deduplicação por chain+token. Este trabalho investigou; não implementou nem ativou auto-buy.

## Acompanhar preço e market cap e limitar a entrada

- Fonte mais próxima da execução: Swap da pool canônica e slot0().sqrtPriceX96. Para token0/token1 com decimais d0/d1, P(token1/token0)=(sqrtPriceX96/2^96)^2 * 10^(d0-d1). Se o token lançado for token1, inverter a razão para obter quote por token. Em produção usar precisão inteira/racional, não float.
- Preço em USD = preço em quote x preço USD atualizado do quoteToken. Para SUSHI/WETH/SPCX o valor USD do par varia; atualizar mesmo sem novo Swap do token. Guardar bloco, timestamp on-chain, observação local e validade da fonte.
- FDV deve declarar a base de supply (máxima/inicial, conforme a definição). Preço x totalSupply atual dá a avaliação da oferta atual; market cap circulante requer oferta circulante confiável. Não declarar LP bloqueado como queimado nem presumir liquidez disponível pelo market cap. Nos quatro tokens inspecionados totalSupply foi 1 bilhão com 18 decimais.
- A API oferece metrics.priceUsd, marketCapitalizationUsd, fullyDilutedValuationUsd, currentTvlUsd, asOf, isStale; negociações trazem priceUsd/amountUsd e streamCursor. Null não é zero; isStale exige atualização.
- SSE oficial /stream/launchpad/events?chainId=4663&tokenAddress=...&after=CURSOR: conexão pontual de 8 segundos retornou HTTP 200, text/event-stream e stream.ready. Não houve trade nesse trecho; disponibilidade foi validada, latência de entrega de novos trades não.
- Limites de execução: valor máximo por token e por período; preço médio máximo, market cap/FDV máximo com definição de supply; impacto de preço máximo; amountOutMinimum; deadline; idade máxima do quote; pares permitidos; teto de fee/gas; uma compra por CA; verificação de possibilidade de venda. Resultado de quote de venda não garante que uma carteira conseguirá vender depois.

## Cotação reproduzida sem transação

Bloco fixo 60525993, pool Meme-fi, entrada de 100 SUSHI: 1.062.633,9871 tokens estimados pelo Quoter, já considerando a fee da pool. Aplicando a taxa padrão de saída da interface, 1.052.007,6473 tokens. Impacto calculado além da fee da pool: aproximadamente 0,541%. É uma cotação histórica, não preço ofertado agora. Não basta multiplicar market cap para saber quanto a compra vai custar; o tamanho da ordem altera a execução.

Foram feitas 12 cotações de compra (1, 10 e 100 unidades do quoteToken em quatro pools) e quatro cotações de venda via eth_call no mesmo bloco. As vendas usam o estado anterior e não formam uma simulação atômica de compra seguida de venda. Os valores servem como prova de leitura dos contratos.

## Arquivos e próximo passo

Evidência bruta e respostas: research/sniper-2026-09-11/. Scripts pontuais: research/sniper-bootstrap.mjs, sniper-swaps.mjs, sniper-quotes.mjs, sniper-api.mjs. Resultado completo por token, recibos e logs preservados; não são um serviço ativo.

Próximo passo técnico: construir um executor primeiro em simulação, medir detecção→quote→envio simulado, e validar limites de preço/gasto e saída antes de autorizar qualquer transação real. Monitor e heartbeat seguem interrompidos por decisão anterior do usuário.
