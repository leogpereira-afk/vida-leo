# Central das empresas Implementation Plan

**Goal:** Transformar Empresas na central de direção aprovada, preservando registros existentes.
**Architecture:** Estado existente E; coleção liderancas com vinculos e registros. Planos, bancos e documentos continuam em suas fontes. UI em fluxo vertical e índice, sem recadastro anual.
**Global Constraints:** Não modificar dados de produção. Formulários explícitos. Validar URLs, backups, referências e cancelamento. Sem inferir perfis ou pessoas.

- [x] Dados: funções de leitura e salvamento das lideranças por ID; validar vinculação e segurança de links; testes de isolamento entre empresas e preservação do histórico.
- [x] UI: resumo executivo ligado ao plano, lideranças e acompanhamento, contatos e sistemas; preservar seções empresariais e organograma.
- [x] Integridade: validar backup e bloquear exclusão de empresas vinculadas; testes de formulário/cancelamento.
- [x] Verificação: suíte completa, inspeção desktop/móvel em cópia local sem sincronização, revisão de diff e entrega sem alterar cadastros reais.

Verificado: 564 testes passaram. Prévia com dados fictícios conferida no desktop e em 390px; registro e conclusão de acompanhamento testados no navegador. Sem publicação ou alteração de dados reais.
