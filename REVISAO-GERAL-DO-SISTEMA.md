# Revisão geral da Central do Léo

Esta rodada cobre as 15 telas internas, os controles compartilhados e o código que monta cada página. Não equivale a uma auditoria visual concluída nem à validação dos dados reais. Publicação das mudanças desta rodada, do redesign de Saúde e da integração Gmail autorizada pelo usuário; confirmação do deploy deve ser consultada no GitHub Actions.

## Cobertura por área

| Área | O que foi conferido e resultado desta rodada |
|---|---|
| Início | Montagem com/sem registros, cartões e destinos. Rótulos deixam explícito que gastos e saldo usam lançamentos, sem recorrentes estimados. |
| Rendimentos | Montagem, filtros e cartões; preservadas as correções de total por empresa. Testes de abas e montagem complementam os testes de cálculo. |
| Gastos | Montagem, categorias, abas e acesso aos recorrentes. Mantida a distinção entre pagamentos lançados e custos estimados. |
| Patrimônio | Montagem, tabela e totais existentes. Acesso às linhas pelo teclado; tabela simples adaptável ao celular. Aviso de avaliações incompletas sem afirmar qual seria o valor real. |
| Caixa e VGV | Corrigidos cartões que chamavam texto como função. Contas, empreendimentos e reservas incluídos na busca com destino ao quadro correspondente. |
| Viagens | Corrigida regressão local introduzida no redesign de Saúde. Tabela reconhece hotéis cadastrados na lista atual, tanto no nome quanto nas pendências. Montagem com viagem fictícia aprovada. |
| Agenda | Montagem, navegação e edição de campo na tabela testadas. Exportação de evento de dia inteiro com vários dias preserva o período. |
| Demandas | Montagem, cartões, priorização e filtros já existentes verificados. Tabela simples ganha apresentação em campos identificados no celular. |
| Saúde | Novo resumo, áreas, medidas com datas próprias e ausência de registro sem alerta de nunca feito. Corrigida a posição dos cartões de exames; agora pertencem apenas à Saúde. |
| Gestão estratégica | Montagem sem empresa e com empresa fictícia; cartões de objetivos e equipe. Tabelas simples recebem navegação por teclado e tratamento móvel quando elegíveis. |
| Fortemais | Montagem sem obra e com obra fictícia, usando resumo de custos simulado. Importação real do ERP, livro-caixa e rateio não foram validados contra dados reais nesta rodada. |
| Oportunidades | Montagem vazia e com oportunidade fictícia; cartões e tabelas existentes. Critérios pessoais de pontuação preservados. |
| Documentos | Ausência de validade deixa de gerar selo agregado Em dia. Próxima validade usa apenas datas futuras ou de hoje. Montagem e caso sem validade testados. |
| Guia de vida | Montagem dos quadros, atalhos e cadastros. Busca ampliada para metas e rituais; resultados de bancos, empresas e livros abrem seus quadros. |
| Configurações | Montagem completa com arquivos e serviços simulados. Nova Conferência dos cadastros, somente de leitura, aponta identificadores repetidos, datas inválidas/invertidas e valores não numéricos. |

Portal dos Bosques é um link para outro sistema, não uma tela interna. Não foi auditado nesta rodada.

## Computador e celular

As tabelas simples preservam suas colunas no computador. Em telas pequenas, as tabelas elegíveis passam a mostrar campos com seus rótulos, em duas colunas por registro. Tabelas aninhadas ou com células mescladas não entram nessa transformação. Saúde e Finanças conservam seus tratamentos específicos. Linhas clicáveis sem controles internos recebem acesso por Enter e espaço.

Os testes verificam a estrutura e os eventos dos elementos, não o tamanho real, as quebras de linha, o contraste final ou a renderização no Safari. Conferência visual nos dois formatos continua pendente.

## Evidências

109 testes aprovados: testes anteriores de lógica, novos casos de dados, 30 casos de montagem (15 telas sem registros e 15 com registros fictícios), navegação de cartões, separação das áreas, rótulos da tabela móvel e edição de um compromisso. A suíte utiliza um DOM simulado e não envia dados à nuvem. Serviços de arquivos, equipe e custos são substituídos por respostas fictícias.

Os testes amplos reproduziram duas falhas de aplicativo antes da correção: clique em cartões de Caixa e VGV e montagem de Viagens com trecho de Saúde fora de lugar. Ambos passaram após as correções. Ajustes na preparação dos testes foram feitos quando o ambiente simulado diferia do comportamento esperado, sem alterar o aplicativo para mascarar a falha.

A nova dependência de desenvolvimento e o arquivo de versões permitem repetir os testes. O site continua estático. O DOM simulado é exclusivo dos testes; o leitor de convites ICAL também é distribuído localmente para uso no navegador.

## Limites e próximos passos

- Publicação: autorizada explicitamente pelo usuário nesta rodada.
- Google: autenticação e leitura real de Gmail/Agenda permanecem pendentes.
- Dados: nenhuma edição, exclusão ou classificação automática dos registros reais foi feita.
- Validação externa: cálculos financeiros não foram conciliados com bancos ou ERP; referências de saúde não foram reavaliadas clinicamente.
- Testes: não cobrem todos os fluxos de upload/download, restauração real, login real e todas as combinações possíveis de registros.

## Agenda e Gmail

- Nova seção no topo da Agenda: conectar Gmail e buscar convites dos últimos 90 dias.
- Leitura de convites de calendário (.ics ou text/calendar), com seleção antes de importar.
- Tratamento de horários, dias inteiros, atualizações, cancelamentos e duplicidades.
- Não interpreta datas em e-mails de texto livre; séries recorrentes devem vir pelo Google Agenda.
- Busca manual, sem sincronização com a página fechada. Cancelamentos são avisados, sem apagar registros locais.
- 109 testes passaram, incluindo consulta simulada de anexo, seleção, importação e segunda consulta sem duplicar.
- Autorização OAuth com a conta real ainda não verificada. Verificação visual local indisponível: navegador informou conexão recusada.
- Publicação desta rodada autorizada pelo usuário após a apresentação do escopo completo.
