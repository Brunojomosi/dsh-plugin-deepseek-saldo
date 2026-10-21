# DeepSeek Balance — plugin do DSH

**Português** | [English](README.en.md)

Mostra o saldo em dinheiro da sua conta DeepSeek na barra lateral esquerda,
**logo acima do botão "More"**.

```
[ícone] Balance                    US$ 12,34
[•••]   More
```

![Linha "Balance" acima do botão "More" na barra lateral do DSH](https://raw.githubusercontent.com/Brunojomosi/dsh-plugin-deepseek-saldo/main/docs/preview.png)

## O que ele faz

- Lê o saldo em `GET https://api.deepseek.com/user/balance` usando a mesma
  credencial `DEEPSEEK_API_KEY` que o provedor `deepseek-official` do DSH usa.
- Exibe o **saldo total** (recarregado + concedido) na moeda devolvida pela API
  (normalmente `USD`). O número é formatado com a localidade do navegador
  (por exemplo `US$ 12,34`).
- Atualiza sozinho a cada 60 segundos enquanto a janela está visível.
- **Clique na linha** para forçar uma leitura nova (ignora o cache de 30 s).
- Passe o mouse para ver o detalhamento: concedido, recarregado, hora da
  última leitura e dica de uso.
- Em caso de problema, mostra `—` com o motivo no tooltip:
  - `DEEPSEEK_API_KEY` ausente no ambiente de lançamento/credenciais;
  - chave recusada pela API (HTTP 401/403);
  - falha de rede/timeout;
  - saldo abaixo do mínimo para novas requisições (valor em cor de aviso).

## Requisitos

- DSH 0.2.1-rc.2 (testado nessa versão; usa a API de slots de cliente e a
  Connection autenticada do harness).
- Credencial `DEEPSEEK_API_KEY` configurada — na página **Modelos** do DSH ou
  como variável de ambiente do processo que inicia o app.
- Nenhuma dependência npm e nenhum script de instalação.

## Instalação

Com o DSH aberto, peça ao agente:

> instale o plugin `dsh-plugin-deepseek-saldo`

Quando o pacote estiver publicado no npm, o `plugin_manager` baixa e habilita
sozinho. Enquanto isso, clone este repositório e instale a pasta:

```bash
git clone https://github.com/Brunojomosi/dsh-plugin-deepseek-saldo.git
```

> instale o plugin a partir da pasta `C:\caminho\do\clone`

O `plugin_manager` aceita o caminho absoluto do pacote. Depois de instalado, a
linha aparece sozinha na barra lateral; não é preciso reiniciar o app na
primeira instalação.

Repositório e issues:
<https://github.com/Brunojomosi/dsh-plugin-deepseek-saldo>

## Privacidade e segurança

- O único endereço externo é `https://api.deepseek.com/user/balance`.
- A chave fica apenas no processo do host: a página recebe somente número,
  moeda e horário, por uma rota autenticada da Connection do DSH
  (`/api/deepseek-balance/state`).
- O plugin não tem telemetria, não grava arquivos, não lê cookies/localStorage
  e não executa comandos.

## Estrutura

| Arquivo | Papel |
|---|---|
| `lib/index.js` | Metade de host: registra a rota autenticada na Connection do DSH e chama a API da DeepSeek. |
| `lib/client.js` | Metade de navegador: registra a linha em `sidebar.footer.action` (o espaço imediatamente acima do menu da conta). |
| `cordis.patch.yml` | Insere a entrada `deepseek-balance` no Loader do perfil. |
| `locale/en.json`, `locale/zh.json` | Título e descrição exibidos em Configurações → Plugins. |
| `icon.svg` | Ícone do plugin na lista de plugins. |

## Onde fica e como remover

O DSH instala o pacote como *link* para uma pasta do seu computador, então ela
precisa continuar existindo. Uma escolha comum é:

```
%USERPROFILE%\.dsh-plugins\dsh-plugin-deepseek-saldo
```

Mantenha a pasta fora de `Downloads` e fora da pasta de instalação do app, para
que limpezas e atualizações do DSH não afetem o plugin.

Para remover: Configurações → Plugins → DeepSeek Balance → desinstalar
(ou `plugin_manager` com `remove_bundle`). Reinicie o app se a remoção pedir.

> **Reinstalação:** o identificador do módulo de navegador é
> `dsh-plugin-deepseek-saldo`. Se você remover e reinstalar este mesmo pacote,
> o DSH pode manter em cache o módulo antigo como "ausente" e a linha só volta
> depois de reiniciar o app — é um comportamento do harness, não do plugin.

## Limitações

- Só aparece com a barra lateral expandida; no trilho de 56 px a linha é oculta.
- O saldo é o da **conta da API** (chave `DEEPSEEK_API_KEY`). Se a chave for
  trocada no ambiente, o próximo ciclo já lê o novo saldo.
- A moeda vem da API (CNY ou USD); não há conversão para BRL.

## Licença

MIT.
