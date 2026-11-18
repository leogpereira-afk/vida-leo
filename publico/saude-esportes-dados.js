/* Biblioteca educativa de esportes. Conteúdo público, sem dados pessoais. */
var SaudeEsportesDados = {
  "revisedAt": "2026-11-17",
  "purpose": "Biblioteca educativa para conhecer os treinos, escolher equipamentos e reduzir riscos. Exemplos não substituem avaliação nem prescrição individual.",
  "modalities": [
    {
      "id": "corrida",
      "title": "Corrida",
      "intro": "Uma biblioteca para entender os estímulos, interpretar o relógio e escolher roupas e tênis pelo uso. Consistência e progressão compatível importam mais que perseguir números isolados.",
      "training": [
        {
          "title": "Rodagem",
          "text": "Corrida contínua confortável para acumular prática aeróbica. É uma forma de construir regularidade sem transformar cada saída em teste de velocidade.",
          "cue": "A conversa deve continuar possível. Ajuste ao calor, terreno e cansaço.",
          "care": "O teste da fala não mede uma zona cardíaca exata.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Longo",
          "text": "Sessão mais longa que as habituais, construída a partir do seu histórico. Pode treinar resistência e familiaridade com mais tempo em movimento, mas não precisa seguir um número fixo de quilômetros.",
          "cue": "Duração e ritmo dependem do objetivo e do que você tolera.",
          "care": "Não existe distância obrigatória nem percentual semanal que garanta segurança.",
          "sources": [
            "carga-2025",
            "progressao-rct"
          ]
        },
        {
          "title": "Limiar",
          "text": "Blocos sustentados próximos a uma transição fisiológica individual. Pode ser contínuo ou dividido em blocos; o objetivo é sustentar esforço exigente sem transformar o final em sprint.",
          "cue": "Esforço exigente e controlado; o pace deve vir da avaliação e da experiência.",
          "care": "Ritmo de prova e limiar não são sempre iguais.",
          "sources": [
            "lactato-humano"
          ]
        },
        {
          "title": "Intervalado",
          "text": "Blocos de esforço separados por recuperação planejada. Os blocos podem ser definidos por tempo ou distância. A pausa é parte do treino, não um detalhe a eliminar.",
          "cue": "Duração, ritmo e pausa mudam o estímulo; preserve a qualidade do movimento.",
          "care": "Intervalado não significa fazer todo tiro no máximo.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Fartlek",
          "text": "Variações de ritmo ao longo de uma corrida contínua. Uma sessão pode alternar trechos mais rápidos e leves usando pontos do caminho, desde que o terreno permita segurança.",
          "cue": "Pode usar tempo, marcos do percurso ou percepção de esforço.",
          "care": "Trecho rápido também conta como carga intensa.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Subidas",
          "text": "Repetições em inclinação para variar o estímulo e a demanda de força. A inclinação muda a exigência e o ritmo; compare esforço e controle, não apenas pace de asfalto plano.",
          "cue": "Comece em terreno conhecido, com esforço controlado e recuperação adequada.",
          "care": "Não force o antepé; a descida também exige controle e acrescenta carga.",
          "sources": [
            "carga-2025"
          ]
        },
        {
          "title": "Progressivo",
          "text": "Corrida que aumenta o esforço aos poucos, conforme um objetivo planejado. É diferente de começar rápido demais e tentar sobreviver ao final.",
          "cue": "Comece controlado e só aumente enquanto consegue manter movimento e respiração organizados.",
          "care": "O trecho final intenso também entra na carga da semana; não precisa terminar no máximo.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Força complementar",
          "text": "Agachamento, passada, elevação de panturrilha e dobradiça de quadril são padrões úteis para desenvolver capacidade de produzir e controlar força.",
          "cue": "Aprenda a execução com carga adequada e combine a sessão com o restante das modalidades.",
          "care": "Não adicionar uma sessão pesada de pernas sem considerar tiros, longo e HYROX próximos.",
          "sources": [
            "acsm-2026"
          ]
        }
      ],
      "glossary": [
        {
          "title": "VO₂máx",
          "text": "Capacidade máxima de captar e utilizar oxigênio. No relógio, normalmente é uma estimativa: compare tendências em condições semelhantes.",
          "sources": []
        },
        {
          "title": "Lactato e limiar",
          "text": "Lactato também é combustível. O limiar descreve uma transição na resposta ao esforço, não um ponto universal onde começa a dor.",
          "sources": [
            "lactato-humano"
          ]
        },
        {
          "title": "Pace",
          "text": "Tempo para percorrer um quilômetro, em min/km. Pace menor significa maior velocidade.",
          "sources": []
        },
        {
          "title": "Cadência",
          "text": "Passos por minuto contando os dois pés. Varia com ritmo, corpo e técnica; 180 não é meta obrigatória.",
          "sources": [
            "cadencia"
          ]
        },
        {
          "title": "Zonas cardíacas",
          "text": "Faixas para organizar intensidade. Os limites dependem do método e da pessoa; calor, fadiga e medição afetam a leitura.",
          "sources": []
        },
        {
          "title": "VFC / HRV",
          "text": "Variação do intervalo entre batimentos. Observe sua tendência junto com sono, sintomas e treino; um valor isolado não diagnostica recuperação.",
          "sources": [
            "ais-vfc"
          ]
        },
        {
          "title": "PSE / RPE",
          "text": "Percepção subjetiva de esforço: a sensação de dificuldade da sessão. A escala escolhida precisa ser usada de forma consistente.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Volume",
          "text": "Quantidade de treino, expressa em tempo, distância ou outro total. Não diz sozinho o quanto a sessão foi exigente.",
          "sources": [
            "carga-2025"
          ]
        },
        {
          "title": "Intensidade",
          "text": "Quão exigente é o esforço. Pode ser descrita por percepção, ritmo, potência ou frequência cardíaca, cada um com seus limites.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Recuperação",
          "text": "Intervalo entre esforços e processo de adaptação entre sessões. Pausas, dias leves e sono fazem parte da organização do treino.",
          "sources": []
        },
        {
          "title": "Taper / polimento",
          "text": "Redução planejada da carga antes de uma prova para chegar com menos fadiga. Duração e formato dependem do evento e do histórico; não significa abandonar todo movimento.",
          "sources": []
        },
        {
          "title": "Velocidade × pace",
          "text": "Velocidade usa distância por tempo (km/h); pace usa tempo por distância (min/km). Um pace menor representa maior velocidade.",
          "sources": []
        }
      ],
      "gear": [
        {
          "title": "Tênis de rodagem diária",
          "text": "Para a maior parte das corridas e treinos confortáveis: procure ajuste seguro, espaço para os dedos e amortecimento que você tolere bem. A vida útil varia; desgaste, deformação e mudança de conforto importam além dos quilômetros.",
          "sources": [
            "amortecimento"
          ]
        },
        {
          "title": "Tênis de performance / ritmo",
          "text": "Opções para treinos de ritmo, fartlek e intervalados. Peso, geometria e resposta da espuma variam: nem todo tênis rápido é baixo, firme ou indicado para todos. Teste em sessões progressivas antes de usá-lo em esforço prolongado.",
          "sources": []
        },
        {
          "title": "Tênis com placa de carbono",
          "text": "Combinam espuma, geometria e rigidez para buscar desempenho. Não são obrigatórios nem exclusivos do dia da prova; precisam de adaptação e testes prévios. Não há base para afirmar que a placa “faz o trabalho dos tendões” e os enfraquece.",
          "sources": [
            "carbono"
          ]
        },
        {
          "title": "Híbrido / cross-training",
          "text": "Busca combinar deslocamentos e exercícios de força. Para HYROX, teste corrida, tração no trenó, curvas e avanços com o mesmo par. Um modelo excelente para levantar peso pode ser desconfortável nos quilômetros de corrida.",
          "sources": []
        },
        {
          "title": "Tênis de estabilidade",
          "text": "Recursos de suporte e geometria podem ajudar alguns corredores, mas a indicação não nasce só de olhar a pronação. Priorize conforto, sintomas, histórico e avaliação quando necessária.",
          "sources": [
            "motion-control"
          ]
        },
        {
          "title": "Trail / terrenos naturais",
          "text": "Solado e proteção devem combinar com lama, pedra, terra e inclinação. Aderência em piso seco não garante o mesmo comportamento molhado; teste em terreno simples.",
          "sources": []
        },
        {
          "title": "Meias e prevenção de atrito",
          "text": "Escolha tamanho e tecido confortáveis, sem dobras; teste com o tênis e a duração do treino. Costuras, suor e ajuste também influenciam bolhas. Não estreie meias ou amarração na prova.",
          "sources": []
        },
        {
          "title": "Roupa de treino",
          "text": "Camiseta, regata, top, short ou bermuda precisam permitir movimento e lidar bem com suor. Teste costuras, sustentação e bolsos carregados; peças apertadas ou soltas demais podem incomodar.",
          "sources": []
        },
        {
          "title": "Sol, clima e visibilidade",
          "text": "Adapte roupa e proteção ao clima. Em locais com tráfego, priorize ser visto e ouvir o ambiente; planeje percurso, água e pontos de apoio.",
          "sources": []
        }
      ],
      "care": [
        "Some a carga da corrida à do HYROX, do pedal e da musculação de pernas.",
        "Evite aumentar distância, intensidade e terreno ao mesmo tempo.",
        "Dor persistente, inchaço ou mudança da passada pedem ajuste e avaliação."
      ],
      "sources": [
        "cdc-intensidade",
        "carga-2025",
        "progressao-rct",
        "cadencia",
        "lactato-humano",
        "ais-vfc",
        "carbono",
        "amortecimento"
      ],
      "image": "assets/esportes/corrida.webp",
      "productsCheckedAt": "2026-11-17",
      "products": [
        {
          "name": "Air Zoom Pegasus 42",
          "brand": "Nike",
          "category": "Tênis · rodagem no asfalto",
          "use": "Exemplo para corridas diárias no asfalto. Combina espuma ReactX e unidade Air Zoom ao longo da entressola.",
          "limit": "Experimente o ajuste com a meia de treino. A categoria de rodagem não determina o tênis ideal para todo pé ou toda distância.",
          "url": "https://www.nike.com.br/tenis-nike-air-zoom-pegasus-42-masculino-097736.html",
          "image": "https://imgnike-a.akamaihd.net/1920x1920/0977360LA1.jpg",
          "imageAlt": "Foto oficial de Nike Air Zoom Pegasus 42"
        },
        {
          "name": "NOVABLAST 6",
          "brand": "ASICS",
          "category": "Tênis · treino diário",
          "use": "Exemplo da linha de corrida de rua com amortecimento, para comparar em rodagens de diferentes durações.",
          "limit": "Teste conforto e controle em curva; sensação de maciez não equivale a prevenção de lesão. Confira a disponibilidade da versão e do tamanho.",
          "url": "https://www.asics.com.br/1011c243-002/p",
          "image": "https://asicsbr.vteximg.com.br/arquivos/ids/3990884-1000-1000/1011C243_002_SR_RT_GLOBAL.jpg?v=639185060226100000",
          "imageAlt": "Foto oficial de ASICS NOVABLAST 6"
        },
        {
          "name": "Adizero EVO SL",
          "brand": "adidas",
          "category": "Tênis · corrida de rua",
          "use": "Modelo de corrida com espuma Lightstrike Pro, útil para comparar a sensação em rodagens e trechos de ritmo mais vivo.",
          "limit": "A indicação de uso não define um pace mínimo ou ganho garantido. Faça a adaptação em treino antes de escolher para uma prova.",
          "url": "https://www.adidas.com/us/adizero-evo-sl-shoes/JP7149.html",
          "image": "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/b8d2e6f0cdd940f6bb2988cb68ee5bf0_9366/Adizero_EVO_SL_Shoes_Black_JP7149_HM1.jpg",
          "imageAlt": "Foto oficial de adidas Adizero EVO SL"
        },
        {
          "name": "Dri-FIT Stride 5 polegadas",
          "brand": "Nike",
          "category": "Vestuário · shorts de corrida",
          "use": "Shorts com forro interno, ajuste no cós, bolsos e tecido voltado ao manejo do suor durante a corrida.",
          "limit": "Confira se o forro e as costuras ficam confortáveis em movimento. Os detalhes refletivos não substituem iluminação em locais escuros.",
          "url": "https://www.nike.com.br/shorts-dri-fit-nike-stride-masculino-095599.html",
          "image": "https://imgnike-a.akamaihd.net/1920x1920/09559918A1.jpg",
          "imageAlt": "Foto oficial de Nike Dri-FIT Stride 5 polegadas"
        }
      ]
    },
    {
      "id": "hyrox",
      "title": "HYROX",
      "intro": "Corrida e estações em sequência: oito trechos de 1 km alternados com oito exercícios. Aprenda cada movimento e treine a volta à corrida sem transformar toda sessão em simulado máximo.",
      "sources": [
        "hyrox-regras",
        "concept2-ski",
        "concept2-remo",
        "hyrox-fisiologia",
        "hyrox-resultados",
        "hyrox-historia"
      ],
      "training": [
        {
          "title": "01 · SkiErg · 1.000 m",
          "text": "Depois do primeiro quilômetro, o ergômetro de esqui combina puxada de braços, tronco e quadris. Procure uma cadência sustentável e acompanhe o tempo por 500 m.",
          "cue": "Comece alto, com joelhos soltos; incline a partir dos quadris, leve as mãos às coxas e retorne com controle. Ensaie primeiro algumas puxadas suaves.",
          "care": "Se os braços fazem tudo e o corpo permanece ereto, reduza o ritmo. Na prova, fique na base e aguarde confirmação do árbitro ao completar a distância.",
          "sources": [
            "hyrox-regras",
            "concept2-ski"
          ],
          "image": "assets/esportes/hyrox/skierg.jpg"
        },
        {
          "title": "02 · Sled Push · 50 m",
          "text": "Empurre o trenó pelas hastes em trechos de 12,5 m. O objetivo é manter pressão e deslocamento, em vez de repetir arrancadas desorganizadas.",
          "cue": "Firme o tronco, encontre a pegada e empurre o chão para trás com passos curtos. Comece com carga que permita saída e continuidade controladas.",
          "care": "Se a sola patina ou o quadril sobe sem deslocar o trenó, pare e ajuste. Peso total inclui o trenó; atrito do piso muda muito a sensação.",
          "sources": [
            "hyrox-regras"
          ],
          "image": "assets/esportes/hyrox/sled-push.jpg"
        },
        {
          "title": "03 · Sled Pull · 50 m",
          "text": "Puxe o trenó com uma corda, usando a área delimitada para movimentar o corpo e recuperar a pegada. Organize a sobra de corda na própria raia.",
          "cue": "De frente para o trenó, use pernas e quadris, recue em passos curtos e recolha a corda antes de alcançar o limite da área.",
          "care": "Não enrole a corda na mão nem a deixe sob os pés. Se cada puxada vira um tranco com ombros elevados, reduza a carga e o trecho puxado.",
          "sources": [
            "hyrox-regras"
          ],
          "image": "assets/esportes/hyrox/sled-pull.jpg"
        },
        {
          "title": "04 · Burpee Broad Jump · 80 m",
          "text": "Alterne o burpee com um salto horizontal. Distância de salto repetível e controle na aterrissagem são mais úteis que buscar o salto máximo.",
          "cue": "Leve o peito ao chão, retorne os pés e salte com os dois pés juntos. Ensaie devagar, separando o burpee e o salto antes de conectá-los.",
          "care": "Se precisa dar passos para recuperar o equilíbrio, encurte o salto. A prova tem regras de posição das mãos e dos pés; confira-as antes de competir.",
          "sources": [
            "hyrox-regras"
          ],
          "image": "assets/esportes/hyrox/burpee.jpg"
        },
        {
          "title": "05 · Remo · 1.000 m",
          "text": "O banco deslizante permite produzir força principalmente a partir das pernas e completar a remada com tronco e braços. Evite apressar a recuperação.",
          "cue": "Ida: pernas, tronco, braços. Volta: braços, tronco, pernas. As mãos passam dos joelhos antes de você dobrá-los e aproximar o banco.",
          "care": "Se a alça precisa desviar dos joelhos, o banco voltou cedo. Ajuste apoios e teste a alavanca de ar; posição maior não significa treino melhor.",
          "sources": [
            "hyrox-regras",
            "concept2-remo",
            "concept2-damper"
          ],
          "image": "assets/esportes/hyrox/remo.jpg"
        },
        {
          "title": "06 · Farmers Carry · 200 m",
          "text": "Caminhe com um kettlebell em cada mão. A pegada e o controle do tronco precisam continuar funcionando ao longo do percurso e nas curvas.",
          "cue": "Levante dobrando quadris e joelhos, caminhe com braços longos e reduza a passada nas curvas. Para descansar, pouse os dois pesos perto dos pés.",
          "care": "Não avance apenas com um peso nem deixe os kettlebells caírem para ganhar distância. Na chegada, devolva-os à área indicada com alças para cima.",
          "sources": [
            "hyrox-regras"
          ],
          "image": "assets/esportes/hyrox/farmers-carry.jpg"
        },
        {
          "title": "07 · Sandbag Lunge · 100 m",
          "text": "Avanços alternados com saco nos ombros. O equilíbrio depende de uma passada que permita controlar a descida e estender o corpo antes da próxima repetição.",
          "cue": "Imagine dois trilhos para os pés; toque o joelho traseiro suavemente no chão e volte a ficar alto. Aprenda sem saco antes de adicionar carga.",
          "care": "Se o joelho bate no piso ou o corpo oscila, reduza ritmo e carga. Evite colocar os pés sobre uma única linha e fazer passos extras entre avanços.",
          "sources": [
            "hyrox-regras"
          ],
          "image": "assets/esportes/hyrox/lunge.jpg"
        },
        {
          "title": "08 · Wall Balls · 100 repetições",
          "text": "Agachamento com bola e arremesso ao alvo. Na edição individual 26/27, são 100 repetições válidas; bola e alvo dependem da divisão.",
          "cue": "Segure perto do peito, agache e use a subida para lançar. Teste sua distância da parede com bola leve, recebendo-a perto do corpo.",
          "care": "Se faz uma pausa antes do arremesso e cansa só os braços, coordene pernas e lançamento. No-reps não entram na contagem; use a validação do árbitro.",
          "sources": [
            "hyrox-regras"
          ],
          "image": "assets/esportes/hyrox/wall-balls.jpg"
        }
      ],
      "gear": [
        {
          "title": "Tênis para correr e tracionar",
          "text": "Teste o mesmo par em corrida, trenó, curvas e avanços. Procure conforto, aderência e calcanhar seguro; não escolha só pela aparência ou pelo nome “híbrido”.",
          "sources": []
        },
        {
          "title": "Roupas e meias testadas",
          "text": "Use peças respiráveis que permaneçam no lugar ao correr, agachar e fazer burpees. Confira costuras, sustentação, bolsos carregados e atrito antes do dia da prova.",
          "sources": []
        },
        {
          "title": "Luvas comuns",
          "text": "São opcionais e permitidas no regulamento consultado. Teste palma fina, ajuste firme e soltura fácil na corda e nos kettlebells. Grips de ginástica e straps não são equivalentes.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Máquinas e alavanca de ar",
          "text": "SkiErg e remo medem distância no monitor. A alavanca damper regula passagem de ar: compare também técnica e sensação de esforço, sem tratar o número como intensidade obrigatória.",
          "sources": [
            "concept2-damper"
          ]
        },
        {
          "title": "Trenó, corda e pesos",
          "text": "Confira a marcação do implemento antes de usar. O peso do trenó da tabela inclui sua estrutura; “2 × 24 kg” significa um kettlebell de 24 kg em cada mão. Não transforme carga de prova em carga de aprendizagem.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Acessórios e regras",
          "text": "Calçado fechado é exigido, com exceção opcional nos wall balls. Joelheiras tubulares, cinto e mochila de hidratação constam entre os itens permitidos. Fones, grips e câmera corporal são proibidos; confira o regulamento da etapa.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Hidratação e nutrição",
          "text": "Teste sua estratégia em treinos. Na prova, use os pontos oficiais; nutrição própria deve ser carregada desde a largada. Não conte com gel ou bebida entregues por espectadores.",
          "sources": [
            "hyrox-regras"
          ]
        }
      ],
      "glossary": [
        {
          "title": "Roxzone",
          "text": "Área entre pista e estações. O tempo continua contando, por isso entrada, saída e orientação também importam.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Open e Pro",
          "text": "Divisões individuais com cargas diferentes. Escolha pela inscrição e preparo; não existe uma carga pessoal definida apenas pelo nome da modalidade.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Doubles, Relay e Adaptive",
          "text": "Duplas, revezamento e formato adaptado têm regras próprias. No Doubles, a dupla corre junta e divide estações; no Relay, quatro pessoas repartem o percurso.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Split e transição",
          "text": "Split é o tempo de um trecho. Transição é a passagem entre corrida e estação. Compare a estação somada à corrida seguinte, não só seu melhor tempo isolado.",
          "sources": [
            "hyrox-fisiologia"
          ]
        },
        {
          "title": "No-rep",
          "text": "Repetição que não atende ao padrão e precisa ser refeita. Técnica válida e contagem correta fazem parte do resultado.",
          "sources": [
            "hyrox-regras"
          ]
        },
        {
          "title": "Damper e drag factor",
          "text": "Damper é a alavanca de entrada de ar. Drag factor é uma medida calculada pelo monitor para representar resistência. O esforço também depende de como você aplica força e repete o movimento.",
          "sources": [
            "concept2-damper"
          ]
        },
        {
          "title": "Pace nas máquinas",
          "text": "O monitor costuma mostrar tempo por 500 m. Não compare diretamente esse número ao pace de corrida em min/km.",
          "sources": []
        },
        {
          "title": "Treino combinado",
          "text": "Sessão que alterna corrida e exercícios. Pode ser curta e controlada para aprender transições; não precisa reproduzir a prova inteira.",
          "sources": [
            "hyrox-fisiologia"
          ]
        },
        {
          "title": "Origem do esporte",
          "text": "O HYROX surgiu em Hamburgo em 2017, combinando corrida e condicionamento funcional em formato padronizado. A primeira etapa sul-americana ocorreu em São Paulo, em setembro de 2025.",
          "sources": [
            "hyrox-historia",
            "hyrox-brasil"
          ]
        }
      ],
      "care": [
        "Aprenda a técnica com pouca fadiga antes de somar carga, corrida e velocidade.",
        "Intercale estímulos e considere a soma com musculação de pernas, pedal intenso e corrida forte.",
        "Treine o retorno à corrida: ganhar segundos numa estação pode custar mais tempo no quilômetro seguinte.",
        "Use imagens como ilustração; confira movimento com orientação presencial e vídeos técnicos.",
        "Dor que muda o movimento pede interrupção e ajuste. Não insistir para completar uma distância ou uma carga de prova.",
        "Confira a temporada, divisão, mapa da arena e padrão de movimento antes de competir. Esta biblioteca não substitui o regulamento."
      ],
      "image": "assets/esportes/hyrox.webp",
      "productsCheckedAt": "2026-11-17",
      "products": [
        {
          "name": "PUMA x HYROX Deviate NITRO Elite 4",
          "brand": "PUMA",
          "category": "Tênis · competição híbrida",
          "use": "Modelo específico para HYROX, com espuma NITROFOAM Elite, placa de carbono PWRPLATE e solado adaptado para o trenó.",
          "limit": "Teste corrida, curvas, lunges e trenó no mesmo par. A placa não garante melhor resultado nem substitui ajuste e familiaridade com o tênis.",
          "url": "https://us.puma.com/us/en/pd/puma-x-hyrox-deviate-nitro-elite-4-mens-running-shoes/312959",
          "image": "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/312959/01/sv01/fnd/PNA/fmt/png/PUMA-x-HYROX-Deviate-NITRO™-Elite-4-Men's-Training-Shoes",
          "imageAlt": "Foto oficial de PUMA PUMA x HYROX Deviate NITRO Elite 4"
        },
        {
          "name": "PUMA x HYROX Activate NITRO",
          "brand": "PUMA",
          "category": "Tênis · treino híbrido",
          "use": "Opção desenvolvida para sessões de força e condicionamento do HYROX, com NITROFOAM e solado PUMAGRIP.",
          "limit": "Uma sessão com mais corrida pode pedir sensação diferente de uma sessão dominada por estações. Compare no piso e nos movimentos que você realmente usa.",
          "url": "https://us.puma.com/us/en/pd/puma-x-hyrox-activate-nitro-training-shoes/314057",
          "image": "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/314057/01/sv01/fnd/PNA/fmt/png/PUMA-x-HYROX-Activate-NITRO™-Training-Shoes",
          "imageAlt": "Foto oficial de PUMA PUMA x HYROX Activate NITRO"
        },
        {
          "name": "PUMA x HYROX DryElite Tee",
          "brand": "PUMA",
          "category": "Vestuário · camiseta de treino",
          "use": "Camiseta de treino com painéis de tela, tecido com elastano e tecnologia dryCELL para manejo do suor.",
          "limit": "Verifique a liberdade dos ombros em wall balls e a posição da camiseta nos burpees. O logo HYROX não é requisito para treinar ou competir.",
          "url": "https://us.puma.com/us/en/pd/puma-x-hyrox-mens-dryelite-tee/528567",
          "image": "https://images.puma.com/image/upload/f_auto,q_auto,b_rgb:fafafa,w_2000,h_2000/global/528567/01/mod01/fnd/PNA/fmt/png/PUMA-x-HYROX-Men's-DryElite-Tee",
          "imageAlt": "Foto oficial de PUMA PUMA x HYROX DryElite Tee"
        }
      ]
    },
    {
      "id": "mtb",
      "title": "Mountain bike",
      "intro": "Resistência, leitura do terreno e domínio da bicicleta. Pratique habilidades em locais simples antes de aumentar velocidade, obstáculos e dificuldade.",
      "training": [
        {
          "title": "Base aeróbica",
          "text": "Pedal contínuo em esforço confortável, em percurso compatível com sua experiência.",
          "cue": "Acompanhe esforço e fadiga; velocidade muda muito com terreno e vento.",
          "care": "Evite escolher uma trilha mais técnica só para manter a velocidade média.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Subidas",
          "text": "Trechos de subida com duração e recuperação planejadas.",
          "cue": "Troque a marcha antes de perder fluidez e preserve controle e tração.",
          "care": "A marcha precisa preservar o controle; esforço elevado e fadiga também contam para os outros esportes.",
          "sources": [
            "cdc-intensidade"
          ]
        },
        {
          "title": "Posição neutra",
          "text": "Pratique equilíbrio e mobilidade sobre a bicicleta em terreno simples.",
          "cue": "Braços e pernas ajudam a acompanhar o terreno; ajuste com um instrutor.",
          "care": "Não mantenha articulações travadas para tentar “segurar” toda irregularidade.",
          "sources": [
            "mtb-lesoes"
          ]
        },
        {
          "title": "Frenagem",
          "text": "Treine uso progressivo dos dois freios em local seguro.",
          "cue": "Aprenda a controlar velocidade sem travar rodas antes de ir para trechos técnicos.",
          "care": "Treine em piso previsível, sem pedestres e com espaço para desacelerar.",
          "sources": [
            "mtb-lesoes"
          ]
        },
        {
          "title": "Curvas e trajetória",
          "text": "Leia o percurso com antecedência e pratique curvas em baixa velocidade.",
          "cue": "Escolha dificuldade que permita manter controle e espaço para corrigir.",
          "care": "Não entre em curva cega acima da velocidade em que consegue parar dentro da área visível.",
          "sources": [
            "mtb-lesoes"
          ]
        },
        {
          "title": "Obstáculos",
          "text": "Aprenda progressões pequenas em ambiente controlado.",
          "cue": "Saltos e descidas exigentes pedem instrução presencial e proteção compatível.",
          "care": "Se não domina a passagem, descer da bicicleta e reconhecer o trecho é uma opção válida.",
          "sources": [
            "mtb-lesoes"
          ]
        }
      ],
      "glossary": [
        {
          "title": "XC / XCM",
          "text": "Cross-country e sua vertente de maratona; combinam resistência e habilidade técnica.",
          "sources": []
        },
        {
          "title": "Trail / enduro / downhill",
          "text": "Formas de pedalar com exigências diferentes de subida, descida e terreno; equipamento e proteção precisam acompanhar o uso.",
          "sources": []
        },
        {
          "title": "Singletrack",
          "text": "Trilha estreita, geralmente com espaço para uma bicicleta por vez.",
          "sources": []
        },
        {
          "title": "SAG",
          "text": "Quanto a suspensão cede com o ciclista em posição. Ajuste conforme fabricante, bicicleta e uso.",
          "sources": []
        },
        {
          "title": "Tubeless",
          "text": "Sistema de pneu sem câmara que usa vedação apropriada; ainda exige inspeção e pressão adequada.",
          "sources": []
        },
        {
          "title": "Dropper",
          "text": "Canote retrátil que permite mudar a altura do selim durante o percurso.",
          "sources": []
        },
        {
          "title": "Cadência de pedalada",
          "text": "Número de voltas do pedivela por minuto. A melhor combinação entre marcha e cadência depende de terreno, esforço e experiência.",
          "sources": []
        },
        {
          "title": "Relação de marchas",
          "text": "Combinação entre coroa e pinhão. Uma relação mais leve facilita girar na subida; pratique a troca antes de o esforço ficar excessivo.",
          "sources": []
        },
        {
          "title": "Linha / trajetória",
          "text": "Caminho escolhido para atravessar uma curva ou obstáculo. Considere aderência, visibilidade e espaço para corrigir.",
          "sources": [
            "mtb-lesoes"
          ]
        }
      ],
      "gear": [
        {
          "title": "Capacete",
          "text": "Certificado, bem ajustado e compatível com a modalidade. Em downhill, as regras UCI exigem integral em treino de pista e corrida.",
          "sources": [
            "uci-mtb"
          ]
        },
        {
          "title": "Olhos e mãos",
          "text": "Óculos e luvas adequados ao terreno, com boa visão e controle das manetes.",
          "sources": []
        },
        {
          "title": "Calçado e pedal",
          "text": "Compatibilidade e domínio do sistema vêm antes da performance. Pratique encaixe e desencaixe em local seguro.",
          "sources": []
        },
        {
          "title": "Vestuário",
          "text": "Bermuda ou bretelle bem ajustado, camadas para o clima e peças sem pontas soltas perto de corrente e rodas.",
          "sources": []
        },
        {
          "title": "Bicicleta pronta",
          "text": "Confira pneus, freios, rodas, transmissão e comandos; pressão e ajuste não têm valor único para todos.",
          "sources": []
        },
        {
          "title": "Autonomia",
          "text": "Leve água, ferramentas básicas e comunicação; compartilhe o percurso com alguém quando for necessário.",
          "sources": []
        }
      ],
      "care": [
        "Reconheça o terreno e reduza a dificuldade quando estiver cansado.",
        "Dor ou dormência persistente exige revisão do ajuste e avaliação.",
        "Suspeita de concussão após queda exige interrupção e avaliação; capacete não elimina esse risco.",
        "Depois de queda, confira corpo e bicicleta antes de seguir. Capacete e proteções reduzem exposições, mas não tornam qualquer trecho seguro."
      ],
      "sources": [
        "mtb-lesoes",
        "uci-mtb",
        "uci-concussao"
      ],
      "image": "assets/esportes/mtb.webp",
      "productsCheckedAt": "2026-11-17",
      "products": [
        {
          "name": "SH-XC302",
          "brand": "Shimano",
          "category": "Sapatilha · pedal de encaixe SPD",
          "use": "Sapatilha de cross-country com fechamento BOA e compatibilidade SPD. Exemplo para quem utiliza pedal de encaixe e quer ajuste por disco.",
          "limit": "Confirme taco, pedal e montagem compatíveis; SPD não é SPD-SL. Pratique encaixar e desencaixar em local controlado antes da trilha.",
          "url": "https://ride.shimano.com/products/sh-xc302",
          "image": "https://ride.shimano.com/cdn/shop/files/ea4cqanvqfw3hngwqkvq_bfab5d11-cae4-4c94-8fb7-842448e09bd7_1400x.jpg?v=1794903795",
          "imageAlt": "Foto oficial de Shimano SH-XC302"
        },
        {
          "name": "Five Ten Freerider Pro",
          "brand": "adidas Five Ten",
          "category": "Sapatilha · pedal plataforma (flat)",
          "use": "Calçado de mountain bike da linha Freerider para contato com pedal plataforma, sem sistema de taco de encaixe.",
          "limit": "Confira aderência e posicionamento com o seu pedal. Não é substituto direto de uma sapatilha SPD; a escolha depende do sistema usado na bicicleta.",
          "url": "https://www.adidas.com/us/five-ten-freerider-pro-mountain-bike-shoes/IF7425.html",
          "image": "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/ddaa256d44fb42c8b809f3a7bdf534f2_9366/Five_Ten_Freerider_Pro_Mountain_Bike_Shoes_Black_IF7425_01_standard.jpg",
          "imageAlt": "Foto oficial de adidas Five Ten Five Ten Freerider Pro"
        },
        {
          "name": "Fixture Mips II",
          "brand": "Giro",
          "category": "Acessório · capacete de ciclismo",
          "use": "Capacete de ciclismo com ajuste Roc Loc Sport e sistema Mips. Exemplo para conferir tamanho, assentamento e regulagem das tiras.",
          "limit": "Não há proteção absoluta contra impactos. Confira a certificação e a finalidade da versão comprada; o modelo aberto não cobre as mesmas áreas de um full-face.",
          "url": "https://www.giro.com/product/fixture-mips-ii-helmet/100000002400000017.html",
          "image": "https://vault.widen.net/content/x8jdd13fkn?h=1500&w=1500",
          "imageAlt": "Foto oficial de Giro Fixture Mips II"
        },
        {
          "name": "Ranger Gloves",
          "brand": "Fox Racing",
          "category": "Vestuário · luvas de MTB",
          "use": "Luvas de dedos longos para mountain bike, com ajuste no punho e compatibilidade com tela sensível ao toque.",
          "limit": "Experimente segurando o guidão e acionando freios. Luva apertada ou com sobras pode atrapalhar o controle; não elimina risco em quedas.",
          "url": "https://www.foxracing.com/product/ranger-gloves/33613.html",
          "image": "https://vault.widen.net/content/tq4u9nxywe?h=1500&w=1500",
          "imageAlt": "Foto oficial de Fox Racing Ranger Gloves"
        }
      ]
    },
    {
      "id": "musculacao",
      "title": "Musculação",
      "intro": "Treine padrões de movimento com amplitude controlada, carga adequada e progressão consistente. Use a força como parte do conjunto de esportes, respeitando recuperação e técnica.",
      "training": [
        {
          "title": "Agachar",
          "text": "Agachamento e leg press são opções para trabalhar o padrão de extensão de joelhos e quadril.",
          "cue": "No agachamento, mantenha apoio estável, dobre joelhos e quadris e desça até a amplitude que controla; suba sem trancos. No leg press, ajuste banco e não deixe a pelve perder apoio.",
          "care": "Não aumente amplitude e carga ao mesmo tempo se ainda perde o controle da descida.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Dobrar o quadril",
          "text": "Levantamento romeno e variações treinam a dobradiça de quadril.",
          "cue": "Leve o quadril para trás com joelhos levemente flexionados e carga perto do corpo; volte usando o quadril, dentro da amplitude que mantém controlada.",
          "care": "Evite transformar a repetição em um tranco; ajuste a carga se não consegue manter o padrão aprendido.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Unilateral",
          "text": "Passada e step-up trabalham cada perna com maior demanda de controle.",
          "cue": "Na passada, separe os pés como dois trilhos e desça devagar. No step-up, apoie bem o pé e escolha um degrau que permita controlar também a volta.",
          "care": "Escolha altura de apoio e passada que permitam subir e descer sem perder o equilíbrio.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Empurrar",
          "text": "Flexão, supino e variações em máquina são alternativas para membros superiores.",
          "cue": "No supino ou flexão, organize apoio das mãos, controle a descida e empurre sem perder a posição do tronco; use amplitude confortável e previsível.",
          "care": "Não fique preso sob uma carga livre: organize segurança e assistência antes da série.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Puxar",
          "text": "Remadas e puxadas permitem treinar costas e braços com diferentes equipamentos.",
          "cue": "Conduza cotovelos e carga com controle, mantenha tronco estável e devolva o peso devagar; use amplitude que não exija compensações.",
          "care": "Não use balanço do tronco para esconder perda de controle ou completar uma carga excessiva.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Panturrilha e tronco",
          "text": "Elevações de panturrilha, carregadas e exercícios de estabilização complementam os padrões.",
          "cue": "Na panturrilha, eleve e abaixe os calcanhares com controle. No tronco, sustente ou mova sem perder a postura combinada; respire durante o exercício.",
          "care": "Não busque tremor ou dor como objetivo; ajuste volume à resposta e às outras modalidades.",
          "sources": [
            "acsm-2026"
          ]
        }
      ],
      "glossary": [
        {
          "title": "Série e repetição",
          "text": "Repetição é um ciclo do movimento; série é um conjunto de repetições.",
          "sources": []
        },
        {
          "title": "Amplitude",
          "text": "Extensão do movimento realizada com controle, conforme exercício e capacidade.",
          "sources": []
        },
        {
          "title": "Concêntrico / excêntrico",
          "text": "Fases de encurtamento e alongamento muscular sob tensão. Isométrico mantém uma posição.",
          "sources": []
        },
        {
          "title": "1RM",
          "text": "Maior carga completada em uma repetição de determinado exercício. Não é preciso testar máximo para começar.",
          "sources": []
        },
        {
          "title": "RIR",
          "text": "Repetições em reserva: estimativa de quantas ainda seriam possíveis mantendo a execução.",
          "sources": []
        },
        {
          "title": "Falha técnica",
          "text": "Ponto em que não se mantém o padrão combinado. Ir à falha em toda série não é obrigatório.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Carga e volume",
          "text": "Carga pode indicar o peso externo; volume combina o trabalho realizado, como séries e repetições. Aumentar os dois de uma vez pode mudar muito a exigência.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Descanso entre séries",
          "text": "Pausa usada para recuperar capacidade de repetir o esforço. Ajuste ao exercício, objetivo e qualidade das próximas repetições; menos descanso não é sempre melhor.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Progressão",
          "text": "Aumento planejado da exigência. Pode vir de mais controle, repetições, séries ou carga, conforme o objetivo e a resposta ao treinamento.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Dor muscular tardia",
          "text": "Desconforto que pode aparecer após esforço pouco habitual. Não é medida obrigatória de eficácia e não deve ser confundido com dor articular ou lesão.",
          "sources": []
        }
      ],
      "gear": [
        {
          "title": "Calçado estável",
          "text": "Escolha apoio e aderência compatíveis com o exercício; amortecimento muito instável pode atrapalhar controle.",
          "sources": []
        },
        {
          "title": "Máquina ou peso livre",
          "text": "Ambos podem funcionar. Escolha pelo objetivo, disponibilidade e domínio do movimento.",
          "sources": [
            "acsm-2026"
          ]
        },
        {
          "title": "Cinto e straps",
          "text": "São ferramentas opcionais para usos específicos, não substitutos de técnica ou controle de carga.",
          "sources": []
        },
        {
          "title": "Segurança do espaço",
          "text": "Ajuste bancos e máquinas, mantenha área livre e use travas, barras de segurança e auxílio quando indicado.",
          "sources": []
        }
      ],
      "care": [
        "Regularidade e individualização são mais importantes que uma ficha excessivamente complexa.",
        "Para adultos saudáveis, as diretrizes orientam grandes grupos musculares pelo menos duas vezes por semana, ajustando carga e volume.",
        "Dor muscular tardia não mede a qualidade do treino. Dor articular persistente pede ajuste e avaliação."
      ],
      "sources": [
        "acsm-2026"
      ],
      "image": "assets/esportes/musculacao.webp",
      "productsCheckedAt": "2026-11-17",
      "products": [
        {
          "name": "Metcon 10",
          "brand": "Nike",
          "category": "Tênis · força e treino funcional",
          "use": "Modelo de treino com placa Hyperlift sob o calcanhar e espuma ReactX. Exemplo para comparar o apoio em agachamentos, levantamentos e circuitos.",
          "limit": "Teste a base de apoio e o ajuste em seus exercícios. Um tênis voltado à força não deve ser escolhido automaticamente para longas corridas.",
          "url": "https://www.nike.com/t/metcon-10-mens-workout-shoes-WWGl2m1D/HJ1875-002",
          "image": "https://static.nike.com/a/images/t_default/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/5709c27f-742f-4236-93c5-fd398cde51f9/M+NIKE+METCON+10.png",
          "imageAlt": "Foto oficial de Nike Metcon 10"
        },
        {
          "name": "Dropset 4",
          "brand": "adidas",
          "category": "Tênis · força e circuitos",
          "use": "Modelo de treino funcional de força, com entressola Repetitor e Energyrods; a fabricante inclui pesos, resistência muscular e corridas curtas entre os usos.",
          "limit": "Corrida curta em circuito não equivale a rodagem longa. Compare a firmeza e a mobilidade necessárias aos seus exercícios.",
          "url": "https://www.adidas.com/us/dropset-4-training-shoes/JR4673.html",
          "image": "https://assets.adidas.com/images/w_500%2Cf_auto%2Cq_auto/96dca2b88abc4c0e8b0f0d571a532d83_9366/Dropset_4_Training_Shoes_Black_JR4673_HM1.jpg",
          "imageAlt": "Foto oficial de adidas Dropset 4"
        },
        {
          "name": "Romaleos 4",
          "brand": "Nike",
          "category": "Tênis · levantamento de peso",
          "use": "Calçado específico de levantamento, com entressola rígida, calcanhar elevado e tiras de ajuste. É uma opção a avaliar para movimentos de agachamento e levantamento olímpico.",
          "limit": "O salto modifica a posição do corpo; não corrige técnica por si só. Não é um tênis de corrida nem uma exigência para toda sessão de musculação.",
          "url": "https://www.nike.com/t/romaleos-4-weightlifting-shoes-r7zff9/CD3463-010",
          "image": "https://static.nike.com/a/images/t_default/u_9ddf04c7-2a9a-4d76-add1-d15af8f0263d,c_scale,fl_relative,w_1.0,h_1.0,fl_layer_apply/d1d586ba-9202-4c41-ba05-85d5e5e861cd/NIKE+ROMALEOS+4.png",
          "imageAlt": "Foto oficial de Nike Romaleos 4"
        }
      ]
    }
  ],
  "sources": {
    "acsm-2026": {
      "label": "ACSM · Diretrizes de musculação 2026",
      "url": "https://acsm.org/resistance-training-guidelines-update-2026/",
      "type": "Posição oficial",
      "year": 2026,
      "application": "Orientar regularidade, individualização, frequência e progressão do treinamento de força em adultos saudáveis.",
      "limitation": "Diretriz geral; não substitui prescrição individual ou protocolos de reabilitação."
    },
    "cadencia": {
      "label": "Heiderscheit et al. · Cadência e mecânica",
      "url": "https://pubmed.ncbi.nlm.nih.gov/20581720/",
      "type": "Experimento biomecânico",
      "year": 2011,
      "application": "Mostrar que mudanças relativas na frequência de passos podem alterar algumas cargas articulares.",
      "limitation": "Experimento biomecânico de laboratório; não prova prevenção clínica de lesões nem uma cadência ideal universal."
    },
    "progressao-rct": {
      "label": "Buist et al. · Progressão e lesões",
      "url": "https://pubmed.ncbi.nlm.nih.gov/17940147/",
      "type": "Ensaio randomizado",
      "year": 2008,
      "application": "Revisar a ideia de que uma regra percentual de progressão, sozinha, garante segurança.",
      "limitation": "Ensaio com 532 iniciantes; o programa baseado em 10% não reduziu lesões frente ao comparador. Isso não torna qualquer aumento seguro."
    },
    "carga-2025": {
      "label": "Frandsen et al. · Distância por sessão e lesões",
      "url": "https://doi.org/10.1136/bjsports-2024-109380",
      "type": "Coorte observacional",
      "year": 2025,
      "application": "Considerar a distância de cada sessão em relação ao histórico recente ao planejar progressão.",
      "limitation": "Coorte observacional de 5.205 corredores; associação não prova causa nem define limite seguro para cada pessoa. Resumo indexado consultado."
    },
    "carbono": {
      "label": "Tenforde et al. · Placa de carbono e lesões por estresse",
      "url": "https://doi.org/10.1007/s40279-023-01818-z",
      "type": "Série de casos e discussão",
      "year": 2023,
      "application": "Recomendar adaptação gradual a mudanças importantes de geometria e rigidez do calçado.",
      "limitation": "Série de cinco casos e discussão; não estima risco por modelo nem prova que placa causa lesões ou enfraquece tendões."
    },
    "lactato-humano": {
      "label": "MacRae et al. · Uso do lactato no exercício",
      "url": "https://pubmed.ncbi.nlm.nih.gov/8594549/",
      "type": "Experimento fisiológico",
      "year": 1995,
      "application": "Explicar que lactato pode ser utilizado como combustível e que sua dinâmica muda com treinamento.",
      "limitation": "Experimento com oito participantes; informa um mecanismo, não determina pace ou limiar individual."
    },
    "ais-vfc": {
      "label": "AIS · Interpretação da VFC",
      "url": "https://www.ausport.gov.au/ais/position_statements/heart-rate-variability",
      "type": "Diretriz oficial",
      "application": "Usar tendências de FC/VFC junto de contexto, qualidade da medição, sono e treino.",
      "limitation": "Orientação para monitoramento; um valor isolado não diagnostica doença nem libera ou proíbe um treino.",
      "year": null
    },
    "cdc-intensidade": {
      "label": "CDC · Percepção de intensidade",
      "url": "https://www.cdc.gov/physical-activity-basics/measuring/index.html",
      "type": "Orientação oficial",
      "year": 2025,
      "application": "Reconhecer intensidade relativa por sensação de esforço e teste da fala.",
      "limitation": "Estimativas práticas; não calibram zonas exatas de frequência cardíaca ou limiar fisiológico."
    },
    "mtb-lesoes": {
      "label": "Becker et al. · Lesões no downhill",
      "url": "https://pubmed.ncbi.nlm.nih.gov/23329619/",
      "type": "Coorte observacional",
      "year": 2013,
      "application": "Valorizar técnica, reconhecimento do terreno e adequação da proteção na prática de downhill.",
      "limitation": "Coorte de 249 ciclistas; downhill não representa todo MTB recreativo, e a observação não isola a eficácia de cada medida."
    },
    "uci-mtb": {
      "label": "UCI · Regulamento MTB 2026",
      "url": "https://assets.ctfassets.net/761l7gh5x5an/6qYIYIddcAPjN248n7tVDI/952938d168fc58dff91242d076230446/4-MTB-20260101-E.pdf",
      "type": "Regulamento oficial",
      "year": 2026,
      "application": "Conferir exigências de equipamento nas disciplinas competitivas de mountain bike.",
      "limitation": "Norma de competição, não ensaio clínico. Exigências de downhill não devem ser generalizadas para XC."
    },
    "uci-concussao": {
      "label": "UCI · Cuidados com concussão no MTB",
      "url": "https://assets.ctfassets.net/761l7gh5x5an/4oBJcmbemv6cyQB8s28eOg/913435dea3df45a0446b146d98b6427a/Information_on_concussions_management_MTB.pdf",
      "type": "Orientação oficial",
      "application": "Reconhecer suspeita de concussão, interromper a atividade e buscar avaliação e retorno acompanhado.",
      "limitation": "Orientação de segurança; não é ferramenta de autodiagnóstico nem autorização para retornar ao esporte.",
      "year": null
    },
    "amortecimento": {
      "label": "Malisoux et al. · Amortecimento e cargas",
      "url": "https://pmc.ncbi.nlm.nih.gov/articles/PMC8632264/",
      "type": "Análise secundária de ensaio randomizado",
      "year": 2021,
      "application": "Mostrar que relações entre amortecimento, forças e lesões são mais complexas que “mais macio protege mais”.",
      "limitation": "Análise de dois protótipos em um ensaio; não recomenda marcas, modelos ou indicação baseada somente em pronação."
    },
    "hyrox-regras": {
      "label": "HYROX · Regulamento Singles 26/27",
      "url": "https://maintain.hyrox.com/rulebooks/HYROX_RulebookSingles_EN.pdf",
      "type": "Regulamento oficial",
      "year": 2026,
      "application": "Conferir sequência, distâncias, padrões de movimento, divisão e equipamentos da prova individual.",
      "limitation": "Norma de competição; não prescreve carga de treino nem prova prevenção. Outros formatos e atualizações exigem consulta própria."
    },
    "concept2-ski": {
      "label": "Concept2 · Técnica de SkiErg",
      "url": "https://www.concept2.com/training/skierg-technique",
      "type": "Instrução técnica do fabricante",
      "year": null,
      "application": "Ver a coordenação entre tronco, quadris e braços e conferir a recuperação da puxada.",
      "limitation": "Demonstração geral de uso; não é avaliação individual nem estudo clínico de prevenção."
    },
    "concept2-remo": {
      "label": "Concept2 · Técnica de remo",
      "url": "https://www.concept2.com/training/rowing-technique",
      "type": "Instrução técnica do fabricante",
      "year": null,
      "application": "Aprender a sequência pernas–tronco–braços na remada e a ordem inversa na recuperação.",
      "limitation": "Demonstração geral; ajustes individuais de equipamento e movimento podem exigir orientação presencial."
    },
    "hyrox-fisiologia": {
      "label": "Brandt et al. · Demandas fisiológicas do HYROX",
      "url": "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2025.1519240/full",
      "type": "Estudo de simulação",
      "year": 2025,
      "application": "Entender a participação da corrida e das estações e a associação da capacidade aeróbica ao desempenho.",
      "limitation": "Onze praticantes experientes; estudo pequeno e observacional. Não determina planilha ideal nem avalia prevenção de lesões."
    },
    "hyrox-resultados": {
      "label": "Rappelt et al. · Resultados PRO e ELITE",
      "url": "https://www.frontiersin.org/journals/physiology/articles/10.3389/fphys.2026.1847569/full",
      "type": "Análise observacional de resultados",
      "year": 2026,
      "application": "Contextualizar o peso do desempenho na corrida e a contribuição das estações de força no resultado total.",
      "limitation": "39.696 resultados de sete temporadas PRO/ELITE; associação sem intervenção. Não representa prescrição para iniciantes nem dados de lesões."
    },
    "hyrox-historia": {
      "label": "HYROX Brasil · História",
      "url": "https://hyroxbrazil.com/pt-br/historia/",
      "type": "Histórico oficial",
      "year": null,
      "application": "Consultar origem, fundadores e proposta do formato.",
      "limitation": "Fonte institucional, com linguagem promocional; não serve como evidência clínica ou garantia de resultado."
    },
    "hyrox-brasil": {
      "label": "HYROX · Estreia em São Paulo",
      "url": "https://brazil.hyrox.com/event/hyrox-sao-paulo-season-25-26-nmbba0",
      "type": "Registro oficial de evento",
      "year": 2025,
      "application": "Confirmar data e contexto da estreia sul-americana em São Paulo.",
      "limitation": "Evento histórico; não representa calendário ou regras vigentes para uma nova inscrição."
    },
    "motion-control": {
      "label": "Malisoux et al. · Tênis com controle de movimento",
      "url": "https://pubmed.ncbi.nlm.nih.gov/26746907/",
      "type": "Ensaio randomizado",
      "year": 2016,
      "application": "Examinar o efeito de um sistema de controle de movimento sobre lesões em corredores recreativos, considerando a postura do pé.",
      "limitation": "Estudo com 372 corredores, um modelo de calçado e seis meses de acompanhamento; o achado por postura do pé veio de análise de subgrupos. Não permite indicar qualquer tênis apenas pela pronação ou garantir proteção individual."
    },
    "concept2-damper": {
      "label": "Concept2 · Damper e drag factor",
      "url": "https://www.concept2.com/training/articles/damper-setting",
      "type": "Instrução técnica do fabricante",
      "year": null,
      "application": "Distinguir a alavanca de passagem de ar, a medida de desaceleração do volante e a intensidade produzida pelo praticante.",
      "limitation": "Explicação técnica do equipamento; não define uma regulagem ideal para toda pessoa nem substitui teste prático, orientação ou regras da competição."
    }
  },
  "version": "2026-11-17.1",
  "imageNotice": "Imagens ilustrativas geradas por IA. Para aprender a execução, combine os pontos de controle com orientação presencial e demonstrações técnicas."
};
