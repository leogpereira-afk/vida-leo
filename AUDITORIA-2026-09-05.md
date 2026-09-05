# Central do Léo — auditoria e melhorias

Data: 05/09/2026. Publicação autorizada pelo usuário após a revisão da prévia local.

## Resultado

Revisão da interface das 15 telas internas em computador (1280 px) e celular (390 px), revisão dos componentes compartilhados, cálculos do início, exportação da agenda, restauração e sincronização, formulários e validação de sessão. Foram aplicadas as correções abaixo e criados 18 testes automatizados. Os dados de produção não foram editados. Os testes de edição usaram um bem fictício apenas na prévia local.

## Organização e layout

| Item | Alteração |
|---|---|
| Navegação no computador | Busca no topo, indicação da página atual e grupos preservados. |
| Navegação no celular | Menu expansível em duas colunas; fecha após escolher uma tela; status de sincronização sempre visível. |
| Ferramentas | Backup, restauração, arquivos, impressão e saída agrupados em uma área recolhível. |
| Início | Seis indicadores em grade equilibrada, com links para as respectivas telas. |
| Indicadores gerais | Melhor adaptação à largura, valores com quebra controlada e hierarquia entre título, valor e legenda. |
| Títulos e cartões | Espaçamentos, bordas, tipografia e sombras padronizados. |
| Tabelas | Rolagem horizontal dentro do quadro, células mais legíveis e controles maiores. |
| Configurações | Assuntos inicialmente recolhidos quando ainda não há preferência salva; botão para abrir/recolher todos. |
| Formulários | Rótulos associados aos campos; campos monetários aceitam edição decimal normal, colagem e valores negativos. |
| Janelas | Foco contido, fechamento por Escape, botão nomeado, recuperação do foco e limpeza de eventos. |
| Teclado | Link para pular a navegação, foco visível, cabeçalhos e indicadores acionáveis por Enter/Espaço. Dias com eventos também recebem operação por teclado. |
| Preferências visuais | Ajustes para tema escuro, redução de movimento e impressão. |

## Bugs corrigidos e evidências

| Prioridade | Problema | Correção e verificação |
|---|---|---|
| Alta | Restauração anunciava sucesso mesmo com erro de envio. | Envio retorna resultado explícito; restaurações e reinicialização conferem esse resultado. Testes de falha, sucesso e conflito. |
| Alta | Envios sobrepostos na mesma aba podiam disputar a versão remota. | Envios serializados. Teste com três chamadas concorrentes confirma somente um envio ativo. A trava entre aparelhos foi preservada. |
| Alta | Recomeçar limpava anexos locais, apesar de prometer preservá-los. | Removida a limpeza do IndexedDB nessa ação. Revisão do código; ação destrutiva não executada em produção. |
| Alta | Backup malformado podia substituir o estado antes de quebrar a leitura. | Validação estrutural antes da troca. Testes cobrem lista inválida e lista legítima de exclusões de custo. |
| Alta | Validador de sessão aceitava token assinado sem expiração. | Expiração numérica, finita e futura obrigatória. Quatro testes com assinaturas fictícias verificam validade, expiração, ausência da expiração e outro sistema. Correção implantada no servidor como versão 55. |
| Média | Data mudava para o dia seguinte depois das 21h em São Paulo. | Data baseada no calendário local. Teste às 23h30. |
| Média | Gráfico repetia meses quando aberto no dia 31. | Primeiro dia do mês definido antes de recuar meses. Teste de março a agosto. |
| Média | “Ganhos x gastos” exibia apenas a diferença. | Título alterado para “Saldo mensal”, explicando ganhos menos gastos registrados. |
| Média | Indicador anual de viagens somava todos os anos. | Filtra viagens que intersectam o ano, exclui canceladas e limita os dias ao intervalo anual. Revisão do cálculo. |
| Média | Datas invertidas ainda produziam um dia de viagem. | Intervalos invertidos retornam zero. Teste automatizado. |
| Média | Pesagem em branco aparecia como peso atual sem número. | Início considera somente registros com peso positivo. Revisão do filtro. |
| Média | Contas bancárias usavam tipos de caixa, como cheque e permuta. | Listas independentes e edição separada nas configurações; valores antigos permanecem nas opções dos registros. Teste da lista bancária. |
| Média | Texto editado no formulário não persistiu no teste de interação. | Gravação também no evento de entrada; campo ativo perde foco antes do fechamento para concluir a edição. Repetição confirmou persistência após recarregar. |
| Média | Eventos de dia inteiro tinham início e fim na mesma data. | Fim no próximo dia. Teste do arquivo ICS gerado. |
| Média | Evento às 23h30 era exportado com fim às 00h30 do mesmo dia. | Cálculo de término com avanço de data. Teste do arquivo ICS gerado. |
| Média | Listeners de Escape sobreviviam ao fechamento por botão. | Remoção no fechamento e proteção contra fechamento duplicado. Testada sequência abrir, fechar, reabrir e Escape. |
| Média | Link de oportunidade podia usar protocolo executável. | Somente HTTP e HTTPS são aceitos. Teste rejeita `javascript:`. |
| Média | Falha de rede no login aparecia como senha incorreta. | Erro de conexão separado, botão bloqueado durante a tentativa e campos obrigatórios. Revisão do código. |
| Baixa | PDF abria os quadros e mudava a interface. | Expansão restrita às regras de impressão. Revisão do código e CSS. |
| Baixa | Exclusão de linha podia usar posição inadequada se a referência não existisse. | Remove somente o objeto encontrado e exige confirmação. Revisão do código. |
| Baixa | Resposta atrasada das configurações podia completar outra tela. | Verifica se Configurações continua ativa após aguardar os arquivos. Revisão do código. |

## Cobertura por tela

Todas as telas abaixo abriram no navegador, com estados locais, em 1280 e 390 px, sem transbordamento horizontal da página nos estados observados. Isso não certifica todos os possíveis conteúdos, importações ou volumes de dados.

| Tela | Verificação adicional / mudança específica |
|---|---|
| Início | Grade, atalhos, data local, peso e período anual; gráfico de saldo. |
| Rendimentos | Abertura, controles compartilhados, filtros e tabelas. |
| Gastos | Abertura, indicadores e controles compartilhados. |
| Patrimônio | Cadastro fictício, edição de nome e valores, persistência após recarregar. R$ 1.234,56 menos R$ 234,56 resultou em R$ 1.000,00. |
| Caixa e VGV | Abertura, resumo, separação da lista de tipos em relação aos bancos. |
| Viagens | Abertura e duração de intervalos. |
| Agenda | Abertura, calendário e exportação ICS nos dois casos de borda. |
| Demandas | Abertura, filtros e componentes compartilhados. |
| Saúde | Abertura e origem do peso no início. |
| Gestão estratégica | Abertura e disposição das áreas. |
| Fortemais | Abertura local e revisão da preservação dos anexos. Importação do ERP não executada. |
| Oportunidades | Abertura e bloqueio de protocolos de link inadequados. |
| Documentos | Abertura e componentes compartilhados. |
| Guia de vida | Abertura e correção da lista de contas bancárias. |
| Configurações | Organização dos assuntos, listas, campos, backup e sessão. |

Busca: encontrou o registro fictício por “auditoria”. Tab permaneceu na janela; Escape removeu a janela após reabertura. Não foram registrados erros de console durante a navegação local observada.

## Limites reais e consultoria final de bugs

1. **Validar em ambiente de homologação antes da publicação:** login real, expiração e renovação de sessão, restauração com servidor e conflitos entre dois aparelhos. Os testes automatizados de envio usaram respostas simuladas; não houve escrita no banco de produção.
2. **Integrações:** Gmail/OAuth, importação de ERP/XLSX, anexos remotos, backups históricos e administração de acessos dependem de serviços e dados específicos. Não foram executados de ponta a ponta. Portal dos Bosques e Painel da Impresilk são sistemas externos, não fazem parte das 15 telas auditadas.
3. **Calendário importado:** o importador atual é simples. Fusos horários, recorrências, exceções e reimportação de alterações ainda precisam de uma revisão específica com arquivos de exemplo. Não considerar o fluxo equivalente a sincronização completa com Google Agenda.
4. **Sincronização:** permanece o modelo de estado inteiro e resolução de conflito com uma cópia descartada. Para preservar edições simultâneas com menos retrabalho, a evolução recomendada é versionamento por registro. A serialização adicionada resolve a concorrência de envios dentro da mesma aba; não faz fusão automática entre usuários/aparelhos.
5. **Acessibilidade:** componentes compartilhados foram melhorados. Ainda é necessária auditoria integral com leitor de tela, contraste de todas as cores dinâmicas e operações com dados em todos os componentes feitos manualmente. Não há declaração de conformidade WCAG.
6. **Desempenho e manutenção:** o aplicativo concentra aproximadamente 9 mil linhas em um HTML. Os refinamentos visuais ficaram em arquivo separado, mas a separação dos módulos e ensaios com grandes volumes ficam para uma próxima etapa. Não foram feitas medições de Lighthouse ou carga.
7. **Segurança do serviço:** a assinatura/expiração foi testada isoladamente. Não foi executado teste de invasão, revisão completa das permissões do projeto compartilhado ou validação das políticas implantadas. O código SQL versionado habilita RLS em `leo_estado`; isso não prova a configuração vigente do servidor.

## Entrega e publicação

- Interface: `publico/index.html` e `publico/refinamento.css`.
- Servidor: `supabase/functions/leo-sync/index.ts`.
- Testes: `tests/regression.mjs` e `tests/auth.mjs`, executáveis por `npm test` com Node.js.
- Prévia local: http://127.0.0.1:8765/ enquanto o servidor desta sessão estiver ativo.
- Publicação autorizada em 05/09/2026. A função `leo-sync` foi implantada como versão 55; a interface é publicada pelo fluxo de GitHub Pages deste repositório. A confirmação da versão no ar é feita após a conclusão desse fluxo.
