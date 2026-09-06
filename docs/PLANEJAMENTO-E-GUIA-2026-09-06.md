# Guia de vida e planejamento anual — 06/09/2026

## Entrega

- Guia de vida com visão geral de prioridades e áreas para planos pessoais, família, cadastros e desenvolvimento. Os editores de rituais e do plano pessoal ficam junto de seus respectivos resumos. Os atalhos abrem a área correta.
- Documentos em cartões visíveis, com busca por nome, referência e local, filtros por pessoa e validade e acesso aos anexos existentes.
- Oportunidades com próximo passo e prazo em destaque, busca, filtros e comparação de notas. Os estágios são exibidos pelo próprio nome; “Tocando” não aparece como “Realizado”.
- Planejamento estratégico por ID da empresa e ano, começando em 2027. Anos seguintes são criados em branco ou a partir de outro plano, sem substituir o original. Na cópia, os prazos ficam em branco e as ações voltam para “A fazer”.
- Histórico acessível mesmo após renomear ou baixar uma empresa. Encerrar um plano protege sua edição; reabrir permite correções. Resultados e anexos ficam vinculados ao plano do ano.
- Tela do planejamento com empresa/ano no topo, “Novo objetivo” e “Exportar PDF” à mão, três indicadores compactos e formulários de ações recolhidos até o uso.
- Exportação em formato de apresentação para PDF, com logomarca, empresa, ano, direção, objetivos, ações, responsáveis, prazos, equipe e balanço. O botão abre a prévia; “Salvar como PDF” abre a impressão do navegador.

## Dados e compatibilidade

O estado usa a sincronização e o backup existentes. A coleção `planejamentoEmpresas` mantém cada empresa/ano como um registro separado. A validação de backup rejeita anos inválidos, planos duplicados e estruturas de ações inválidas.

Conteúdo eventualmente existente em `estrategia` permanece preservado. A compatibilidade cria o plano de 2027 apenas quando há conteúdo e não existe esse ano para a empresa, persistindo o ID antes de oferecer anexos. A agenda usa os planos anuais abertos sem duplicar a origem já convertida.

Nenhum dado pessoal real foi alterado nos testes. As prévias usaram registros fictícios e permaneceram fora do repositório.

## Verificação

- 223 testes automatizados aprovados, incluindo 18 testes específicos de histórico, isolamento entre empresas/anos, cópia independente, encerramento, anexos, backup, filtros, navegação e conteúdo da apresentação.
- Revisão no navegador em 1280 px, 390 px e 320 px; navegação pelas áreas do Guia e do planejamento, documentos e oportunidades sem transbordamento horizontal ou erro de carregamento.
- Tema escuro conferido em 320 px.
- Criação de 2028 a partir de 2027 e alteração da missão pela interface: o texto de 2027 permaneceu intacto.
- Busca de documento, comparação de oportunidades e abertura automática do editor de rituais verificadas pela interface.
- Exportação real aberta no Chrome com a empresa e o ano selecionados. Prévia de impressão do exemplo simples com cinco páginas; apresentação completa com sete páginas incluindo valores e equipe. Conferência com dados de demonstração, sem impressão física nem execução em iPhone físico.
- `git diff --check` sem erros. Nenhuma biblioteca adicional de exportação é carregada pelo painel.
