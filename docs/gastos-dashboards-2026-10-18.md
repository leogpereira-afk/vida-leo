# Gastos compactos e dashboards

Pedido: aplicar o padrão de Rendimentos a Gastos, com evolução mensal, por empresa e entre todos os anos. Cor corrigida pelo dono durante a implementação: roxo #6d3bb8. Prévia com dados fictícios; publicação não solicitada nesta etapa.

## Estrutura

- Resumo compacto, Gráficos, Lançamentos e Recorrentes.
- Dashboards de evolução mensal, foco em empresa, comparação de anos e comparação de empresas.
- Até dois gráficos abertos por visão. Acumulados, diferenças, tabelas e detalhes podem ser expandidos; cada gráfico oferece ampliação e exportação de imagem quando aplicável.
- Gráficos, tabelas, detalhe e arquivos CSV/Excel/PDF usam a mesma base de leitura. PNG e SVG reutilizam o exportador de gráficos.
- Cadastros recorrentes e formulários continuam únicos. Pesquisa dos lançamentos e filtros são preservados ao consultar uma ficha.

## Dados e identidade

Competência usa o campo mes do gasto. Valores futuros, inválidos, zero e ausência de informação permanecem distintos. Estornos ficam negativos. Registros não confirmam quitação. O cadastro atual de recorrentes não é distribuído artificialmente pelos anos e não é somado aos gráficos históricos.

Comparações equivalentes usam o mesmo número de meses, não o mesmo dia: o cadastro aceita despesas sem data diária. A condição parcial e a ausência de fechamento continuam explícitas. Valores são nominais.

O formulário oferece empresa opcional por empresaId do cadastro de empresasPJ. O ID prevalece sobre nomes antigos. Nomes legados só são relacionados na leitura quando há correspondência exata e única; ausências e ambiguidades ficam separadas, sem migração silenciosa. A escolha de retirar o vínculo é explícita. Editar outra informação mantém os campos legados e o vínculo intactos.

## Implementação

GastosModelo contém os cálculos puros. GastosUI monta os painéis sobre o renderizador existente de lançamentos e recorrentes, preservando cadastros, anexos e ações. FinanceiroGraficos reúne as primitivas de gráfico e exportação já utilizadas por Rendimentos; a extração evita manter dois motores visuais diferentes. As regras analíticas de Rendimentos não foram alteradas. As melhorias de Saúde presentes em origin/main foram preservadas no clone isolado.

## Verificação prevista

Testes de cálculo, vínculo, filtros, origem, expansão, exportação e regressões gerais. Navegação e layout em computador e celular. Prévia excluída do Git e sem acesso à nuvem. Validação em produção depende de publicação posteriormente autorizada.
