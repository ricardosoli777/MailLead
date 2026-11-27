/** How to use marketing, in the order a person needs it. Keep in step with docs/marketing/. */

type Topic = { title: string; intro?: string; steps?: string[]; tips?: string[] };

const TOPICS: Topic[] = [
	{
		title: "Comece por aqui",
		intro: "Esta é a ordem que funciona. Cada item tem um tópico abaixo.",
		steps: [
			"Envio: confira o remetente e se todas as verificações estão certas.",
			"Modelos: crie o e-mail que vai usar.",
			"Nova lista: crie uma lista. O formulário dela abre sozinho.",
			"Captura: ajuste o formulário e cole o código na sua página.",
			"Campanhas (um disparo) ou Funis (sequência automática).",
		],
	},
	{
		title: "Criar um modelo de e-mail",
		steps: [
			"Em Modelos, escolha um pronto pelo uso (boas-vindas, conteúdo, eventos, vendas, clientes, reativação, avisos) ou escreva para que é e clique em IA escolhe.",
			"Em Modelos, preencha os Dados do rodapé uma vez: valem para todos os e-mails.",
			"O link Descadastre-se aqui entra sozinho no fim de todo e-mail de marketing. Não precisa escrever nada.",
			"Troque o que está em [MAIÚSCULAS] e o endereço exemplo.com. O funil não ativa enquanto sobrar algum.",
			"Com um funil ativo, os números da tela de Funis se atualizam sozinhos a cada 10 segundos.",
			"Monte com blocos: título, texto, imagem, botão, vídeo ou áudio (viram capa com link) e divisor.",
			"Preencha o rodapé (empresa, contato e por que a pessoa recebe). Sem ele o modelo não é salvo.",
			"Salve e envie um teste para você.",
		],
		tips: [
			"Link no meio do texto: [clique aqui](https://seu-endereco.com), ou use o botão + Link no texto. Endereço solto também vira link.",
			"Vídeo não toca dentro do e-mail: o bloco Vídeo mostra a capa com o link. Para algo se mexendo, envie um GIF no bloco de imagem.",
			"Use {{nome|cliente}} para chamar pelo nome; quando não houver nome, aparece \"cliente\".",
			"Um assunto claro, sem tudo em maiúsculas, ajuda a não cair no spam.",
		],
	},
	{
		title: "Listas, contatos e consentimento",
		steps: [
			"Em Nova lista, crie a lista (ex.: Clientes).",
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
			"Confirme. O envio começa em cerca de 1 minuto.",
			"Acompanhe entregues, devoluções, cliques e descadastros no relatório.",
		],
		tips: [
			"Comece com uma lista pequena e engajada.",
			"Aberturas são aproximadas; confie mais nos cliques.",
			"Por padrão, quem não abre há 180 dias fica de fora e cada pessoa recebe no máximo 3 campanhas por semana.",
		],
	},
	{
		title: "Áudio por WhatsApp no funil",
		steps: [
			"Em WhatsApp, salve o endereço e o token da instância e envie um teste.",
			"Em Captura, ligue \"Pedir WhatsApp\" no formulário e salve. Se já colou o código no site, copie de novo.",
			"Em Funis, adicione o bloco \"Áudio no WhatsApp\" e grave ou envie o áudio dentro dele.",
			"Salve e ative o funil. Depois clique em Testar, dentro do funil, e cadastre-se com os seus dados.",
		],
		tips: [
			"Só recebe quem marcou a autorização no formulário. Os outros seguem o funil sem o áudio.",
			"Os envios saem devagar: no máximo 5 a cada 5 minutos e 100 por dia, das 8h às 20h.",
			"Se a pessoa pedir para parar, abra o contato em Contatos e clique em Parar WhatsApp. A resposta \"SAIR\" ainda não é lida automaticamente.",
			"Quem se descadastra do e-mail sai do funil e também deixa de receber os áudios.",
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
			"O envio sai em pequenos lotes a cada minuto, com limite por provedor (Gmail, Outlook, Yahoo).",
			"Pausa automática: se devoluções chegarem a 2% ou reclamações a 0,08% (com pelo menos 50 envios), tudo para e você é avisado.",
			"Todo e-mail de marketing leva o link de descadastro, que vale na hora.",
		],
	},
	{
		title: "WhatsApp (primeira etapa: conexão e teste)",
		steps: [
			"No seu Evolution Go, crie uma instância só para o MailLead e leia o QR Code com o número que vai enviar.",
			"Em WhatsApp, informe o endereço do servidor e o token dessa instância.",
			"Grave um áudio, ouça e envie para o seu próprio número.",
		],
		tips: [
			"Use o token da instância, nunca a chave geral do servidor.",
			"O envio dentro dos funis ainda não existe: vem depois do teste.",
			"O token não entra no backup. Depois de restaurar, cole de novo.",
		],
	},
	{
		title: "Criar funil com IA",
		steps: [
			"Em IA, cole a chave de API da OpenAI, Anthropic ou Google, escolha o modelo e marque \"Usar este\".",
			"Em Funis, no quadro \"Criar com IA\", conte o que você oferece, para quem e o objetivo. Pode digitar ou falar pelo microfone.",
			"No clipe, anexe documentos (PDF, Word, TXT) para a IA ler e escrever os e-mails, e imagens para aparecerem neles.",
			"Leia a proposta (clique em cada e-mail para ver o texto) e peça ajustes no chat.",
			"Clique em \"Criar este funil\". Ele abre como rascunho, com os e-mails já escritos.",
		],
		tips: [
			"As chaves ficam só no seu navegador. Em outro computador, cole de novo.",
			"Os documentos vão ao provedor de IA e não ficam guardados no MailLead. As imagens ficam em endereço público.",
			"O microfone usa o reconhecimento de voz do navegador (Chrome e Edge).",
			"O uso da API é cobrado pelo provedor.",
			"Revise sempre: a IA pode errar. Nada é enviado antes de você ativar.",
		],
	},
	{
		title: "Backup e restauração",
		tips: [
			"Em Backup: uma cópia é feita todo dia e ficam as últimas 30. Antes de uma grande mudança, clique em Fazer backup agora.",
			"Baixe uma cópia de vez em quando e guarde fora do MailLead. O arquivo contém dados dos contatos.",
			"Restaurar só acrescenta o que falta. Não desfaz descadastros nem exclusões a pedido, e não envia nada sozinho: funis e campanhas voltam pausados.",
			"Imagens dos modelos ficam no armazenamento de arquivos, fora desta cópia.",
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
			"WhatsApp dentro dos funis.",
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
