# Validação do monitor Sushi Launch

> Estado atual: acompanhamento interrompido a pedido do usuário em 10/09/2026. Automação de cinco minutos PAUSADA; monitor e supervisor encerrados, cursor e histórico preservados. Não retomar sem nova solicitação.

Consulta de aceitação: 2026-09-10T21:00:50.443Z. Resultado: APROVADO.

## Evidência real

- Varredura de eventos das duas factories conhecidas na chain Robinhood 4663: blocos 0 a 59.693.536, sem lacunas nos intervalos salvos, 2.657 eventos (2.643 V1 e 14 V2).
- API paginada: 27 páginas, 2.655 tokens; todos conciliados com os eventos, sem divergências de identidade/nome/horário nos campos verificados.
- Dois registros on-chain não vieram na API: Sushi Coin Official (V1, nome autodeclarado) e sushicat (V2). Ambos verificados por recibo; nenhuma afiliação institucional inferida do nome.
- Todos os 14 V2 verificados individualmente por recibo, sucesso da transação, log da factory, ABI e bloco canônico.
- Primeiros V2: SushiMoon, 2026-08-17 00:26:19 UTC; sushicat, 2026-08-17 08:34:50 UTC. Tabela e transações em V2_HISTORICO_VALIDADO.md.
- Intervalo entre snapshot e scanner preenchido: blocos 59.693.537 a 59.700.013, nenhum lançamento. Captura contínua a partir de 59.700.014. Marco de novos: após o bloco 59.700.269, iniciado às 20:47:16.651 UTC em 10/09.
- Reinicializações reais preservaram o marco, o cursor e a deduplicação; scanner alcançou novamente a ponta da rede.
- Contrato V2 é proxy EIP1967. Implementação verificada: 0xe3a197e6ea396623f9bad114a680961f81833d4f. Código/implementação/providers e PR V2 são acompanhados para sinalizar mudanças.

## Testes e limites

23 testes aprovados em validation/tests.log. Cobrem ABIs com recibos reais salvos, rejeição de factory falsa/ABI incorreta, ordenação, corte de abertura, reconciliação da API, deduplicação, cursor transacional, persistência, reconexão, reorg, ponte do histórico, timestamp zero do RPC e entrega/deduplicação de alertas.

Falhas de rede, reorganizações e novos tokens usados nos testes são fixtures isoladas. Não foi criada transação real para testar alertas. As consultas históricas, recibos, API e reinicializações do processo foram reais. npm audit reportou zero vulnerabilidades conhecidas nas dependências instaladas, em validation/npm-audit.json; isso não constitui auditoria dos contratos.

A primeira consulta de histórico em um único intervalo sofreu timeout; a coleta posterior em intervalos terminou e foi conciliada. Evidência inicial preservada em validation/latest.json; resultado final em validation/acceptance.json e validation/history-latest.json. Houve rate limit no backfill, tratado com cache, lotes menores e espera. Cobertura é dos eventos retornados pelo RPC para as duas factories conhecidas; não é validação de todas as redes nem de um futuro contrato desconhecido. Finalidade L1 não foi comprovada.

## Operação entregue

Supervisor Node e monitor em segundo plano. Estado consultado em 2026-09-10T21:02:36.996Z: running=True, RPC=ok, API=ok, bloco=59709364, atraso=0, novos desde início=0.

Heartbeat Codex ativo nesta tarefa, ID sushi-launch-novos-tokens-v1-v2, a cada cinco minutos, para relatar novos tokens/falhas/mudanças relevantes. Captura HTTP local em ciclos nominais de 2,5 segundos acrescidos das consultas. Painel em data/LIVE.md, contratos/horários/transações em data/new-tokens.json; comandos em README.md.

Pendências externas: horário UTC exato da abertura pública de 11/09 e confirmação de eventual contrato final alterado. publicLaunchAtUtc continua null. Não confundir primeiros históricos com primeiros após a abertura. RPC dedicado, fallback e WebSocket não configurados. PC ligado/conectado é necessário; não há inicialização automática após reboot.

Fontes: [PR V2 oficial](https://github.com/sushi-labs/sushiswap/pull/2242), [Sushi Launch](https://www.sushi.com/launch?sortBy=CREATED_AT), [RPC Robinhood](https://docs.robinhood.com/chain/connecting/).
