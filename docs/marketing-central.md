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

## Ampliação exclusiva da Fortemais (preparação local)

A Fortemais ganhou sete áreas: visão geral, site, busca orgânica, Perfil da
Empresa, Instagram, anúncios e administração. O catálogo prepara 53 métricas,
com tabelas por página, canal, cidade, dispositivo, termo, conteúdo, campanha e
anúncio. Disponibilidade do catálogo **não prova coleta**: cada provedor pode
não entregar determinadas métricas. Valores ausentes ficam nulos.

`marketing-fortemais.mjs` projeta somente as chaves privadas
`leo_marketing_fortemais` e `leo_marketing_fortemais_admin` de `painel_cache`.
Não usa nenhuma chave dos coletores da Impresilk. Cada fonte exige empresa
exata e identidade conferida. Google/site/perfil usam o domínio; Instagram
usa o perfil; contas de anúncios requerem vínculo explícito confirmado.
A função de leitura não faz coleta nem concede autorização.

`POST leo-sync {acao:"marketingAdministracao", empresa:"fortemais",
administracao:{fontes:{...}}}` exige o mesmo dono da leitura. Aceita apenas
responsável, conta, identificação do ativo, observação e situação cadastral.
Não altera métricas, tokens, permissões, contas ou anúncios. A situação é
preenchida pela pessoa; o estado da coleta vem separadamente do servidor.
O formulário mantém os campos após falha e impede troca que descarte edição.

### Contrato do coletor a conectar

O cache tem `{empresa:"fortemais",fontes:{ga4,search,perfil,instagram,
google_ads,meta_ads}}`. Cada fonte contém `empresa`, `estado`, `coletadoEm`,
`identidade`, `moeda` (somente mídia) e `periodos`. Cada período tem `inicio`,
`fim`, `completo`, `metricas`, `tabelas` e `serie`. A projeção ignora campos
extras, limita linhas e descarta datas inválidas/duplicadas. Nenhum dado real,
ID privado, e-mail administrador ou credencial fica neste repositório público.

As taxas são frações (0.05 = 5%), tempo em segundos, custos na moeda informada
pelo provedor. Sem moeda, não se presume BRL. Usuários/alcance totais devem vir
do relatório do intervalo, nunca da soma diária. Somente resultados com data
confirmada aparecem; mais de 48 horas sinaliza leitura antiga. Cada fonte tem
seu próprio período explícito. A tela não soma canais ou períodos incompatíveis.

### Limites desta etapa

A descoberta confirmou no navegador a propriedade Analytics e Search Console
da Fortemais. As conexões de leitura correspondentes no Make ainda requerem
autorização; foram preparados pedidos no Make. A configuração e validação do
coletor que alimentará esse novo contrato ainda dependem dessas autorizações.
O cadastro identificado está em arquivo privado fora do repositório para a
prévia; não foi gravado em produção. Instagram, Perfil da Empresa e contas de
mídia ainda exigem autorização e validação de identidade e métricas.

Não há rotina de marketing ativada, anúncios publicados ou expansão de
permissões dos coletores da Impresilk. Publicar a tela sozinha não torna as
fontes conectadas. Próxima sequência: concluir OAuth, validar identidades,
implementar e testar a coleta isolada, conferir o recorte, autorizar publicação,
implantar servidor antes da tela e verificar os dados no painel real.

### Fortemais: conexão direta (14/10/2026)

A Fortemais pode autorizar Google e Meta diretamente na Central, sem Make.
A administração oferece conexão, seleção de ativo e coleta sob demanda. Não
foi criada rotina recorrente. O cadastro manual não comprova autorização.

- Google usa o app web `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` e o retorno
  já usado pela Central: `/functions/v1/leo-sync/googleCallback`. O state `fm.`
  separa este fluxo do Drive/Agenda. Tokens pessoais não são reutilizados.
- Meta exige um app próprio configurado em `LEO_MKT_META_CLIENT_ID` e
  `LEO_MKT_META_CLIENT_SECRET`, com o mesmo retorno permitido. Não usa o
  `META_TOKEN` da Impresilk. Instagram precisa de conta profissional ligada
  à Página e permissões aprovadas pelo provedor.
- Google pede analytics.readonly, webmasters.readonly e business.manage
  (escopo exigido pelo Perfil; o coletor somente lê). Meta pede insights e
  ads_read. Não cria anúncios nem altera site, perfil ou campanhas.
- OAuth: nonce aleatório consumido uma vez, validade de 10 minutos, PKCE no
  Google. O callback guarda autorização pendente; só o dono autenticado,
  com prova guardada no navegador que iniciou, confirma a instalação.
- Cofre lógico: `leo_config`, prefixo `marketing_fortemais_direto_`, RLS sem
  políticas públicas. A API nunca devolve tokens. A autorização da Meta é
  trocada por token de longa duração; no vencimento é necessário reconectar.
- Caches por fonte: `leo_marketing_fortemais_direto_<fonte>`. Fontes são
  gravadas independentemente, sem sobrescrever coleta concorrente de outro
  canal. Falhas preservam os dados anteriores e registram o impedimento.
- GA4 confere o domínio no fluxo e filtra relatórios por host; Instagram
  confere @fortemais; Perfil e Busca conferem fortemais.net. A conta de
  anúncios é selecionada e vinculada explicitamente pelo dono.
- Janela inicial: 28 dias terminando três dias antes da consulta. Usuários e
  alcance vêm do total do período, nunca da soma de dias. Listagens limitadas
  ou relatórios recusados sinalizam coleta parcial. Campos não coletados
  permanecem ausentes; seguidores atuais não são apresentados como históricos.
- Google Ads ainda exige implementação/configuração própria de token de
  desenvolvedor e conta. Não é marcado como conectado por herdar o Google.

Os testes usam respostas simuladas. Só a autorização e uma coleta bem-sucedida
na conta real confirmam operação de ponta a ponta. Configurar o app não resolve
automaticamente bloqueios ou aprovações pendentes no Google/Meta.
