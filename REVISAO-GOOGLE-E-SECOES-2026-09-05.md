# Integrações Google e revisão das seções

Estado: implementação local preparada; autenticação real e conferência visual pendentes porque o Mac está bloqueado. Esta etapa ainda não foi publicada. A versão publicada na etapa anterior permanece no ar.

## Gmail

- Área de conexão em Viagens e Configurações, usando o cliente OAuth que já existia no projeto.
- Permissão somente de leitura, verificada após a autorização.
- Consulta de até 15 mensagens da caixa de entrada: assunto, remetente, data e resumo. Não envia mensagens, não marca como lida e não altera a caixa.
- Busca de passagens existente integrada ao novo controle de sessão. A gravação das viagens continua dependendo da revisão e confirmação no aplicativo.
- Falhas ao ler uma mensagem de passagem agora interrompem a consulta com aviso; não são mais ignoradas silenciosamente.
- Renovação de autorização e desconexão da sessão local. Não remove as permissões da conta Google; isso é feito na conta Google.
- Tokens ficam somente na memória, sem gravação em backup, servidor ou armazenamento persistente.

## Google Agenda

- Área de conexão em Agenda e Configurações.
- Calendários são listados após autorização; o usuário escolhe qual consultar.
- Período: últimos 30 dias e próximos 12 meses; leitura paginada até 5.000 eventos, interrompendo sem gravar se exceder o limite.
- Recorrências são expandidas pelo Google em ocorrências individuais.
- Horários convertidos para Brasília; eventos de dia inteiro preservam suas datas.
- Tela de revisão com seleção individual, seleção de todos e confirmação antes de importar.
- Reimportação reconhece a identidade do evento por calendário + ID; atualiza a cópia selecionada, sem duplicá-la.
- Eventos cancelados são ignorados. Cópias existentes não são apagadas automaticamente quando um evento deixa de aparecer.
- É uma importação sob demanda. Não há sincronização em segundo plano nem envio da Central para o Google nesta etapa.
- Para atualizar uma cópia, o usuário recebe aviso de que os campos importados substituirão os da Central.

## Revisão das 15 seções

| Seção | Melhorias nesta etapa |
|---|---|
| Início | Identificação da página no título do navegador e índice de assuntos quando há pelo menos quatro quadros. |
| Rendimentos | Texto introdutório mais direto; ranking deixa de chamar rendimentos de lucro. |
| Gastos | Descrição explica despesas, recorrências e categorias; índice de assuntos. |
| Patrimônio | Descrição explica bens, dívidas e documentos. |
| Caixa e VGV | “Composição do resultado”, “Importar e exportar” e legenda objetiva para reservas; remoção de cabeçalhos vazios de tabelas internas. |
| Viagens | Descrição sem depender das cores; conexão Gmail; reserva na lista atual de hotéis impede falso alerta de hotel ausente. |
| Agenda | Conexão direta ao Google Agenda; eventos importados de dia inteiro podem ocupar vários dias no calendário. |
| Demandas | Título corresponde ao menu; descrição destaca prioridades, prazos e conclusão. |
| Saúde | Descrição mais objetiva, legendas sem afirmações clínicas desnecessárias; pesagens vazias não definem os indicadores. |
| Gestão estratégica | Índice permite localizar rapidamente identidade, planejamento e campo tático. |
| Fortemais | “Importar custos do ERP” deixa a ação explícita; tabelas internas sem cabeçalhos vazios. |
| Oportunidades | Descrição destaca comparação e decisão; quadro “Oportunidades por estágio e tipo”. |
| Documentos | Título consistente com o menu; descrição explica arquivos, validade e organização por pessoa. |
| Guia de vida | Descrição explicita objetivos, planos e família; “Pontos para revisar” substitui “Sugestões minhas”; índice de assuntos. |
| Configurações | Descrição inclui conexões e cópias de segurança; controles de Gmail e Google Agenda. |

O índice é gerado a partir dos quadros realmente presentes, respeita filtros e abre o assunto selecionado. Quadros sem título usados apenas para envolver tabelas deixam de produzir cabeçalhos recolhíveis vazios. O conteúdo de cada renderização fica em um contêiner próprio, reduzindo a interferência de respostas assíncronas de telas anteriores.

## Verificações

26 testes automatizados passaram, incluindo os 18 anteriores e oito casos novos: UTC para Brasília, evento de vários dias, cancelamento, atualização de cópia existente, ocorrências recorrentes distintas, item repetido na consulta, expiração da sessão Google e hotel no cadastro atual. Revisão de diferenças sem erros de formatação.

Ainda não houve autenticação Google, consulta real aos e-mails ou calendários, importação de dados reais nem validação visual desta etapa. O navegador retornou bloqueio do Mac em duas tentativas. É necessário desbloquear o computador para continuar.

O cliente OAuth precisa ter a origem pública do site autorizada, APIs Gmail e Calendar habilitadas e a conta permitida na tela de consentimento. Nenhuma alteração de configuração no Google Cloud foi feita nesta etapa. A aprovação de permissões será apresentada pelo próprio Google.

Referências usadas: [modelo de autorização Google](https://developers.google.com/identity/oauth2/web/guides/use-token-model) e [consulta de eventos do Calendar](https://developers.google.com/workspace/calendar/api/v3/reference/events/list).
