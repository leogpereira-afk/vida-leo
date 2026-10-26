# Ferramentas de obra — revisão local de 26/10/2026

## Entrega preparada

Evolução das 25 ferramentas existentes da Fortemais, mantendo os registros no mesmo modelo de armazenamento. Nenhum dado de obra real foi utilizado nos testes ou incluído no repositório. Publicação ainda não realizada.

- Formulários compactos, seleção por chips, entrada numérica exata, botões de incremento e réguas graduadas para medidas e quantidades adequadas.
- Escala da régua permanece estável durante o arraste. A digitação pode ampliar a escala e conservar precisão superior ao passo dos botões.
- Consumos, resistências e especificações técnicas não recebem sugestões de dimensionamento pelas réguas.
- Catálogo, escolha de material, parâmetros avançados, fontes e memória de cálculo recolhíveis.
- Em celular, alternância entre Medidas, Resultado e Compra. Campos com unidades e ações de toque.
- Guia de cada ferramenta com dados necessários, fórmula, cuidados de compra e dependências do projeto ou do fabricante. Pesquisa detalhada em `fortemais-fontes-2026-10-26.md`.

## Correções de cálculo e compra

- Conversão explícita entre consumo por centímetro e por milímetro em reboco/gesso, sem alterar o coeficiente informado.
- Contagens comerciais inteiras, arredondamento tolerante ao ruído decimal e demanda positiva que nunca desaparece no arredondamento.
- Limites de desenho e de plano de corte, sem percorrer quantidades ilimitadas de elementos gráficos.
- Aberturas que não cabem lado a lado não invalidam automaticamente a área: o resultado quantitativo permanece acompanhado da pendência de posição no projeto. Área líquida zero não produz uma parede fictícia.
- FCK, altura do rodapé, dimensões de mantas e peças, classe do aço e número de vias do cabo multipolar participam da identificação de compra. Cabo multipolar usa comprimento físico.
- Materiais sem identificação suficiente ficam separados por simulação e item, com aviso e origem visíveis. Um formato genérico de piso não identifica o produto.
- Embalagem de cimento editável nas composições; a premissa anterior de 50 kg é exposta para conferência e mantida apenas como compatibilidade na ausência do campo.
- Compras consolidadas não reutilizam resultados de motores anteriores. A interface identifica a compra parcial, lista as simulações que precisam de recálculo e conserva as versões antigas.

## Verificação

Há testes do motor, preservação das entradas, controles, guias, versões, consolidação, integração e ciclo das 25 ferramentas. A conferência de navegador utiliza uma prévia isolada e dados fictícios, incluindo salvamento, recarga, retomada, conversão cm/mm, erro de medida e layout móvel.

Resultado final em 26/10/2026:

- `TZ=America/Sao_Paulo node --test tests/*.mjs`: **2.003 testes passaram; nenhuma falha, teste cancelado ou ignorado**. Inclui a suíte geral do projeto, não apenas as alterações desta entrega.
- Sintaxe dos cinco módulos JavaScript alterados/adicionados: aprovada.
- `git diff --check`: limpo. Testes de hashes das referências de cache incluídos na suíte geral.
- Prévia em navegador: exemplo de 50 m² e 2 cm com coeficiente fictício 1,5 kg/m²/cm resultou em 150 kg líquidos e 9 sacos de 20 kg após reserva de 10%; mudança para kg/m²/mm mantendo 1,5 resultou em 1.500 kg e 83 sacos, como esperado pela unidade escolhida.
- Espessura zero bloqueou salvar, retirou o resultado anterior e indicou o campo inválido; correção para 2 cm restabeleceu o resultado.
- Salvamento local e retomada após recarga preservaram identificação, parâmetros, fonte e compra da versão 1.
- Celular em 390 × 844: Medidas/Resultado/Compra conferidos, sem transbordamento horizontal da página; tabela de materiais rola dentro de sua própria região. Contraste da aba selecionada corrigido e confirmado.
- Logs de erro/aviso do navegador na conferência final: nenhum registrado.

## Limites práticos

Os resultados são quantitativos de planejamento baseados nos dados informados. Não dimensionam estruturas, circuitos, tubulações, fixações nem substituem a especificação de projeto. A composição e a reserva precisam corresponder ao produto e à situação de execução. Referências oficiais não significam homologação do algoritmo pelo fabricante.

O teste de persistência no navegador é local; sincronização produtiva entre dispositivos não foi acionada nesta prévia. O histórico de produção não foi migrado nem regravado.
