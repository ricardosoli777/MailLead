# Backup do marketing

**Marketing → Backup.** O backup do aplicativo cobre só o banco de e-mail; este cobre o `MARKETING_DB`.

## O que é
- Todas as tabelas de marketing, em linhas JSON compactadas (`.ndjson.gz`), em `env.BUCKET` sob `marketing-backups/`.
- Diário no agendamento das 02:00 UTC e manual pela tela. Ficam os 30 mais novos.
- Contém dados pessoais, hashes das chaves de API, segredos dos webhooks e o segredo dos links de descadastro. Só o administrador principal acessa.
- Contato apagado a pedido pode permanecer em cópias antigas até saírem da janela de 30.
- Não inclui as imagens dos modelos (`marketing/assets/` no mesmo armazenamento). Perder o armazenamento perde cópias e imagens: baixe uma cópia de vez em quando.

## Restaurar
Só acrescenta o que falta; nunca sobrescreve nem apaga.

- Descadastros, bloqueios e exclusões atuais permanecem.
- Envios que estavam na fila voltam como ignorados; campanhas e funis ativos voltam pausados.
- Chaves de API e webhooks só voltam se não houver nenhum, para não reativar os revogados.
- O que você apagou de propósito (modelo, funil, etiqueta) volta se estiver na cópia.
- Depois de perder o banco, o que aconteceu após a cópia não existe mais: descadastros feitos nesse intervalo se perdem e um funil reativado pode repetir o último passo. Revise antes de reativar.

## Banco perdido por completo
Crie o banco, aplique `drizzle-marketing`, publique e use **Restaurar de um arquivo**. O Cloudflare D1 também permite voltar no tempo (Time Travel) dentro do período do plano, o que é preferível quando o banco ainda existe.
