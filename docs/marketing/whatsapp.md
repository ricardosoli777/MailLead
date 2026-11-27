# WhatsApp (onda 7)

Somente para quem se cadastrou e aceitou receber no WhatsApp. Sem disparo em massa.

## Etapa 1: conexão e teste
**Marketing → WhatsApp.** Usa o Evolution Go do dono, por uma instância própria do MailLead.

- Chamadas feitas: `GET /instance/status`, `POST /send/text`, `POST /send/media` (multipart, `type=audio`), com o cabeçalho `apikey` = token da instância. Nada cria, conecta ou altera instâncias.
- O servidor converte o áudio para OGG/Opus e envia como mensagem de voz (lido no código-fonte de `evolution-foundation/evolution-go`, ramo main; a versão instalada pode diferir). A conversão lê o arquivo por pipe: alguns M4A podem falhar.
- Endereço só `https`; redirecionamentos recusados; o token nunca volta ao navegador, não entra no backup e não é reaproveitado ao trocar o endereço.
- Cabeçalhos: `microphone=(self)` e `media-src 'self' blob:`.

## Etapa 2: áudio no funil
- **Aceite próprio.** O formulário pode pedir o número (`marketing_forms.whatsapp_text`), com caixa desmarcada. Grava em `marketing_whatsapp`, separado do aceite de e-mail. Com confirmação por e-mail, só vale depois de confirmado, e só essa confirmação desfaz um "parar" anterior.
- **Passo `whatsapp` no funil.** O áudio fica privado em `BUCKET` (`marketing/audio/<id>`), enviado por `POST /api/marketing/audio`. Sem aceite, o passo é registrado como `skipped` e a pessoa segue.
- **No máximo uma vez.** `marketing_whatsapp_sends` tem uma linha por funil, passo e contato, criada antes do envio. Falha não é repetida.
- **Ritmo.** 5 por passagem do cron, 100 em 24 h, das 8h às 20h de Brasília, com 3 a 8 s entre um e outro. Fora disso, ou com a instância desconectada, a pessoa espera no passo.
- A API e os webhooks não registram aceite de WhatsApp.

## Mensagem escrita

O passo **WhatsApp** do funil tem um campo de texto e um de áudio: vale um, o outro ou os dois, na ordem escolhida. Valem as variáveis do lead e dos dados do rodapé. A autorização, o horário e o ritmo são os mesmos do áudio.

## Falta
- "SAIR" automático (exige o webhook da instância do MailLead apontando para cá). Hoje é o botão Parar WhatsApp no contato.
- Texto escrito pelo WhatsApp no funil.
