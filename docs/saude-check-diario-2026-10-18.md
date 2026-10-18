# Saúde: confirmação do uso e check diário

Pedido do dono em 18/10/2026: corrigir bloqueio ao registrar uso e permitir identificar uso diário com marcação simples. Implementação local, sem publicação e sem alteração de registros reais.

Causa reproduzida: a ação Registrar uso abria o formulário de um item A confirmar, mas a validação exigia Em andamento apenas ao salvar. Agora o próprio formulário oferece uma confirmação explícita de que o medicamento está em uso. A confirmação e o lançamento são gravados juntos; erro de validação ou persistência reverte ambos. Pausados e encerrados continuam exigindo revisão da situação em Editar.

Editar medicamento inclui Uso diário. Ao selecionar, o intervalo fica em um dia; a quantidade continua sendo a informada pelo usuário. Intervalos de um dia já cadastrados são reconhecidos, sem interpretar texto de receita ou inventar dose. A ficha oferece Usei hoje quando o tratamento está ativo e tem unidade e quantidade cadastradas. A marcação cria um registro auditável com hora real e consumo confirmado. Havendo registro ativo no dia, mostra Uso registrado hoje e bloqueia repetição. Desfazer pelo histórico mantém a trilha anterior e devolve o estoque.

A função de formulário passou a ler checkbox como booleano e tratar campos vazios sem erro de trim. Nenhum dado clínico ou status foi confirmado automaticamente. Esta alteração usa a persistência e sincronização já existentes; a confirmação em outro aparelho não foi testada em produção.

Verificação: sete testes novos; os seis primeiros foram escritos antes da implementação e falharam pela ausência do fluxo e do check, incluindo o erro da imagem, configuração, consumo, duplicação, estoque, falha ao salvar, desfazer e retomada por serialização. Suíte completa: 1.278 testes, zero falhas. Sintaxe JS e diff conferidos. Navegador local com dados fictícios: primeiro uso sem confirmação recusado, confirmação permitiu gravar, check registrou o dia e baixou a quantidade correta. Sem erros JavaScript. Em 390 px, largura de conteúdo 390 px, sem transbordamento.

Prévia local: http://127.0.0.1:5502/preview-saude-check.html. O arquivo de prévia está ignorado pelo Git.

## Registro direto e reposição

A ficha agora contém formulário de Registrar uso com quantidade visível. Data, horário e observação ficam em detalhes recolhíveis. O horário vazio usa a hora real no momento do registro; datas anteriores podem ser informadas. A confirmação de item pendente fica no mesmo formulário. Unidades ausentes e situações pausadas/encerradas explicam o bloqueio antes da gravação. Falha de gravação mantém os campos e reverte a alteração.

O alerta diferencia saldo desconhecido, falta de estoque e reposição próxima. Usa o limite configurado; quando ausente, alerta em até três usos completos pela quantidade cadastrada, explicando essa regra. Sem quantidade por uso, não inventa previsão. O indicador da lista e o filtro Compras usam a mesma regra. Para compra sem quantidade, o atalho abre o registro existente para completar, preservando seu vínculo.

Cinco testes adicionais verificam formulário direto, confirmação, limite de reposição, compra incompleta e falha de persistência. Verificação completa final: 1.283 testes, zero falhas; sintaxe JS e git diff --check sem erros. Navegador com dados fictícios: primeira tentativa sem confirmação recusada, confirmação e consumo gravados juntos, alerta acionado ao atingir três usos, sem janela modal e sem erro JavaScript. Em 390 px, conteúdo de 390 px, sem rolagem lateral; formulário legível e ação acessível.

A conferência de documentos e registros reais está exclusivamente fora do repositório público. Não houve atualização de tratamentos reais nem publicação. Nenhum envio externo de lembrete foi configurado.

## Atalho junto às ações principais

A pedido do dono, Registrar uso voltou à barra superior da ficha, entre Compra e Evolução. O botão coloca o foco na quantidade do formulário direto, sem abrir janela nem gravar um uso automaticamente. Verificação desta alteração: 45 testes relacionados passaram, sintaxe e diff sem erros; clique conferido no navegador e em 390 px, com foco na quantidade, sem rolagem lateral ou erro JavaScript. Continua local, sem publicação.

## Posição final solicitada: ao lado de Visão geral

O atalho Registrar uso foi movido da barra da ficha para a navegação do tratamento, imediatamente depois de Visão geral. Ele abre Itens prescritos e foca a quantidade do item selecionado ou de um medicamento disponível. Remove filtros que poderiam ocultar o formulário e não grava uso ao clicar. Tratamentos sem item apropriado mostram o botão desabilitado. Verificação: 89 testes de Saúde passaram; sintaxe e diff conferidos; clique partindo da Visão geral e foco no campo testados no navegador e em 390 px, sem rolagem lateral. Continua sem publicação.
