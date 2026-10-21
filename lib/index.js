/**
 * Metade de host do `dsh-plugin-deepseek-balance`.
 *
 * Registra a rota autenticada de leitura do saldo:
 *
 *   GET /api/deepseek-balance/state[?refresh=1]
 *
 * A rota entra na Connection (`/api/...` e obrigatorio), entao passa pela
 * mesma admissao das chamadas RPC da pagina. A chave usada e a mesma do
 * provedor `deepseek-official` (referencia `DEEPSEEK_API_KEY`): primeiro pelo
 * servico de credenciais, depois pelo ambiente de lancamento e, por ultimo,
 * pelo `process.env`. O saldo vem de
 * `GET https://api.deepseek.com/user/balance`; a resposta e normalizada em
 * numeros e nunca inclui a chave.
 */
const ROUTE = "/api/deepseek-balance/state";

/** Endpoint oficial de saldo da conta DeepSeek. */
const BALANCE_URL = "https://api.deepseek.com/user/balance";

/** Janela de cache: varias janelas abertas compartilham uma leitura. */
const CACHE_MS = 30_000;

/** Prazo de uma leitura do saldo. */
const TIMEOUT_MS = 15_000;

/** Servicos exigidos: a Connection autentica a requisicao antes do handler. */
export const inject = ["connection"];

/** Ultima leitura bem resolvida (ou erro) compartilhada entre janelas. */
let cached;

/**
 * Resposta JSON curta e nao cacheavel pelo navegador.
 * @param {unknown} payload - corpo serializavel.
 * @returns {Response} a resposta HTTP.
 */
function json(payload) {
	return new Response(JSON.stringify(payload), {
		headers: {
			"content-type": "application/json; charset=utf-8",
			"cache-control": "private, no-store",
			"x-content-type-options": "nosniff",
		},
	});
}

/**
 * Converte um valor monetario textual da API em numero.
 * @param {unknown} value - valor cru (`"6.58"`).
 * @returns {number | undefined} o numero, ou undefined quando invalido.
 */
function toNumber(value) {
	const parsed = typeof value === "number" ? value : Number(value);
	return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * Resolve a chave da API DeepSeek pela mesma cadeia do provedor de modelo.
 * @param {object} ctx - contexto do plugin no processo principal.
 * @returns {Promise<string | undefined>} a chave, ou undefined quando ausente.
 */
async function resolveApiKey(ctx) {
	const ref = "DEEPSEEK_API_KEY";
	try {
		const credentials = ctx.get("credentials");
		if (credentials !== undefined && typeof credentials.resolve === "function") {
			const hit = await credentials.resolve(ref);
			if (hit !== undefined && typeof hit.value === "string" && hit.value.trim().length > 0) return hit.value.trim();
		}
	} catch {
		// sem servico de credenciais: cai para o ambiente
	}
	try {
		const environment = ctx.get("launchEnvironment");
		if (environment !== undefined && typeof environment.get === "function") {
			const hit = environment.get(ref);
			if (hit !== undefined && typeof hit.value === "string" && hit.value.trim().length > 0) return hit.value.trim();
		}
	} catch {
		// snapshot de lancamento ausente: cai para o processo
	}
	const ambient = process.env.DEEPSEEK_API_KEY;
	if (typeof ambient === "string" && ambient.trim().length > 0) return ambient.trim();
	return undefined;
}

/**
 * Le o saldo da conta na API oficial.
 * @param {string} key - chave da API DeepSeek.
 * @returns {Promise<object>} payload normalizado para a interface.
 */
async function readBalance(key) {
	let response;
	try {
		response = await fetch(BALANCE_URL, {
			method: "GET",
			headers: {
				authorization: "Bearer " + key,
				accept: "application/json",
			},
			redirect: "error",
			signal: AbortSignal.timeout(TIMEOUT_MS),
		});
	} catch (error) {
		const message = error && error.name === "TimeoutError" ? "timeout" : error && error.message ? error.message : String(error);
		return { ok: false, reason: "network", message };
	}
	if (response.status === 401 || response.status === 403) {
		await response.body?.cancel();
		return { ok: false, reason: "unauthorized", message: "a API recusou a chave DEEPSEEK_API_KEY (HTTP " + String(response.status) + ")" };
	}
	if (!response.ok) {
		await response.body?.cancel();
		return { ok: false, reason: "http", message: "HTTP " + String(response.status) };
	}
	let body;
	try {
		body = await response.json();
	} catch {
		return { ok: false, reason: "protocol", message: "resposta invalida da API" };
	}
	const infos = body && Array.isArray(body.balance_infos) ? body.balance_infos : [];
	const balances = [];
	for (const info of infos) {
		if (info === null || typeof info !== "object") continue;
		const total = toNumber(info.total_balance);
		const currency = typeof info.currency === "string" ? info.currency : "";
		if (total === undefined) continue;
		balances.push({
			currency,
			total,
			granted: toNumber(info.granted_balance),
			toppedUp: toNumber(info.topped_up_balance),
		});
	}
	return {
		ok: true,
		source: "api-key",
		isAvailable: body !== null && typeof body === "object" && body.is_available === true,
		fetchedAt: Date.now(),
		balances,
	};
}

/**
 * Responde uma leitura de estado, com cache curta e um caminho de refresh.
 * @param {object} ctx - contexto do plugin no processo principal.
 * @param {Request} request - requisicao ja autenticada.
 * @returns {Promise<Response>} a resposta HTTP.
 */
async function respond(ctx, request) {
	let force = false;
	try {
		force = new URL(request.url).searchParams.get("refresh") === "1";
	} catch {
		force = false;
	}
	if (!force && cached !== undefined && Date.now() - cached.at < CACHE_MS) return json(cached.payload);

	let payload;
	const key = await resolveApiKey(ctx);
	if (key === undefined) {
		payload = {
			ok: false,
			reason: "no-api-key",
			message: "DEEPSEEK_API_KEY nao configurada (credenciais ou ambiente de lancamento)",
			fetchedAt: Date.now(),
		};
	} else {
		payload = await readBalance(key);
	}
	cached = { at: Date.now(), payload };
	return json(payload);
}

/**
 * Metade de host: registra a rota de estado do saldo.
 * @param {object} ctx - contexto do plugin no processo principal.
 */
export function apply(ctx) {
	ctx.effect(
		() =>
			ctx.connection.fetch.register({
				path: ROUTE,
				methods: ["GET"],
				requestBody: "buffered",
				fetch: (request) => respond(ctx, request),
			}),
		"deepseek-balance: rota de estado"
	);
}
