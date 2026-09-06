# Revisão de design e acessibilidade — 06/09/2026

Revisão complementar à auditoria técnica da Central do Léo. Abrange os 15 módulos internos, 19 tipos de janela e componentes compartilhados. As mudanças são de apresentação, interação e identificação dos controles; os registros de produção não foram alterados nesta etapa.

## Melhorias entregues

- Cabeçalhos com tipografia consistente e remoção da fileira de atalhos que repetia o seletor de seções.
- Formulários com duas colunas no computador e uma no celular, campos sem largura mínima que ultrapasse a janela, rótulos legíveis e contornos mais visíveis.
- Janelas limitadas à altura disponível, cabeçalho fixo, conteúdo com rolagem própria e barra de ações acessível durante a rolagem.
- Isolamento do painel e de janelas anteriores enquanto uma janela está aberta. Tab/Shift+Tab permanecem na janela; Escape fecha; o foco retorna ao botão de origem mesmo quando a tela o recria.
- Botões nativos para anexos e importação do ERP, com indicação de envio e bloqueio de acionamento repetido enquanto ocupados.
- Nomes acessíveis para filtros, busca, controles do calendário, instruções, escalas, etapas de metas e campos de tabelas. Ações de arquivos informam também o nome do anexo.
- Navegação por teclado nos cabeçalhos de obras e nas seções da ficha. Mensagem de erro da entrada identificada como alerta.
- Texto secundário, notas zeradas e foco com contraste maior. Fundos, abas, campos nativos e cartões ajustados ao tema escuro.
- Caixa e VGV: ação de planilha em largura inteira no celular; edição e PDF abaixo; quatro seções em duas colunas, sem ocultar opções na rolagem horizontal.
- Saúde: seletor de inclusão proporcional no computador e textos de referências coerentes entre lista e ficha. Não houve alteração de limites clínicos.
- Grupos de cinco indicadores melhor distribuídos para evitar um cartão isolado no computador e no celular.

## Verificação realizada

- **205 testes aprovados**, incluindo 39 verificações acrescentadas nesta revisão: campos das 19 janelas, filtros dos 15 módulos, camadas de janelas, retorno de foco, anexos, alerta de entrada e campos adicionados à ficha de viagem.
- Navegação nos **15 módulos em 1280 × 900 e 390 × 844**, na prévia local do aplicativo. Nenhuma página ultrapassou a largura disponível e nenhum alerta de falha de renderização apareceu nos percursos.
- Navegação nos **15 módulos em 320 × 740 no tema escuro**, em uma cópia local com dados de exemplo e serviços simulados. Sem transbordamento horizontal da página nos percursos.
- Abertura dos **19 tipos de janela em 1280, 390 e 320 pixels de largura**. Sem transbordamento da janela ou do corpo nos exemplos e sem campos de formulário sem identificação nos casos cobertos.
- Inspeção visual de telas e formulários representativos, incluindo Saúde, Caixa e VGV, Gestão estratégica, Configurações, Viagem, Exame e Documento. Inspeção de estrutura e medidas complementa a inspeção por imagem.
- Teclado real no navegador: Shift+Tab do botão de fechar para o último controle, Tab de volta ao primeiro, Escape e retorno ao botão de inclusão após remontagem da tela.
- Temas claro e escuro avaliados em prévias separadas, sem mudar a preferência do computador do usuário.
- Revisão do diff e verificação de espaços/formatação antes da publicação. A folha de estilos recebe nova versão para atualização do cache.

### Amostras de contraste

Cálculo por luminância relativa das cores definidas nos estilos, sem arredondamento para decidir aprovação.

| Amostra | Razão | Referência |
|---|---:|---:|
| Texto principal sobre cartão claro | 16,17:1 | 4,5:1 |
| Texto secundário sobre fundo de abas claro | 4,82:1 | 4,5:1 |
| Botão principal claro | 6,02:1 | 4,5:1 |
| Contorno de campo claro | 3,53:1 | 3:1 |
| Texto principal sobre cartão escuro | 13,57:1 | 4,5:1 |
| Texto secundário sobre abas escuras | 6,46:1 | 4,5:1 |
| Botão principal escuro | 7,07:1 | 4,5:1 |
| Contorno de campo escuro | 4,66:1 | 3:1 |

## Limites da verificação

Os testes de celular usam dimensões no navegador, não um iPhone ou Android físico. Não houve teste com VoiceOver/NVDA, zoom real de 200% nem certificação WCAG. As amostras de contraste não constituem uma medição de cada pixel, gráfico ou combinação possível de conteúdo. O catálogo de janelas usa exemplos locais; não executa OAuth real nem ações destrutivas em produção.

As pendências de conferência financeira e validação real de integrações registradas na auditoria técnica continuam separadas desta entrega de design. Esta revisão não certifica ausência de todos os bugs possíveis.
