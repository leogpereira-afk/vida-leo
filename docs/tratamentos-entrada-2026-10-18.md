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
