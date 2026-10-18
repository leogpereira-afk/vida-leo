# Cópia mensal dos investimentos

Implementação autorizada pelo dono em 18/10/2026, incluindo a alteração deste repositório sem AGENTS.md. Publicação ainda não solicitada para esta mudança.

Na visão Lançamentos de Rendimentos, agrupada por Mês, cada mês com registros do tipo Investimento ou Investimentos oferece o botão Copiar investimentos para o mês seguinte. Respeita o recorte visível e inclui todas as páginas dele. A janela apresenta empresa, instituição, tipo, observações e data ajustada; somente valores são editáveis. Campos obrigatórios e não nulos seguem a validação financeira existente.

A confirmação valida o lote inteiro antes de criar IDs novos e chamar a gravação existente. Preserva o dia quando possível, ajustando ao último dia disponível no mês seguinte. Dezembro avança o ano. Após salvar, abre o mês de destino. Cancelar não altera registros. Comprovantes, IDs e estados do registro anterior não são copiados.

O vínculo copiadoDeId permite ignorar cópias já presentes no mês de destino na lista carregada. A confirmação verifica novamente se a fonte foi modificada ou removida. Falha síncrona de armazenamento reverte as inclusões e permite tentar novamente, preservando o formulário. Usa a sincronização atual da Central; não cria um novo contrato de servidor ou garantia adicional de concorrência entre aparelhos.

Verificação: cinco testes de comportamento foram escritos primeiro e falharam por ausência do botão; passaram após a implementação. Suíte completa: 1.271 testes aprovados, zero falhas. Sintaxe e git diff --check aprovados. Navegador com dados fictícios: abrir, preencher, confirmar e apresentar outubro; sem erros JavaScript. Em 390 px, formulário com largura 374 px, sem transbordamento horizontal. Nenhuma escrita em produção.

Prévia local ignorada pelo Git: http://127.0.0.1:5501/preview-copia.html. Não incluir a prévia nem dados reais na publicação.
