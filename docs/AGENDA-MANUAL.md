# Gmail e Google Agenda: uso manual

Escolha final do usuário: executar somente ao apertar os botões na Agenda.

1. **Conectar Gmail e buscar datas**: procura convites, vencimentos, renovações e compromissos nos últimos 90 dias. E-mails com texto são analisados por regras de datas; PDFs e imagens não são interpretados.
2. **Revisar e importar**: todos os itens começam desmarcados. Confira/corrija datas detectadas no texto e selecione o que trazer. Datas incompletas precisam ser preenchidas. Não cria lançamentos financeiros nem executa pagamentos.
3. **Enviar selecionados ao Google Agenda**: nova seleção e autorização Google para criar/atualizar os lembretes. Calendário próprio `Central do Léo · Gmail`, avisos 1 dia e 1 hora antes. Notificações dependem das permissões do aparelho. Em eventos sem horário, o início é meia-noite. Reenvio usa ID estável.

Credenciais Google permanecem apenas na sessão do navegador. Não precisa configurar segredo OAuth no servidor. O acesso expira e pode exigir reconexão.

A função de sincronização contínua não foi publicada. O agendamento preparatório do Supabase está desativado e sua configuração tem `enabled=false`. As tabelas preparatórias permanecem vazias e protegidas, sem tokens Google. Nenhum e-mail real foi lido ou evento real criado na verificação.

Verificações: 129 testes, incluindo preenchimento obrigatório de data incompleta, seleção manual, criação e reenvio idempotente ao Google com APIs simuladas. A conexão e as notificações reais dependem da autorização do usuário no navegador.
