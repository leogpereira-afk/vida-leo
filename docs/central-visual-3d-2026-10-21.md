# Central do Léo — revisão visual compacta

Estado: revisão local concluída, publicação autorizada pelo usuário em 21/10/2026. A confirmação do deploy e dos arquivos servidos é registrada separadamente após sua execução.

## Entrega

- 23 imagens 3D novas e independentes; a Fortemais reutiliza sua imagem existente. Todas as 24 áreas internas têm identidade visual.
- Arquivos locais WebP de 256 × 256 px com transparência. A documentação de criação fica em `publico/central-3d/README.md`.
- Menu com nomes visíveis, ícones compactos e indicação da área atual. Marcas oficiais de Drive e Strava e links para outros sistemas são preservados.
- Cabeçalhos menores, com imagem, título, cor da área e ações. Ajustes específicos em Marketing, Saúde, Rendimentos, Gastos e Strava resolvem conflitos com estilos antigos.
- Início com oito atalhos principais; busca por nome/assunto e expansão para todas as áreas visíveis. Áreas ocultas e links externos não entram nessa grade.
- Grade de quatro colunas no computador e duas no celular. Foco visível, nomes acessíveis, suporte aos temas existentes e ausência de animação permanente.
- Identidade visual separada dos dados: não modifica registros, cálculos, sincronização, permissões ou conexões.

## Verificação

1. Suíte completa: 1.662 testes aprovados, zero falhas, zero ignorados. Inclui quatro novos testes para cobertura de imagens, busca/expansão, navegação e preservação de links externos e dados.
2. Renderização local das 24 áreas em larguras de 390 e 768 px: 48 conferências, sem transbordamento horizontal da página, imagens quebradas ou alerta fatal de renderização. Listas e abas com rolagem própria continuam funcionando como no módulo original.
3. Inspeção visual da página inicial, coleção de ícones e áreas representativas; correção de contraste do Marketing e do alinhamento/tamanho dos cabeçalhos de Saúde, Rendimentos, Gastos e Strava.
4. Sintaxe de JavaScript, hashes de cache dos arquivos alterados e `git diff --check` conferidos. O projeto é estático e não tem etapa separada de build.
5. Após o usuário fechar a confirmação antiga, a conferência interativa no navegador foi concluída: expansão de 8 para 22 atalhos e recolhimento, busca sem acento, busca pelo assunto, resultado vazio, abertura de Demandas e Fortemais, identificação da área ativa e retorno pelo menu. Na largura de 390 px foram conferidos abrir/fechar o menu, expandir os atalhos, buscar Saúde e abrir a área pelo resultado. Nenhum erro encontrado nesses fluxos.

Os testes de renderização usam uma prévia isolada com registros fictícios e chamadas de nuvem desativadas. Não comprovam sincronização autenticada ou funcionamento em produção.

## Limitações e próximo passo

O bloqueio dos cliques foi resolvido e a conferência local foi concluída. A validação móvel foi realizada no navegador em iframe de largura controlada, não em aparelho físico. Não se deve confundir essa validação com um teste de ponta a ponta autenticado.

A publicação foi autorizada pelo usuário. A versão remota foi revisada, sem mudanças concorrentes na main no momento da conferência. Nenhum cadastro real foi criado nesta entrega. A publicação altera apenas os arquivos estáticos; não requer implantação de Edge Functions.

## Compactação final

- Folha de densidade separada e aplicada por último, somente em tela. Preserva a impressão.
- Na página inicial, cabeçalho de 94 para aproximadamente 66 px, cards de áreas de 76 para 58 px e menu lateral de 42 para 35 px.
- Menos preenchimento em cards, indicadores e áreas vazias; textos e ícones continuam identificando as funções. No celular, os principais controles e itens do menu mantêm 44 px de altura.
- As 24 áreas foram novamente conferidas a 390 e 768 px: 48 verificações sem transbordamento horizontal da página, imagens quebradas ou erro fatal de renderização.
- Busca por Saúde, expansão dos atalhos e navegação até a área conferidas após a compactação. Suíte completa executada novamente: 1.662 testes aprovados, zero falhas.

## Auditoria da versão publicada — 21/10/2026

- Sessão autenticada no Chrome, versão publicada 6235312: 23 áreas visíveis percorridas por cliques no menu, em desktop e em viewport de 390 px. O menu móvel recolheu após cada escolha.
- Busca de áreas, ausência de resultados, abertura por atalho, expansão para 22 atalhos, abertura/fechamento da busca geral e quatro filtros de prioridades conferidos.
- Marketing: carregamento concluído e 11 abas navegadas em largura móvel, sem transbordamento da página.
- Fortemais: 25 ferramentas percorridas por Próxima; Anterior e as visualizações Medidas, 3D e Compra conferidos. Sem salvar simulações reais.
- Encontrada uma unidade kg/m² ultrapassando em 4 px a viewport de 390 px: o campo numérico tinha largura mínima de 8ch dentro de uma coluna estreita. Correção permite o encolhimento flexível do campo sem esconder a unidade.
- Revalidação local: alvenaria a 390, 360 e 320 px; todas as 25 ferramentas a 320 px, sem transbordamento ou imagem quebrada. Suíte completa novamente: 1.662 testes aprovados.
- Limites: emulação de viewport, não aparelho físico. Google Drive pediu conexão; não foi concedida nova permissão. A conferência de navegação não valida gravação, exclusão, envio de mensagens nem todas as integrações externas.
