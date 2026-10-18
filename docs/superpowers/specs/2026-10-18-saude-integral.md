# Prompt de evolução da Saúde da Central do Léo

Quero transformar toda a área de Saúde da Central do Léo em um painel pessoal completo, confiável e agradável de usar. Preciso entender rapidamente o que registrar, o que está pendente, como meus registros evoluem e o que levar para uma consulta. O objetivo é organizar meus cuidados e meu histórico, preservando os documentos e as orientações profissionais.

Atue como designer de produto e experiência, especialista em acessibilidade, analista de dados e desenvolvedor experiente. Vá além de mudar cores: melhore os fluxos, a qualidade dos dados e a navegação. Trabalhe com cards compactos e inteligentes, ações rápidas e detalhes acessíveis, sem sobrecarregar a tela.

## 1. Comece pelo sistema real e preserve o que já existe

Examine a estrutura atual, as regras do repositório, o estado das alterações locais e a versão publicada. Leia os protocolos vigentes e respeite as autorizações já dadas. Não substitua a aplicação inteira nem mude outras áreas da Central sem necessidade.

Audite e evolua todas as áreas existentes:

- Resumo e indicadores.
- Exames, marcadores, laudos, comparação e acompanhamento preventivo.
- Peso, composição corporal, medidas e sinais vitais.
- Sintomas, queixas, consultas, retornos e fisioterapia.
- Tratamentos, medicamentos, suplementos, compras, usos e reposição.
- Vacinas, prevenção e histórico familiar.
- Documentos, ficha de emergência, relatórios e qualidade dos dados.
- Gravação, sincronização, permissões e funcionamento no celular.

Reaproveite os componentes, a autenticação, os serviços e os cálculos adequados. Preserve IDs, anexos, históricos, datas e vínculos. Não elimine campos antigos nem reclassifique receitas históricas como tratamentos atuais.

Apresente primeiro um diagnóstico breve com evidência, impacto, prioridade, esforço e grau de certeza. Separe problema reproduzido, risco observado no código, melhoria de experiência e dependência ainda não verificada. Depois implemente por etapas dentro do escopo aprovado. Não pare em sugestões ou numa troca cosmética de CSS.

## 2. Corrija primeiro os problemas já identificados

Reconfirme estes achados na versão em que vai trabalhar:

1. Na importação de exames, os itens entram na memória antes de a gravação terminar. Uma falha seguida de nova tentativa no mesmo formulário pode duplicá-los. Reproduza com dados fictícios e corrija a transação e a repetição segura.
2. Importar laudo atualmente aceita JSON/texto, sem extração direta de PDF/foto. Os rótulos devem explicar a capacidade real.
3. Histórico familiar pode nascer com parente, doença e situação já selecionados. Remova suposições clínicas e peça informação expressa.
4. Rastreios preventivos usam intervalos fixos e equivalências de marcadores. Não trate automaticamente isso como um plano individual ou prova de uma avaliação completa.
5. A qualidade dos dados ainda precisa cobrir todas as áreas, não somente alguns tipos de registro.

Consulte a auditoria fornecida junto deste prompt. Não considere que testes existentes aprovados provam que esses cenários estão cobertos.

## 3. Organize a entrada em torno do que preciso fazer

A primeira tela deve responder: o que merece minha atenção agora?

Mostre, quando houver dados:

- Usos e cuidados planejados para hoje, com o estado real do registro.
- Consultas e retornos próximos.
- Itens com reposição necessária ou estoque a confirmar.
- Resultados e documentos aguardando conferência.
- Pequeno resumo dos indicadores mais úteis, com data, unidade e acesso ao histórico.

Priorize no máximo quatro indicadores principais; os demais ficam em Ver todos ou em preferências. Se não houver dados, apresente um estado vazio compacto com a ação de cadastro. Evite várias caixas grandes mostrando apenas traços.

Separe compromissos confirmados, pendências de cadastro e sugestões para discutir com o profissional. Toda prioridade automática deve explicar por que apareceu.

Reaproveite a navegação atual e simplifique os níveis. Preserve a posição solicitada de **Registrar uso imediatamente ao lado de Visão geral dentro do tratamento**. Esse botão deve abrir o caminho mais curto para escolher o item, informar a quantidade e confirmar, sem gravar nada apenas ao navegar.

Lembre a seleção e os filtros úteis ao voltar de um detalhe, sem misturar dados de tratamentos diferentes. Faça o botão Voltar e o histórico do navegador funcionarem de forma previsível.

## 4. Crie um padrão de cards compactos e inteligentes

O card deve conter apenas o necessário para decidir o próximo passo:

1. Título ou nome do item.
2. Dado principal e unidade, quando houver.
3. Data e contexto indispensável.
4. Situação em texto.
5. Uma ação principal e acesso aos detalhes.

Os detalhes completos, anexos, notas e histórico abrem sob demanda. Não esconda informação crítica em tooltip nem corte nome, quantidade ou orientação necessária ao uso.

Direção visual:

- Identidade da Central do Léo, com o verde já usado em Saúde e fundos claros neutros.
- Verde para confirmação; âmbar para atenção; vermelho apenas para situações que justifiquem destaque; cinza para informação ausente ou neutra. Seleção e gravidade devem ser distinguíveis.
- Espaçamentos em escala consistente; como ponto inicial, 12–16 px de padding e 12 px entre cards, ajustados por conteúdo.
- Cantos de 12–16 px e sombra discreta; evitar caixas dentro de caixas sem função.
- Texto principal confortável, preferencialmente 14–16 px; rótulos de 12–14 px; números maiores só quando forem o foco.
- Até três chips curtos por card. Não usar chips como substitutos de botões de ação.
- No computador, grade adaptável e listas densas quando elas forem mais adequadas; no celular, uma coluna, sem encolher tudo para caber.
- Oferecer densidade compacta e confortável se isso ajudar, preservando a preferência.

Um card inteligente deve mudar conforme a situação. Exemplos: consulta próxima mostra Preparar consulta; estoque baixo mostra Repor; documento incompleto mostra Conferir; item já registrado mostra a confirmação e o histórico. Não crie um índice de saúde, diagnóstico ou avaliação global sem metodologia válida e escopo apropriado.

Use os princípios de agrupamento e concisão como referência, sem copiar identidade ou código de terceiros: [NHS Cards](https://service-manual.nhs.uk/design-system/components/card).

## 5. Evolua tratamentos, uso e estoque

Mantenha separados: orientação prescrita, situação do tratamento, planejamento do uso, compra recebida, estoque e uso efetivamente registrado. Comprar não significa utilizar; estar prescrito não significa estar em uso.

Na tela de registro:

- Nome do medicamento e unidade sempre visíveis.
- Quantidade em destaque, sem assumir dose desconhecida.
- Data de hoje como conveniência e horário real; permitir informar uso passado confirmado, sem lançamentos futuros como realizados.
- Data, horário e observação em detalhes recolhíveis.
- Confirmação explícita quando um item ainda está A confirmar.
- Ação para desfazer/corrigir com trilha de histórico.
- Erro no próprio formulário, sem perder o que já foi preenchido.

Preserve o check diário simples quando o cadastro realmente representar o total por dia. Diferencie isso de medicamentos com várias tomadas. Se forem necessários horários individuais, modele ocorrências separadas e mantenha a quantidade e a frequência expressamente configuradas. Não converta cadastros antigos silenciosamente.

Permita diferenciar registrado, ainda sem registro, não utilizado e reagendado, quando aplicável. Ausência de registro não comprova que a pessoa deixou de usar. Registrar não utilizado não deve baixar estoque. Não conceda pontos ou recompensas por consumir medicamentos.

Estoque e reposição:

- Quantidade comprada e unidade reais; opção de completar a compra existente.
- Saldo conhecido, desconhecido e zerado apresentados de maneiras diferentes.
- Não permitir baixa maior que saldo conhecido sem corrigir os movimentos.
- Não misturar caixas, cápsulas, ampolas, mL e gramas sem conversão cadastrada e confirmada.
- Limite de reposição configurável por item.
- Se mantiver o aviso padrão de até três usos, explicá-lo e usar somente quantidade por uso confirmada.
- Previsão de duração apenas quando saldo, consumo e intervalo permitirem o cálculo; informar os pressupostos.
- Data estimada de acabar não é ordem de compra nem motivo para alterar uma prescrição.

Lembretes devem ser opcionais, configuráveis e discretos. Diferencie aviso dentro do painel, evento no calendário e notificação realmente entregue. Não prometa lembretes em segundo plano sem suporte validado. Use a distinção entre registro e lembrete como referência de experiência: [Apple Saúde](https://support.apple.com/en-ie/105064).

## 6. Faça a conferência de receitas e documentos ser completa

Crie um fluxo claro: selecionar documento → identificar tipo e data → ler ou transcrever → conferir itens → revisar diferenças → confirmar importação → consultar histórico.

Preserve o documento original completo, com leitura confortável, zoom e navegação de páginas. Vincule cada dado extraído ao documento e, quando possível, à página ou trecho de origem.

Mostre a cobertura: itens encontrados, cadastrados, já existentes, não reconhecidos e que pedem revisão. Não apresente a importação como concluída se houve itens descartados sem explicação.

Para cada campo, diferencie extraído, confirmado pelo usuário e não informado. Mantenha a orientação original além dos campos estruturados. Não transforme embalagem prescrita em quantidade efetivamente comprada; nem deduza início, adesão, frequência ou dose a partir de informação ambígua.

Organize documentos por tratamento, consulta, exame, tipo e data, com uma biblioteca transversal que reutilize os mesmos arquivos. Documentos antigos devem permanecer históricos até existir decisão explícita sobre seu uso atual.

Se houver necessidade de OCR ou IA, confirme primeiro a tecnologia disponível, suas limitações e onde os dados serão processados. Não envie documentos de saúde para um novo provedor sem autorização específica. Se não houver extração disponível, entregue anexação e transcrição assistida honestas, mantendo a dependência identificada.

## 7. Melhore exames e comparativos

Unifique a experiência de consulta e comparação, evitando listas redundantes sem propósito. Permita buscar marcador, filtrar período/coleta e abrir rapidamente o laudo que sustenta o resultado.

Cada resultado deve preservar nome original, valor, unidade, data da coleta, laboratório, referência do próprio laudo e situação documental. Diferencie coleta, emissão do documento e cadastro no sistema.

Compare apenas dados compatíveis. Não misture unidades, métodos ou contextos diferentes sem uma equivalência explícita e validada. Resultados qualitativos, limites como menor/maior que e casas decimais precisam manter seu significado.

Mostre datas reais de cada ponto, lacunas e quantidade de registros. Não calcule percentual com base zero; não invente tendência com um único ponto ou quando houver conflito de resultados.

Uma variação numérica não determina melhora ou piora clínica. Referência geral, referência do laudo e meta profissional são informações distintas; rotule sua origem e não substitua uma pela outra.

No celular, ofereça resumo por marcador e escolha dos dois resultados comparados. A tabela completa pode continuar disponível em uma região rolável identificada, com cabeçalhos e primeira coluna úteis, sem obrigar a usar uma matriz enorme para uma consulta simples.

## 8. Melhore medidas e sinais vitais

Disponibilize registro rápido com data, horário quando pertinente, unidade, fonte e observação. Diferencie medida digitada, extraída de laudo e recebida por integração.

Use os rótulos sistólica, diastólica e frequência cardíaca, acompanhados de explicação breve quando necessário. Trate ausência de medida de forma diferente de valor zero.

Mostre última medição com sua própria data, variação no período selecionado e histórico completo. Não combine silenciosamente medidas de datas diferentes para formar um indicador.

Cálculos derivados devem declarar fórmula, unidades e dados usados. Metas devem vir de cadastro explícito; a interface não deve recomendar emagrecimento, ganho de peso ou conduta clínica automaticamente.

Para composição corporal, preserve método, equipamento ou documento quando disponíveis, evitando comparar como equivalentes avaliações de contextos diferentes.

## 9. Una sintomas, consultas, retornos e fisioterapia

Organize uma linha do tempo por episódio ou acompanhamento, reutilizando os vínculos existentes.

Sintomas: início, localização, intensidade declarada, situação, fatores relatados e evolução. Resolvido deve arquivar no histórico, sem apagar.

Consultas: profissional, especialidade, data, situação, motivo, perguntas para levar, documentos associados, decisões registradas e retorno combinado. Uma consulta agendada não deve aparecer como realizada por passagem do tempo.

Inclua Preparar consulta com resumo selecionável do período, medicamentos confirmados, exames, sintomas e perguntas. O usuário revisa o conteúdo antes de exportar ou compartilhar.

Fisioterapia: sessões realizadas, número/total quando informado, profissional, atividades descritas, dor antes/depois e observações funcionais cadastradas. Permita acompanhar a série sem concluir automaticamente que uma oscilação de dor comprova eficácia.

Evite duplicar a mesma consulta porque ela aparece tanto na área geral quanto dentro de um tratamento. Vínculos devem apontar para o registro existente.

## 10. Evolua vacinas, prevenção, histórico familiar e emergência

Vacinas: preservar comprovante, dose, data, lote/local quando disponíveis e próxima data explicitamente informada. Diferenciar dose realizada, agendada e informação a confirmar. Não inventar calendários individuais.

Prevenção: distinguir sugestão educativa, acompanhamento recomendado por profissional e prazo confirmado. Regras clínicas devem ter fonte oficial, data de revisão e responsável pela validação. Um marcador isolado não deve comprovar um check-up completo sem critério documentado.

Histórico familiar: iniciar com campos não selecionados; registrar somente informações declaradas, mantendo origem e data da atualização. Não criar diagnósticos ou inferir risco individual automaticamente.

Ficha de emergência: apresentação rápida com dados revisados, alergias, medicamentos confirmados em uso, condições declaradas e contatos. Mostrar última atualização e informação não confirmada. Não confundir ausência de alergia cadastrada com declaração de que não há alergias.

Gerar PDF legível, com seleção do conteúdo e indicação de confidencialidade. Não tornar a ficha pública nem criar compartilhamento permanente sem autorização específica.

## 11. Torne gravação e sincronização confiáveis

Mapeie o caminho inteiro de cada registro e anexo. Diferencie:

- Alteração ainda não salva.
- Salvo neste dispositivo.
- Aguardando sincronização.
- Confirmado no servidor, com horário.
- Falha, conflito ou anexo pendente.

Só mostre Sincronizado após confirmação. A gravação de um registro não deve afirmar que seu anexo também foi enviado.

Em falha, preserve dados anteriores e preenchimento; permita tentar novamente sem duplicar. Use IDs estáveis, operação idempotente e recuperação coerente de estado. Faça a importação proteger tanto memória quanto armazenamento; não basta mostrar uma mensagem de erro após alterar os dados.

Verifique falta de espaço, rede indisponível, sessão expirada, anexos interrompidos, duas abas e dois dispositivos. Não resolva conflito sobrescrevendo todo o histórico silenciosamente. Registre correções e preserve a origem dos dados.

Reaproveite a arquitetura adequada. Caso a solução exija migração, explique a necessidade, faça backup e teste restauração antes de alterar dados reais. Não prometa capacidade ilimitada ou funcionamento offline que não tenha sido validado. Referência técnica: [MDN Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API/Using_the_Web_Storage_API).

## 12. Acessibilidade, privacidade e desempenho

Faça a interface ser compacta sem ficar difícil de ler ou tocar. Busque ações de toque com 44 px e respeite os critérios aplicáveis da WCAG 2.2; não apresente esse alvo de conforto como o mínimo obrigatório AA de 24 px.

Valide teclado, foco visível e não encoberto, leitura por tecnologia assistiva, zoom de 200%, reorganização em 320 CSS px e contraste AA. Cor deve sempre ter texto ou outro sinal equivalente. Todas as linhas clicáveis devem oferecer controle acessível real.

Cabeçalhos e ações fixos só podem ser usados se não cobrirem o conteúdo e o foco. Tabelas devem ter cabeçalhos corretos e alternativas adequadas ao uso no celular.

Proteja consultas, arquivos e exportações com autenticação e autorização efetivas. Dados de Saúde não devem aparecer em repositório público, telemetria, notificações abertas ou logs de diagnóstico. Não crie acesso de empregadores ou gestores empresariais a estes dados pessoais.

Carregue documentos e históricos extensos sob demanda, sem renderizar todas as áreas pesadas a cada interação. Exiba carregamento, vazio, erro e sucesso de forma consistente. Use comunicação simples e orientada à ação: [AHRQ](https://www.ahrq.gov/health-literacy/improve/precautions/index.html).

Referências de acessibilidade: [alvos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), [reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html), [foco](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) e [WCAG 2.2](https://www.w3.org/TR/WCAG22/).

## 13. Relatórios e qualidade dos dados

Disponibilize relatórios úteis de tratamentos, usos, estoque, exames comparados, evolução de medidas, consultas, vacinas e resumo para consulta. Preserve filtros e período; informe data de geração, unidade, fonte, lacunas e conteúdo selecionado. Não exporte dados adicionais sem necessidade.

Amplie a Qualidade dos dados para todas as áreas, com pendências agrupadas e ação direta para corrigir. Diferencie erro de consistência, possível duplicidade, informação ausente e questão a confirmar com o profissional. Evite repetir o mesmo alerta em vários lugares.

Não apague possíveis duplicatas automaticamente; mostre por que foram sinalizadas e permita revisar. Resultados diferentes na mesma data podem ser registros legítimos.

## 14. Valide jornadas completas e entregue para revisão

Organize a execução nesta ordem:

1. Confiabilidade, erros reproduzidos e preservação dos registros.
2. Navegação, cards e ações do dia a dia.
3. Documentos, acompanhamento e relatórios.
4. Recursos opcionais dependentes de provedores, com limitações explícitas.

Execute verificações relevantes, incluindo:

- Importação com falha de gravação, nova tentativa, recarga e ausência de duplicatas.
- Receita completa, item não reconhecido, documento antigo e revisão de transcrição.
- Primeiro uso ainda pendente, uso diário, múltiplas tomadas quando configuradas, desfazer e saldo desconhecido/baixo/zero.
- Tratamento pausado ou encerrado sem registros automáticos.
- Comparativo de exames com unidades diferentes, base zero, resultado qualitativo, duplicidade e coleta ausente.
- Medida com unidade errada, datas futuras e fonte não informada.
- Queixa ligada a consulta e fisioterapia, reagendamento, cancelamento e histórico preservado.
- Vacina sem comprovante ou próxima data, prevenção não confirmada e histórico familiar em branco.
- Ficha de emergência e PDFs com conteúdo e permissões corretos.
- Falta de espaço, falha de anexos, sessão expirada, duas abas e dois dispositivos autorizados.
- Computador, celular, teclado, zoom, estados vazios e conjuntos grandes de dados fictícios.

Compare os totais dos cards com os registros que os compõem e abra esses registros a partir dos indicadores. Teste também o comportamento que falhava originalmente; não use apenas testes que espelham o código novo.

Ao concluir, mostre o que existia, o que mudou, o que foi testado e quais limitações permanecem. Entregue a prévia, capturas das principais telas e a ordem de revisão. Não declare integração, notificação, sincronização ou acessibilidade validada sem evidência.

Prepare para revisão. **Publicação, migração de dados reais e ativação de serviços externos dependem de autorização específica.**

Resultado esperado: em poucos segundos eu entendo o que precisa de atenção; em poucos passos consigo registrar; consigo confiar na origem e no estado dos dados; e encontro todos os detalhes e documentos quando preciso, com uma interface compacta, legível e organizada.
