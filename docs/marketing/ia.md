# Criar funil com IA

**Marketing → IA** guarda a chave e o modelo de OpenAI, Anthropic ou Google **somente no navegador** (IndexedDB `maillead-ai`). Nada vai para o banco, backup ou log.

**Marketing → Funis → Criar com IA** é um chat. A cada pedido, o navegador envia chave e modelo a `/api/marketing/ai/chat`, que chama o provedor e devolve a resposta e uma proposta de funil. A resposta do modelo é tratada como texto não confiável (`ai-utils.ts` reconstrói cada campo; só links http/https).

"Criar este funil" (`/api/marketing/ai/create`) grava um modelo por e-mail e um funil **rascunho**. Nada é ativado nem enviado.

- Enviado ao provedor: a conversa, a proposta atual e os nomes das etiquetas. Nenhum contato.
- Modelos vêm da lista do próprio provedor; nenhum nome fica fixo no código.
- Nos modelos Claude que aceitam, uma recusa é repassada pela API a outro modelo (`fallbacks: "default"`).

## Voz e anexos
- **Microfone:** ditado pelo reconhecimento de voz do próprio navegador (`SpeechRecognition`, Chrome e Edge; o botão some onde não existe). O navegador pode enviar o áudio ao serviço de voz do fabricante. O texto fica na caixa para revisar antes de enviar.
- **Documentos** (PDF, DOCX, TXT, MD, CSV): material que a IA lê para escrever os e-mails. Ficam só na tela e vão ao provedor a cada mensagem do chat; o MailLead não os grava nem publica. PDF vai inteiro (até 10 MB); do Word o navegador extrai o texto; textos somam até 100 mil caracteres. Até 5.
- **Imagens** (2 MB): vão para `marketing/assets/`, com endereço público e impossível de adivinhar, e viram blocos de imagem. A IA vê só o nome. Endereços de imagem que o modelo inventar são descartados.
