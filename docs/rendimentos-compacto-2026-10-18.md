# Rendimentos compacto, 18/10/2026

## Escopo autorizado

O dono pediu reduzir o espaço ocupado por cards e informações, permitir resumir e expandir e aplicar o azul da marca do Léo. Autorizou preparar e testar em clone isolado, mesmo sem AGENTS.md e VEZ.md no repositório. Esta entrega é uma prévia local, sem publicação.

## Mudanças

- Cabeçalho menor, com o azul #3840e8 já usado na identidade da Central.
- Quatro indicadores compactos, mantendo acesso aos registros de origem.
- Expandir detalhes exibe critérios, explicações, evolução, participação e demais análises. Recolher volta à visão compacta.
- Ano e empresa continuam à vista; múltiplos anos, meses, intervalo e limpeza ficam em Mais filtros. O recorte selecionado continua explícito abaixo dos filtros.
- Tabelas por empresa e mês mantêm seus dados, com botões Recolher e Expandir e estado preservado durante a navegação.
- Ajustes específicos para celular, foco visível, rótulos e controles de expansão acessíveis.
- Versões de arquivos atualizadas pelo hash do conteúdo.

## Verificação

- Suíte completa com Node 24, igual à CI: 1273 testes aprovados, zero falhas, zero pulados.
- Testes de expansão, preservação do estado ao filtrar ou alternar abas e invariância dos registros.
- Teste de identidade atualizado para a escolha expressa do dono: Rendimentos compartilha o azul da marca, com contraste AA verificado.
- Sintaxe JavaScript e git diff --check aprovados.
- Conferência no navegador: abrir e recolher detalhes, abrir e recolher tabela, acesso ao painel de filtros.
- Conferência visual em 1440 px e 390 px; valores completos no celular e tabela com rolagem própria, sem alargar a página.
- Prévia com dados fictícios, bloqueio de comunicação com o servidor e gravações em memória. O arquivo de prévia não faz parte do commit.

## Estado

Preparado e testado localmente. Nenhuma gravação em dados reais, alteração de backend ou publicação nesta tarefa.
