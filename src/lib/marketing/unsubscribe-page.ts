/** Plain HTML with ordinary forms: it must work without a session or scripts. */

const escapes: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (value: string) => value.replace(/[&<>"']/g, (char) => escapes[char]);

export function maskEmail(email: string): string {
	const at = email.lastIndexOf("@");
	return `${email.slice(0, Math.min(2, at))}***${email.slice(at)}`;
}

function page(body: string, status = 200): Response {
	return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Preferências de e-mail</title><style>
body{margin:0;background:#f6f8fc;font-family:Arial,Helvetica,sans-serif;color:#202124}
main{max-width:420px;margin:48px auto;padding:28px;background:#fff;border-radius:16px}
h1{font-size:20px;margin:0 0 12px}p{line-height:1.5;color:#5f6368}
label{display:flex;gap:10px;padding:8px 0}
button{width:100%;padding:12px;border-radius:8px;border:1px solid #0b57d0;font-size:15px;cursor:pointer;margin-top:12px}
.primary{background:#0b57d0;color:#fff}.secondary{background:#fff;color:#0b57d0}
</style></head><body><main>${body}</main></body></html>`, {
		status,
		headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Referrer-Policy": "same-origin" },
	});
}

export const invalidLinkPage = () => page("<h1>Link inválido</h1><p>Este endereço não é válido. Responda à mensagem recebida para pedir a remoção.</p>", 404);

export const removedPage = () => page("<h1>Pronto, você saiu</h1><p>Você não receberá mais nossas mensagens de marketing.</p>");

export function preferencesPage(contact: { email: string; lists: { id: string; name: string; unsubscribed: boolean }[] }, saved = false): Response {
	const lists = contact.lists.length
		? `<form method="post"><input type="hidden" name="action" value="save">${contact.lists
			.map((list) => `<label><input type="checkbox" name="list" value="${esc(list.id)}"${list.unsubscribed ? "" : " checked"}> ${esc(list.name)}</label>`)
			.join("")}<button class="secondary">Salvar preferências</button></form>`
		: "";
	return page(`<h1>Preferências de e-mail</h1><p>${esc(maskEmail(contact.email))}</p>${saved ? "<p><strong>Preferências salvas.</strong></p>" : ""}${lists}<form method="post"><input type="hidden" name="action" value="all"><button class="primary">Sair de tudo</button></form>`);
}
