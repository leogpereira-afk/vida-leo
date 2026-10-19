# Entrada dos tratamentos

## Problema e comportamento corrigido

A entrada podia priorizar um medicamento avulso por causa da ordem dos cadastros ou de uma seleção anterior. O formulário de uso aparecia antes do contexto do plano.

Na aba Tratamentos, a entrada agora abre o plano de emagrecimento existente em Visão geral. A ordenação é apenas de apresentação: planos cujo nome contém emagrecimento vêm primeiro, depois outros planos e, por último, avulsos. Planos são identificados pelo tipo cadastrado ou por filhos já vinculados.

Os planos ficam no seletor principal. Medicamentos e cuidados sem plano ficam em uma seção própria recolhível. Nenhum vínculo é deduzido ou criado pela apresentação.

O comando Registrar uso fica nas ações do plano e abre a lista dos seus itens, sem escolher um medicamento automaticamente. A ficha e o formulário aparecem após selecionar o item. A abertura dirigida de um item por outras ações conserva o alvo.

A Visão geral mantém os indicadores e o gráfico resumido. A tabela completa de avaliações permanece em Evolução.

## Verificação

- Nove regressões específicas: prioridade do emagrecimento, navegação de volta ao plano, avulsos separados, seleção explícita, alvo dirigido, ausência de mutação, alternativas sem plano de emagrecimento e tabela completa em Evolução.
- Suíte completa: **1.459 testes aprovados**, sem falhas ou ignorados.
- Navegador: plano correto e Visão geral na entrada; formulário ausente até escolher um item; lista limitada ao plano; avulso acessível; retorno pela aba restaura o emagrecimento.
- Celular de 390 px sem transbordamento da página. Console da prévia sem erros.
- Testes e demonstração usam exclusivamente dados fictícios. Os cadastros, vínculos, usos, compras, estoque e documentos reais não foram modificados.

## Entrega

Prévia local em ramo próprio. Publicação ainda não solicitada para esta correção. A prévia e as dependências locais estão excluídas do Git.

## Compactação vertical da tela

O cabeçalho, os seletores, as ações e os indicadores receberam espaçamentos menores somente em Tratamentos. O status de gravação compartilha a faixa dos filtros; os itens sem plano ficam junto ao seletor; o consultório compartilha a faixa das seções. Nenhuma informação clínica foi removida. No celular, a frase de apresentação cede espaço e os seletores usam rolagem horizontal, mantendo controles de pelo menos 44 px.

Na comparação com dados fictícios e viewport de 1.440 × 1.000 px, o início dos indicadores mudou de 716,3 para 422,6 px e o gráfico de 882,9 para 560,2 px. Em 390 px, a largura da página permanece em 390 px, sem transbordamento; a rolagem dos seletores fica contida neles.

Verificação atual: **1.460 testes aprovados**, zero falhas, sintaxe dos dois scripts e `git diff --check` sem erros. No navegador foram conferidos o retorno à Visão geral, a abertura dos documentos e do consultório, a remoção do escopo compacto ao sair de Tratamentos e o console sem erros. Revisão independente do diff sem bloqueios. Os dados e a sincronização não foram alterados. Esta compactação também permanece local.
