# Fortemais: acompanhamento por obra

**Objetivo:** aplicar o prompt aprovado: dashboard geral e da obra, Financeiro atual preservado, Compras, Documentos e Fotos e descrição. Entrega somente em prévia local.

**Arquitetura:** módulos JS da Central, dados complementares dentro do mesmo registro de obra, anexos no serviço existente por referência canônica. Nenhum novo sistema financeiro, migração ou escrita em produção. O modelo financeiro existente não muda.

**Especificação:** prompt aprovado no chat em 26/10/2026. Cards compactos, quatro acessos principais, demandas/etapas preservadas, dados ausentes distintos de zero, compras não afetam gastos, documentos originais preservados, celular sem cortes.

## Tarefas e interfaces

- [x] Compras: criar `publico/fortemais-compras-modelo.js`, `fortemais-compras.js`, `fortemais-compras.css` e testes. Estado `o.fmCompras={versao:1,listas:[]}`; API `FortemaisComprasModelo.resumo(dados,hoje)` e `fmComprasPainel(o)`. Listas com solicitante, itens, preços estimados/cotados/comprados separados, cancelamento, recebimento parcial, anexos `obra:<id>:compra:<id>`, PDF de conferência. Gravação com controle de base, rollback e rascunho preservado.
- [x] Imóvel/fotos: criar `publico/fortemais-imovel-modelo.js`, `fortemais-imovel.js`, `fortemais-imovel.css` e testes. Estado `o.fmImovel` apenas complementar; reutilizar cadastro de nome/endereço/áreas; fotos por ID em anexos `obra:<id>`, legenda/data/etapa/ambiente/tipo/uso/capa. API `fmImovelPainel(o)` e `fmImovelResumo(o)`. Documentos existentes preservados, facilitar categoria e versões sem substituir bytes.
- [x] Integração: `index.html`, novo `fortemais-obras-dashboard.js/css`, helper DOM. Geral com quatro indicadores e cards operacionais. Obra abre Dashboard; quatro acessos Financeiro/Compras/Documentos/Fotos. Financeiro mantém previsão/ROI/TIR/realizado; Demandas e etapas permanecem acessíveis. Mesmas obras, IDs e filtros; navegação bloqueia rascunho não salvo.
- [x] Persistência: validar campos complementares no backup; conferir que sincronização mantém campos desconhecidos e arquivos usam escopo correto. Testar falha local, conflito, recarga, isolamento de obras e não alteração financeira.
- [x] Verificação: suíte existente pertinente e completa; revisão independente do diff; prévia sintética desktop/celular; preenchimento, salvamento, recarga e arquivo no navegador; conteúdo do PDF validado em testes. Nenhuma publicação.

## Registro

- Base: origin/main bb111a7, clone isolado em /tmp. AGENTS.md e VEZ.md ausentes; autorização prévia do usuário para trabalho isolado mantida.
- Documentos e Demandas já existem na base atual e serão reutilizados, sem duplicação de cadastros.


## Verificação final · 27/10/2026

- Suite completa: 2.090 testes passaram, zero falhas (`TZ=America/Sao_Paulo node --test tests/*.mjs`). Site estático, sem etapa de build de frontend.
- Review independente: corrigidos status legados/customizados, vínculo/MIME da capa, liberação de URLs, atualização de arquivos ao trocar área e atualização dos indicadores após salvar.
- Navegador IAB: prévia em 320, 390 e 1.440 px; sem transbordamento horizontal observado. Em telas estreitas, quatro acessos em uma coluna para preservar leitura.
- Compras: lista sintética criada pelo formulário, 2,5 × R$ 19,90 = R$ 49,75; recarga preservou descrição, solicitante e total. Testes cobrem preços ausentes, frete/desconto, recebimento parcial, cancelamento reversível e financeiro inalterado.
- Descrição e documentos: edição/classificação salvas pelo formulário e presentes após recarga. Upload de ilustração local apareceu na galeria e na área Documentos.
- Falha local, concorrência e restauração são cobertas por testes. A sincronização de produção não foi executada nesta etapa: prévia possui armazenamento separado e bloqueia rede externa. Arquivos offline continuam no IndexedDB, fora do JSON de backup.
- Conteúdo e segurança dos relatórios PDF validados em testes; impressão física não realizada.
- Prévia: http://127.0.0.1:5529/preview-fortemais-obras.html#fortemais (servidor local). Somente dados fictícios; nenhuma publicação ou mudança de dados oficiais.
- Captura: `/Users/leonardopereira/.codex/visualizations/2026/10/01/01a0f4d9-b0e5-7161-953f-b3d7613943f5/fortemais-obras-previa.jpg`.
- Para futura publicação, respeitar a nova aprovação do usuário, conferir estado remoto novamente e não incluir o symlink node_modules ou arquivos de prévia na entrega de produção.

## Publicação autorizada · 27/10/2026

- Usuário aprovou publicar a reformulação e conferir salvamento e sincronização no site oficial.
- Nova conferência remota: origin/main permanece em bb111a7; nenhuma divergência da base aprovada. Protocolo ausente, com autorização anterior mantida.
- Suíte repetida antes do release: 2.090 testes passaram, zero falhas; inclui quatro verificações do ambiente local de prévia, que não será publicado.
- Entrega restrita aos módulos, integração, testes de produção e este registro. Prévia HTML, teste do ambiente de prévia e symlink node_modules ficam fora do commit.
- Conferência oficial utilizará somente cadastros sintéticos, com comparação independente no servidor e preservação dos registros anteriores.
