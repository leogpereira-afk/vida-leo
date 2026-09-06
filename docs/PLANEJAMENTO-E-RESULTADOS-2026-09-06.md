# Planejamento estratégico e resultados pessoais — 06/09/2026

## Planejamento

A entrada agora apresenta direção, execução das ações, prioridades, pendências de preenchimento e próximos prazos. Empresa e ano permanecem no topo. Os objetivos usam uma lista compacta, com detalhes abertos sob demanda, busca e filtros para ações em aberto, atrasadas e bloqueadas.

- Direção inclui identidade, diagnóstico (cenário, forças, fragilidades, oportunidades e riscos) e escolhas de posicionamento e prioridades.
- Cada objetivo pode guardar indicador, meta esperada e resultado observado com data. O percentual de ações concluídas não é apresentado como percentual de alcance da meta.
- Ações podem ser criadas e editadas em formulários com salvamento explícito. Cancelar não grava um rascunho.
- Equipe possui frentes e pessoas com edição direta, inclusive no celular. O vínculo entre pessoa e frente usa o ID, sem depender do nome.
- Histórico por empresa e ano, a partir de 2027. Copiar um plano preserva direção e metas, reinicia prazos e execução e deixa os resultados observados no ano de origem.
- Planos encerrados continuam protegidos para consulta. Anexos permanecem disponíveis para leitura.
- Apresentação em PDF inclui os novos campos de diagnóstico, escolhas, meta e resultado.

Referências consultadas e adaptadas ao uso anual do painel:

- [BDC — How to write a strategic plan](https://www.bdc.ca/en/articles-tools/business-strategy-planning/define-strategy/how-write-strategic-plan): contexto atual, futuro desejado, prioridades e plano de ação.
- [BDC — How to measure the success of your strategic plan](https://www.bdc.ca/en/articles-tools/business-strategy-planning/define-strategy/how-to-measure-success-strategic-plan): distinguir marcos de execução de medidas de desempenho e vincular indicadores aos objetivos.
- [BDC — What is strategic planning?](https://www.bdc.ca/en/articles-tools/business-strategy-planning/define-strategy/strategic-planning-demystified): revisões de execução mensais e aprofundamento trimestral.
- [Harvard Business School — Creating a Successful Strategy](https://www.isc.hbs.edu/strategy/creating-a-successful-strategy/Pages/default.aspx): proposta de valor e escolhas sobre o que priorizar e o que deixar de fazer.

## Desenvolvimento

Guia de vida → Desenvolvimento → Resultados reúne quatro entradas: DISC, Liderança, Minhas análises e Resultados na prática. O retrato também possui o atalho “Ver meus resultados”.

Os resultados documentados são lidos das fontes privadas já importadas. As análises mostram tema, origem, aplicação proposta, forma de observar o resultado e percepção registrada pelo usuário. Novos resultados práticos recebem data, contexto, evidência e vínculo com a análise; não alteram o relatório original. Fontes pendentes e números antigos sem origem identificada não são apresentados como novas medições.

Nenhum documento pessoal foi incorporado aos arquivos públicos. Não houve nova importação nem alteração direta da base remota nesta revisão.

## Verificação

245 testes passaram. Os testes cobrem rascunhos cancelados, edição de ações, resumo da execução, datas dos resultados, filtros, IDs da equipe, proteção de anos encerrados, cópia entre anos, PDF, medições documentadas, análises e persistência dos resultados pessoais. Conferência visual em computador e celular, incluindo os cinco painéis do planejamento e os quatro tipos de resultado. A prévia utiliza dados fictícios; os dados privados foram conferidos separadamente quanto à montagem da nova tela.

Na prévia em 390 × 844, nenhuma das cinco abas do planejamento nem dos quatro tipos de resultado excedeu a largura da tela. Também conferidos 1440 × 1000, contraste em modo escuro, gravação e persistência de resultado após recarregar e ausência de erros no console. A apresentação HTML usada na exportação foi inspecionada quanto à paginação e sobreposição de rodapés; a geração final do arquivo PDF continua usando a impressão do navegador.

## Complemento — cadastro anterior completo

Minhas análises passa a incluir todos os campos de `comportamento`, com os textos integrais, números, listas e objetos. Os assuntos são agrupados para consulta e os campos desconhecidos também são preservados na exibição. O mesmo leitor completo atende à consulta do histórico. Registros sem origem comprovada permanecem identificados como anteriores; referências simbólicas não são promovidas a medições.

Corrigida a montagem de fragmentos HTML com mais de uma raiz: o helper `el` mantinha somente o título e descartava o parágrafo seguinte na tela. A reprodução com a versão anterior confirmou a ausência do texto, e o novo leitor mostrou tanto o texto quanto campos antes omitidos. Testes verificam cobertura dos campos, ausência de mutação dos dados, zeros, falsos, estruturas aninhadas, texto longo, escape de HTML e independência dos filtros. 248 testes passaram. Prévia móvel em 390 × 844 sem excesso de largura e console sem erros. Nenhuma alteração da base privada foi necessária.
