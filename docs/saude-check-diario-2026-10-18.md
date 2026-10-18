# Saúde: confirmação do uso e check diário

Pedido do dono em 18/10/2026: corrigir bloqueio ao registrar uso e permitir identificar uso diário com marcação simples. Implementação local, sem publicação e sem alteração de registros reais.

Causa reproduzida: a ação Registrar uso abria o formulário de um item A confirmar, mas a validação exigia Em andamento apenas ao salvar. Agora o próprio formulário oferece uma confirmação explícita de que o medicamento está em uso. A confirmação e o lançamento são gravados juntos; erro de validação ou persistência reverte ambos. Pausados e encerrados continuam exigindo revisão da situação em Editar.

Editar medicamento inclui Uso diário. Ao selecionar, o intervalo fica em um dia; a quantidade continua sendo a informada pelo usuário. Intervalos de um dia já cadastrados são reconhecidos, sem interpretar texto de receita ou inventar dose. A ficha oferece Usei hoje quando o tratamento está ativo e tem unidade e quantidade cadastradas. A marcação cria um registro auditável com hora real e consumo confirmado. Havendo registro ativo no dia, mostra Uso registrado hoje e bloqueia repetição. Desfazer pelo histórico mantém a trilha anterior e devolve o estoque.

A função de formulário passou a ler checkbox como booleano e tratar campos vazios sem erro de trim. Nenhum dado clínico ou status foi confirmado automaticamente. Esta alteração usa a persistência e sincronização já existentes; a confirmação em outro aparelho não foi testada em produção.

Verificação: sete testes novos; os seis primeiros foram escritos antes da implementação e falharam pela ausência do fluxo e do check, incluindo o erro da imagem, configuração, consumo, duplicação, estoque, falha ao salvar, desfazer e retomada por serialização. Suíte completa: 1.278 testes, zero falhas. Sintaxe JS e diff conferidos. Navegador local com dados fictícios: primeiro uso sem confirmação recusado, confirmação permitiu gravar, check registrou o dia e baixou a quantidade correta. Sem erros JavaScript. Em 390 px, largura de conteúdo 390 px, sem transbordamento.

Prévia local: http://127.0.0.1:5502/preview-saude-check.html. O arquivo de prévia está ignorado pelo Git.
