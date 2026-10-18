PDF.js 6.4.299 — Apache-2.0, build legacy da distribuição Mozilla.

Origem: https://registry.npmjs.org/pdfjs-dist/-/pdfjs-dist-6.4.299.tgz
Release: https://github.com/mozilla/pdf.js/releases/tag/v6.4.299
API: https://mozilla.github.io/pdf.js/api/draft/module-pdfjsLib.html
Exemplos: https://mozilla.github.io/pdf.js/examples/index.html

Incluídos motor/worker legacy minificados, CMaps, fontes padrão, ICCs e WASM
com as licenças originais. Sem viewer, sandbox de execução de scripts PDF,
telemetria ou CDN. Worker e recursos auxiliares usam URLs deste diretório.
SHA256SUMS permite conferir a integridade dos arquivos distribuídos.

O consumidor não executa ações/scripts/anotações de PDFs, usa Canvas e texto
como textContent, desabilita XFA/worker rendering e solicita isEvalSupported:false.
O build legacy inclui os polyfills necessários para navegadores sem novas APIs ES2026.
Patch local auditável: nos dois arquivos minificados, o único fallback de descoberta
do global do core-js `Function("return this")()` foi substituído por `globalThis`.
Em navegadores suportados esse caminho já era precedido por globalThis/window/self.
Não há mais chamada a Function() ou eval() nos arquivos distribuídos.
Não carregue pdf.sandbox: esse componente não faz parte desta integração.

Limitação: PDFs protegidos por senha precisam de uma cópia desbloqueada para
este leitor; o link para o original continua disponível. PDFs imagem não
possuem texto embutido: não há OCR.

SHA-256 do tarball upstream: 86269b40170eb41740ea05ad2102d71d33de4f122b34eb2f478be0ea7779c415

Os hashes upstream de cada arquivo estão em UPSTREAM-SHA256SUMS; os arquivos
locais após o patch estão em SHA256SUMS. O teste reverte a única substituição
e exige que os hashes dos motores voltem aos originais.
