# Central do Léo — revisão de 12/09/2026

Revisão do código, navegação, apresentação e entradas das 15 áreas da Central. Mantidos a logomarca, as cores, os cadastros, os históricos, as integrações por confirmação e a leitura vertical das análises pessoais.

## O que mudou por área

| Área | Leitura e funcionamento |
|---|---|
| Início | Prioridades sempre visíveis, filtros por prazo, próximos compromissos e viagem próximos do topo; indicadores compactos; aniversário de hoje corrigido; viagens sobrepostas não duplicam dias; peso futuro não vira peso atual. |
| Rendimentos | Lista completa ao escolher todos os anos; pesquisa com contagem e subtotal; histórico separado do resumo; entrada no topo e formulário com Salvar/Cancelar. |
| Gastos | Pesquisa nos lançamentos; repetição do mês com seleção inicialmente desmarcada e total antes de incluir; estornos sem percentuais inválidos; proteção de comprovantes ao excluir. |
| Patrimônio | Busca e filtros por tipo e situação, incluindo a carteira atual; totais identificam o recorte; vendidos permanecem no histórico; data da avaliação e prévia do saldo na edição. |
| Caixa e VGV | Fonte e datas das posições em destaque; pesquisa nas quatro listas e inclusão orientada; fórmulas, 12 indicadores, planilha de origem, importação e alternativa manual preservados. |
| Viagens | Próximas e em andamento primeiro; pesquisa; períodos que atravessam anos aparecem nos dois recortes; filtros e totais coerentes; inclusão guiada. |
| Agenda | Calendário no topo; clique em dia vazio permite incluir; períodos longos; ligação direta aos registros de origem; importação de calendário com revisão. Gmail permanece por ação manual e aprovação. |
| Demandas | Topo e controles compactos; prioridades, prazos e próximos passos; inclusão guiada; tempo médio somente com datas de conclusão informadas. |
| Saúde | Última medição e último resultado preenchido, com data e unidade; exame aguardando não substitui resultado anterior; dados numéricos não são inferidos de texto inválido; ficha de emergência não leva patrimônio, contas ou PIX. |
| Planejamento estratégico | Empresa e ano a partir de 2027; fila de revisão; acesso ao objetivo correto; resultados acrescentados ao histórico e ao PDF; contas vinculadas pela empresa, não apenas pelo banco. |
| Fortemais | Busca de obras; ano definido pelo fim do recebimento; comparação respeita o mesmo filtro da lista; nova obra exige identificação antes de incluir. |
| Oportunidades | Avaliações incompletas identificadas e fora do ranking comparável; próximos passos visíveis; reenviar o mesmo passo à Agenda não duplica nem sobrescreve evento editado. |
| Documentos | Lista compacta, filtros de dono/validade e busca; cadastro guiado; nomes personalizados preservados; data inválida não aparece como documento em dia. |
| Guia e desenvolvimento | Próximos passos das metas; criação confirmada de pessoa, meta, ritual e ideia; conexão entre análise, prática e resultado; DISC, liderança, análises anteriores e resultados completos em sequência vertical. |
| Configurações | Busca dos assuntos; renomeação de empresa centralizada, com preservação de vínculos; bloqueio da exclusão de empresa com dados; opção Encerrar preserva o histórico. |

## Proteção na entrada e nas conexões

- Novas entradas são rascunhos até confirmar. Cancelar não cria uma linha vazia.
- Moeda inválida é sinalizada, sem substituir silenciosamente o valor por zero.
- Formulários desatualizados não confirmam uma inclusão em uma lista antiga.
- Exclusão de recorrências aguarda a remoção dos anexos da referência correta.
- Renomear uma empresa reconecta o cadastro, o planejamento, bancos, obras e rendimentos, preservando IDs e resultados. Junções ambíguas continuam exigindo revisão dos dados.
- A busca inclui indicadores, ações e resultados estratégicos, análises, habilidades e evidências pessoais.
- A adoção de atualização de outro aparelho libera corretamente a navegação e oferece recuperação local dos textos de formulários; não reaplica rascunhos automaticamente.
- Importação manual de calendário considera fuso e o fim exclusivo dos eventos de dia inteiro; itens ficam desmarcados para aprovação. A exportação preserva duração, UID, períodos de vários dias, horários editados e textos completos. Eventos com data ou período inválido são identificados antes de gerar o arquivo, evitando exportação parcial silenciosa.

## Verificação

Suíte final: **408 testes passaram, nenhuma falha e nenhum teste ignorado**. São 159 testes novos além dos 249 existentes. Revisão independente financeira: 69 testes direcionados e duas verificações adicionais por eventos reais dos campos, preservando dados, versões e vínculos.

Os testes automatizados incluem renderização das 15 áreas, identificação dos campos, navegação por teclado, dados vazios/preenchidos, filtros e totais, cancelamento e confirmação, histórico/PDF, valores inválidos, anexos simulados, renomeação e conflitos entre versões.

No navegador, as 15 áreas foram abertas em 1440 px e 390 px sem erro de carregamento ou rolagem horizontal da página. Foram inspecionados os formulários, a sequência contínua de resultados e o planejamento; corrigidos espaçamento de formulário e excesso de controles encontrados nessa inspeção. O teste visual de gasto inválido manteve o formulário aberto com explicação; Cancelar preservou a contagem anterior e liberou a navegação. Em Resultados, as quatro áreas permaneceram na mesma sequência, sem seções recolhidas.

## Limites da revisão

A validação funcional usa registros de teste isolados. Não foram excluídos cadastros reais, alterado o banco de dados nem disparadas importações Gmail/Google ou mensagens. A conferência do código não comprova a exatidão de cada valor ou documento pessoal; informações sem evidência permanecem para revisão do dono. Integrações externas continuam dependendo de sessão, autorização e disponibilidade do serviço.
