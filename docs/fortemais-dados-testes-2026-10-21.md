# Fortemais — organização dos dados e testes

Data: 21/10/2026. Base: `d65f2c4`. Alterações locais; sem publicação ou migração de registros produtivos.

## Organização disponível

Em **Ferramentas de obra → Simulações salvas e compras**:

- Busca por nome, obra, ambiente, elemento, etapa e ferramenta, ignorando acentos.
- Filtro de obra pelo ID, inclusive simulações avulsas e vínculos cuja obra não foi encontrada.
- Situações: ativas, calculadas, rascunhos, alternativas, arquivadas e todas. Abertura em ativas, por atualização mais recente.
- Nome legível da obra, contexto do elemento e situação de compra em cada linha compacta.
- Histórico recolhido; comparação habilitada somente com duas escolhas. Trocar o filtro limpa a seleção anterior.
- Compras por obra com filtro próprio. Buscar ou filtrar a lista de simulações não muda o total da compra. Alternativas, rascunhos e arquivadas ficam fora da consolidação.

Nenhuma lista foi regravada, renumerada ou vinculada por semelhança de nome. Os filtros só mudam a apresentação.

## Mapa dos dados existentes

| Conjunto | Origem no estado da Central | Relação e finalidade |
|---|---|---|
| Obras | `E.obras` | `id` identifica a obra; o nome é apenas apresentação. |
| Simulações | `E.fortemaisApoio.simulacoes` | `id` da simulação, número `ativa`, `versoes`, `arquivada` e `incluirCompra`. |
| Versões de cálculo | `simulacao.versoes` | `obraId`, `toolId`, ambiente, etapa, elemento, entradas, resultado, data e versão do motor. |
| Compras | Derivadas das versões ativas | Sem cadastro paralelo; agrupamento por material, especificação, unidade, embalagem e política de corte. |
| Favoritas e dicas próprias | `E.fortemaisApoio` | `favoritos`, `dicas`, `dicasFavoritas` e `checklists`; mantidos sem transformação. |
| Inovações | `E.fortemaisInovacoes` | Caderno existente, independente do cadastro de cada obra. |
| Demandas de obra | `obra.fmDemandas` | Etapas e itens com IDs e histórico, conforme modelo existente. |
| Metadados dos documentos | `obra.fmArquivosMetadados` | Chave pelo ID do arquivo; arquivos pertencem à referência `obra:<id>` ou suas referências filhas. |

Fontes: `publico/index.html`, `fortemais-apoio-modelo.js`, `fortemais-ferramentas.js`, `fortemais-inovacoes.js`, `fortemais-demandas-modelo.js`, `fortemais-documentos.js` e `fortemais-documentos-modelo.js`.

O salvamento existente grava o estado no armazenamento local e agenda a sincronização. Confirmar o salvamento local não comprova envio à nuvem. A integração de nuvem não foi alterada nesta tarefa.

## Falhas reproduzidas e corrigidas

1. **Obra ausente:** retomar uma simulação cujo `obraId` não estava nas opções podia deixar a seleção vazia e perder a referência no próximo salvamento. Agora o ID original permanece como “Obra não encontrada”, sem selecionar outra obra pelo nome.
2. **Rascunho incompleto:** retomar um registro sem ambiente, etapa ou elemento podia reaproveitar os campos da edição anterior. A retomada agora limpa esses campos antes de preencher o registro escolhido.
3. **Histórico com lacuna:** um histórico aceito pelo validador, por exemplo começando na versão 2, podia repetir o número ao salvar. A nova versão usa o maior número existente mais um, sem modificar as anteriores.

As falhas foram reproduzidas em testes antes da correção. As fórmulas das 25 ferramentas não foram alteradas.

## Verificações

- Suíte inicial: **1.651 testes aprovados**.
- Suíte final: **1.657 testes aprovados**, zero falhas ou ignorados. Inclui seis novos testes de regressão/organização.
- Cobertura executada inclui cálculos e retomada das 25 ferramentas, persistência, conflitos de edição, falha de armazenamento, preservação de rascunhos, consolidação, exportações, documentos, demandas e inovações.
- Na prévia, usando exclusivamente dados fictícios: salvar, alterar medidas, criar nova versão, retomar, duplicar, comparar, filtrar obra e consolidar materiais.
- Parede de demonstração: 15 m² e 207 blocos para compra na v1; 18 m² e 248 blocos na v2. Duplicar como alternativa manteve a compra em 248. Tentar incluir o mesmo elemento duas vezes foi bloqueado.
- Outra obra: 12 m² e 165 blocos; consolidado das duas obras: 413 blocos, excluindo a alternativa. São exemplos históricos de teste, sem uso operacional.
- Nova aba recuperou os três registros fictícios e suas versões anteriores do armazenamento local.
- Apresentação conferida em 1280 × 720 e 390 × 844, sem transbordamento horizontal do documento na lista. Capturas salvas fora do repositório.
- Aplicação estática: não há comando de build separado. A validação inclui suíte, sintaxe dos arquivos alterados, referências de cache e `git diff --check`.

## Limites identificados

- A produção abriu na tela de login. Não foi possível conferir cadastros reais, anexos reais nem ida e volta da sincronização autenticada; nenhum registro real foi alterado.
- O teste visual de arquivamento não foi concluído: a confirmação nativa travou a interação da aba de teste. O arquivamento e sua exclusão da compra passaram nos testes automatizados. Os demais fluxos interativos listados acima foram conferidos antes desse bloqueio; a leitura e as capturas posteriores confirmaram a persistência e a apresentação.
- A prévia com dados fictícios, os logs e as capturas não são prova de publicação. Esta revisão está pronta localmente e ainda não foi publicada.

## Como usar

1. Escolha a ferramenta e informe as medidas do projeto.
2. Em Identificação e salvamento, escolha a obra e preencha nome, ambiente, etapa e elemento. Salve rascunho quando ainda faltarem informações.
3. Calcule, confira as quantidades e salve a simulação. Retomar e salvar cria uma nova versão.
4. Em Simulações salvas e compras, use os filtros para localizar o registro. Para comparar, marque duas linhas.
5. Duplicar cria uma alternativa fora da compra. Confira qual cenário deve compor a compra antes de mudar essa opção.
6. Em Consolidar materiais, escolha a obra e confira o total por especificação. Registros arquivados permanecem no histórico e podem ser consultados pelo filtro Arquivadas.
