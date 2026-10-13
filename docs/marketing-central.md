# Marketing na Central do Léo

## Entrega local

Área `#marketing`, acesso na navegação lateral e atalho em Fortemais. Filtros
por empresa e semana, três fontes, indicadores compactos, evolução semanal,
origens de visitas, páginas mais vistas e resumo copiável para análise da Aurora.
A análise exibida é uma comparação determinística, não uma chamada ao agente.
Preparar o resumo não envia mensagem nem dispara rotina.

## Integração de leitura

`POST leo-sync {acao: "marketingPainel", empresa: "impresilk"}` exige a sessão
do dono da Central: papel dono, sujeito configurado e uso vazio. Não aceita
crachá OAuth ou de outro sistema. Só lê `painel_cache`; não lê cofre ou tokens.
O navegador recebe projeção explícita de métricas, nunca o cache bruto.

O adaptador reutiliza os retratos dos conectores já existentes da Impresilk:
`mkt_fonte_google` e `mkt_fonte_meta`. Confere domínio e perfil antes de
associá-los à empresa. Nenhuma outra empresa herda essas chaves.

Fortemais e as demais empresas têm estados pendentes; **ainda não há coletor
multiempresa ou fluxo de autorização delas nesta Central**. Próxima etapa:
identificar a conta administradora Google e propriedade/local, autorizar o
perfil profissional Meta, vincular fontes por empresa e validar a primeira
coleta. Não reutilizar automaticamente as credenciais ou seleção de ativos da
Impresilk. O perfil pessoal administrador não equivale a autorização da API.

## Semântica

- Visitantes são os usuários ativos da semana retornados pelo GA4; nunca soma
  de usuários diários. Sessões e páginas vistas são métricas separadas.
- Alcance do Instagram é por semana, não soma de alcance diário; não equivale
  a visitas ao perfil. A fonte pode incluir anúncios.
- Semanas imaturas do Instagram e Perfil da Empresa não têm total exibido.
- Comparação somente entre semanas adjacentes, completas, com valores e base
  anterior diferente de zero. Coleta parcial ou antiga não gera tendência.
- Páginas mais vistas pertencem à janela total da coleta, rotulada à parte.
  Canais pertencem à semana selecionada.
- Ausência é `null`, zero só aparece quando a fonte informou zero.
- Data é a da parte coletada, nunca a atualização geral do registro. Mais de
  48 horas sinaliza dado antigo. Reler o cache não inicia coleta no provedor.
- Troca de empresa invalida respostas assíncronas anteriores.

## Validação e publicação

`pnpm test` cobre autorização, separação por empresa, identidade divergente,
projeção sem segredos, semanas imaturas, zeros, erros, XSS, troca concorrente
de filtro, interface e navegação. A prévia local usa uma leitura sanitizada
fora do repositório; nenhuma métrica privada foi adicionada aos arquivos.

Publicação requer autorização do dono. Implantar `leo-sync` com
`marketing.mjs` antes da tela. Verificar a rota com sessão válida do dono e
com sessão recusada; depois conferir Marketing e Fortemais no site publicado.
Uma suíte local ou prévia não confirma implantação.
