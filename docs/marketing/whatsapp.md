# WhatsApp (onda 7)

Somente para quem se cadastrou e aceitou receber no WhatsApp. Sem disparo em massa.

## Etapa 1: conexão e teste
**Marketing → WhatsApp.** Usa o Evolution Go do dono, por uma instância própria do MailLead.

- Chamadas feitas: `GET /instance/status`, `POST /send/text`, `POST /send/media` (multipart, `type=audio`), com o cabeçalho `apikey` = token da instância. Nada cria, conecta ou altera instâncias.
- O servidor converte o áudio para OGG/Opus e envia como mensagem de voz (lido no código-fonte de `evolution-foundation/evolution-go`, ramo main; a versão instalada pode diferir). A conversão lê o arquivo por pipe: alguns M4A podem falhar.
- Endereço só `https`; redirecionamentos recusados; o token nunca volta ao navegador, não entra no backup e não é reaproveitado ao trocar o endereço.
- Cabeçalhos: `microphone=(self)` e `media-src 'self' blob:`.

## Etapas seguintes (não construídas)
1. Aceite de WhatsApp e telefone no formulário, API e webhook, separado do aceite de e-mail.
2. Bloco WhatsApp no funil (texto e áudio gravado no cartão), com intervalo entre envios.
3. "SAIR" interrompe os envios (exige webhook da instância apontando para o MailLead).
