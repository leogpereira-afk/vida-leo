import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

/* O `?v=` DE CADA ARQUIVO É O HASH DO CONTEÚDO, e ninguém o recalcula no deploy.
 *
 * Em 16/09/2026 dois estavam mentindo, os dois por descuido meu:
 *  - google-datas.js seguia em `?v=2` desde 06/09, mas o arquivo mudou em 15/09
 *    (janela de 7 dias e o filtro de "só particular"). Navegador com a cópia
 *    velha rodava as regras antigas sem nenhum aviso;
 *  - refinamento.css mudou e o número ficou o mesmo.
 * Número mantido à mão envelhece calado. Aqui ele é conferido contra o arquivo
 * de verdade: mexeu no arquivo e esqueceu o número, a suíte fica vermelha e o
 * deploy (que depende dela) não sai. O conserto é trocar o número pelo hash
 * que a mensagem de erro já traz. */
const html = readFileSync(new URL('../publico/index.html', import.meta.url), 'utf8');
const refs = [...html.matchAll(/(?:href|src)="\.\/([^"?]+)\?v=([^"]*)"/g)];

test('versão dos arquivos: existe pelo menos uma referência versionada', () => {
  assert.ok(refs.length >= 5, 'a varredura não achou os arquivos — o teste estaria passando em branco');
});

for (const [, caminho, v] of refs) {
  test(`versão dos arquivos: ${caminho} leva o hash do próprio conteúdo`, () => {
    const real = createHash('sha256').update(readFileSync(new URL('../publico/' + caminho, import.meta.url))).digest('hex').slice(0, 12);
    assert.equal(v, real, `${caminho} mudou e o ?v= não: troque ?v=${v} por ?v=${real}`);
  });
}
