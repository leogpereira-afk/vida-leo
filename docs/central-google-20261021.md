# Central: conexões Google e densidade

## Mudanças

- Configurações reúne Drive, Gmail e Google Agenda em um painel, com estado independente por serviço.
- O botão principal abre a autorização persistente já implementada no servidor. A opção temporária fica recolhida.
- Abrir o Drive consulta somente a autorização salva; não abre login automaticamente.
- Sessões provenientes do servidor informam reconexão automática. Tokens expirados e escopos retirados não aparecem conectados.
- Consultas com acesso expirado tentam renovar pela autorização salva antes de pedir login.
- Desconectar informa o impacto sobre toda a autorização compartilhada e limpa as sessões somente após sucesso do servidor.
- Envio de e-mail e criação de lembretes são identificados como opcionais para consulta.
- Cards, indicadores e ferramentas mais compactos; ações de conexão preservam 44 px de altura no celular. Imagens 3D mantidas.

## Verificação

- Quatro testes novos reproduziram falhas antes da correção e passaram depois.
- 1.666 testes passaram. O projeto é estático, sem etapa separada de build.
- 25 ferramentas percorridas em 320 e 390 px: sem excesso horizontal ou imagens quebradas.
- Início, Configurações, Drive, Agenda e Marketing conferidos em 320, 390 e 1280 px.
- Busca por Gmail e filtro de conexões preservam a navegação no painel unificado.

## Limite operacional

A autorização real apresentou aviso de aplicativo não verificado e foi entregue ao titular para revisão. Esse aviso não prova que o aplicativo está em modo de testes. Sem concluir a autorização e consultar cada serviço, não se declara a integração operacionalmente validada.

Nenhum e-mail enviado, compromisso importado, calendário criado ou arquivo real incorporado ao repositório. Esta alteração não modifica os escopos pedidos pelo servidor nem concede permissões.
