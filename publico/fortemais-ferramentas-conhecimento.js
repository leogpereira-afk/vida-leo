(function (g) {
'use strict';

// Pesquisa editorial de fontes primárias. Não altera medidas, coeficientes ou resultados.
// As fórmulas descrevem a estimativa da ferramenta; não são dimensionamento de projeto.
const VERSION = '1.0.0';
const consultadoEm = '2026-10-26';
const fonte = (titulo, url, trecho) => ({titulo, url, trecho, consultadoEm});
const fontes = {
  alvenaria: fonte('ABCP — Metodologia de execução de alvenaria', 'https://abcp.org.br/wp-content/uploads/2016/01/AE_metodo_executivo.pdf', 'Projeto de produção, modulação e execução.'),
  reboco: fonte('Quartzolit — Reboco pronto', 'https://www.quartzolit.weber/argamassas-e-rejuntes-quartzolit/argamassas-e-revestimentos-decorativos/reboco-pronto-quartzolit', 'Consumo por área e espessura; usos e restrições do produto.'),
  gesso: fonte('Placo — Reboco Fácil', 'https://www.placo.com.br/produtos/reboco-facil', 'Dados técnicos: consumo expresso por m² e por mm.'),
  concreto: fonte('ABCP — Perguntas frequentes sobre cimento e concreto', 'https://abcp.org.br/perguntas-frequentes/', 'Dosagem, componentes e necessidade de estudos específicos.'),
  telas: fonte('Gerdau — Simulador e tabela de telas soldadas', 'https://voce.mais.gerdau.com.br/simulador-de-telas', 'Designação, direções, dimensões e massa nominal das telas.'),
  barras: fonte('Gerdau — Catálogo de construção civil', 'https://www2.gerdau.com.br/wp-content/uploads/2022/07/Catalogo-Construcao-Civil-Gerdau_0-1.pdf', 'Apresentações comerciais e massa nominal dos vergalhões.'),
  terra: fonte('DNIT — Manual de implantação básica de rodovia', 'https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/ipr/coletanea-de-manuais/vigentes/742_manual_de_implantacao_basica.pdf', 'Página 242: estados do solo e definição da relação de empolamento.'),
  pisos: fonte('Portobello — Manual do cliente', 'https://www.portobello.com.br/produtos/abrir/6165/Manualdocliente_AGO22.pdf', 'Página 8: tonalidade, calibre e reserva conforme paginação.'),
  rodape: fonte('Portobello — Rodapés', 'https://www.portobello.com.br/complementos/rodapes', 'Medição de rodapés em metros lineares.'),
  eletrica: fonte('Prysmian — Manual de instalações elétricas', 'https://br.prysmian.com/sites/br.prysmian.com/files/media/documents/Manual_Instalacoes_Eletricas.pdf', 'Dimensionamento de circuitos e métodos de instalação; conferir normas vigentes no projeto.'),
  tigre: fonte('Tigre — Manual de instalações hidráulicas prediais, 2025', 'https://tigresite.s3.amazonaws.com/2025/08/manual_tigre_2025.pdf', 'Água fria, água quente, esgoto e águas pluviais tratados por sistema.'),
  cobertura: fonte('Brasilit — Catálogo geral de produtos', 'https://www.brasilit.com.br/sites/brasilit.com.br/files/downloads/1/Catalogo_Geral_0.pdf', 'Larguras úteis, inclinações, recobrimentos e complementos por modelo.'),
  impermeabilizante: fonte('Viapol — Viaplus 1000', 'https://www.viapol.com.br/produtos/viaplus-1000/', 'Consumo do sistema conforme aplicação; demãos até atingir o consumo especificado.'),
  manta: fonte('Viapol — Premium Alumínio Poliéster', 'https://www.viapol.com.br/produtos/premium-aluminio-poliester/', 'Consumo que considera sobreposições e recortes; aplicação específica do produto.'),
  pintura: fonte('Suvinil — Demãos e pintura acabada', 'https://www.suvinil.com.br/blog/saiba-a-quantidade-de-demaos-necessarias', 'Rendimento acabado contempla as demãos previstas pelo fabricante.'),
  contrapiso: fonte('Quartzolit — Boletim técnico do contrapiso pronto', 'https://www.quartzolit.weber/files/br/2024-07/BT_Contrapiso_pronto_Quartzolit_REV120124.pdf', 'Dados técnicos: consumo por área e espessura e condições de aplicação.'),
  pavimentacao: fonte('ABCP — Manual de pavimento intertravado', 'https://abcp.org.br/wp-content/uploads/2016/01/Manual_Pavimento_Intertravado-1.pdf', 'Camadas, confinamento, drenagem e sequência de execução.'),
  formas: fonte('CAIXA — SINAPI: fôrmas para pilares circulares', 'https://www.caixa.gov.br/Downloads/sinapi-cadernos-tecnicos/SINAPI-CT-FORMAS-PARA-PILARES-CIRCULARES.pdf', 'Exemplo de composição que distingue fabricação, montagem e número de utilizações.'),
  drywall: fonte('Knauf — Manual de instalação de sistemas drywall', 'https://knauf.com/api/download-center/v1/assets/3384a2d3-b2b2-48ab-96f6-9be7e6c9b0a2?country=br&download=true', 'Páginas impressas 46 a 54: consumos por sistema, perdas e itens por perímetro.'),
  pecas: fonte('Cebrace — Ferramentas para construção civil', 'https://www.cebrace.com.br/ferramentas-de-suporte/ferramentas-para-construcao-civil/', 'Espessura e aplicação dos vidros exigem especificação própria.'),
  paisagismo: fonte('Embrapa — Cartilha: espaçamento e densidade de plantio', 'https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1061001/1/Cartilha1.pdf', 'Página 23: relação entre espaçamento e plantas por área; cultura específica, sem prescrição para jardins.'),
  sinapi: fonte('CAIXA — SINAPI: metodologias e conceitos', 'https://www.caixa.gov.br/Downloads/sinapi-metodologia/Livro_SINAPI_Metodologias_Conceitos.pdf', 'Seções sobre RUP, consumo unitário e perdas; usar a composição aplicável.'),
  residuos: fonte('SEMAD-MG — Resíduos da construção civil', 'https://meioambiente.mg.gov.br/w/residuos-da-construcao-civil-rcc', 'Segregação, gestão municipal e destinação dos resíduos.'),
  dados: fonte('Furukawa — Guia rápido de instalação', 'https://www.furukawalatam.com/sfc/servlet.shepherd/version/download/0686100000299HvAAI?asPdf=false&operationContext=CHATER', 'Acomodação e identificação dos cabos; consultar a revisão disponível do guia.')
};

const catalogo = [];
function adicionar(id, objetivo, dados, formula, cuidados, dependencias, referencias) {
  catalogo.push({id, objetivo, dados, formula, cuidados, dependencias, fontes: referencias.map(chave => fontes[chave])});
}

adicionar('alvenaria', 'Estimar blocos pela área da parede e pelo módulo da peça com junta.',
  ['Largura e altura da parede, portas e janelas com quantidades.', 'Comprimento, altura e espessura do bloco; junta e embalagem do produto escolhido.'],
  ['Área líquida = largura × altura − soma dos vãos, em m².', 'Módulo = (comprimento + junta) × (altura + junta), na mesma unidade; peças = área líquida ÷ área do módulo, arredondadas para cima.'],
  ['O cálculo por área não identifica meios-blocos, canaletas e peças de amarração.', 'Conferir paginação e recortes; contar argamassa pelo consumo específico, sem deduzi-lo dos furos do bloco.'],
  ['Projeto de alvenaria define família de blocos, modulação, vergas, contravergas e eventuais armaduras.'], ['alvenaria']);

adicionar('reboco', 'Separar área revestida, volume da camada e consumo do produto.',
  ['Medidas e número de faces; vãos descontados em todas as faces correspondentes.', 'Espessura prevista e consumo da argamassa com a unidade exata da ficha.'],
  ['Volume (m³) = área (m²) × espessura (cm) ÷ 100.', 'Massa (kg) = área × espessura × consumo, usando a mesma unidade de espessura do coeficiente.'],
  ['Medir irregularidades: a espessura real pode variar pela superfície.', 'Consumo para assentamento não equivale ao de revestimento; composição preparada na obra precisa de coeficientes próprios.'],
  ['Base, exposição, aderência, espessura admissível e preparo dependem do sistema especificado.'], ['reboco']);

adicionar('gesso', 'Estimar gesso de revestimento sem confundir consumo por milímetro e por centímetro.',
  ['Área das faces e tetos, vãos, espessura e massa da embalagem.', 'Produto, ambiente permitido e consumo na unidade declarada pelo fabricante.'],
  ['Massa = área (m²) × espessura × consumo por m² e por unidade de espessura.', 'Selecione kg/m²/mm ou kg/m²/cm conforme a ficha. A ferramenta converte a espessura automaticamente: 1 cm = 10 mm.'],
  ['Com a unidade da ficha selecionada, informe o coeficiente original, sem multiplicá-lo novamente por 10.', 'Gesso de revestimento e chapas de drywall têm quantitativos diferentes; a ferramenta trata o revestimento.'],
  ['Conferir indicação para a base, condições de umidade e espessura com o produto escolhido.'], ['gesso']);

adicionar('concreto', 'Somar o volume geométrico dos elementos para planejar o fornecimento.',
  ['Dimensões de cada elemento, quantidade e encontros que poderiam ser contados duas vezes.', 'Especificação de projeto e fornecimento escolhido: usinado ou composição informada.'],
  ['Volume (m³) = soma de largura (m) × comprimento (m) × espessura (cm) ÷ 100 × quantidade.', 'Na composição informada, cada insumo = volume × coeficiente correspondente por m³.'],
  ['O fck registrado não determina uma receita de cimento, areia e brita.', 'Volume geométrico não resolve logística de bombeamento, tolerâncias da execução ou pedido mínimo do fornecedor.'],
  ['Dosagem, resistência, consistência, agregados e controle tecnológico devem seguir a especificação técnica.'], ['concreto']);

adicionar('malhas', 'Estimar painéis de tela a partir da paginação e das sobreposições informadas.',
  ['Área a cobrir, dimensões comerciais do painel e número de camadas.', 'Sobreposição de projeto, designação da tela e permissão de rotação.'],
  ['Na primeira posição entra a dimensão inteira do painel; cada painel seguinte avança dimensão − sobreposição.', 'Painéis = colunas × linhas × camadas; o arranjo é verificado nas duas direções.'],
  ['Dividir apenas área total por área do painel ignora as emendas.', 'Não girar telas com direções diferentes sem autorização do projeto; recortes e reaproveitamentos exigem paginação.'],
  ['Designação, fios, espaçamentos, ancoragens, sobreposições e cobrimento são definições estruturais.'], ['telas']);

adicionar('barras', 'Planejar cortes e conferir massa de aço por especificação.',
  ['Comprimento desenvolvido e quantidade de cada peça, diâmetro e classe do aço.', 'Comprimento comercial e massa por metro na tabela do fornecedor.'],
  ['Metros = soma de comprimento da peça × quantidade, separados por especificação.', 'Massa (kg) = metros × massa linear (kg/m); quantidade de barras depende do encaixe dos cortes.'],
  ['Dividir a soma dos metros pelo tamanho da barra pode subestimar barras quando sobras não comportam as peças.', 'Confirmar comprimentos de dobras e ancoragens; o desenho esquemático não os dimensiona.'],
  ['Projeto estrutural e lista de ferros definem peças, emendas e condições de corte e dobra.'], ['barras']);

adicionar('terra', 'Distinguir terra natural, solta e compactada no balanço de volumes e no transporte.',
  ['Áreas, profundidades de corte e aterro e reuso tecnicamente adequado.', 'Relações solto/compactado e natural/compactado; densidade solta e capacidades do veículo.'],
  ['Volume compactado = área × espessura em metros.', 'Volume solto de compra = necessidade compactada × relação solto/compactado; comparar transporte por volume e por massa.'],
  ['O nome “fator de empolamento” pode representar relações inversas em referências distintas: conferir numerador e denominador.', 'Não abater todo corte como reuso automaticamente; estados, qualidade e umidade precisam ser compatíveis.'],
  ['Levantamento, ensaios e projeto de terraplenagem definem cotas, material aproveitável e fatores.'], ['terra']);

adicionar('pisos', 'Estimar revestimento e caixas com atenção ao desenho de assentamento.',
  ['Medidas do ambiente, exclusões, formato real da peça e junta especificada.', 'Cobertura e peças por caixa, referência, tonalidade e calibre.'],
  ['Área líquida = largura × comprimento − exclusões.', 'Compra por caixas = arredondar para cima a necessidade com a reserva adotada ÷ cobertura da caixa.'],
  ['A área de juntas não substitui conferência da paginação, recortes e aproveitamento.', 'A reserva varia com ambiente, formato e paginação; conferir tonalidade e calibre ao receber.'],
  ['Projeto de paginação e ficha do revestimento definem juntas; argamassa e rejunte são calculados separadamente.'], ['pisos']);

adicionar('rodape', 'Levantar metros lineares de rodapé e sua apresentação comercial.',
  ['Comprimento das paredes que recebem rodapé, vãos sem rodapé e altura.', 'Comprimento da peça pronta ou plano de corte do revestimento que produzirá as tiras.'],
  ['Metros líquidos = perímetro medido − trechos sem rodapé.', 'Área das tiras (m²) = metros líquidos × altura (cm) ÷ 100; peças prontas dependem do comprimento comercial.'],
  ['Rodapé é comprado ou executado em metros lineares; m² é uma informação complementar.', 'Cantos, acabamento de bordas e perda da serra podem impedir o aproveitamento teórico de uma placa.'],
  ['Conferir desenho dos encontros e fabricação das tiras antes de usar sobras do piso.'], ['rodape']);

adicionar('eletrica', 'Quantificar trajetos de eletrodutos e metros físicos de cada cabo especificado.',
  ['Trechos identificados, subidas, descidas, folgas e quantidade de condutores.', 'Seção, função, isolação e tipo individual ou multipolar conforme projeto.'],
  ['Condutor individual: metros do trajeto completo × quantidade de condutores.', 'Cabo multipolar: metros do cabo físico, sem multiplicar pelas veias; eletroduto compartilhado é contado uma vez por trajeto.'],
  ['Não somar rolos de seções ou funções diferentes como se fossem intercambiáveis.', 'Metragem não comprova capacidade de corrente, queda de tensão ou ocupação do eletroduto.'],
  ['Dimensionamento, proteções, aterramento e método de instalação pertencem ao projeto elétrico.'], ['eletrica']);

adicionar('hidraulica', 'Separar tubos e conexões por sistema, material e diâmetro.',
  ['Comprimentos físicos, quantidades, subidas e especificação de cada trecho.', 'Comprimento comercial, conexões, registros e demais componentes do desenho.'],
  ['Metros = soma dos comprimentos × quantidades por especificação.', 'Barras dependem do plano de corte; conexões e registros são contados por unidade.'],
  ['Comprimento equivalente de perda de carga não é metragem para compra.', 'Não misturar componentes de água fria e quente apenas porque têm o mesmo diâmetro nominal.'],
  ['Pressões, temperaturas, vazões, diâmetros e compatibilidade das juntas exigem projeto.'], ['tigre']);

adicionar('esgoto', 'Organizar tubos e conexões de esgoto, ventilação e águas pluviais.',
  ['Traçados com comprimentos e desníveis, diâmetro, material e sistema.', 'Conexões, caixas, ralos e componentes de inspeção indicados no projeto.'],
  ['Metros físicos = comprimento de cada peça × quantidade, agrupados por especificação.', 'Conexões são somadas em unidades e barras são conferidas pelo plano de corte.'],
  ['Esgoto sanitário e drenagem pluvial não são a mesma rede.', 'Não inferir diâmetro, declividade ou número de conexões pela área do imóvel.'],
  ['Traçado, ventilação, declividades, vazões e acessos de inspeção dependem do projeto hidrossanitário.'], ['tigre']);

adicionar('cobertura', 'Converter projeção horizontal em área inclinada e conferir cobertura útil.',
  ['Dimensões da projeção, beirais e inclinação em percentual.', 'Área útil por unidade do modelo escolhido, cumeeiras, rufos e demais arremates.'],
  ['Para plano com inclinação uniforme: área inclinada = área horizontal com beirais × √(1 + (inclinação ÷ 100)²).', 'Unidades = área inclinada ÷ cobertura útil por unidade, com arredondamento e reserva adotada.'],
  ['Percentual não é ângulo em graus. Telhados com várias águas exigem separar trechos e evitar dupla contagem.', 'Dimensão total da telha difere da útil; não descontar recobrimento de novo se já estiver incluído.'],
  ['Inclinação permitida, recobrimentos, apoios, fixações e estrutura seguem o modelo e o projeto.'], ['cobertura']);

adicionar('impermeabilizacao', 'Quantificar a área completa e distinguir consumo total de consumo por demão.',
  ['Piso, subidas verticais, exclusões e detalhes do sistema especificado.', 'Consumo total ou por demão; no rolo, dimensões e sobreposição prevista.'],
  ['Área = piso + perímetro com subida × altura da subida − exclusões.', 'Consumo total: massa = área × kg/m² do sistema. Por demão: multiplicar também pelo número de demãos.'],
  ['Não multiplicar novamente pelas demãos um consumo que já representa o sistema completo.', 'Manta por área útil é aproximação: ralos, cantos, recortes e emendas precisam de paginação; não duplicar perda já embutida.'],
  ['Projeto define sistema, preparação, subidas, reforços, proteção e ensaios de estanqueidade.'], ['impermeabilizante', 'manta']);

adicionar('pintura', 'Estimar tinta sem contar duas vezes as demãos da pintura acabada.',
  ['Área efetivamente pintada e produto, cor, base e acabamento.', 'Rendimento e unidade da embalagem; identificar “por demão” ou “acabado”.'],
  ['Rendimento por demão: litros = área × demãos ÷ rendimento em m²/L.', 'Rendimento acabado: litros = área ÷ rendimento em m²/L. Se a ficha informa m² por lata, dividir essa área pelos litros da lata.'],
  ['Rendimento acabado já considera as demãos previstas; multiplicar novamente superestima o material.', 'Preparo, absorção e mudança de cor afetam consumo; selador e fundo têm quantitativos próprios.'],
  ['Ficha técnica define indicação, preparo, diluição, demãos e intervalos para o produto.'], ['pintura']);

adicionar('contrapiso', 'Medir o volume de cada camada e separar volume de massa comprada.',
  ['Área e espessura de cada camada; considerar variações de nível e caimentos.', 'Material de cada camada e, para produto ensacado, consumo específico da ficha.'],
  ['Volume da camada (m³) = largura × comprimento × espessura (cm) ÷ 100.', 'Para converter em massa, usar área × espessura × consumo do produto com unidades compatíveis.'],
  ['A ferramenta de camadas informa volume; esse número não é quantidade de sacos.', 'Não tratar a soma de cimento e areia soltos como volume final da argamassa.'],
  ['Espessuras, aderência, caimentos, juntas e sequência de camadas dependem do projeto e do produto.'], ['contrapiso']);

adicionar('pavimentacao', 'Organizar volumes por camada de pavimentação e a condição de medição.',
  ['Área e espessura de cada camada, material e estado: solto ou compactado.', 'Confinamentos, drenagem e revestimento definidos no projeto.'],
  ['Volume geométrico de cada camada (m³) = área × espessura em metros.', 'Material solto para entrega exige a relação de conversão correspondente à camada, informada separadamente.'],
  ['Não somar volumes de camadas diferentes como se fossem um único material.', 'A espessura compactada não equivale à espessura solta de lançamento.'],
  ['Suporte do solo, tráfego, drenagem e sistema de pavimento definem materiais e espessuras.'], ['pavimentacao']);

adicionar('formas', 'Estimar chapas considerando frentes de trabalho e reutilização planejada.',
  ['Área de contato com o concreto, etapas, ciclos e estoque realmente aproveitável.', 'Área da chapa, recortes e peças que não poderão migrar entre etapas.'],
  ['Na hipótese simplificada de etapas iguais e sequenciais: área por ciclo = área total ÷ ciclos.', 'Compra adicional parte da área por ciclo menos estoque compatível, arredondada em chapas.'],
  ['A média por ciclo pode ficar abaixo da maior frente simultânea; conferir o pico de uso no cronograma.', 'Número de utilizações de uma composição de custo não garante a mesma reutilização física na obra.'],
  ['Projeto de fôrmas e escoramento, prazo de desforma, conservação e plano de corte precisam ser conferidos.'], ['formas']);

adicionar('drywall', 'Quantificar os componentes do sistema completo com a base correta de área.',
  ['Tipo de sistema e área de referência da composição: parede, face ou forro.', 'Camadas de chapa, perfis, acessórios, consumos e embalagens de cada item.'],
  ['Quantidade do componente = área de referência × coeficiente do sistema.', 'Itens definidos por perímetro ou por unidade devem ser levantados nessa base, fora de um coeficiente genérico por m².'],
  ['Tabelas Knauf consultadas já incluem perdas: conferir a nota antes de acrescentar reserva.', 'Não multiplicar faces de novo quando a composição de parede já as contempla; portas e reforços exigem levantamento específico.'],
  ['Altura, modulação, umidade, cargas, acústica e fogo determinam o sistema e seus componentes.'], ['drywall']);

adicionar('pecas', 'Organizar áreas e unidades de peças sob medida para cotação.',
  ['Lista de peças com nome, largura, altura ou profundidade e quantidade.', 'Desenho aprovado com material, espessura, recortes, bordas e ferragens.'],
  ['Área da peça (m²) = largura (m) × altura ou profundidade (m) × quantidade.', 'Manter também a contagem de unidades: a soma em m² não define a fabricação.'],
  ['Área não calcula espessura, capacidade de carga ou tipo seguro de vidro.', 'Bancadas, vidros e esquadrias podem ter regras comerciais próprias; confirmar medição final e plano de fabricação.'],
  ['Especificação e detalhamento do fabricante/projetista definem tolerâncias, apoios, ferragens e instalação.'], ['pecas']);

adicionar('paisagismo', 'Estimar área de gramado e contagem preliminar em malha retangular.',
  ['Dimensões reais da área e exclusões de caminhos e canteiros.', 'Cobertura por placa de grama e espaçamento escolhido para plantas e linhas.'],
  ['Grama em m² = largura × comprimento; placas dependem da cobertura comercial.', 'A malha da ferramenta usa células: arredonda para cima largura ÷ espaçamento X e comprimento ÷ espaçamento Y, depois multiplica.'],
  ['A malha não resolve bordas, recuos e canteiros irregulares; conferir a posição das mudas.', 'A relação entre espaçamento e densidade é geométrica; não importar espaçamento de outra espécie ou cultura.'],
  ['Espécie, insolação, solo, porte adulto e irrigação orientam o projeto paisagístico.'], ['paisagismo']);

adicionar('produtividade', 'Transformar quantidade de serviço e RUP informada em esforço e prazo teórico.',
  ['Quantidade na unidade do serviço e RUP em horas de trabalho por unidade.', 'Equipe considerada na RUP e horas disponíveis por pessoa por dia.'],
  ['Horas de trabalho = quantidade × RUP.', 'Dias teóricos = horas de trabalho ÷ pessoas ÷ horas disponíveis por pessoa por dia.'],
  ['RUP maior significa mais horas por unidade; não confundir com produção por hora.', 'Misturar RUP de um profissional com equipe total distorce o prazo; aumentar equipe não garante ganho proporcional.'],
  ['Cronograma precisa considerar sequência, frentes disponíveis, cura, suprimentos e interrupções.'], ['sinapi']);

adicionar('residuos', 'Estimar viagens a partir do volume solto e do limite que restringe a carga.',
  ['Volume solto dos resíduos separados por tipo e densidade representativa quando usada.', 'Volume útil e carga útil real do equipamento contratado.'],
  ['Massa (t) = volume solto (m³) × densidade (t/m³).', 'Capacidade equivalente (m³) = menor entre volume útil e carga útil ÷ densidade; viagens = volume ÷ capacidade, arredondado para cima.'],
  ['Volume demolido em posição original não equivale automaticamente a volume solto.', 'A densidade depende da mistura; separar resíduos evita tratar todo entulho como material homogêneo.'],
  ['Conferir transportador, destinação e regras municipais; o cálculo não define a classificação do resíduo.'], ['residuos', 'terra']);

adicionar('dados', 'Somar metros físicos de cabos por trajeto e especificação.',
  ['Percurso completo de cada ponto, subidas, descidas e folga prevista.', 'Tipo de cabo, categoria ou fibra, aplicação e conteúdo da bobina.'],
  ['Metros do trajeto = comprimento + desníveis + folga informada.', 'Somar por especificação e conferir bobinas; um cabo de vários pares continua sendo um único comprimento físico.'],
  ['Não multiplicar a metragem pelo número de pares internos.', 'Metros totais não validam comprimento máximo de enlace, alimentação PoE ou desempenho de CFTV.'],
  ['Projeto e fabricante definem topologia, separação, curvaturas, conectores, limites e testes do enlace.'], ['dados']);

adicionar('consumo', 'Aplicar um coeficiente rastreável à quantidade do serviço.',
  ['Quantidade e unidade do serviço, produto e coeficiente com sua fonte.', 'Unidade de saída, embalagem e informação sobre perda já incluída no coeficiente.'],
  ['Necessidade = quantidade do serviço × coeficiente na unidade correspondente.', 'Embalagens = necessidade com a reserva aplicável ÷ conteúdo da embalagem, arredondadas para cima.'],
  ['Coeficiente em kg/m² não pode ser aplicado diretamente a um volume em m³.', 'Verificar se consumo real, composição ou ficha já inclui perdas antes de acrescentar outra margem.'],
  ['Usar a ficha do produto ou a composição compatível com o serviço, método e condições de execução.'], ['sinapi']);

function congelar(valor) {
  if (valor && typeof valor === 'object' && !Object.isFrozen(valor)) {
    Object.values(valor).forEach(congelar);
    Object.freeze(valor);
  }
  return valor;
}
congelar(catalogo);
const indice = new Map(catalogo.map(item => [item.id, item]));
g.FortemaisConhecimento = Object.freeze({
  VERSION, consultadoEm, catalogo,
  porFerramenta(id) { return typeof id === 'string' ? indice.get(id) || null : null; }
});
})(globalThis);
