# Contexto — Sushi Launch Monitor

> Estado atual: acompanhamento interrompido a pedido do usuário em 10/09/2026. Automação de cinco minutos PAUSADA; monitor e supervisor encerrados, cursor e histórico preservados. Não retomar sem nova solicitação.

Atualização: 10/09/2026. Usuário autorizou validar tudo, implementar e iniciar o monitor de novos tokens Sushi Launch V1/V2 e avisar os próximos nesta tarefa. A abertura V2 prevista para 11/09 foi informada diretamente ao usuário pelo responsável; UTC/bloco exato ainda não conhecido.

Estado: IMPLEMENTADO E EM OPERAÇÃO LOCAL. Read-only, sem carteira, assinatura ou broadcast. Supervisor Node e monitor iniciados em segundo plano; heartbeat Codex ativo a cada cinco minutos, id sushi-launch-novos-tokens-v1-v2. Início durável: 2026-09-10T20:47:16.651Z, bloco 59700269. Consultar data/status.json para saúde atual, não assumir atividade a partir deste documento.

Fontes principais: README.md operacional, VALIDACAO_MONITOR.md, validation/acceptance.json, validation/history-latest.json, evidence/live/ e fontes GitHub fixadas em evidence/source e evidence/v2-source. Investigação inicial preservada em INVESTIGACAO_SUSHI_LAUNCH.md.

Confirmado: Robinhood 4663; POST API /api/graphql; providers SUSHI_V1 e SUSHI_V2; factories/eventos distintos. Histórico 0..59693536: 2643 V1 + 14 V2 = 2657. API: 2642 V1 + 13 V2 = 2655, 27 páginas. API omitiu um V1 e sushicat V2, ambos comprovados por recibo. Todos os 14 V2 comprovados por recibo. Ponte histórica 59693537..59700013 preenchida, 0 lançamentos; scanner cobre a partir de 59700014 e retoma cursor após parada. Primeiro V2 histórico: SushiMoon, 17/08/2026 00:26:19 UTC.

V2 é proxy EIP1967; implementação verificada 0xe3a197e6ea396623f9bad114a680961f81833d4f. Mudanças de provider, código/implementação e PR #2242 geram atenção para revisão. Não assumir que factory final amanhã permanecerá idêntica.

Implementação: Node 24, viem fixado, SQLite WAL, cursores/âncoras/outbox, logs por factory+assinatura, API como enriquecimento, UTC canônico, deduplicação e reorg. 23 testes passaram, incluindo alertas em fixture isolada. Reinício real do processo preservou início/cursor e alcançou novamente o head sem duplicações. Nenhum token novo desde o início até a validação; confirmar a última saída antes de informar novamente.

Pendências externas: marcador exato UTC da abertura pública; RPC dedicado/fallback/WSS se exigida maior disponibilidade. Hoje o RPC é HTTP público; não há serviço de boot automático. PC precisa permanecer ligado e conectado. Não apresentar histórico antigo como próximos tokens, não prever tokens que ainda não foram criados, não confundir Pools.fun ou metrics.version com Sushi Launch V2.


## Consulta pontual em 11/09/2026

Investigação de sniping concluída em INVESTIGACAO_SNIPER_2026-09-11.md: 13 tokens, 635 swaps, 51 compras verificadas; padrão de +2 blocos em três V2 pela mesma carteira. API indexa 22 V2; PR #2242 incorporado em 18:10:22 UTC. Pool fee 1%; código da interface inclui mais 1% na saída salvo isenção. Sem auto-buy, sem transações e sem retomada do monitor/heartbeat.
