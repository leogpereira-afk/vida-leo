# Identidade da Central do Léo

Referência: sistema Leonardo da skill layout-moderno (tipografia Poppins nos títulos, base neutra e identidade índigo). A preferência de fonte escolhida em Configurações continua tendo prioridade.

Todas as 23 áreas internas visíveis e a rota legada de planejamento recebem um acento próprio. O registro está em `publico/leonardo-design.js`; as regras compartilhadas estão em `publico/leonardo-design.css`. A navegação aplica o tema antes de renderizar cada tela, inclusive telas assíncronas. Se o arquivo visual não carregar, a navegação continua disponível.

- Cabeçalho compacto, ícone vetorial decorativo e título textual.
- Acento de navegação, botões e seleções; base clara comum e adaptação ao modo escuro do sistema.
- Cores de sucesso, atenção e erro mantêm sua semântica. Valores e gráficos não são recalculados nem recoloridos por categoria.
- Emojis da lateral e marcas originais preservados. Sistemas externos não são alterados.
- Controles mantêm rótulos, teclado, estados desabilitados e foco visível. Celular mantém navegação recolhível e rolagem interna das abas.
- Nenhuma mudança de cadastro, sincronização, anexos, permissões ou integrações.
- Regras visuais restritas a tela; impressão mantém o estilo próprio existente.

## Verificação

Testes de contraste: texto de botões >= 4,5:1, cabeçalhos >= 7:1 e acentos claros no fundo escuro >= 4,5:1. Teste de navegação garante que o tema acompanha a rota e não grava dados. Verificação visual local das 23 áreas em computador e largura de 390 pixels, com ausência de transbordamento horizontal da página nos estados consultados.
