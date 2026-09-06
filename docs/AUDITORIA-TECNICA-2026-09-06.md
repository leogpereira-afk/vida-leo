# Auditoria técnica — 06/09/2026

Escopo: Central do Léo, 15 módulos internos, componentes compartilhados, leitor de planilhas, sincronização `leo-sync`, anexos, testes e publicação. Sistemas externos ligados por atalhos não fazem parte desta entrega. Dados pessoais, cópias da base e achados com nomes/valores ficaram fora do repositório público.

## Correções e evidências

| Área | Correção | Verificação |
|---|---|---|
| Histórico de rendimentos | Agregação em uma passagem por ano/empresa. Anos textuais são normalizados; nomes especiais não alteram o protótipo do acumulador. | Totais anteriores comparados com os novos; caso de nome especial e histórico legado. |
| Cache | A versão local avança mesmo em duas edições no mesmo milissegundo; histórico confere também a identidade do estado. | Testes de versões e agregação. |
| Sincronização | Uma leitura não autoriza sobrescrever uma base concorrente. Respostas de leitura anteriores a um envio concluído são ignoradas. | Simulações de conflito e resposta atrasada. |
| Status | Edições feitas durante um envio continuam identificadas como pendentes. | Revisão do ciclo de envio e testes de serialização. |
| Servidor | Recusa estado sem estrutura mínima e base inválida; a versão avança mesmo com relógio atrás da base. | Testes do handler com requisições reais em memória e banco simulado. |
| Recuperação | Versão descartada usa o mesmo fluxo validado de restauração e confirmação de envio. Listas internas malformadas são recusadas antes da troca. | Testes de backup, sucesso/falha de envio e dados internos inválidos. |
| Anexos | Sem índice remoto confiável, não apaga o registro pai. Falha de remoção no Storage preserva o índice. | Falhas de rede/Storage simuladas. |
| Anexos | Lista paginada, com ordenação estável, ultrapassa 1.000 arquivos. | Teste com 1.001 registros. |
| Anexos ativos | HTML/SVG e demais formatos fora da lista de prévia ficam disponíveis para download; prévias de PDF/imagens não mantêm `opener`. | Teste dos controles de arquivo HTML/SVG. |
| Obras | Imposto/comissão efetivamente zerados no livro-caixa prevalecem sobre valor manual. TIR com data inválida retorna ausência de cálculo. | Testes de imposto zerado e fluxo inválido. |
| ERP | Validação de valores/datas antes de alterar fichas; reimportação atualiza aporte existente e preserva ID/observação. Ficha deve sincronizar antes de enviar custos. | Reimportação, arquivo inválido e falha de sincronização simulados. |
| XLSX/XLSM | Células são lidas independentemente da ordem dos atributos XML. Verificação de CRC, truncamento, compressão e limite de descompactação. | ZIP íntegro/corrompido/truncado; XLSM original também lido localmente. |
| Patrimonial | Reservas com zero são preservadas; leitura ultrapassa a antiga linha 60. Datas de posição aceitam formato textual ou serial válido. Valores inválidos de contas interrompem a importação. | Leitura do arquivo original e casos de números/datas. |
| Caixa e VGV | Migração separa configuração antiga de tipos bancários e tipos de capital, sem reclassificar lançamentos. | Teste com configuração legada e categoria personalizada. |
| Conferência | Inspeção recursiva alcança hotéis e demais listas internas; reconhece mais datas e campos monetários. Exames aceitam vírgula e resultado textual. | Casos de listas internas, áreas textuais, datas inválidas e resultados de exames. |
| Saúde | Textos identificam faixas como referências cadastradas, sem atribuí-las ao laudo do laboratório. | Revisão da apresentação; faixas clínicas não foram recalibradas. |
| Publicação | Instalação pelo arquivo de versões e suíte obrigatória antes de publicar no Pages. | Execução local e execução no GitHub Actions na publicação. |

## Desempenho

Ensaio local com 20.000 lançamentos fictícios, 160 empresas e 16 anos, forçando o recálculo de `histVivo`: aproximadamente 6.707 ms antes e 17 ms após a alteração. É uma medição do cálculo isolado em Node, não uma medição de tempo de abertura do site, rede, Safari ou dispositivos diferentes. A comparação de totais anuais e por empresa preservou os resultados da base analisada.

## Cobertura

- 166 testes: lógica, montagem dos 15 módulos vazios/preenchidos, navegação de cartões, importações, backups, cálculos, Google manual e handler do servidor com serviços simulados.
- Navegação pelo navegador nos 15 módulos em 1280 × 900 e 390 × 844, com uma cópia local dos dados. Sem transbordamento horizontal da página, alertas de falha de renderização ou erros de console nos percursos realizados.
- Campos textuais receberam marcação de teste em uma cópia local, sem criar elementos HTML inesperados nos 15 módulos.
- Auditoria de dependências do lockfile: nenhuma vulnerabilidade reportada pelo registro consultado nesta data.
- Inventário de fontes, configurações e testes; revisão orientada a entradas, cálculos, efeitos colaterais e persistência. Contagem de linhas não significa cobertura integral de execução ou certificação de cada caminho possível.

## Limitações e evolução

- OAuth e APIs reais de Gmail/Agenda não receberam novas autorizações nem eventos de teste. Os fluxos foram verificados por simulação.
- Não foram executadas exclusões, restaurações destrutivas nem conflitos entre aparelhos reais em produção. O comportamento foi reproduzido em testes isolados.
- A importação do ERP permanece por lotes. Falha após lotes já gravados exige reenvio; a identidade das parcelas torna o reenvio idempotente. Não há transação única entre ficha e todos os lotes.
- Nomes semelhantes não comprovam duplicidade. Alertas de possíveis duplicidades e natureza de dívida exigem conferência documental antes de excluir ou reclassificar.
- Valores e prazos foram verificados estruturalmente e nos cálculos do sistema, não conciliados integralmente com bancos, contratos ou laudos. Não é validação clínica nem auditoria contábil externa.
- Sincronização mantém o modelo de estado completo e cópia descartada em conflito; não realiza fusão automática por registro. Uma evolução independente seria versionar entidades.
- Não foi feita certificação WCAG, teste de invasão completo nem auditoria dos sistemas externos ou de todos os serviços compartilhados do projeto Supabase.
