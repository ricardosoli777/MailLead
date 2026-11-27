# Modelos prontos

`src/lib/marketing/starters.ts` traz os e-mails prontos, separados por uso: boas-vindas, conteúdo, eventos, vendas, clientes, reativação e avisos. Os textos são do MailLead; nenhum foi copiado de outra ferramenta.

Aparecem em **Marketing → Criar → Modelos** e dentro da caixa de e-mail do funil (**Escolher modelo pronto**).

## Dados do rodapé

Em **Modelos**, preencha uma vez: nome, sobrenome, empresa, endereço, CEP, cidade, estado, país, contato, aviso legal e a opção "Todos os direitos reservados". Obrigatórios só a empresa ou o nome, o contato e o aviso legal; campo vazio não aparece. **Salvar e aplicar em todos** troca o rodapé de todos os modelos e dos funis e campanhas ainda não concluídos, mesmo ativos. O que já foi enviado não muda. Enquanto não preencher, cada modelo tem o seu rodapé.

## Link de descadastro

Entra sozinho no fim de todo e-mail de marketing, com um endereço próprio para cada pessoa, junto com o cabeçalho de descadastro em um clique. Não há variável para escrever. Inserido pelo compositor do e-mail comum, o modelo não leva o link, porque não é envio de marketing.

## IA escolhe

Escreva para que é o e-mail e clique em **IA escolhe** (precisa da chave em **Marketing → IA**). A IA só aponta um dos modelos da lista; não altera o texto.

## O que preencher

O que está em `[MAIÚSCULAS]` e o endereço `exemplo.com` dos botões são seus. Se sobrar algum:

- o funil não ativa e diz o que falta;
- a campanha mostra um aviso antes do envio.
