# Auditoria das ferramentas de obra — 27/10/2026

Escopo: conferir as 25 ferramentas da Fortemais, seus quantitativos e a lista de compras, com simulações fictícias e preservação das versões. Base inicial: `bb111a7`; integrada à atualização `b79c603` para publicação autorizada. Motor corrigido: `1.3.1`. A auditoria utilizou dados fictícios e não escreveu no banco de produção.

## Correções comprovadas

- **Embalagem zero:** elétrica, dados/CFTV, paisagismo e quantitativo por consumo tratavam zero como campo vazio. Agora rejeitam zero explícito. Vazio continua permitindo compra contínua, quando o campo é opcional.
- **Comprimento comercial do rodapé:** zero também era tratado como ausência; agora é inválido. Sem comprimento informado, permanece a compra por metro.
- **Pisos:** cobertura por caixa igual a zero era substituída silenciosamente pela quantidade de peças da caixa. Agora só ausência/vazio permite esse cálculo alternativo.
- **Peças sob medida:** a lista apresentava a área, mas perdia o número de peças. Motor, consolidação, tela, PDF e CSV agora preservam a contagem física junto às dimensões, material e área estimada com reserva. Dois vidros de 1 × 1 m, com 10% de reserva, continuam sendo duas peças e 2,2 m² estimados de matéria-prima. A reserva não cria frações de peça nem constitui um plano de corte.

## Conferência por ferramenta

| Ferramenta | O que foi conferido | Resultado |
|---|---|---|
| Blocos e alvenaria | Área, portas/janelas, juntas, blocos e pacotes | Aprovado nos cenários testados |
| Reboco e emboço | Área/faces, cm e mm, consumo industrial ou composição, sacos | Aprovado |
| Gesso por consumo | Volume, consumo por espessura e sacos | Aprovado |
| Concreto por elemento | Quantidades, cm→m, usinado/composição, FCK, cimento | Aprovado |
| Telas soldadas | Sobreposições, camadas, rotação e painéis inteiros | Aprovado |
| Corte de barras de aço | Cortes, barras inteiras, reserva e massa | Aprovado |
| Terra: estados e transporte | Corte/aterro, reuso, estados, volume e carga dos veículos | Aprovado |
| Pisos e revestimentos | Área, reserva, cobertura/peças por caixa e caixas inteiras | Aprovado após correção da entrada zero |
| Rodapé | Exclusões, metros, altura e comprimento comercial | Aprovado após correção da entrada zero |
| Eletrodutos e cabos | Trajetos únicos, condutores, multipolar, reserva e rolos | Aprovado após correção da embalagem zero |
| Água fria e quente | Cortes por sistema/material/diâmetro, barras e conexões | Aprovado |
| Esgoto e pluvial | Cortes, peças, reserva e conexões | Aprovado |
| Cobertura inclinada | Inclinação, beirais, cobertura útil, cumeeiras e rufos | Aprovado |
| Impermeabilização | Subidas, exclusões, demãos/consumo total e mantas | Aprovado |
| Tinta e selador | Rendimento por demão ou acabado, litros, selador e latas | Aprovado |
| Contrapiso em camadas | Área, espessuras e volumes por material | Aprovado |
| Pavimentação em camadas | Conversão cm→m, volumes e reserva | Aprovado |
| Formas e reutilização | Ciclos, estoque, área de chapa e arredondamento | Aprovado na premissa declarada de frentes uniformes e sequenciais |
| Drywall e forro | Consumo por área, unidades, materiais e embalagens | Aprovado |
| Bancadas, vidros e esquadrias | Dimensões, contagem física, área com reserva e consolidação | Aprovado após preservar contagem |
| Gramado e plantio | Área, placas, malha de mudas e reserva | Aprovado após correção da embalagem zero |
| Produtividade e prazo | Pessoa-hora, equipe e jornada | Aprovado; não gera compra de materiais |
| Resíduos e caçambas | Volume, massa, capacidade útil e número de viagens | Aprovado; quantitativo logístico, sem compra de materiais |
| Dados e CFTV | Trajetos, desníveis, folgas e rolos por especificação | Aprovado após correção da embalagem zero |
| Quantitativo por consumo | Coeficiente, unidade, perda e embalagens | Aprovado após correção da embalagem zero |

## Histórico e consolidação

Foram exercitados os 25 fluxos pela interface em DOM isolado: exemplo fictício, identificação, salvar v1, reconstruir a página com o JSON salvo, retomar, alterar uma entrada, recalcular, salvar v2, recarregar, retomar v2 e arquivar.

As asserções confirmam que v1 permanece idêntica, somente v2 entra na compra, o arquivo retira materiais da compra sem apagar versões e dados não relacionados permanecem iguais. Foram cobertos conflitos de versão, alternativas, referências não identificadas, unidades e embalagens incompatíveis, agrupamento antes de arredondar e planos de corte conservados.

O motor anterior continua registrado nas versões antigas. Não existe migração destrutiva nem recálculo automático do histórico: resultados de motor anterior são apresentados como pendentes de recálculo e ficam fora da compra atual até salvar uma nova versão. A contagem de peças é opcional na validação do legado.

## Verificações executadas

- Suíte completa: `TZ=America/Sao_Paulo node --test tests/*.mjs` — **2.273 testes aprovados, 0 falhas**, após integrar a atualização do acompanhamento de obras.
- Regressões específicas reproduziram os defeitos antes das correções.
- Revisão independente do motor, consolidação, tela e exportações sem novos achados.
- `git diff --check` sem erros; referências dos scripts atualizadas no HTML.
- Navegador local: salvou duas peças, recarregou, retomou, alterou para três, salvou v2 e recarregou novamente. Compra confirmou **3 peças / 3,3 m² com reserva**, com ambas as versões no histórico. Arquivar preservou as duas versões e esvaziou a compra desse teste.
- Navegador local: embalagem zero exibiu erro e desabilitou salvar resultado inválido.
- Larguras de 1.280 e 390 px verificadas sem transbordamento da página.

## Limites

Os testes verificam aritmética, validações, apresentação e persistência local/serializada. Não constituem projeto estrutural, elétrico, hidráulico, paginação executiva ou homologação de consumos de fabricantes. As quantidades dependem das medidas e dos coeficientes informados. A rodada atual não escreveu em produção nem repetiu sincronização entre dispositivos; esse fluxo permanece separado dos testes locais. Publicação das correções autorizada pelo usuário; a entrega inclui conferência dos arquivos publicados e comparação do histórico armazenado, sem recálculo automático das versões anteriores.
