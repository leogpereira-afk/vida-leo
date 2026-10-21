# Central do Léo — revisão visual compacta

Estado: implementação local, sem publicação. Data: 21/10/2026.

## Entrega

- 23 imagens 3D novas e independentes; a Fortemais reutiliza sua imagem existente. Todas as 24 áreas internas têm identidade visual.
- Arquivos locais WebP de 256 × 256 px com transparência. A documentação de criação fica em `publico/central-3d/README.md`.
- Menu com nomes visíveis, ícones compactos e indicação da área atual. Marcas oficiais de Drive e Strava e links para outros sistemas são preservados.
- Cabeçalhos menores, com imagem, título, cor da área e ações. Ajustes específicos em Marketing, Saúde, Rendimentos, Gastos e Strava resolvem conflitos com estilos antigos.
- Início com oito atalhos principais; busca por nome/assunto e expansão para todas as áreas visíveis. Áreas ocultas e links externos não entram nessa grade.
- Grade de quatro colunas no computador e duas no celular. Foco visível, nomes acessíveis, suporte aos temas existentes e ausência de animação permanente.
- Identidade visual separada dos dados: não modifica registros, cálculos, sincronização, permissões ou conexões.

## Verificação

1. Suíte completa: 1.661 testes aprovados, zero falhas, zero ignorados. Inclui quatro novos testes para cobertura de imagens, busca/expansão, navegação e preservação de links externos e dados.
2. Renderização local das 24 áreas em larguras de 390 e 768 px: 48 conferências, sem transbordamento horizontal da página, imagens quebradas ou alerta fatal de renderização. Listas e abas com rolagem própria continuam funcionando como no módulo original.
3. Inspeção visual da página inicial, coleção de ícones e áreas representativas; correção de contraste do Marketing e do alinhamento/tamanho dos cabeçalhos de Saúde, Rendimentos, Gastos e Strava.
4. Sintaxe de JavaScript, hashes de cache dos arquivos alterados e `git diff --check` conferidos. O projeto é estático e não tem etapa separada de build.
5. Após o usuário fechar a confirmação antiga, a conferência interativa no navegador foi concluída: expansão de 8 para 22 atalhos e recolhimento, busca sem acento, busca pelo assunto, resultado vazio, abertura de Demandas e Fortemais, identificação da área ativa e retorno pelo menu. Na largura de 390 px foram conferidos abrir/fechar o menu, expandir os atalhos, buscar Saúde e abrir a área pelo resultado. Nenhum erro encontrado nesses fluxos.

Os testes de renderização usam uma prévia isolada com registros fictícios e chamadas de nuvem desativadas. Não comprovam sincronização autenticada ou funcionamento em produção.

## Limitações e próximo passo

O bloqueio dos cliques foi resolvido e a conferência local foi concluída. A validação móvel foi realizada no navegador em iframe de largura controlada, não em aparelho físico. Não se deve confundir essa validação com um teste de ponta a ponta autenticado.

Antes de publicar: revisar a versão remota e obter autorização de publicação. Nenhum cadastro real foi criado e nenhum servidor foi alterado nesta entrega.
