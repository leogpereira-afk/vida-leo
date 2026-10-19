# Fortemais ferramentas — implementation plan
Spec: ../specs/2026-10-18-fortemais-ferramentas.md
User approved implementation and local preview only. No deployment.
1. Calculator engine/catalog/tests (engine-brief.md). Behavioral numeric tests then implementation.
2. Renderer/tests (renderer-brief.md). Geometry contract shared with 1; independent file ownership.
3. UI/model/tips/tests (ui-brief.md). Consumes 1 and 2; no shared file editing.
4. Integrate index scripts/state/navigation and test helper; fictional preview outside release, full tests then browser desktop/mobile core flows and exports.
5. Independent whole-change review, fix substantiated issues, rerun affected checks. Deliver local preview with honest dependencies.

User refinement (2026-10-18): compact scrollable input panel on desktop, reduced metrics and expandable material details, expandable 3D with keyboard close/focus return; mobile uses a normal single-column flow. Validate these interactions in the browser before delivery.
