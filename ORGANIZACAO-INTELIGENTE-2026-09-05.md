# Organização e lógica de uso — Central do Léo

Implementação local, ainda não publicada. Revisão visual e conexão real com Google pendentes: o computador está bloqueado.

## Melhorias implementadas

- Índice por assunto em toda tela com quadros identificados, inclusive telas curtas. Botões de acesso rápido usam os assuntos presentes na tela; filtros não deixam atalhos para quadros inexistentes. Abrir um assunto expande seu conteúdo e leva o foco ao cabeçalho.
- Início: avisos distinguem prazo passado, hoje, amanhã, dias restantes e pendência sem data. O contador de atrasos usa a data, não apenas a categoria de atenção.
- Início: botão permite consultar todos os avisos, além dos primeiros 12.
- Alertas de documentos, demandas, exames e viagens abrem o cadastro associado.
- Demandas: pendentes antes das concluídas; prazos mais antigos primeiro; empate por prioridade; demandas sem prazo após as datadas. O critério aparece na tela.
- Demandas: filtros Pendentes, Atrasadas e Alta prioridade; cadastro acessível também por Enter e espaço.
- Busca: exames encontrados pelo nome atual, médico e resultado; tratamentos pelo tratamento e motivo, preservando compatibilidade com campos antigos.
- Busca: viagens, demandas, documentos, patrimônio, pessoas, exames, oportunidades e rendimentos abrem seus detalhes. Os demais resultados continuam levando à seção.
- Busca por passagem, hotel ou ingresso abre a viagem correspondente.
- Viagens: lista atual de hotéis considerada tanto nos avisos quanto na verificação de viagem pronta.
- Layout dos avisos adapta texto, selo de prazo e botão a telas pequenas.

## Cobertura das seções

A navegação por assuntos alcança Início, Rendimentos, Gastos, Patrimônio, Caixa e VGV, Viagens, Agenda, Demandas, Saúde, Gestão estratégica, Fortemais, Oportunidades, Documentos, Guia de vida e Configurações, usando os títulos gerados por cada tela. Isso não equivale a uma validação visual de todos os fluxos: ela está pendente.

As mudanças anteriores em Gmail, Google Agenda e títulos estão detalhadas em REVISAO-GOOGLE-E-SECOES-2026-09-05.md. A integração preparada é de leitura e importação mediante revisão; não existe conexão autenticada confirmada nesta etapa.

## Validação e limites

46 testes automatizados aprovados, incluindo casos dos defeitos corrigidos: busca com campos atuais, associação ao cadastro correto, falsos alertas de hotel, rótulos de prazo e ordenação de demandas. Revisão de diferenças sem erros de formatação. Esses testes executam a lógica JavaScript com ambiente de navegador simulado; não substituem testes visuais nem autenticação real.

A organização usa regras explícitas e os registros existentes. Não foi adicionada uma API de inteligência artificial, nem alterados automaticamente dados pessoais ou prioridades cadastradas.


## Continuação sem depender do navegador

Conforme pedido, autenticação Google e conferência visual ficaram para depois. Foram implementadas e verificadas as seguintes melhorias adicionais:

- Eventos de vários dias aparecem na lista e na contagem de todos os meses que atravessam.
- Viagens canceladas não entram nos eventos do calendário.
- Viagens antigas não são classificadas como pendências vencidas; cobranças de prazo ficam restritas às categorias com pendências.
- Próximos compromissos incluem eventos em andamento e respeitam a ordem dos horários dentro de cada data, sem reorganizar o armazenamento ao abrir a tela.
- Compromissos abrem seu próprio formulário pela busca, painel inicial, dia do calendário, lista mensal e botão Abrir da tabela.
- O formulário permite editar data, hora, último dia, local, tipo e observações; edições de cópias Google ficam apenas na Central.
- Atalhos aguardam a conclusão do carregamento da própria tela. Respostas de uma tela abandonada não deslocam a tela atual.
- Falhas de carregamento síncrono ou assíncrono exibem uma mensagem na tela ativa.

Validação: 46 testes passaram, sem falhas. Os três testes novos de navegação inicialmente falharam por uma tentativa inválida de substituir uma constante no ambiente simulado; a preparação do teste foi corrigida para simular a criação de elementos do navegador, e a suíte completa passou. A revisão das diferenças não apontou erros de formatação. As alterações desta continuação permanecem locais, sem publicação.
