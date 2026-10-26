# Fortemais: referências das 25 ferramentas de obra

Pesquisa em 26/10/2026. A base editorial está em `publico/fortemais-ferramentas-conhecimento.js` e pode ser consultada por `FortemaisConhecimento.porFerramenta(id)`.

## Escopo e uso

Os guias ajudam a levantar dados, conferir unidades e planejar a compra. O texto é uma síntese própria, com links para fontes primárias de fabricantes e instituições. Não há tabela de consumos universais, recomendação automática de espessura, diâmetro, resistência ou percentual de reserva.

As fórmulas são explicações dimensionais do cálculo implementado no modelo Fortemais: áreas, volumes, comprimentos, conversões e arredondamento comercial. As referências fundamentam as unidades, as condições de aplicação e os cuidados de cada serviço; a inclusão de um link não significa que a instituição validou o algoritmo ou a ferramenta. Paginação retangular, encaixe de cortes e simplificação de ciclos de fôrmas são hipóteses do aplicativo, identificadas como tal.

`porFerramenta(id)` devolve um objeto imutável com `id`, `objetivo`, listas de texto `dados`, `formula`, `cuidados`, `dependencias` e `fontes`. Cada fonte contém `titulo`, `url`, `trecho` e `consultadoEm`. Id desconhecido retorna `null`. O módulo não depende de DOM, não acessa rede e não altera o motor, seus padrões, entradas ou resultados.

Na interface, o conteúdo deve acompanhar a ferramenta em detalhes recolhidos, com as entradas “Como calcular” e “Conferir antes de comprar”. Links abrem a referência correspondente. A lista abaixo registra a finalidade editorial, sem reproduzir fichas técnicas.

## Cobertura

| Ferramenta | Referência primária | Aplicação no guia |
| --- | --- | --- |
| `alvenaria` | [ABCP — Metodologia de execução](https://abcp.org.br/wp-content/uploads/2016/01/AE_metodo_executivo.pdf) | Modulação e peças complementares exigem projeto de produção; a estimativa por área é limitada. |
| `reboco` | [Quartzolit — Reboco pronto](https://www.quartzolit.weber/argamassas-e-rejuntes-quartzolit/argamassas-e-revestimentos-decorativos/reboco-pronto-quartzolit) | Identificar consumo por espessura e aplicação específica. |
| `gesso` | [Placo — Reboco Fácil](https://www.placo.com.br/produtos/reboco-facil) | A ficha expressa o consumo por milímetro; conversão precisa respeitar a unidade do campo. |
| `concreto` | [ABCP — Perguntas frequentes](https://abcp.org.br/perguntas-frequentes/) | A dosagem depende de materiais e estudos; fck não é receita. |
| `malhas` | [Gerdau — Simulador e tabela de telas](https://voce.mais.gerdau.com.br/simulador-de-telas) | Conferir designação, direções e dimensões do painel. |
| `barras` | [Gerdau — Catálogo de construção civil](https://www2.gerdau.com.br/wp-content/uploads/2022/07/Catalogo-Construcao-Civil-Gerdau_0-1.pdf) | Massa nominal e apresentação comercial por especificação. |
| `terra` | [DNIT — Manual de implantação básica, p. 242](https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/ipr/coletanea-de-manuais/vigentes/742_manual_de_implantacao_basica.pdf) | Distinguir estados e a direção da relação de volumes. |
| `pisos` | [Portobello — Manual do cliente, p. 8](https://www.portobello.com.br/produtos/abrir/6165/Manualdocliente_AGO22.pdf) | Reserva conforme paginação; conferência de tonalidade e calibre. |
| `rodape` | [Portobello — Rodapés](https://www.portobello.com.br/complementos/rodapes) | Medição em metros lineares. |
| `eletrica` | [Prysmian — Manual de instalações elétricas](https://br.prysmian.com/sites/br.prysmian.com/files/media/documents/Manual_Instalacoes_Eletricas.pdf) | Separar quantitativo de dimensionamento e método de instalação. |
| `hidraulica` | [Tigre — Manual técnico, 7ª edição, julho de 2025](https://tigresite.s3.amazonaws.com/2025/08/manual_tigre_2025.pdf) | Sistemas de água fria e quente e suas especificações. |
| `esgoto` | [Tigre — Manual técnico, 2025](https://tigresite.s3.amazonaws.com/2025/08/manual_tigre_2025.pdf) | Esgoto, ventilação e águas pluviais tratados por sistema. |
| `cobertura` | [Brasilit — Catálogo geral](https://www.brasilit.com.br/sites/brasilit.com.br/files/downloads/1/Catalogo_Geral_0.pdf) | Recobrimentos e dimensão útil dependem do modelo e inclinação. |
| `impermeabilizacao` | [Viapol — Viaplus 1000](https://www.viapol.com.br/produtos/viaplus-1000/) e [Premium Alumínio Poliéster](https://www.viapol.com.br/produtos/premium-aluminio-poliester/) | Consumo do sistema, demãos e perdas ou recortes já incluídos. |
| `pintura` | [Suvinil — Demãos e pintura acabada](https://www.suvinil.com.br/blog/saiba-a-quantidade-de-demaos-necessarias) | Rendimento acabado contém as demãos previstas. |
| `contrapiso` | [Quartzolit — Boletim técnico](https://www.quartzolit.weber/files/br/2024-07/BT_Contrapiso_pronto_Quartzolit_REV120124.pdf) | Conversão de geometria para consumo de produto depende de coeficiente específico. |
| `pavimentacao` | [ABCP — Manual de pavimento intertravado](https://abcp.org.br/wp-content/uploads/2016/01/Manual_Pavimento_Intertravado-1.pdf) | Separação de camadas, drenagem e confinamento. |
| `formas` | [CAIXA — SINAPI: fôrmas para pilares circulares](https://www.caixa.gov.br/Downloads/sinapi-cadernos-tecnicos/SINAPI-CT-FORMAS-PARA-PILARES-CIRCULARES.pdf) | Exemplo de composição que distingue etapas e utilizações; não estender seus índices a outras fôrmas. |
| `drywall` | [Knauf — Manual de instalação, pp. 46–54](https://knauf.com/api/download-center/v1/assets/3384a2d3-b2b2-48ab-96f6-9be7e6c9b0a2?country=br&download=true) | Base por sistema; perdas incluídas nas tabelas; alguns componentes medidos por perímetro. |
| `pecas` | [Cebrace — Ferramentas para construção civil](https://www.cebrace.com.br/ferramentas-de-suporte/ferramentas-para-construcao-civil/) | Área das peças não substitui especificação de vidro e aplicação. |
| `paisagismo` | [Embrapa — Cartilha, p. 23](https://www.infoteca.cnptia.embrapa.br/infoteca/bitstream/doc/1061001/1/Cartilha1.pdf) | Relação geométrica entre espaçamento e densidade; nenhum espaçamento da cultura é adotado para jardins. |
| `produtividade` | [CAIXA — SINAPI: metodologias e conceitos](https://www.caixa.gov.br/Downloads/sinapi-metodologia/Livro_SINAPI_Metodologias_Conceitos.pdf) | RUP é esforço em horas de trabalho por unidade de serviço. |
| `residuos` | [SEMAD-MG — Resíduos da construção civil](https://meioambiente.mg.gov.br/w/residuos-da-construcao-civil-rcc) e [DNIT — estados do material](https://www.gov.br/dnit/pt-br/assuntos/planejamento-e-pesquisa/ipr/coletanea-de-manuais/vigentes/742_manual_de_implantacao_basica.pdf) | Segregação, gestão local e distinção entre volume original e solto. |
| `dados` | [Furukawa — Guia rápido de instalação](https://www.furukawalatam.com/sfc/servlet.shepherd/version/download/0686100000299HvAAI?asPdf=false&operationContext=CHATER) | Identificação e acomodação de cabos; metragem não valida o enlace. |
| `consumo` | [CAIXA — SINAPI: metodologias e conceitos](https://www.caixa.gov.br/Downloads/sinapi-metodologia/Livro_SINAPI_Metodologias_Conceitos.pdf) | Consumo unitário e perda têm bases distintas; evitar nova reserva sobre perda já incluída. |

## Pontos que afetam o cálculo

- Gesso: para passar de um coeficiente por mm para um coeficiente por cm, multiplica-se por dez. Isso é conversão de unidade, não indicação de consumo para qualquer gesso.
- Pintura: a modalidade “acabado” não multiplica novamente pelas demãos. A ficha do produto e a condição da superfície continuam determinantes.
- Impermeabilização: o consumo total precisa ser distinguido do consumo por demão; detalhes de manta dependem de paginação.
- Drywall: no manual Knauf consultado, páginas impressas 46–54, várias tabelas incluem 5% de perdas. Esse percentual não é um padrão do aplicativo. Na página 48, certos perfis de contorno são medidos pelo perímetro.
- Terra: o DNIT usa na explicação uma relação natural/solto. A entrada do modelo Fortemais “solto por compactado” é outra relação. Comparar rótulos de numerador e denominador antes de preencher.
- Fôrmas: dividir área total por ciclos é uma hipótese de frentes iguais e sequenciais; o pico de uso e o reaproveitamento real precisam ser confrontados com o cronograma.

## Limitações da consulta

O navegador de pesquisa permitiu leitura direta de diversos documentos, incluindo ABCP, Knauf, Tigre e Suvinil. Algumas referências foram consultadas pelo texto indexado do próprio domínio oficial porque a abertura direta teve restrição: Placo e SEMAD-MG retornaram 403; o livro SINAPI entrou em redirecionamento; o manual DNIT excedeu o tamanho aceito; o guia Furukawa redirecionou para `www3.latam.lightera.com`, não acessível pela ferramenta. Os trechos indexados sustentaram apenas os conceitos descritos acima; não foram usados para certificar íntegra, vigência normativa ou disponibilidade futura de download.

As datas nas fontes são de consulta, não de revisão da norma ou ficha. Manuais históricos disponíveis em domínio oficial foram usados para conceitos, sem presumir vigência de tabelas normativas. Antes da compra ou execução, consultar a revisão atual do produto e o projeto da obra.

## Verificação local

`tests/fortemais-ferramentas-conhecimento.mjs` verifica cobertura exata das 25 ferramentas, seções preenchidas, referências HTTPS de domínios primários, alertas de unidades e dupla contagem, independência do DOM/modelo e imutabilidade dos dados. Não faz download em tempo de teste nem afirma validação estrutural dos projetos.
