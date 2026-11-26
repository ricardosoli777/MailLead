# E-mail marketing — Desenho técnico

Requisitos em [spec.md](spec.md). Proposta de 2026-11-26.

## Decisões
| ID | Decisão | Motivo | Custo |
|----|---------|--------|-------|
| D1 | Aba **dentro** do MailFlare | Pedido do dono do projeto (substitui a sugestão anterior de app separado) | O fork passa a divergir do original |
| D2 | **Banco D1 separado** (`MARKETING_DB`), migrações em `drizzle-marketing/` | As migrações do autor são numeradas em sequência; as nossas colidiriam. Também isola carga e volume | Sem junção direta com as tabelas do e-mail; só D1 (sem PostgreSQL/MySQL); backup próprio a criar |
| D3 | Código isolado em `src/lib/marketing/`, `src/app/**/marketing/` e `/api/marketing/` | Poucos pontos de conflito: menu, `worker.ts`, `wrangler.jsonc` | — |
| D4 | Fila própria `mailflare-marketing` | Disparo em massa não atrasa o e-mail normal | Um recurso a mais na Cloudflare |
| D5 | SES com *configuration set* e subdomínio próprios | Separa reputação e eventos | A suspensão de uma conta SES afeta tudo que envia por ela |
| D6 | Fork público | O código do MailFlare é AGPL-3.0; quem usa pela rede deve poder obter o fonte | Sem segredos no repositório |

## O que já existe e será reaproveitado
Confirmar cada item na onda 0.
- `src/lib/aws/ses.ts`: envio SESv2 que aceita cabeçalhos personalizados.
- `src/lib/aws/sns-signature.ts` e `/api/provider-events/ses`: recebimento verificado de eventos. A lista de supressão atual vem **desligada por padrão** e é por domínio ([deliverability.md](../deliverability.md)).
- `src/lib/deliverability/`: DMARC e MTA-STS.
- Pixel de abertura, filas, cron de 5 minutos, R2, editor de texto, Turnstile.

## Dados (MARKETING_DB)
`contacts`, `lists`, `list_members`, `tags`, `consents` (somente acréscimo), `suppressions`, `templates`, `assets`, `campaigns`, `sends` (única por campanha + contato, atende K2), `events`, `forms`, `api_hooks`, `flows`, `flow_steps`, `flow_runs`, `daily_counters`.

## Caminho de um envio
campanha → materializa `sends` → fila em lotes → antes de **cada** envio confere consentimento, supressão, descadastro, aquecimento, cota e disjuntor → renderiza HTML e texto com cabeçalhos de descadastro → SES → eventos via SNS → atualiza `sends`, `suppressions` e contadores → disjuntor.

## Rotas públicas
Descadastro, preferências, confirmação, formulário, clique e abertura. Usam token assinado e não sequencial, sem dados pessoais na URL, com limite de requisições. O redirecionamento de clique só aceita destinos presentes na mensagem enviada.

## Riscos
- Conflito em atualizações do autor nos poucos arquivos compartilhados.
- Limites do D1 e das filas em disparos grandes: medir na onda 3.
- Termos da AWS proíbem envio não solicitado e listas compradas.
- WhatsApp não oficial pode bloquear o número.
