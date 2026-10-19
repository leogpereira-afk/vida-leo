# Fortemais ferramentas — implementation plan
Spec: ../specs/2026-10-18-fortemais-ferramentas.md
User approved implementation and local preview only. No deployment.
1. Calculator engine/catalog/tests (engine-brief.md). Behavioral numeric tests then implementation.
2. Renderer/tests (renderer-brief.md). Geometry contract shared with 1; independent file ownership.
3. UI/model/tips/tests (ui-brief.md). Consumes 1 and 2; no shared file editing.
4. Integrate index scripts/state/navigation and test helper; fictional preview outside release, full tests then browser desktop/mobile core flows and exports.
5. Independent whole-change review, fix substantiated issues, rerun affected checks. Deliver local preview with honest dependencies.

User refinement (2026-10-18): compact scrollable input panel on desktop, reduced metrics and expandable material details, expandable 3D with keyboard close/focus return; mobile uses a normal single-column flow. Validate these interactions in the browser before delivery.

### Refinamento: réguas e materiais (18/10)

- Todos os 25 formulários usam campos numéricos proporcionais ao conteúdo; medidas selecionadas recebem régua com entrada exata preservada, escala adaptável e teclado.
- Catálogo local com 40 referências em 9 ferramentas: alvenaria (7), telas (4), pisos (5), esgoto (5), pintura (4), drywall (2), hidráulica (6), elétrica (5), reboco (2). Fontes oficiais e data em cada referência. Ilustrações SVG esquemáticas originais.
- Referências preenchem apenas propriedades comerciais; não escolhem resistência, transpasse, número de condutores, consumo de produto ou solução técnica. Demais ferramentas mantêm parâmetros de projeto e fornecedor, com o mesmo formulário compacto.
- Alteração de dimensão desfaz a identificação de catálogo. Referências válidas acompanham resultado/PDF; metadados internos não entram no texto do relatório. Alvenaria distingue material e espessura na compra e representação 3D.
- Verificação: 1483 testes aprovados; troca de referência preserva geometria/vãos, réguas aceitam valores exatos fora da escala inicial, controles em linhas não duplicam nomes, materiais diferentes não compartilham especificação.
- Navegador: 1280×800 e 390×844 sem transbordamento horizontal; régua pelo teclado, cálculo e expansão/fechamento 3D conferidos. Prévia com dados fictícios; sem publicação nesta etapa.
