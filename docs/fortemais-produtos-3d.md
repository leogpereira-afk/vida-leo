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

### Aberturas opcionais — 18/10/2026

- Alvenaria agora começa explicitamente sem portas ou janelas, inclusive no exemplo fictício.
- Ao ativar aberturas, o usuário escolhe porta ou janela e informa as medidas; janelas têm peitoril. Desativar preserva as medidas, mas elimina os descontos e recortes, inclusive da exportação.
- Registros antigos sem a opção mantêm os vãos anteriores; a interface explicita esse estado ao abrir.
- Verificação: 1.519 testes passaram. Prévia local conferida com parede inteira (15 m²), porta (13 m² nos testes) e janela (14 m² no navegador).
- Limitação visual observada: a perspectiva do desenho genérico apresenta artefatos nas juntas; esta alteração não modifica o renderizador. Posições horizontais das aberturas continuam esquemáticas, da esquerda para a direita.
- Alteração somente local; publicação não realizada.

### Conferência de unidades e exemplos — 19/10/2026

- O resumo da alvenaria mostra blocos necessários e blocos para compra em unidades. O exemplo de 15 m² apresenta 188 unidades líquidas e 207 para compra, incluindo a reserva.
- Carregar exemplo fictício agora calcula e monta a visualização imediatamente, sem salvar registros. O exemplo de tela inclui diâmetro e espaçamento fictícios para mostrar os fios.
- Faces compartilhadas entre caixas são removidas antes da projeção. A subtração retangular mantém trechos expostos em bordas, aberturas e fiadas desencontradas; eliminou as marcas de juntas observadas em 18/10.
- Consumo genérico e produtividade não possuem dimensões físicas: mostram explicação compacta, sem canvas vazio nem exportação PNG. Campos faltantes aparecem junto à área de resultado.
- Os 25 exemplos foram percorridos no navegador: 23 criaram canvas e 2 apresentaram a explicação. Testes do renderizador verificam comandos de desenho e coordenadas finitas para cada exemplo. Conferidas visualmente alvenaria, pisos, telas e cobertura, além da ampliação em 390 × 844.
- Verificação final: 1.547 testes passaram, nenhum erro de console na prévia e git diff --check limpo. Sem publicação.

### Troca de chips e atualização automática — 19/10/2026

- Causa reproduzida no navegador: chip Terra ativo enquanto o formulário e o desenho ainda eram de alvenaria. Os chips apenas filtravam a lista.
- Cada categoria agora abre sua ferramenta correspondente (ou a última ferramenta daquela categoria). Formulário, indicadores e cena mudam juntos.
- Edições de medidas, réguas, aberturas e material recalculam após 350 ms sem novas alterações. Resultados ficam indisponíveis para salvar/exportar nesse intervalo. Entrada inválida remove a imagem anterior e mostra a pendência.
- O renderizador atualiza a cena mantendo o mesmo canvas, zoom, rotação e seleção de detalhe/camada. Trocar de ferramenta inicia a vista correspondente.
- Rascunhos ficam separados por ferramenta durante a sessão. A troca não grava no banco; recarregar/fechar ainda exige salvar explicitamente para persistir.
- Após carregar um exemplo fictício, ferramentas ainda não visitadas abrem seu próprio exemplo, identificado na mensagem. Sem essa escolha inicial, não se inventam medidas.
- Verificação: 1.551 testes passaram; todas as 13 categorias conferidas no navegador; largura alterada de 5 para 8 m atualizou a área para 24 m² sem clicar em Calcular e foi preservada ao voltar. Console sem erros. Prévia local, sem publicação.
