# Saúde em linhas e evolução por período

## Pedido e entrega local

O proprietário pediu restaurar a leitura compacta de exames, medidas e consultas, acrescentar dashboards de evolução por ano e mês e incluir emojis na navegação. Após revisar a prévia local, autorizou a publicação dessas melhorias.

## Interface

- Exames, medidas, sinais vitais, consultas, sintomas e fisioterapia usam uma linha por registro em tabelas.
- Exames e medidas abrem em **Linhas**. Os comandos **Evolução** e **Juntos** permitem consultar os gráficos sem perder filtros ou o histórico.
- Edição, documentos, preparo de consulta e episódio mantêm os vínculos originais. Referências, observações e indicadores adicionais ficam em detalhes recolhíveis.
- A tabela de medidas conserva peso, altura, cintura, gordura, massas e fonte/método. Água corporal e outros indicadores já cadastrados continuam nos detalhes e no seletor de evolução.
- As tabelas continuam em linhas no celular, com rolagem dentro do próprio contêiner. A adaptação global que transformava tabelas em cartões foi desativada somente para os novos quadros de Saúde.
- Abas e principais ações incluem emojis.

## Evolução documental

O módulo `saude-evolucao.js` centraliza as séries e a apresentação de exames, medidas e sinais vitais.

- **Datas das coletas:** pontos nas datas reais.
- **Mês a mês:** janeiro a dezembro, uma cor estável por ano; último resultado numérico válido de cada mês no mesmo contexto.
- **Ano a ano:** último resultado numérico válido de cada ano, identificado pela data. Não há soma ou média de resultados de saúde.
- A tabela alternativa mantém todas as coletas e o valor original. Cada ponto abre o registro correspondente por clique ou teclado.
- Unidade, fonte, laboratório, método, amostra, material e contexto diferentes permanecem separados. Contextos incompletos aparecem como pontos isolados.
- Lacunas não viram zero. Resultados qualitativos, valores com limites `<`/`>`, datas inválidas/futuras e múltiplas amostras na mesma data permanecem explícitos e não produzem ligações enganosas.
- A visualização não altera registros, não interpreta evolução clínica e não cria metas ou referências médicas.

## Verificação

- Suíte completa: **1.450 testes aprovados**, nenhuma falha ou teste ignorado.
- Regressões cobrem estrutura em linhas, campos adicionais/legados, resultados literais, filtros, callbacks com IDs, documentos, alternância de visões, séries, unidades, datas, duplicidade, lacunas e ausência de mutação.
- Foi reproduzida e corrigida no navegador uma diferença do parser HTML: linhas do comparativo agora são criadas como elementos `tr`, no contexto correto de tabela.
- Navegador em 1440 × 1000: primeira linha de exame com 49 px; 101 resultados fictícios em linhas, sem cartões.
- Navegador em 390 × 844: largura total de 390 px, tabelas e gráficos rolam internamente sem alargar a página. Seletores, modos mensal/anual e edição pelo teclado conferidos.
- Toda a demonstração usa dados fictícios e não permite consultas remotas. Nenhum dado real de Saúde foi alterado.

## Limite da entrega

Código em ramo dedicado. A prévia e o vínculo local de dependências estão excluídos do Git. A publicação foi autorizada pelo proprietário; a conclusão depende do workflow de publicação e da conferência posterior dos arquivos servidos.
