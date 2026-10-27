// Cenários exclusivamente sintéticos. Os coeficientes abaixo são dados do teste,
// e não recomendações de projeto, execução ou composição de materiais.
export const scenarios = [
  {
    id:'contrapiso',
    inputs:{largura:4,comprimento:5,perdaPct:10,camadas:[
      {nome:'Base sintética A',espessuraCm:5},
      {nome:'Acabamento sintético B',espessuraCm:2}
    ]},
    materials:[{unit:'m³',liquido:1,comPerda:1.1,compra:1.1,embalagens:null,sobra:0},{unit:'m³',liquido:.4,comPerda:.44,compra:.44,embalagens:null,sobra:0}],
    metrics:{'Área':20}
  },
  {
    id:'pavimentacao',
    inputs:{largura:2.5,comprimento:8,perdaPct:5,camadas:[
      {nome:'Base sintética A',espessuraCm:12},
      {nome:'Acabamento sintético B',espessuraCm:4}
    ]},
    materials:[{unit:'m³',liquido:2.4,comPerda:2.52,compra:2.52,embalagens:null,sobra:0},{unit:'m³',liquido:.8,comPerda:.84,compra:.84,embalagens:null,sobra:0}],
    metrics:{'Área':20}
  },
  {
    id:'formas',
    inputs:{produto:'Chapa sintética 18 mm',area:80,ciclos:4,estoque:5,painelArea:2.2,perdaPct:10},
    materials:[{unit:'m²',liquido:15,comPerda:16.5,compra:17.6,embalagens:8,sobra:1.1}],
    metrics:{'Área de contato':80,'Estoque necessário por ciclo uniforme':20}
  },
  {
    id:'drywall',
    inputs:{area:12.5,perdaPct:8,consumos:[
      {nome:'Placa sintética 12,5 mm',unidade:'m²',consumo:2,embalagem:2.88},
      {nome:'Perfil sintético 48 mm',unidade:'m',consumo:3,embalagem:3},
      {nome:'Massa sintética',unidade:'kg',consumo:.4,embalagem:''}
    ]},
    materials:[{unit:'m²',liquido:25,comPerda:27,compra:28.8,embalagens:10,sobra:1.8},{unit:'m',liquido:37.5,comPerda:40.5,compra:42,embalagens:14,sobra:1.5},{unit:'kg',liquido:5,comPerda:5.4,compra:5.4,embalagens:null,sobra:0}],
    metrics:{}
  },
  {
    id:'pecas',
    inputs:{pecas:[{nome:'Vidro sintético',material:'Vidro sintético 8 mm',largura:1.2,altura:.8,quantidade:3},{nome:'Bancada sintética',material:'Pedra sintética 20 mm',largura:2,altura:.6,quantidade:2}],perdaPct:0},
    materials:[{unit:'m²',liquido:2.88,comPerda:2.88,compra:2.88,embalagens:null,sobra:0},{unit:'m²',liquido:2.4,comPerda:2.4,compra:2.4,embalagens:null,sobra:0}],
    metrics:{'Quantidade 1':3,'Quantidade 2':2}
  },
  {
    id:'paisagismo',
    inputs:{produtoGrama:'Grama sintética A',produtoMudas:'Muda sintética B',largura:2.5,comprimento:3.2,espacamentoX:1,espacamentoY:.8,embalagem:.5,perdaPct:10},
    materials:[{unit:'m²',liquido:8,comPerda:8.8,compra:9,embalagens:18,sobra:.2},{unit:'un',liquido:12,comPerda:13.2,compra:14,embalagens:14,sobra:.8}],
    metrics:{}
  },
  {
    id:'produtividade',
    inputs:{quantidade:125,rup:.4,equipe:2,horasDia:8},
    materials:[],
    metrics:{'Horas de trabalho':50,'Dias de equipe':3.125}
  },
  {
    id:'consumo',
    inputs:{quantidade:12.5,consumo:1.2,produto:'Produto sintético',unidade:'kg',embalagem:4,perdaPct:10},
    materials:[{unit:'kg',liquido:15,comPerda:16.5,compra:20,embalagens:5,sobra:3.5}],
    metrics:{}
  }
];
