# Fortemais — vistas dos produtos (prévia local)

O módulo `fortemais-produtos-3d.js` transforma apenas a geometria de apresentação. As compras, coeficientes, reservas e quantidades continuam no motor de cálculo. A cena guarda os parâmetros que originaram o resultado; editar o formulário exige recalcular. Resultados antigos continuam legíveis e recebem a orientação de recálculo pela versão do motor.

- Alvenaria: perfil explícito, fiadas, vãos esquemáticos e juntas individuais. Detalhe de tijolo de oito furos horizontais, cerâmico liso ou concreto vazado. Frisos modelados em relevo no detalhe. Medidas externas e junta vêm do formulário; paredes internas e distribuição da massa são ilustrativas.
- Referências: City para dimensões dos cerâmicos lisos; Continental para vedação de concreto; Cerâmica Itapira para tijolo de 8 furos frisado 9 × 19 × 19 cm. Fontes disponíveis no seletor de modelos. Sem perfil selecionado, não se presume vazados ou frisos.
- Telas: fios no espaçamento informado, transpasses e camadas. Conjunto leve com linhas e detalhe com seções cilíndricas. Separação entre camadas não representa cobrimento.
- Tubos: trechos separados e seção aberta. DN não é certificado como diâmetro externo; parede ilustrativa. Não se infere posição de conexões.
- Cabos e barras: amostras por especificação, com detalhe abreviado. Diâmetro externo dos cabos não é deduzido da seção do cobre. Barras respeitam diâmetro informado; não há dimensionamento de armaduras.
- Pisos/rodapés: peças, recortes retangulares e juntas; espessuras não informadas ficam identificadas como ilustrativas.
- Reboco/gesso: camada na espessura informada sobre base com exposição parcial demonstrativa. Consumo continua sobre a área total calculada.
- Terra e pavimentos: estados/camadas diferenciados. Pintura, impermeabilização, drywall, concreto, formas, peças e resíduos têm representação específica ou equivalente explicitamente descrita.
- Cobertura permanece plano com inclinação e beirais; não inventa perfil de telha sem especificação. Produtividade e consumo sem dimensões não geram falsos volumes métricos.

Controles: conjunto/detalhe quando aplicável; camada aplicada visível/oculta; topo/frente/3D; ampliar, zoom, girar, cotas e PNG. Limites de geometria preservam a interface e avisam quando o desenho foi limitado. Nenhuma dependência externa ou chamada de rede foi acrescentada ao render.

Verificação em 18/10/2026: 1.516 testes passaram. Casos cobrem todos os 25 cálculos nas duas vistas e estados de camada, geometria finita, preservação do resultado, vazados, juntas, cotas e controles. Inspeção no navegador: alvenaria, tubos, tela soldada, piso e reboco; detalhe ampliado em 390 × 844 sem transbordamento horizontal. Prévia usa dados fictícios. Sem publicação.
