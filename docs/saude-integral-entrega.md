# Saúde integral — entrega para revisão local

## Escopo

O painel mantém os cadastros, IDs e serviços da Central do Léo. Esta entrega está em branch local, com demonstração de dados fictícios. Não publica nem altera registros médicos de produção.

A entrada Hoje concentra até quatro indicadores, ocorrências configuradas, datas informadas e conferências. As áreas Exames, Medidas, Consultas e sintomas, Tratamentos, Cuidados e Documentos usam seleção, filtros e detalhes próprios. Densidade compacta/confortável é uma preferência de leitura.

## Fluxos e integridade

- Importação de exames e formulários preservam o estado anterior quando a gravação local falha. Nova tentativa não deve duplicar a importação concluída.
- O cadastro familiar começa sem parentesco/condição/situação presumidos.
- Sugestões do catálogo preventivo não definem um calendário clínico individual. Apenas orientações e datas explicitamente confirmadas alimentam os próximos cuidados.
- Registrar uso continua imediatamente ao lado de Visão geral no tratamento. Compra, estoque, planejamento e uso possuem registros separados.
- Ocorrências configuradas podem ficar sem registro, registradas, não utilizadas ou adiadas. Somente o uso efetivo baixa estoque; desfazer mantém a trilha do evento.
- Dados ausentes não viram zero. Datas de medidas/pressão/pulso permanecem independentes. IMC usa peso e altura da mesma medição e informa sua fórmula.
- Exames preservam resultado original/qualitativo, unidade, método, referência e data. Variação numérica não representa avaliação clínica.
- Consultas e sessões se vinculam ao episódio pelo ID. Uma consulta não se torna realizada pela passagem do tempo.
- Relatórios e ficha de emergência permitem escolher o conteúdo e revisar o documento antes de imprimir/salvar em PDF, sem envio automático.

## Documentos

A biblioteca reutiliza os anexos. PDF.js local renderiza o original e o texto embutido, quando presente. Há paginação e zoom. A revisão manual conserva original, página, transcrição, cobertura, trechos não reconhecidos e itens confirmados/pendentes. Campos da revisão não alteram silenciosamente exames ou prescrições. A situação de envio do arquivo é separada da gravação dos metadados.

Não há OCR ou novo provedor de IA nesta entrega. Documentos digitalizados como imagem exigem conferência/transcrição manual. As receitas reais não foram reprocessadas nem tiveram orientação clínica inferida.

## Verificação

Executar a suíte completa com `TZ=America/Sao_Paulo node --test --test-concurrency=4 tests/*.mjs`. Há regressões de falha/repetição de gravação, ocorrências, limites de estoque, edição preservando ID, filtro e vínculo, cobertura documental, segurança dos endereços e renderização real do PDF sem rede/avaliação dinâmica.

A demonstração local foi usada para verificar recarga, uso/não utilização/adiamento, estoque, comparação de exames, linha do tempo, seleção dos relatórios e ficha de emergência. As sete áreas foram inspecionadas a 320 CSS px sem transbordamento da página; o leitor tem região própria de ampliação.

## Limites reais

- Nenhum resultado clínico foi validado nem nenhuma dose ajustada.
- A arquitetura autenticada/CAS existente foi mantida e seus testes continuam necessários. Dois dispositivos físicos e o novo fluxo contra a nuvem produtiva não foram exercitados nesta prévia.
- Google Agenda e notificações externas não foram acionados. Aviso dentro do painel não equivale a notificação entregue em segundo plano.
- A inspeção de teclado/reflow não constitui certificação completa de conformidade WCAG. PDFs sem texto embutido não recebem OCR nesta versão.
- Publicação depende de autorização posterior do dono.

## Resultado final da revisão — 18/10/2026

Foram executados **1.360 testes, todos aprovados**, sem falhas, cancelamentos ou testes pulados. A última execução do controlador está em `/tmp/saude-integral-final.log`. A onda final acrescentou 22 regressões com reprodução de falhas antes da correção. A revisão independente confirmou como atendidos os seis achados importantes e os três menores.

As correções finais contemplam projeção de duração com várias tomadas; vínculo do check/uso diário à ocorrência correta; anexos nas referências históricas; seleção de planos, família e cadastros legados nos relatórios; editor transacional no comparativo desktop; separação dos contextos do gráfico de peso; saldo desconhecido legível; nome explícito na ficha; e retomada da área após recarregar.

No navegador foram conferidos o registro de uso no topo do tratamento, persistência após recarga, estados de não utilização/adiamento, saldo, sete áreas a 320 px, leitura Canvas/texto do PDF, conferência parcial e bloqueio de cobertura completa com trechos pendentes, relatórios selecionados, ficha e histórico Voltar. **A repetição final do cenário de desfazer uso no IAB foi interrompida por uma confirmação nativa que a automação não conseguiu concluir.** O cenário de desfazer/corrigir, incluindo reversão do estoque, foi verificado nos testes automatizados; a validação visual desse último fluxo continua pendente. Foi aberta outra aba da prévia para revisão. Não se declara teste completo em dois dispositivos físicos nem validação contra dados produtivos.

## Decisões de execução

- O trabalho permaneceu no clone isolado e na branch local já autorizada. Integrações externas opcionais não foram ativadas. Se essa escolha não corresponder à revisão desejada, o custo é retestar a configuração autorizada; não há mudança de produção a desfazer.
- Os auxiliares locais da skill de execução estavam sem permissão de execução. Briefs, pacotes e registro de andamento foram preparados manualmente, sem modificar a skill. O custo de eventual erro nesse registro é uma reconferência manual; os commits e saídas de teste foram preservados separadamente.

Branch preservada em `/tmp/vida-leo-saude-check-20261018`, `codex/saude-check-diario-20261018`. Nenhum merge, push ou deploy foi realizado nesta entrega. A conferência dos hashes dos recursos acompanha o conteúdo servido pela prévia local.
