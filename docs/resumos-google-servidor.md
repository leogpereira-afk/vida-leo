# Gmail e Drive em segundo plano

Rotina `resumosSincronizarCron` a cada cinco minutos, em minutos deslocados da
agenda, usando exclusivamente a autorização de leitura já concedida ao Google.
Servidor primeiro; depois aplicar a migração de agendamento e publicar a interface.

O cache privado `leo_config/inicio_google_cache` fica fora de `leo_estado`, dos
backups exportados pela Central, do localStorage e do repositório. Guarda até
quatro e-mails (ID, assunto, remetente, data, indicação de não lido) e quatro pastas
da raiz do Meu Drive, ordenadas por nome, mantendo o comportamento dos atalhos.
Não copia corpo, snippet, anexos nem conteúdo dos arquivos.

Leitura pela ação autenticada `googleResumoInicio`, com verificação da conexão e
escopo de cada serviço. Desconectar limpa o cache. Coleta não reativa conexão
alterada durante a consulta. Falhas independentes conservam última leitura com
aviso; recusa 401/403 elimina aquele resumo. Timestamp acima de dez minutos é
marcado como desatualizado. Botão atualizar relê o cache; coleta periódica acontece
no servidor, sem navegador. Dados só atualizam enquanto a autorização for válida.

Segredo exclusivo `resumos_cron_token`; a rotina não aceita URLs, conta ou filtros
vindos do corpo do pedido. Nenhum envio/alteração de mensagem ou arquivo.
Desativação: cron.alter_job do job `leo-resumos-google-5min`, sem excluir dados.
