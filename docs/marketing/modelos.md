# Modelos prontos

`src/lib/marketing/starters.ts` traz os e-mails prontos, separados por uso: boas-vindas, conteúdo, eventos, vendas, clientes, reativação e avisos. Os textos são do MailLead; nenhum foi copiado de outra ferramenta.

Aparecem em **Marketing → Criar → Modelos** e dentro da caixa de e-mail do funil (**Escolher modelo pronto**).

## Dados do rodapé

Em **Modelos**, preencha nome, sobrenome, empresa, endereço, CEP, cidade, estado, país e contato, e monte o **Rodapé do e-mail** no editor: negrito, itálico, sublinhado, riscado, alinhamento, lista, link, tamanho, cor e **Inserir variável**. **Salvar e aplicar em todos** troca o rodapé de todos os modelos e dos funis e campanhas ainda não concluídos, mesmo ativos. O que já foi enviado não muda.

O HTML é reconstruído no servidor com uma lista curta de marcas e estilos (`rich-footer.ts`); o resto é descartado.

## Link de descadastro

Entra sozinho no fim de todo e-mail de marketing, com um endereço próprio para cada pessoa, junto com o cabeçalho de descadastro em um clique. Para repeti-lo no texto: `{{link_descadastro}}` ou `[sair da lista]({{link_descadastro}})`. Inserido pelo compositor do e-mail comum, o modelo não leva o link, porque não é envio de marketing.

## Variáveis

No editor, **Inserir variável** coloca o código onde está o cursor (assunto, prévia, títulos, textos, texto do botão e aviso legal).

| Código | Valor |
| --- | --- |
| `{{nome\|cliente}}`, `{{email}}` | do lead (o texto depois da barra é a reserva) |
| `{{remetente_nome}}`, `{{remetente_sobrenome}}`, `{{remetente_empresa}}` | seus, dos Dados do rodapé |
| `{{remetente_endereco}}`, `{{remetente_cep}}`, `{{remetente_cidade}}`, `{{remetente_estado}}`, `{{remetente_pais}}`, `{{remetente_contato}}` | seus, dos Dados do rodapé |
| `{{ano}}`, `{{link_descadastro}}` | ano atual e link da pessoa |

## IA escolhe

Escreva para que é o e-mail e clique em **IA escolhe** (precisa da chave em **Marketing → IA**). A IA só aponta um dos modelos da lista; não altera o texto.

## O que preencher

O que está em `[MAIÚSCULAS]` e o endereço `exemplo.com` dos botões são seus. Se sobrar algum:

- o funil não ativa e diz o que falta;
- a campanha mostra um aviso antes do envio.
