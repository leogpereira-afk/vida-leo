# Redesign de Gastos e Rendimentos

Implementação local baseada nas duas fotos enviadas. Não publicada; conferência visual no navegador continua adiada conforme orientação anterior.

- Navegação por Resumo, Lançamentos e Recorrentes em Gastos; Resumo, Lançamentos e Histórico em Rendimentos.
- Número principal em faixa verde escura e indicadores auxiliares compactos, substituindo cinco cartões equivalentes.
- Exportações reunidas em menu; retirada do controle de abrir/recolher tudo dessas duas telas.
- Conteúdo visível ao selecionar a aba, mesmo quando havia preferência antiga de recolhimento.
- Gastos por categoria em lista com barras proporcionais, valores, participação e janela com os itens; comparação detalhada permanece acessível.
- Lançamentos de gastos em lista própria no celular, com formulário de edição, acesso a comprovantes e exclusão mediante confirmação.
- Custo e saldo apresentados como estimativas, esclarecendo a soma de lançamentos com recorrentes e o risco de contabilizar a mesma conta duas vezes. Não se deduzem duplicidades automaticamente.
- Todos os meses usa os meses com registros de gastos ou rendimentos para alinhar o período agregado. Recorrentes históricos continuam estimados a partir do cadastro atual, explicitamente informado.
- Gastos sem categoria e valores negativos deixam de sumir do detalhamento por categoria.
- Filtro de empresa em Rendimentos passa a atualizar total, comparação, maior fonte e quantidade de lançamentos.
- Variação anual identificada como comparação com o total do ano anterior; aviso do acumulado parcial sem projeção apresentada como previsão.

Validação: suíte JavaScript e revisão de diferenças. A suíte não equivale à conferência de renderização no Safari; essa etapa permanece pendente. Nenhuma publicação realizada nesta etapa.
