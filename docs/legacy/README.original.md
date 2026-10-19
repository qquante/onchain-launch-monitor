> Historical project notes. Paths, operational status, badges and test claims below are retained as archival reference and have not all been revalidated. Use the root README and docs/REVIEW.md for this review snapshot.

# Sushi Launch Monitor

> Estado atual: acompanhamento interrompido a pedido do usuário em 10/09/2026. Automação de cinco minutos PAUSADA; monitor e supervisor encerrados, cursor e histórico preservados. Não retomar sem nova solicitação.

Monitor local somente leitura de lançamentos pelas factories Sushi Launch V1 e V2 na Robinhood Mainnet (chain ID 4663). Consulta eventos on-chain, reconcilia/enriquece pela API oficial e mantém SQLite com cursor durável e histórico. Não requer carteira nem chave privada.

Implementado e iniciado em 10/09/2026 às 20:47:16.651 UTC, bloco de referência 59.700.269. O início fica preservado após reinicializações.

## Operação

Requisito: Node.js 24 ou superior (validado com 24.15.0). Dependências fixadas no package-lock.json.

```powershell
cd C:\Users\PC\Desktop\SushiSwap
npm.cmd ci --ignore-scripts
.\scripts\start.ps1
npm.cmd run status
.\scripts\watch.ps1
```

`start.ps1` inicia supervisor e monitor em segundo plano, com janelas ocultas. Já estão iniciados nesta entrega; uma nova chamada recusa duplicação. O supervisor reinicia o filho após falha. Não há inicialização automática após reboot do Windows; execute start.ps1 depois de reiniciar o PC. Não apague data/monitor.sqlite para reiniciar, pois ele guarda o marco original e a deduplicação.

Parar de forma intencional:

```powershell
.\scripts\stop.ps1
```

O processo termina as consultas em andamento, salva o cursor e o supervisor respeita a parada. Pode levar aproximadamente um minuto, ou mais se houver timeout/retry em curso. Para retomar, aguarde a saída e use start.ps1.

## Saídas

- `data/LIVE.md`: resumo legível dos novos lançamentos.
- `data/new-tokens.json`: eventos canônicos após o bloco de início do monitor, em ordem on-chain.
- `data/v2-tokens.json`: ranking histórico V2, metadados disponíveis e campos originais do lançamento.
- `data/status.json`: saúde, cursor, atraso, cobertura histórica, pendências de API e mudanças que exigem atenção.
- `data/monitor.log`: atividade do processo, token/contrato, criação e observação em UTC, transação e links disponíveis.
- `data/notifications.jsonl`: alertas persistidos com IDs. Entrega é pelo menos uma vez se houver falha entre gravar e marcar como entregue; consumidores devem deduplicar pelo ID.
- `data/monitor.sqlite`: eventos, metadados, cursores, âncoras, outbox e auditoria.
- `V2_HISTORICO_VALIDADO.md`: tabela dos V2 históricos com recibos.

Há um heartbeat ativo no Codex, `sushi-launch-novos-tokens-v1-v2`, nesta tarefa, a cada cinco minutos. Ele executa `node src/alerts.mjs`, relata novidades/falhas/mudanças relevantes e reconhece o snapshot com `--ack`. Não relata o mesmo estado a cada ciclo. A captura Node independe do heartbeat; os avisos nesta tarefa dependem de o Codex conseguir executar a automação local. Não há encaminhamento para Telegram ou outro destinatário.

## Captura e cobertura

- RPC HTTP: intervalo nominal 2,5 segundos entre ciclos, acrescido do tempo de resposta. Não é garantia de latência de 2,5 segundos.
- API: ciclos de 15 segundos; até duas páginas recentes por ciclo e paginação completa periódica (nominal 30 minutos, acrescida da duração das consultas).
- Contratos: revisão de bytecode, implementação do proxy e enum de providers a cada 60 segundos, acrescidos das consultas.
- PR V2 #2242: consulta periódica a cada pelo menos cinco minutos; mudanças de head/estado geram atenção persistente.
- Falhas RPC não avançam o cursor. Reorg encontra âncora comum salva, remove órfãos e repete os blocos. Sem âncora comum, exige backfill explícito.
- Fonte primária: par exato factory + assinatura TokenLaunched. Adicionar liquidez a qualquer pool Sushi não é criar token por este launchpad.
- Escopo validado: duas factories conhecidas na chain 4663. Outra factory/ABI/rede futura precisa ser validada e incluída; a versão pública final ainda pode mudar.

Configuração em `config/monitor.json`. Variáveis opcionais: `SUSHI_RPC_HTTP`, `SUSHI_RPC_FALLBACK_HTTP`, `SUSHI_RPC_WS`. O modo ativo usa apenas RPC HTTP público; fallback e WebSocket não foram configurados nem validados ao vivo. O código aceita WebSocket como sinal para antecipar a consulta HTTP. O RPC público tem limites e não é uma infraestrutura com SLA; houve HTTP 429 e timeout no backfill, tratados com divisão em intervalos e espera. Para latência/continuidade mais exigentes, o próximo passo é um RPC dedicado com redundância. PC deve continuar ligado, conectado e sem suspensão para a captura contínua; após interrupção, o cursor permite recuperar os blocos disponíveis no RPC.

## V2 e abertura pública

A V2 já tem eventos desde 17/08/2026; o PR de interface #2242 foi aberto em 18/08 e permanece draft na validação de 10/09. A abertura de 11/09 foi informada diretamente ao usuário pelo responsável. Não há horário público confirmado nesta investigação.

`publicLaunchAtUtc` permanece null. Quando o horário real for informado, preencher ISO UTC com Z, por exemplo o formato `AAAA-MM-DDTHH:mm:ssZ`, e reiniciar. O ranking histórico será recalculado com `afterPublicLaunch`; o marco do início do monitor permanece independente. Não inventar meia-noite. A ordem entre eventos usa bloco, índice da transação e índice do log, pois vários tokens podem ter o mesmo segundo.

## Validação

```powershell
npm.cmd test
npm.cmd run validate
```

23 testes passaram: ABIs com recibos reais salvos, spoof de factory, identidade, ordenação, API/recibo, persistência, deduplicação, atomicidade, reconexão, reorg e notificações. Reorg, falha de rede e alerta de token nos testes são fixtures isoladas, não transações provocadas na rede.

`npm run validate` revalida o histórico existente, sua âncora, os recibos de todos os V2 e dos registros omitidos, a API paginada atual e a saúde/cobertura ao vivo. Resultado em `validation/acceptance.json`. A primeira coleta ampla em uma única consulta sofreu timeout; o backfill por intervalos foi concluído depois e seus resultados aprovados estão em `validation/history-latest.json`. A evidência do timeout foi preservada em `validation/latest.json`; ela não é o resultado final de aceitação.

Não equivale a auditoria de segurança do protocolo, confirmação de afiliação dos tokens, nem prova de finalidade L1. São eventos canônicos observados pelo RPC; reorganizações continuam sendo tratadas.

Fontes: [Sushi Launch](https://www.sushi.com/launch?sortBy=CREATED_AT), [código/PR V2](https://github.com/sushi-labs/sushiswap/pull/2242), [Robinhood RPC](https://docs.robinhood.com/chain/connecting/), [finalidade](https://docs.robinhood.com/chain/transaction-finality/).
