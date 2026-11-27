# Mudar o MailLead para um domínio novo

Domínio comprado: `ricardosoares.ia.br` (Registro.br). **Você** = quem é dono das contas. **Claude** = o assistente de código, sempre pedindo autorização antes de mexer em conta ou apagar algo.

| Endereço | Para quê |
|---|---|
| `mail.ricardosoares.ia.br` | O app |
| `ricardosoares.ia.br` | Caixa do negócio: `suporte@` |
| `news.ricardosoares.ia.br` | Só envio de marketing |

**Não mexer:** `klead.com.br`, o e-mail dele, o CRM e o Evo Go (`go.klead.com.br`). O endereço antigo continua ligado até o novo passar em todos os testes.

## 0. Antes de começar
- [ ] **Você:** confirme que sabe a senha do admin. A passkey atual só vale em `mail.klead.com.br`.
- [ ] **Você:** em Marketing → Backup, baixe um backup.

## 1. Comprar o domínio
- [x] Comprado no Registro.br.

## 2. Cloudflare: colocar o domínio
- [x] Adicionado na mesma conta do app.
- [x] No Registro.br, abra o domínio → **Alterar servidores DNS** e coloque os dois que a Cloudflare mostrar.
- [x] Na Cloudflare → DNS → Records, apague os registros de estacionamento que possam ter sido importados: **MX** apontando para `.` e **TXT** `v=spf1 -all`. Com eles o domínio recusa e-mail.
- [x] Espere o domínio ficar **Active** (pode levar algumas horas).

## 3. Cloudflare: permissão do app no domínio novo
O app usa o segredo `CF_TOKEN` para configurar o e-mail.
- [ ] **Você:** em **Account API Tokens**, edite o token do MailLead e inclua o domínio novo, com: DNS **Edit**, Zone **Read**, Zone Settings **Edit**, Email Routing Rules **Edit**. Em nível de conta: Email Sending **Edit**.
- Editar o token mantém o mesmo valor. Se criar outro, grave você mesmo no Worker. Não cole token no chat.

## 4. Endereço do app
- [x] Workers & Pages → `mailflare` → Settings → Domains & Routes → **Add** → Custom domain → `mail.ricardosoares.ia.br`.
- [ ] Na mesma tela, em Variables: se existir `APP_URL`, mude para `https://mail.ricardosoares.ia.br`. Se não existir, crie.
- [ ] Abra o endereço novo e entre com a senha.
- [ ] **Você:** cadastre uma passkey nova e ative a verificação em duas etapas (TOTP) em Settings → Security.

Com `APP_URL` apontando para o novo, links de recuperação de senha e passkeys passam a usar só o endereço novo.

## 5. Caixas de e-mail do domínio novo
- [ ] **Você:** no endereço novo, Admin → Domains → **New domain** → `ricardosoares.ia.br`, com os mesmos serviços de envio e recebimento que usa hoje. Pelo Cloudflare, o app configura Email Routing e Email Sending.
- [ ] **Você:** na Cloudflare, em Email Sending, faça o **On-board** do domínio se ele pedir (exige o plano pago de Workers).
- [ ] **Você:** no domínio expandido em Admin → Domains, configure DKIM e DMARC. Comece o DMARC com `p=none`.
- [ ] **Você:** crie a caixa `suporte@ricardosoares.ia.br`.
- [ ] Teste: envie para um Gmail e responda de volta.

**Não** cadastre `news.ricardosoares.ia.br` em Admin → Domains: o marketing recusa um subdomínio usado no e-mail do dia a dia.

## 6. Amazon SES (marketing)
A conta já tem produção liberada em `us-east-1` e a chave já está guardada no MailLead. Não precisa de chave nem pedido novo.

- [ ] **Você:** console da AWS, região **us-east-1** → Amazon SES → Identities → **Create identity** → Domain → `news.ricardosoares.ia.br`.
  - [ ] Easy DKIM, RSA 2048.
  - [ ] **Use a custom MAIL FROM domain** → `bounce.news.ricardosoares.ia.br`.
  - [ ] Não marque publicação automática no Route 53.
- [ ] **Você:** copie os três CNAME de DKIM (não são secretos) e mande para o Claude.
- [ ] **Claude:** monta o arquivo de importação de DNS.
- [ ] **Você:** Cloudflare → `ricardosoares.ia.br` → DNS → Records → Import and Export → importe, **com o proxy desmarcado**.

Registros esperados:

```
<token1>._domainkey.news   CNAME  <token1>.dkim.amazonses.com
<token2>._domainkey.news   CNAME  <token2>.dkim.amazonses.com
<token3>._domainkey.news   CNAME  <token3>.dkim.amazonses.com
bounce.news                MX 10  feedback-smtp.us-east-1.amazonses.com
bounce.news                TXT    "v=spf1 include:amazonses.com ~all"
_dmarc.news                TXT    "v=DMARC1; p=quarantine; adkim=s; aspf=r;"
```

- [ ] Espere a AWS mostrar o domínio e o MAIL FROM como **Verified**.

## 7. MailLead: marketing no endereço novo
Sempre abrindo `https://mail.ricardosoares.ia.br`.

- [ ] Marketing → Envio: remetente `send@news.ricardosoares.ia.br`, responder para `suporte@ricardosoares.ia.br`, **endereço público** `https://mail.ricardosoares.ia.br`. Salvar.
- [ ] **Configurar eventos** (refaz o aviso de devoluções para o endereço novo). Espere ficar confirmado.
- [ ] **Claude**, com autorização: zerar a contagem de aquecimento. Os testes feitos com o domínio antigo não aquecem o novo.
- [ ] Todas as verificações em verde → enviar teste e conferir SPF, DKIM e DMARC em **PASS** no Gmail ("Mostrar original").
- [ ] Marketing → Modelos → Dados do rodapé: empresa, contato e endereço do negócio. **Salvar e aplicar em todos**.
- [ ] Revisar os modelos: links e assinaturas que ainda citem o domínio antigo.

## 8. WhatsApp (Evo Go dentro do app)
O domínio novo **não** muda nada no Evo Go: o servidor continua `https://go.klead.com.br` (dividido com o CRM) e a conexão salva no MailLead continua valendo no endereço novo. Não instale, atualize nem reinicie o servidor, e não toque na instância do CRM.

- [ ] No endereço novo, abra Marketing → **WhatsApp**. Deve aparecer **Conectado**.
- [ ] Se aparecer **Desconectado**: **você** abre o Manager do Evo Go, entra **somente** na instância `maillead` e lê o QR code com o celular do negócio. Depois, **Verificar de novo**.
- [ ] Se quiser trocar o número para o do negócio: **você** desconecta só a instância `maillead` no Manager e lê o QR code com o número novo.
- [ ] Se precisar salvar de novo: endereço do servidor `https://go.klead.com.br` e o **token da instância `maillead`** (nunca a chave geral). **Você** cola no app, não no chat.
- [ ] Em **Gravar e testar**, informe o seu número e use **Enviar texto de teste** e **Enviar áudio de teste**.
- [ ] Em Captura, marque **Pedir WhatsApp** nos formulários que forem usar. Só recebe quem marcar a autorização.

## 9. Formulários e funis
- [ ] Formulários: copie o **código novo** em Captura e troque nos sites. Teste um cadastro.
- [ ] Integrações por API ou webhook: troque o endereço.
- [ ] Funis: salve e ative de novo os que for usar; teste com **Testar**, informando o seu WhatsApp quando houver o passo **WhatsApp**.
- [ ] Celular, agenda, contatos e programas de e-mail: reconfigure com o endereço novo.

## 10. Limpeza (só depois de uns dias funcionando)
Cada item é listado e autorizado antes.

- [ ] Apagar contatos, listas, campanhas e funis de teste.
- [ ] Remover o endereço `mail.klead.com.br` do Worker. Links de e-mails de teste antigos param de funcionar.
- [ ] Remover a identidade `news.klead.com.br` no SES e **somente** os registros de `news.klead.com.br` na Cloudflare.
- [ ] Tirar o domínio antigo de Admin → Domains **apenas** se nenhuma caixa dele for usada no MailLead. Atenção: remover um domínio mexe no recebimento de e-mail. Se o CRM usa `@klead.com.br`, não remova sem conferir.
- [ ] Tirar `klead.com.br` do `CF_TOKEN`.
- [ ] **Claude:** atualizar README, documentos e memória.

## Ordem de conferência
1. App abre no endereço novo.
2. Caixa nova envia e recebe.
3. Marketing com tudo verde e teste em PASS.
4. Formulário novo cadastra, confirma e descadastra.
5. Funil de teste envia e-mail e WhatsApp.
6. Só então a limpeza.
