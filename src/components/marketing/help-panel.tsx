/** How to use marketing, in the order a person needs it. Keep in step with docs/marketing/. */

type Topic = { title: string; intro?: string; steps?: string[]; tips?: string[] };

const TOPICS: Topic[] = [
	{
		title: "Comece por aqui",
		intro: "Esta é a ordem que funciona. Cada item tem um tópico abaixo.",
		steps: [
			"Envio: confira o remetente e se todas as verificações estão certas.",
			"Modelos: crie o e-mail que vai usar.",
			"Contatos: crie uma lista. O formulário dela abre sozinho.",
			"Captura: ajuste o formulário e cole o código na sua página.",
			"Campanhas (um disparo) ou Funis (sequência automática).",
		],
	},
	{
		title: "Criar um modelo de e-mail",
		steps: [
			"Em Modelos, comece de um pronto (comercial, proposta, comunicado, newsletter) ou crie o seu.",
			"Monte com blocos: título, texto, imagem, botão, vídeo ou áudio (viram capa com link) e divisor.",
			"Preencha o rodapé (empresa, contato e por que a pessoa recebe). Sem ele o modelo não é salvo.",
			"Salve e envie um teste para você.",
		],
		tips: [
			"Use {{nome|cliente}} para chamar pelo nome; quando não houver nome, aparece \"cliente\".",
			"Um assunto claro, sem tudo em maiúsculas, ajuda a não cair no spam.",
		],
	},
	{
		title: "Listas, contatos e consentimento",
		steps: [
			"Em Contatos, crie a lista (ex.: Clientes).",
			"Para trazer pessoas que já tem, importe um CSV com a coluna \"email\" (e \"nome\") e informe como elas aceitaram.",
			"Use etiquetas para separar perfis (ex.: comprou, interessado).",
		],
		tips: [
			"Só recebe quem tem registro de aceite, está na lista e não saiu nem foi bloqueado.",
			"Não importe listas compradas ou coletadas sem permissão: a AWS suspende a conta.",
			"Importar de novo não traz de volta quem saiu.",
		],
	},
	{
		title: "Capturar leads na sua página de vendas",
		steps: [
			"Crie a lista; o formulário dela abre em Captura.",
			"Adicione os campos (telefone, cidade…), marque os obrigatórios e salve.",
			"Copie o código e cole na sua página, ou divulgue o link da página pronta.",
			"Teste com o seu próprio e-mail.",
		],
		tips: [
			"Com a confirmação ligada, o lead só entra depois de clicar no e-mail que recebe.",
			"Mudou os campos? Copie e cole o código de novo.",
			"Webhook: outro sistema envia o e-mail assinado e a pessoa entra com as etiquetas escolhidas.",
			"API: para o seu próprio sistema adicionar e remover contatos. A chave aparece uma única vez.",
		],
	},
	{
		title: "Enviar uma campanha",
		intro: "Um disparo único para uma lista.",
		steps: [
			"Em Campanhas, escolha nome, modelo, assunto e lista. Se quiser, filtre por etiqueta ou agende.",
			"Clique em Revisar e leia os avisos.",
			"Confirme. O envio começa em até 5 minutos.",
			"Acompanhe entregues, devoluções, cliques e descadastros no relatório.",
		],
		tips: [
			"Comece com uma lista pequena e engajada.",
			"Aberturas são aproximadas; confie mais nos cliques.",
			"Por padrão, quem não abre há 180 dias fica de fora e cada pessoa recebe no máximo 3 campanhas por semana.",
		],
	},
	{
		title: "Criar um funil (sequência automática)",
		intro: "Um fluxograma: quando alguém entra na lista ou recebe uma etiqueta, as caixas acontecem sozinhas, de cima para baixo.",
		steps: [
			"Em Funis, escolha um ponto de partida (boas-vindas, entrega de material, venda, pós-compra ou em branco), dê um nome e crie.",
			"Clique na caixa Início e escolha a lista e quando começa.",
			"Arraste blocos para a tela (ou clique neles, ou no +) e ligue as caixas puxando a linha da bolinha de baixo até a próxima.",
			"Clique numa caixa para ajustar, duplicar ou apagar. Em \"Enviar e-mail\", dê um nome à etapa.",
			"Com o desenho pronto, abra cada e-mail e clique em Escrever e-mail (ou use um modelo salvo).",
			"Salvar e ativar. Caixas com problema ficam em vermelho, com o motivo. Para editar depois, pause antes.",
		],
		tips: [
			"Blocos: Enviar e-mail, Esperar (horas ou dias), Condição (clicou, abriu ou tem etiqueta, com saídas Sim e Não), Etiqueta e Fim.",
			"O + no meio de uma linha coloca um passo ali; o × apaga a linha. A tecla Delete apaga o que está selecionado.",
			"Os botões de baixo desfazem, refazem, organizam as caixas e aproximam ou afastam.",
			"Os dois lados da condição podem voltar a se encontrar na mesma caixa. Linha voltando para cima não é permitida.",
			"Coloque uma espera antes de uma condição de clique, para dar tempo à pessoa.",
			"Objetivo: quem receber a etiqueta escolhida (ex.: comprou, vinda do webhook de venda) sai na hora.",
			"Só entra quem chegar depois da ativação. Cada pessoa passa uma vez por funil.",
			"Montar é mais confortável no computador; no celular dá para acompanhar e ajustar tocando.",
		],
	},
	{
		title: "Proteção de reputação (por que o envio pode esperar)",
		tips: [
			"Aquecimento: 50 por dia nos primeiros 3 dias, depois 150, 500, 1.000, 2.000 e crescendo aos poucos.",
			"O envio sai em lotes a cada 5 minutos, com limite por provedor (Gmail, Outlook, Yahoo).",
			"Pausa automática: se devoluções chegarem a 2% ou reclamações a 0,08% (com pelo menos 50 envios), tudo para e você é avisado.",
			"Todo e-mail de marketing leva o link de descadastro, que vale na hora.",
		],
	},
	{
		title: "Meu e-mail não saiu. O que ver?",
		tips: [
			"Envio: alguma verificação está pendente ou o disjuntor pausou?",
			"Limite do dia atingido pelo aquecimento: o restante sai depois.",
			"A pessoa não tem aceite registrado, saiu da lista ou está bloqueada.",
			"Funil: está ativo? A pessoa entrou depois da ativação?",
			"Confira a caixa de spam.",
		],
	},
	{
		title: "Ainda não existe",
		tips: [
			"WhatsApp.",
			"Adaptadores prontos para plataformas de venda (Hotmart, Kiwify e outras).",
			"Teste A/B, pontuação de leads, carrinho abandonado e páginas de captura completas.",
		],
	},
];

export function HelpPanel() {
	return (
		<div className="max-w-3xl space-y-3">
			{TOPICS.map((topic, index) => (
				<details key={topic.title} open={index === 0} className="rounded-3xl bg-white p-6">
					<summary className="cursor-pointer text-base font-semibold">{topic.title}</summary>
					<div className="mt-3 space-y-3 text-sm text-neutral-700">
						{topic.intro && <p>{topic.intro}</p>}
						{topic.steps && <ol className="list-decimal space-y-1 pl-5">{topic.steps.map((item) => <li key={item}>{item}</li>)}</ol>}
						{topic.tips && <ul className="list-disc space-y-1 pl-5">{topic.tips.map((item) => <li key={item}>{item}</li>)}</ul>}
					</div>
				</details>
			))}
		</div>
	);
}
