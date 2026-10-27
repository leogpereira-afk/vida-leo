// Somente cenários sintéticos. Expectativas calculadas a partir das medidas, não do motor.
const cable = (id, comprimento, extra = {}) => ({id, comprimento, subida:0, extra:0, condutores:1, secao:2.5, papel:'Cobre 750 V', modo:'individual', ...extra});
const tube = (comprimento, quantidade, extra = {}) => ({comprimento, quantidade, diametro:25, material:'PVC fictício', sistema:'fria', ...extra});
export const auditCasesB = [
  {id:'eletrica-individual',tool:'eletrica',inputs:{produto:'Eletroduto fictício 25 mm',trechos:[cable('A',10,{subida:2,extra:1,condutores:3})],embalagem:25,perdaPct:10}, materials:[[13,14.3,14.3,null],[39,42.9,50,2]]},
  {id:'eletrica-multipolar',tool:'eletrica',inputs:{produto:'Eletroduto fictício 25 mm',trechos:[cable('A',10,{subida:2,condutores:5,modo:'multipolar'})],embalagem:10,perdaPct:10}, materials:[[12,13.2,13.2,null],[12,13.2,20,2]]},
  {id:'eletrica-trajeto-compartilhado',tool:'eletrica',inputs:{produto:'Eletroduto fictício 25 mm',trechos:[cable('A',12,{condutores:2,papel:'Fase cobre 750 V'}),cable('A',12,{papel:'Neutro cobre 750 V'})],embalagem:10,perdaPct:0}, materials:[[12,12,12,null],[24,24,30,3],[12,12,20,2]]},
  {id:'eletrica-secoes-separadas',tool:'eletrica',inputs:{produto:'Eletroduto fictício 25 mm',trechos:[cable('A',5),cable('B',7,{secao:4})],embalagem:10,perdaPct:0}, materials:[[12,12,12,null],[5,5,10,1],[7,7,10,1]]},
  {id:'dados-mesmo-produto',tool:'dados',inputs:{trechos:[cable('A',10,{subida:1,extra:1,papel:'CAT6 fictício'}),cable('B',20,{subida:2,papel:'CAT6 fictício'})],embalagem:25,perdaPct:20},materials:[[34,40.8,50,2]]},
  {id:'dados-produtos-distintos',tool:'dados',inputs:{trechos:[cable('A',12,{papel:'CAT6 fictício'}),cable('B',22,{papel:'Coaxial fictício'})],embalagem:25,perdaPct:0},materials:[[12,12,25,1],[22,22,25,1]]},
  {id:'dados-compra-fracionada',tool:'dados',inputs:{trechos:[cable('A','2,5',{subida:'0,5',extra:'0,2',papel:'CAT6 fictício'})],embalagem:'',perdaPct:25},materials:[[3.2,4,4,null]]},
  {id:'hidraulica-cortes-complementares',tool:'hidraulica',inputs:{trechos:[tube(4,2),tube(2,2)],conexoes:[{nome:'Joelho fictício 25 mm',quantidade:3}],barra:6,perdaPct:0},materials:[[12,12,12,2],[3,3,3,3]]},
  {id:'hidraulica-reserva-em-barras',tool:'hidraulica',inputs:{trechos:[tube(4,2),tube(2,2)],conexoes:[],barra:6,perdaPct:5},materials:[[12,12.6,18,3]]},
  {id:'hidraulica-recortes-sem-reuso',tool:'hidraulica',inputs:{trechos:[tube(3.5,3)],conexoes:[],barra:6,perdaPct:10},materials:[[10.5,11.55,24,4]]},
  {id:'hidraulica-diametros-distintos',tool:'hidraulica',inputs:{trechos:[tube(4,2),tube(4,2,{diametro:32})],conexoes:[],barra:6,perdaPct:0},materials:[[8,8,12,2],[8,8,12,2]]},
  {id:'esgoto-pvc-pluvial',tool:'esgoto',inputs:{trechos:[tube(2,5,{diametro:100,sistema:'pluvial'})],conexoes:[{nome:'Joelho fictício 100 mm',quantidade:2}],barra:6,perdaPct:0},materials:[[10,10,12,2],[2,2,2,2]]},
  {id:'esgoto-sistemas-separados',tool:'esgoto',inputs:{trechos:[tube(3,1,{diametro:100,sistema:'esgoto'}),tube(3,1,{diametro:100,sistema:'pluvial'})],barra:6,perdaPct:0},materials:[[3,3,6,1],[3,3,6,1]]},
  {id:'cobertura-inclinacao-75',tool:'cobertura',inputs:{produto:'Telha fictícia',largura:3,comprimento:4,inclinacao:75,beiral:0,cobertura:2,perdaPct:20},materials:[[15,18,18,9]],metrics:{'Área inclinada':15}},
  {id:'cobertura-beiral-acessorios',tool:'cobertura',inputs:{produto:'Telha fictícia',largura:3,comprimento:4,inclinacao:75,beiral:.5,cobertura:2,cumeeira:6,rufo:7,perdaPct:10},materials:[[25,27.5,28,14],[6,6.6,6.6,null],[7,7.7,7.7,null]],metrics:{'Área inclinada':25}},
  {id:'cobertura-horizontal',tool:'cobertura',inputs:{produto:'Telha fictícia',largura:3,comprimento:4,inclinacao:0,cobertura:2,perdaPct:0},materials:[[12,12,12,6]],metrics:{'Área inclinada':12}},
  {id:'impermeabilizacao-total',tool:'impermeabilizacao',inputs:{produto:'Produto fictício',area:20,perimetro:10,altura:.3,aberturas:3,modo:'total',consumo:3,demao:9,embalagem:20,perdaPct:10},materials:[[60,66,80,4]],metrics:{'Área do sistema':20}},
  {id:'impermeabilizacao-por-demao',tool:'impermeabilizacao',inputs:{produto:'Produto fictício',area:20,perimetro:10,altura:.3,aberturas:3,modo:'liquido',consumo:1.2,demao:3,embalagem:18,perdaPct:10},materials:[[72,79.2,90,5]],metrics:{'Área do sistema':20}},
  {id:'impermeabilizacao-manta',tool:'impermeabilizacao',inputs:{produto:'Manta fictícia',area:13.5,perimetro:0,altura:0,aberturas:0,modo:'rolo',roloLargura:2,roloComprimento:5,sobreposicao:.5,perdaPct:10},materials:[[13.5,14.85,20.25,3]],metrics:{'Área do sistema':13.5}},
  {id:'impermeabilizacao-area-zero',tool:'impermeabilizacao',inputs:{produto:'Produto fictício',area:10,perimetro:0,altura:0,aberturas:10,modo:'total',consumo:3,embalagem:20,perdaPct:10},materials:[[0,0,0,0]],metrics:{'Área do sistema':0}},
  {id:'pintura-por-demao-selador',tool:'pintura',inputs:{produto:'Tinta fictícia branca',seladorProduto:'Selador fictício',area:120,rendimento:10,demao:3,modo:'demao',selador:.2,embalagem:18,perdaPct:10},materials:[[36,39.6,54,3],[24,26.4,26.4,null]]},
  {id:'pintura-area-acabada',tool:'pintura',inputs:{produto:'Tinta fictícia branca',area:120,rendimento:10,demao:3,modo:'acabado',embalagem:18,perdaPct:10},materials:[[12,13.2,18,1]]},
  {id:'residuos-limite-volume',tool:'residuos',inputs:{volume:12,caminhao:5},materials:[],metrics:{'Viagens / caçambas':3,'Volume solto':12}},
  {id:'residuos-limite-carga',tool:'residuos',inputs:{volume:12,caminhao:5,densidade:2,carga:6},materials:[],metrics:{'Viagens / caçambas':4,'Volume solto':12,'Massa estimada':24}},
  {id:'residuos-minimo-positivo',tool:'residuos',inputs:{volume:1e-12,caminhao:5},materials:[],metrics:{'Viagens / caçambas':1,'Volume solto':1e-12}}
];

export {cable, tube};
