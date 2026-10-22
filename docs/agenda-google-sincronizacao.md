# Agenda Google → Central

A agenda principal é consultada ao abrir a Central e a cada cinco minutos enquanto a página está aberta, além do retorno à janela e do botão Atualizar agenda agora. Não é uma tarefa de servidor com o navegador fechado. Exige autorização Google de leitura e sessão válida da Central. Não escreve no Google, não altera convidados nem envia convites.

## Identidade e preservação

- Calendário + ID de evento identificam cada ocorrência. `primary` é normalizado para o ID retornado pela API. Não unir por nome, horário ou local.
- Novos eventos da principal entram na janela de sete dias passados a doze meses futuros. Calendários secundários só atualizam vínculos anteriormente importados.
- Todos os vínculos existentes ausentes da listagem são consultados individualmente, inclusive históricos. Ausência, 404, erro de rede ou permissão nunca viram cancelamento por inferência: o registro é preservado e a pendência fica visível.
- Cancelamento explícito ou recusa do próprio usuário arquiva a cópia. Cópias locais do mesmo ID também são arquivadas. O histórico guarda o registro inteiro, com ID, observações, referências de arquivos e campos antigos.
- Atualização mantém o ID local, as observações, o tipo e demais campos locais. Dados Google e descrição ficam em campos próprios; a ficha mostra a descrição como texto seguro e permite abrir a origem.
- Retirada manual pela ação de excluir compromisso gera uma marca no histórico para impedir reimportação automática daquela ocorrência.
- Histórico consultável e exportável na Agenda. Não apaga arquivos vinculados. A exportação completa da Central inclui o histórico.

## Concorrência e falhas

Consulta paginada, até 5.000 eventos por calendário. Falha na listagem aborta o plano, sem aplicação parcial. Falhas individuais preservam o vínculo e sinalizam pendências. Aplica somente se o estado local e a base remota permanecerem iguais desde o início e não houver formulário/modal em edição. A gravação usa o CAS existente; só anuncia confirmação após envio à nuvem.

A autorização nesta revisão é para atualização automática da Central pelo Google. Gmail permanece revisão manual. A sincronização de saúde, viagens e demais áreas não é modificada.

## Validação

`tests/agenda-google-sync.mjs` cobre cancelamentos sem data, preservação integral, atualização de descrições e notas locais, idempotência, recorrências diferentes, aliases de calendário, duplicatas pelo mesmo ID, exclusão local, paginação, falhas parciais, concorrência e conteúdo não executável.

Publicação pelo workflow de Pages (site estático, sem etapa de compilação). Dados reais e backups ficam fora do repositório público.
