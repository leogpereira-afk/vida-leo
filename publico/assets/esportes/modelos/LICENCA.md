# Modelo humano atlético — licença e procedência

## Dados incorporados

`humano-atletico.json` contém exclusivamente os dados geométricos de um modelo humano masculino atlético derivado do MakeHuman: posições, normais, triângulos, marcos anatômicos, ossos e pesos de deformação. Inclui shorts, tênis e grupos de superfície para destaque didático dos músculos. Não contém texturas nem código de execução do FormLab ou do MakeHuman.

A origem imediata é [`athlete-model.js` do FormLab Motion Atlas](https://github.com/dcdyouget/formlab-motion-atlas/blob/460f0a35b4e058c191853d5c90baf94bcf244ceb/athlete-model.js), revisão `460f0a35b4e058c191853d5c90baf94bcf244ceb`. O arquivo de origem tem SHA-256 `76f9267f743c6519693c3a076347e065441adbeea56d74efd2531a91926d4612`.

A [licença específica desse asset](https://github.com/dcdyouget/formlab-motion-atlas/blob/460f0a35b4e058c191853d5c90baf94bcf244ceb/ASSET-LICENSES.md) declara o modelo processado sob **CC0 1.0 Universal**. Essa declaração abrange os dados do modelo; não se presume uma licença para o código aplicativo do FormLab.

## Fontes MakeHuman

O modelo foi produzido a partir dos seguintes assets oficiais do MakeHuman, com os hashes conferidos nos arquivos originais:

- [Malha base](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/3dobjs/base.obj): `8e761e6624b8f54536409135d1636da63b32486a90d4897f84e121d144f6fb4c`.
- [Morph masculino jovem](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/targets/macrodetails/caucasian-male-young.target): `70e228ba7164737dae664454394536fc5935fa48d333c1a97d77e2dc6eacc5f5`.
- [Morph masculino jovem, máximo músculo e peso médio](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/targets/macrodetails/universal-male-young-maxmuscle-averageweight.target): `c171ff9cc95e96273beb3e3b1969a01988c2d4982ebc6fe04bf81cf72ee3b295`.
- [Pesos oficiais de deformação](https://github.com/makehumancommunity/makehuman/blob/master/makehuman/data/rigs/default_weights.mhw), conforme a procedência documentada pelo FormLab.

A [licença do MakeHuman](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.md), seção C, libera os assets gráficos incluídos no projeto — malha base, targets, modificadores, texturas, roupas e poses — sob CC0 1.0. A seção D esclarece que os dados exportados não contêm código de execução. O aplicativo MakeHuman tem licença AGPL separada; seu código não foi incorporado.

Texto legal: [CC0 1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/legalcode.pt), também disponível no [arquivo oficial de licença dos assets MakeHuman](https://github.com/makehumancommunity/makehuman/blob/master/LICENSE.ASSETS.md).

## Adaptação nesta aplicação

O invólucro JavaScript foi removido e os dados foram armazenados como JSON. Os grupos legados de cabelo, camiseta e calçados antigos foram excluídos das tabelas de índices e contagens. Foram preservados corpo, olhos, shorts, tênis atuais e os doze grupos anatômicos de estudo. Nenhuma textura, animação, shader ou implementação de renderização externa foi copiada.

O modelo usa metros, eixo Y para cima e eixo Z positivo para frente. O esqueleto possui 22 ossos e quatro influências normalizadas por vértice. Os destaques de superfície são um recurso didático de visualização, não uma medição de ativação muscular.
