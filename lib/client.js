/**
 * Metade de navegador do `dsh-plugin-deepseek-saldo`.
 *
 * Registra uma linha no slot `sidebar.footer.action` — a area do pe da barra
 * lateral esquerda que fica logo acima do botao "More" — mostrando o saldo em
 * dinheiro da conta DeepSeek. O valor vem da rota autenticada
 * `GET /deepseek-balance/state`, registrada pela metade de host.
 */
window.__ModuleLoader__.load({
	id: "dsh-plugin-deepseek-saldo",
	factory(require) {
		const React = require("react");

		/** Namespace de textos deste plugin. */
		const NS = "deepseekBalance";

		/** Rota de estado no servidor local (relativa a base da janela). */
		const ROUTE = "api/deepseek-balance/state";

		/** Intervalo de atualizacao enquanto a janela esta visivel. */
		const POLL_MS = 60_000;

		/** Dicionarios (en/zh sao os idiomas embutidos do cliente). */
		const DICTIONARIES = {
			en: {
				label: "Balance",
				loading: "Reading the balance…",
				error: "Could not read the balance",
				empty: "No balance reported",
				refresh: "Click to refresh",
				granted: "Granted",
				toppedUp: "Topped up",
				updated: "Updated",
				signIn: "Sign in to your DeepSeek account in the app to see the balance.",
				noKey: "No DeepSeek API key configured.",
				insufficient: "Balance is below the minimum required for new requests.",
			},
			zh: {
				label: "余额",
				loading: "正在读取余额…",
				error: "无法读取余额",
				empty: "没有余额信息",
				refresh: "点击刷新",
				granted: "赠送",
				toppedUp: "充值",
				updated: "更新于",
				signIn: "请先在应用内登录 DeepSeek 账户。",
				noKey: "未配置 DeepSeek API 密钥。",
				insufficient: "余额低于发起新请求所需的最低额度。",
			},
		};

		/**
		 * Texto traduzido com queda segura para o ingles.
		 * @param {unknown} t - tradutor injetado pelo slot (pode nao existir).
		 * @param {string} key - chave do dicionario.
		 * @returns {string} o texto.
		 */
		function text(t, key) {
			const fallback = DICTIONARIES.en[key] ?? key;
			try {
				if (typeof t === "function") {
					const value = t(key);
					if (typeof value === "string" && value.length > 0 && value !== key) return value;
				}
			} catch {
				// tradutor ausente ou quebrado: usa o ingles
			}
			return fallback;
		}

		/**
		 * Formata um valor monetario com a moeda informada.
		 * @param {unknown} amount - valor numerico ou string numerica.
		 * @param {unknown} currency - codigo ISO da moeda (USD, CNY, ...).
		 * @returns {string | null} o valor formatado, ou null quando invalido.
		 */
		function formatMoney(amount, currency) {
			const value = typeof amount === "number" ? amount : Number(amount);
			if (!Number.isFinite(value)) return null;
			const code = typeof currency === "string" && /^[A-Za-z]{3}$/u.test(currency) ? currency.toUpperCase() : "";
			const locale = typeof navigator !== "undefined" && typeof navigator.language === "string" ? navigator.language : undefined;
			try {
				return new Intl.NumberFormat(locale, {
					style: "currency",
					currency: code.length > 0 ? code : "USD",
					minimumFractionDigits: 2,
					maximumFractionDigits: 2,
				}).format(value);
			} catch {
				return (code.length > 0 ? code + " " : "") + value.toFixed(2);
			}
		}

		/**
		 * Hora local curta de uma marca temporal.
		 * @param {unknown} timestamp - epoch em milissegundos.
		 * @returns {string} hora formatada, ou string vazia.
		 */
		function clock(timestamp) {
			if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "";
			try {
				return new Date(timestamp).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
			} catch {
				return "";
			}
		}

		/**
		 * Estilo da linha: copia as medidas da linha do menu da conta no pe da
		 * barra lateral (32px de altura, 14px de fonte, raio de 12px).
		 */
		const ROW_CSS = [
			".dsb-row{display:flex;align-items:center;gap:8px;flex:1 1 auto;min-width:0;",
			"height:32px;padding:6px 6px;box-sizing:border-box;background:transparent;border:0;",
			"border-radius:12px;color:var(--dsw-alias-label-primary);",
			"font:400 14px/20px ui-sans-serif,system-ui,'Segoe UI',sans-serif;",
			"text-align:left;cursor:pointer;overflow:hidden}",
			".dsb-row:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".dsb-label{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;",
			"white-space:nowrap;color:var(--dsw-alias-label-primary)}",
			".dsb-value{flex:none;font-weight:500;font-variant-numeric:tabular-nums;white-space:nowrap}",
		].join("");

		/** Icone de carteira desenhado com a cor do texto do host. */
		function WalletIcon() {
			return React.createElement(
				"svg",
				{
					width: 14,
					height: 14,
					viewBox: "0 0 24 24",
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 1.7,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": "true",
					style: { flex: "none", display: "block", opacity: 0.9 },
				},
				React.createElement("path", { d: "M4 7.5A2.5 2.5 0 0 1 6.5 5H18a1 1 0 0 1 1 1v2.5" }),
				React.createElement("path", { d: "M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1H6.5" }),
				React.createElement("circle", { cx: 16.5, cy: 13.5, r: 1.35, fill: "currentColor", stroke: "none" })
			);
		}

		/**
		 * Linha do pe da barra lateral com o saldo atual.
		 * @param {object} props - props do slot (`wide` + hooks/tradutor padrao).
		 * @returns {object | null} a linha, ou null no trilho estreito.
		 */
		function BalanceRow(props) {
			const wide = props === null || props === undefined || props.wide !== false;
			const t = props ? props.t : undefined;
			const [snapshot, setSnapshot] = React.useState({ phase: "loading" });
			const [tick, setTick] = React.useState(0);

			React.useEffect(() => {
				if (!wide) return undefined;
				if (typeof document === "undefined" || typeof fetch !== "function") {
					setSnapshot({ phase: "error", message: "no fetch" });
					return undefined;
				}
				let cancelled = false;
				/**
				 * Monta a URL da rota; `force` ignora o cache curto do host.
				 * @param {boolean} force - pede leitura nova da API.
				 * @returns {URL | undefined} a URL, ou undefined quando a base nao serve.
				 */
				const makeUrl = (force) => {
					try {
						return new URL(ROUTE + (force ? "?refresh=1" : ""), document.baseURI);
					} catch {
						return undefined;
					}
				};
				const run = (force) => {
					const url = makeUrl(force);
					if (url === undefined) {
						setSnapshot({ phase: "error", message: "bad url" });
						return;
					}
					fetch(url.href, {
						cache: "no-store",
						credentials: "same-origin",
						headers: { accept: "application/json" },
					})
						.then((response) => {
							if (!response.ok) throw new Error("HTTP " + String(response.status));
							return response.json();
						})
						.then((data) => {
							if (!cancelled) setSnapshot({ phase: "ready", data });
						})
						.catch((error) => {
							if (!cancelled) setSnapshot({ phase: "error", message: error && error.message ? error.message : String(error) });
						});
				};
				run(tick > 0);
				const timer = setInterval(() => {
					if (typeof document === "undefined" || document.visibilityState !== "hidden") run(false);
				}, POLL_MS);
				return () => {
					cancelled = true;
					clearInterval(timer);
				};
			}, [wide, tick]);

			if (!wide) return null;

			const data = snapshot.phase === "ready" && snapshot.data && typeof snapshot.data === "object" ? snapshot.data : undefined;
			const list = data && Array.isArray(data.balances) ? data.balances : [];
			const primary = list.length > 0 && list[0] && typeof list[0] === "object" ? list[0] : undefined;
			const amount = primary ? formatMoney(primary.total, primary.currency) : null;
			const ok = data !== undefined && data.ok === true;
			const label = text(t, "label");

			let value;
			let tone = "var(--dsw-alias-label-primary)";
			if (snapshot.phase === "loading") value = "···";
			else if (snapshot.phase === "error" || !ok) {
				value = "—";
				tone = "var(--dsw-alias-state-error-primary)";
			} else if (amount === null) value = "—";
			else value = amount;

			const lines = [];
			if (snapshot.phase === "error") lines.push(text(t, "error") + ": " + snapshot.message);
			if (ok && data && data.isAvailable === false) {
				tone = "var(--dsw-alias-state-warn-primary)";
				lines.push(text(t, "insufficient"));
			}
			if (ok && primary) {
				if (primary.granted !== undefined) {
					const granted = formatMoney(primary.granted, primary.currency);
					if (granted !== null) lines.push(text(t, "granted") + ": " + granted);
				}
				if (primary.toppedUp !== undefined) {
					const toppedUp = formatMoney(primary.toppedUp, primary.currency);
					if (toppedUp !== null) lines.push(text(t, "toppedUp") + ": " + toppedUp);
				}
				for (const extra of list.slice(1)) {
					const formatted = formatMoney(extra && extra.total, extra && extra.currency);
					if (formatted !== null) lines.push(formatted);
				}
				if (data.fetchedAt !== undefined) {
					const when = clock(data.fetchedAt);
					if (when.length > 0) lines.push(text(t, "updated") + " " + when);
				}
			}
			if (!ok && data && typeof data.reason === "string") {
				if (data.reason === "sign-in-required") lines.push(text(t, "signIn"));
				else if (data.reason === "no-api-key") lines.push(text(t, "noKey"));
				else if (typeof data.message === "string") lines.push(data.message);
			}
			if (snapshot.phase === "loading") lines.push(text(t, "loading"));
			lines.push(text(t, "refresh"));

			const title = label + ": " + value + "\n" + lines.join("\n");

			return React.createElement(
				React.Fragment,
				null,
				React.createElement("style", { "data-plugin": "deepseek-balance" }, ROW_CSS),
				React.createElement(
					"button",
					{
						type: "button",
						className: "dsb-row",
						title,
						"aria-label": label + ": " + value,
						onClick: () => setTick((current) => current + 1),
					},
					React.createElement(WalletIcon, null),
					React.createElement("span", { className: "dsb-label" }, label),
					React.createElement("span", { className: "dsb-value", style: { color: tone } }, value)
				)
			);
		}

		/** Servicos exigidos pela metade de navegador. */
		const inject = ["slots", "locale"];

		/**
		 * Registra os textos e a linha do pe da barra lateral.
		 * @param {object} ctx - contexto do plugin de cliente.
		 */
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, DICTIONARIES), "deepseek-balance: dicionarios");
			ctx.slots.inject("sidebar.footer.action", () =>
				ctx.slots.register(
					{
						name: "sidebar.footer.action",
						id: "deepseek-balance",
						order: -20,
						locale: NS,
					},
					BalanceRow
				)
			);
		}

		return {
			apply,
			inject,
		};
	},
});
