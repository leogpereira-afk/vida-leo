# Consolidação de ferramentas na mesma obra — 27/10/2026

Base publicada examinada: `fa17d31`, motor 1.3.1. Ensaio com dados exclusivamente fictícios, sem escrita em produção. Publicação autorizada pelo usuário após a prévia; a conclusão depende do workflow do Pages e da conferência da versão servida.

## Problemas reproduzidos e corrigidos

1. **Embalagem ausente:** contrapiso/pavimentação identificavam compra contínua como “contínuo”, enquanto consumo usava “pacotes”, mesmo sem embalagem. A chave separava o mesmo produto em duas linhas. Agora o rótulo é desconsiderado quando não existe embalagem; nome, referência, unidade e demais critérios continuam valendo.
2. **Nomes gerados pela ferramenta:** concreto e reboco produziam nomes internos diferentes para cimento e areia. Agora apenas os três nomes internos exatos de concreto (cimento, areia e brita), nas unidades correspondentes, usam a denominação comum na consolidação. Nomes livres e registros históricos permanecem intactos. Não se presume equivalência entre referências diferentes ou ausentes.

O ajuste ocorre na leitura consolidada; não regrava simulações, não migra histórico e não muda o motor dos quantitativos individuais. As três regressões falharam antes da correção e passaram depois. Uma regressão adicional protege registros legados sem unidade, aceitos pelo validador anterior.

## Resultados de conferência

| Cenário sintético | Resultado conferido |
|---|---|
| Contrapiso 4 × 5 × 0,05 m; pavimentação 4 × 5 × 0,10 m; consumo 10 × 0,05 m³ | 3,5 m³ líquidos; 3,85 m³ com reserva de 10%, em uma única linha |
| Contrapiso recalculado para 10 cm | 4,5 m³ líquidos; 4,95 m³ de compra; a versão anterior não entra na soma |
| Novo recálculo sem alterar medidas | Continua 4,95 m³; terceira versão preservada junto das duas anteriores |
| Cimento no concreto e reboco com mesma referência: 25 + 25 kg, saco 50 kg | Um saco de 50 kg; o arredondamento ocorre depois da soma |
| Drywall e consumo com produto, unidade e embalagem iguais | Soma agrupada, sem somar embalagens já arredondadas de cada simulação |
| Obra diferente, avulsa, alternativa, arquivo e motor antigo | Filtros/exclusões respeitados; histórico preservado |
| Unidade, referência, embalagem ou sistema diferentes | Materiais mantidos separados |
| Tubos com plano de corte | Quantidade de barras conserva os planos; sem supor reaproveitamento entre simulações |

## Verificação

- 20 testes novos do motor/modelo e um fluxo DOM completo de três ferramentas.
- Fluxo DOM: criar, salvar, reconstruir a página pelo JSON persistido, retomar, recalcular v2, repetir v3, filtrar obra/avulsas, duplicar alternativa e arquivar. Versões anteriores comparadas integralmente; dados externos ao apoio preservados.
- Navegador local: retomada do contrapiso na obra fictícia, alteração de 5 para 10 cm, salvar v2, repetir recálculo/salvamento v3 e recarregar. Lista continuou com uma linha de 4,95 m³; histórico exibiu v1, v2 e v3.
- Suíte completa: `TZ=America/Sao_Paulo node --test tests/*.mjs` — **2.294 aprovados; zero falhas**.
- `git diff --check` sem erros; cache do módulo atualizado no HTML.
- Antes da publicação, a suíte completa foi repetida: 2.294 aprovados, zero falhas. A comparação do histórico de produção é feita somente por leitura; nenhum dado privado é incluído neste relatório.

## Limites

A equivalência depende de identificação e especificações compatíveis. Produtos sem referência ficam separados por simulação. Não há conversão automática entre unidades nem dedução de equivalência técnica. Não foi repetida sincronização entre dispositivos ou feita nova gravação na base oficial. Os cenários desta rodada usam coeficientes sintéticos, sem constituir composição técnica de execução.
