"use client";

// The person chooses which data to write; the codes are swapped for the values when the e-mail leaves.
export const SENDER_CODES = {
	firstName: "{{remetente_nome}}",
	lastName: "{{remetente_sobrenome}}",
	company: "{{remetente_empresa}}",
	address: "{{remetente_endereco}}",
	zip: "{{remetente_cep}}",
	city: "{{remetente_cidade}}",
	state: "{{remetente_estado}}",
	country: "{{remetente_pais}}",
	contact: "{{remetente_contato}}",
} as const;

const GROUPS = [
	{ label: "Do lead", items: [["Nome", "{{nome|cliente}}"], ["E-mail", "{{email}}"]] },
	{
		label: "Meus dados",
		items: [["Meu nome", SENDER_CODES.firstName], ["Meu sobrenome", SENDER_CODES.lastName], ["Empresa", SENDER_CODES.company], ["Endereço", SENDER_CODES.address], ["CEP", SENDER_CODES.zip], ["Cidade", SENDER_CODES.city], ["Estado", SENDER_CODES.state], ["País", SENDER_CODES.country], ["Contato", SENDER_CODES.contact]],
	},
	{ label: "Outros", items: [["Ano atual", "{{ano}}"], ["Link de descadastro", "{{link_descadastro}}"]] },
];

export function VariablePicker({ label, onPick }: { label: string; onPick: (code: string) => void }) {
	return (
		<select className="h-8 max-w-full rounded-md border border-neutral-200 bg-white px-2 text-xs text-neutral-600" aria-label={`Inserir variável em ${label}`} value="" onChange={(event) => event.target.value && onPick(event.target.value)}>
			<option value="">+ Inserir variável</option>
			{GROUPS.map((group) => (
				<optgroup key={group.label} label={group.label}>
					{group.items.map(([name, code]) => <option key={code} value={code}>{name}</option>)}
				</optgroup>
			))}
		</select>
	);
}
