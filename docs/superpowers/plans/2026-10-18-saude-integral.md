# Saúde integral Implementation Plan

> For agentic workers: use executing-plans and scoped implementers; preserve the approved spec and review each delivery.

**Goal:** Evoluir todas as áreas da Saúde com gravação confiável, cards compactos, documentos revisáveis e prévia sem dados reais.
**Architecture:** Reaproveitar E e serviços existentes. Adicionar projeções puras em saude-modelo.js, uma interface operacional em saude-painel.js e biblioteca documental em saude-documentos.js. O index integra sem substituir o resto da Central.
**Tech Stack:** JavaScript nativo, IndexedDB/anexos existentes, CSS e Node test/linkedom.
**Spec:** docs/superpowers/specs/2026-10-18-saude-integral.md

## Global Constraints
- Sem publicação, dados reais em arquivos ou migração de produção.
- Preservar IDs, histórico, originais, vínculos e serviços de autenticação/CAS.
- Sem novo provedor OCR/IA; leitor local e revisão manual explícitos.
- Registrar uso permanece ao lado de Visão geral no tratamento.
- Estados: dado ausente não é zero; compra não é uso; ausência de uso não é recusa.

### Task 1: Integridade dos cadastros e regras preventivas
**Files:** publico/index.html; tests/saude-integridade.mjs.
**Interfaces:** importarExamesRotina(), novoRegistroRotina(), rastreiosPendentes(todos), novoCuidadoRotina().
- [x] Criar regressões: falha em localStorage na importação e repetição não mudam E; sucesso repetido não duplica; novo histórico familiar não presume doença.
- [x] Executar testes e observar falhas reais.
- [x] Implementar rollback da lista, erro no formulário e flag de sucesso somente após salvar; revalidar duplicidade no clique final.
- [x] Tornar sugestões preventivas explícitas, com situação A confirmar sem classificar prazo individual pelo catálogo genérico; datas indicadas manualmente seguem o cadastro.
- [x] Verificar testes relacionados e commit local.

### Task 2: Modelo de projeções e ocorrências
**Files:** publico/saude-modelo.js; tests/saude-modelo.mjs.
**Interfaces:** global SaudePainelModelo: hoje(E,data), indicadores(E), ocorrencias(t,data), registrarOcorrencia(t,d), qualidade(E), episodios(E), resumoConsulta(E,filtros), documentosRefs(E).
- [x] Escrever testes para agenda diária declarada, estados por ocorrência, base desconhecida, comparação e qualidade transversal.
- [x] Criar projeções sem mutação; registros de ocorrências com IDs estáveis, sem baixar estoque para não usado/adiado; histórico existente preservado.
- [x] Qualidade cobre sintomas, vitais, vacinas, sessões, família, origem e valores ausentes; nenhuma interpretação clínica.
- [x] Verificar teste red/green e interfaces.

### Task 3: Painel operacional e fluxos completos
**Files:** publico/saude-painel.js; publico/saude-painel.css; publico/index.html; publico/saude-tratamentos.js; tests/saude-painel.mjs.
**Interfaces:** saudePainel(m,area), saudeEditarRegistro(tipo,registro), saudePrepararConsulta(), saudeRelatorio(tipo,registros), saudeStatusGravacao().
- [x] Conservar caminhos antigos; nova entrada Hoje, quatro indicadores, lista de prioridades e ações reais.
- [x] Áreas Exames, Medidas, Consultas e sintomas, Tratamentos, Cuidados e Documentos com cards/listas compactas, filtros, ações e estados vazios.
- [x] Criar formulários transacionais para cadastro/edição, episódio de sintomas, consulta e sessão; datas de plano separadas de realização.
- [x] Histórico de medidas com fonte/unidade/horário e cálculo descrito; comparar somente dados compatíveis.
- [x] Preparar consulta e relatórios selecionáveis por período, sem envio externo.
- [x] Agendamento explícito de múltiplas tomadas em Editar; check diário legado preservado.
- [x] Densidade persistida, histórico de navegação, toque/teclado, estado local/nuvem e recuperação de formulário.

### Task 4: Biblioteca e conferência documental
**Files:** publico/saude-documentos.js; tests/saude-documentos.mjs.
**Interfaces:** quadroDocumentosSaude(), saudeRevisarDocumento(anexo,ref), saudeAbrirDocumento(anexo), saudeCatalogoDocumentos(). Usa arqPor/arqAdd/arqUrlDe existentes.
- [x] Leitor PDF/imagem via URL local/assinada; sem provedor externo novo.
- [x] Biblioteca por ref com busca/tipo/data; anexos existentes sem cópia duplicada.
- [x] Revisão manual com página, texto original, itens reconhecidos, pendentes e confirmados; edição dos campos antes de confirmar; metadados em E.saudeDocumentos.
- [x] Estados anexos pendentes/nuvem diferentes do registro; nenhum falso OCR.
- [x] Testar falha, retomada, segurança URL e preservação de origem.

### Task 5: Integração, revisão e prévia
**Files:** scripts ignorados de prévia; docs/saude-integral-entrega.md; testes relevantes.
- [x] Executar suíte completa, sintaxe, hashes, diff e revisão independente.
- [x] Prévia dedicada com seed fictício cobrindo todas as áreas, sem sincronização de produção.
- [x] Verificar uso, falha ao gravar, importação, documentos, retorno, fisioterapia, vacinas, emergência, exportações e mobile/teclado.
- [x] Registrar o que foi verificado e o que depende de provedor ou de produção; apresentar prévia sem publicar.

## Ressalva da verificação final
A cobertura em modelo/DOM e o parecer de código foram concluídos; a última repetição visual do desfazer no IAB foi interrompida por confirmação nativa. Essa limitação permanece explícita em docs/saude-integral-entrega.md. Publicação não foi feita.
