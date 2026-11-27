"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/components/language-provider";
import { loadSecurityStatus } from "@/components/settings/passkey-settings-utils";
import type { SecurityStatus } from "@/components/settings/passkey-settings-types";
import { StepUpDialog } from "@/components/settings/step-up-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/auth/client";
import { requestError } from "@/lib/http/client-error";

type LoginEmail = { email: string; addresses: string[]; error?: string };

export function LoginEmailCard() {
	const { t } = useLanguage();
	const [current, setCurrent] = useState("");
	const [addresses, setAddresses] = useState<string[]>([]);
	const [selected, setSelected] = useState("");
	const [security, setSecurity] = useState<SecurityStatus | null>(null);
	const [confirming, setConfirming] = useState(false);
	const [status, setStatus] = useState("");

	useEffect(() => {
		let active = true;
		void authFetch("/api/admin/login-email", { cache: "no-store" })
			.then(async (response) => {
				const data = (await response.json()) as LoginEmail;
				if (!response.ok) throw new Error(data.error ?? t("general.loadFailed"));
				if (!active) return;
				setCurrent(data.email);
				setSelected(data.email);
				setAddresses(data.addresses);
			})
			.catch((error) => { if (active) setStatus(error instanceof Error ? error.message : t("general.loadFailed")); });
		void loadSecurityStatus().then((next) => { if (active) setSecurity(next); }).catch(() => undefined);
		return () => { active = false; };
	}, [t]);

	async function save(stepUpToken: string) {
		const response = await authFetch("/api/admin/login-email", {
			method: "PUT",
			// A 401 here means the proof was refused, not that the session ended.
			redirectOnUnauthorized: false,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email: selected, stepUpToken }),
		});
		const data = (await response.json()) as LoginEmail;
		if (!response.ok) throw requestError(data, t("general.saveFailed"));
		setCurrent(data.email);
		setStatus(t("general.loginEmailSaved", { email: data.email }));
	}

	// An address that is not one of the inboxes (an older account) stays listed.
	const options = current && !addresses.includes(current) ? [current, ...addresses] : addresses;

	return <Card className="rounded-3xl border-0 bg-white p-6">
		<CardHeader className="py-0"><CardTitle>{t("general.loginEmail")}</CardTitle></CardHeader>
		<CardContent className="pt-6"><form onSubmit={(event) => { event.preventDefault(); setStatus(""); setConfirming(true); }} className="space-y-4">
			<div className="space-y-2">
				<Label htmlFor="login-email">{t("general.loginEmailLabel")}</Label>
				<select id="login-email" value={selected} onChange={(event) => setSelected(event.target.value)} disabled={!current} className="block h-10 w-full max-w-sm rounded-md border border-neutral-200 bg-white px-3 text-sm">
					{options.map((address) => <option key={address} value={address}>{address}</option>)}
				</select>
			</div>
			<p className="text-sm text-neutral-500">{t("general.loginEmailHint")}</p>
			{status && <p role="status" className="text-sm text-neutral-700">{status}</p>}
			<Button type="submit" disabled={!current || selected === current}>{t("general.save")}</Button>
		</form></CardContent>
		<StepUpDialog
			open={confirming}
			hasPassword={security?.passwordSet ?? true}
			hasPasskey={(security?.passkeys.length ?? 0) > 0}
			requireSecondFactor={security?.requireSecondFactor ?? false}
			totpEnabled={security?.totpEnabled ?? false}
			action="admin.login_email"
			onOpenChange={(open) => !open && setConfirming(false)}
			onAuthorized={async (token) => {
				await save(token);
				setConfirming(false);
			}}
		/>
	</Card>;
}
