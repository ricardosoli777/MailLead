/** The AI keys live only in this browser, in IndexedDB. */
import type { AiProvider } from "@/lib/marketing/ai-types";

export type AiSettings = {
	active: AiProvider | "";
	providers: Partial<Record<AiProvider, { key: string; model: string; models: string[] }>>;
};

export const emptyAiSettings = (): AiSettings => ({ active: "", providers: {} });

const STORE = "settings";

function open(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open("maillead-ai", 1);
		request.onupgradeneeded = () => request.result.createObjectStore(STORE);
		request.onsuccess = () => resolve(request.result);
		request.onerror = () => reject(request.error);
	});
}

async function run<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
	const db = await open();
	try {
		return await new Promise<T>((resolve, reject) => {
			const transaction = db.transaction(STORE, mode);
			const request = action(transaction.objectStore(STORE));
			transaction.oncomplete = () => resolve(request.result);
			transaction.onerror = transaction.onabort = () => reject(transaction.error);
		});
	} finally {
		db.close();
	}
}

export async function readAiSettings(): Promise<AiSettings> {
	return ((await run("readonly", (store) => store.get("config"))) as AiSettings | undefined) ?? emptyAiSettings();
}

export async function writeAiSettings(settings: AiSettings): Promise<void> {
	await run("readwrite", (store) => store.put(settings, "config"));
}
