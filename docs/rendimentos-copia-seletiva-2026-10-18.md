# Cópia seletiva de lançamentos entre meses

## Escopo autorizado

Implementação na área Rendimentos da Central do Léo, após confirmação do proprietário para trabalhar neste repositório sem AGENTS.md. Após revisar a prévia, o proprietário autorizou publicar com o pedido “subir”.

## Comportamento

- O botão passou de “Copiar investimentos” para “Copiar lançamentos”.
- A janela oferece todos os lançamentos mensais da origem, incluindo todos os tipos, empresas e páginas, independentemente dos filtros da tabela.
- Nenhum item começa marcado. Há seleção individual, Selecionar todos, Desmarcar todos e contador.
- O valor anterior aparece como referência. O novo valor só é exigido para os itens selecionados.
- Apenas os selecionados são criados no mês seguinte. O dia é limitado ao último dia válido do destino, inclusive em fevereiro e na virada de ano.
- Registros anuais históricos ficam fora da cópia mensal. Lançamentos de origem, anexos e demais dados existentes são preservados.
- Cópias anteriores identificadas por origem e mês de destino ficam fora da seleção. Origens selecionadas alteradas ou removidas enquanto a janela está aberta bloqueiam a gravação.
- A validação abrange o lote antes da gravação. Falha no armazenamento local desfaz a inserção; submissão repetida não duplica o lote concluído.

## Verificação

- 13 testes específicos passaram: todos os tipos, seleção vazia/parcial/total, valores obrigatórios somente nos selecionados, mês completo com filtros/paginação, datas, duplicidade, alteração de origem e rollback.
- Suíte completa: 1.392 testes passaram, sem falhas ou ignorados.
- Sintaxe dos dois arquivos JavaScript alterados e git diff --check aprovados.
- Navegador: seleção de dois itens de tipos distintos resultou em apenas dois lançamentos no destino, com os valores fictícios informados; console sem erros.
- Layout conferido em 1280 × 900 e 390 × 844. No celular, documento com largura de 390 px e janela com 374 px, sem transbordamento horizontal.
- Prévia exclusiva com dados fictícios e acesso remoto bloqueado. Nenhum lançamento real foi criado ou alterado.

## Limites preservados

A deduplicação reconhece cópias locais com vínculo de origem; não identifica equivalência com lançamentos manuais nem oferece uma transação atômica entre aparelhos. Esta alteração não modifica a sincronização existente.

## Entrega

Implementação em ramo dedicado, com publicação autorizada. A página de prévia e o vínculo local de dependências estão excluídos do Git. A conclusão da entrega depende do workflow de publicação e da comparação dos arquivos servidos com este commit.
