import { authFetch } from "@/lib/auth/client";

export async function marketingRequest<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await authFetch(url, { cache: "no-store", ...init });
	const data = (await response.json().catch(() => ({}))) as T & { error?: string };
	if (!response.ok) throw new Error(data.error ?? "Não foi possível concluir a operação.");
	return data;
}
