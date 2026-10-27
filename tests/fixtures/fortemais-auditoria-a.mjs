// Somente dados sintéticos. Resultados esperados calculados à mão, não pelo motor.
// Ordem de cada tupla: líquido, com reserva, pacotes, compra e sobra após reserva.
export const cenariosA = [
  {
    nome:'alvenaria — parede com porta, pacotes e argamassa', id:'alvenaria',
    inputs:{largura:4,altura:3,temAberturas:'sim',aberturas:[{tipo:'porta',largura:1,altura:2,quantidade:1}],produto:'Bloco sintético A',blocoEspessura:14,blocoComprimento:39,blocoAltura:19,juntaCm:1,milheiro:50,argamassa:5,perdaPct:10},
    // 12−2=10 m²; módulo .40×.20=.08 m²; 125 blocos →137.5→3 pacotes.
    materiais:[[125,137.5,3,150,12.5],[50,55,null,55,0]], metricas:{'Área líquida':10},
    alterar:{largura:6}, compraNova:[250,88]
  },
  {
    nome:'alvenaria — janela com peitoril e zero reserva', id:'alvenaria',
    inputs:{largura:3,altura:3,temAberturas:'sim',aberturas:[{tipo:'janela',largura:1,altura:1,peitoril:1,quantidade:1}],produto:'Bloco sintético B',blocoComprimento:39,blocoAltura:19,juntaCm:1,milheiro:1,perdaPct:0},
    materiais:[[100,100,100,100,0]],metricas:{'Área líquida':8},alterar:{largura:4},compraNova:[138]
  },
  {
    nome:'reboco — múltiplas superfícies, faces e vãos',id:'reboco',
    inputs:{produto:'Argamassa sintética R',areas:[{largura:4,altura:3,faces:2},{largura:2,altura:3,faces:1}],aberturas:2,espessuraCm:2,modo:'industrial',unidadeConsumo:'cm',consumo:1.5,embalagem:20,perdaPct:10},
    // (4×3×2+2×3−2)×2×1.5=84kg; 92.4kg com reserva; 5 sacos.
    materiais:[[84,92.4,5,100,7.6]],metricas:{'Área líquida':28,'Volume geométrico':.56},alterar:{espessuraCm:3},compraNova:[140]
  },
  {
    nome:'reboco — consumo equivalente em milímetros',id:'reboco',
    inputs:{produto:'Argamassa sintética R',areas:[{largura:4,altura:3,faces:2},{largura:2,altura:3,faces:1}],aberturas:2,espessuraCm:2,modo:'industrial',unidadeConsumo:'mm',consumo:.15,embalagem:20,perdaPct:10},
    materiais:[[84,92.4,5,100,7.6]],metricas:{'Área líquida':28,'Volume geométrico':.56},alterar:{espessuraCm:3},compraNova:[140]
  },
  {
    nome:'reboco — composição informada e saco de cimento de 25kg',id:'reboco',
    inputs:{produto:'Composição sintética R2',areas:[{largura:10,altura:5,faces:1}],aberturas:0,espessuraCm:2,modo:'composicao',cimento:200,embalagemCimentoKg:25,areia:1.2,cal:100,perdaPct:10},
    materiais:[[200,220,9,225,5],[100,110,null,110,0],[1.2,1.32,null,1.32,0]],metricas:{'Volume geométrico':1},alterar:{espessuraCm:3},compraNova:[350,165,1.98]
  },
  {
    nome:'gesso — coeficiente por milímetro e valores decimais',id:'gesso',
    inputs:{produto:'Gesso sintético G',areas:[{largura:4,altura:3,faces:1}],aberturas:2,espessuraCm:.5,modo:'industrial',unidadeConsumo:'mm',consumo:.8,embalagem:15,perdaPct:5},
    materiais:[[40,42,3,45,3]],metricas:{'Área líquida':10,'Volume geométrico':.05},alterar:{espessuraCm:1},compraNova:[90]
  },
  {
    nome:'concreto — usinado por dois tipos de elemento',id:'concreto',
    inputs:{produto:'Concreto sintético C25',modo:'usinado',fck:25,elementos:[{largura:4,comprimento:5,espessuraCm:10,quantidade:1},{largura:.2,comprimento:.3,espessuraCm:300,quantidade:4}],perdaPct:5},
    // Laje 2m³ + 4 pilares de .18m³ =2.72m³; reserva5%=2.856m³.
    materiais:[[2.72,2.856,null,2.856,0]],metricas:{'Volume geométrico':2.72},alterar:{perdaPct:10},compraNova:[2.992]
  },
  {
    nome:'concreto — composição sem duplicar usinado',id:'concreto',
    inputs:{produto:'Composição sintética C',modo:'composicao',fck:25,elementos:[{largura:4,comprimento:5,espessuraCm:10,quantidade:1}],cimento:300,areia:.5,brita:.8,embalagemCimentoKg:50,perdaPct:10},
    materiais:[[600,660,14,700,40],[1,1.1,null,1.1,0],[1.6,1.76,null,1.76,0]],metricas:{'Volume geométrico':2},alterar:{perdaPct:0},compraNova:[600,1,1.6]
  },
  {
    nome:'malhas — sobreposição, duas camadas e reserva',id:'malhas',
    inputs:{produto:'Tela sintética M',largura:3.8,comprimento:5.8,painelLargura:2,painelComprimento:3,sobreposicao:.2,camadas:2,rotacao:'nao',espacamento:150,diametro:4.2,perdaPct:10},
    // Duas colunas cobrem3.8; duas linhas cobrem5.8; 2×2×2=8, compra9.
    materiais:[[8,8.8,9,9,.2]],metricas:{'Área do elemento':22.04},alterar:{camadas:1},compraNova:[5]
  },
  {
    nome:'malhas — rotação economiza um painel',id:'malhas',
    inputs:{produto:'Tela sintética M',largura:3,comprimento:2,painelLargura:2,painelComprimento:3,sobreposicao:0,camadas:1,rotacao:'sim',espacamento:150,diametro:4.2,perdaPct:0},
    materiais:[[1,1,1,1,0]],metricas:{'Área do elemento':6},alterar:{rotacao:'nao'},compraNova:[2]
  },
  {
    nome:'barras — cortes físicos e reserva em barra inteira',id:'barras',
    inputs:{pecas:[{comprimento:7,quantidade:3,diametro:10,material:'CA sintético A',kgMetro:.6}],barra:12,perdaPct:10},
    // Três peças7m não cabem em duas barras12m; três barras+uma reserva=48m.
    materiais:[[21,21,4,48,27]],metricas:{'Barras cortadas 10 mm':3,'Barras extras de reserva 10 mm':1,'Massa de compra 10 mm':28.8},alterar:{perdaPct:0},compraNova:[36]
  },
  {
    nome:'barras — referências distintas nunca misturam cortes',id:'barras',
    inputs:{pecas:[{comprimento:4,quantidade:3,diametro:10,material:'A',kgMetro:.6},{comprimento:4,quantidade:3,diametro:10,material:'B',kgMetro:.6}],barra:12,perdaPct:0},
    materiais:[[12,12,1,12,0],[12,12,1,12,0]],metricas:{},alterar:{barra:6},compraNova:[18,18]
  },
  {
    nome:'terra — reuso, corte, descarte e limite de carga',id:'terra',
    inputs:{produto:'Terra sintética T',setores:[{area:100,profundidadeCm:20,corteCm:30}],reuso:10,fatorSolto:1.25,fatorNatural:1.1,caminhao:10,carga:8,densidade:2},
    //20m³ compactados−10 reuso=10; compra12.5soltos; carga limita4m³/viagem.
    materiais:[[12.5,12.5,null,12.5,0]],metricas:{'Demanda compactada':20,'Compra compactada':10,'Escavado natural':30,'Descarte solto':21.59090909090909,'Viagens de compra':4,'Viagens de descarte':6},alterar:{reuso:0},compraNova:[25]
  },
  {
    nome:'pisos — exclusão, caixa em metros quadrados e reserva',id:'pisos',
    inputs:{produto:'Piso sintético P',largura:4,comprimento:5,vaoArea:2,pecaLargura:60,pecaComprimento:60,juntaMm:2,caixaArea:2.16,perdaPct:10},
    materiais:[[18,19.8,10,21.6,1.8]],metricas:{'Área líquida':18,'Peças na paginação retangular bruta':63},alterar:{vaoArea:0},compraNova:[23.76]
  },
  {
    nome:'pisos — caixa definida por quantidade de peças',id:'pisos',
    inputs:{produto:'Piso sintético P2',largura:3,comprimento:2,pecaLargura:50,pecaComprimento:50,juntaMm:0,pecasCaixa:4,perdaPct:0},
    materiais:[[6,6,6,6,0]],metricas:{'Área líquida':6,'Peças na paginação retangular bruta':24},alterar:{perdaPct:10},compraNova:[7]
  },
  {
    nome:'rodape — desconta vãos e compra peças inteiras',id:'rodape',
    inputs:{produto:'Rodapé sintético R',perimetro:18,vaos:2,alturaCm:10,peca:2.4,perdaPct:10},
    materiais:[[16,17.6,8,19.2,1.6]],metricas:{'Área de rodapé':1.6},alterar:{vaos:0},compraNova:[21.6]
  },
  {
    nome:'rodape — fornecimento contínuo',id:'rodape',
    inputs:{produto:'Rodapé sintético contínuo',perimetro:18,vaos:2,alturaCm:10,perdaPct:0},
    materiais:[[16,16,null,16,0]],metricas:{'Área de rodapé':1.6},alterar:{perdaPct:10},compraNova:[17.6]
  }
];
