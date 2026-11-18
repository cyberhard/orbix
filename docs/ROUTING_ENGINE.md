# Орбита: единый движок маршрутизации (L1 Direct / L2 Zapret / L3 VPN)

Архитектура вдохновлена `ordo-systems/keen-proxy` (fwmark + policy-таблица +
DNS-фронт + URLTest-балансировка), реализована нативно под стек панели:
fw4/nftables + iproute2 + sing-box + dnsmasq, генераторы на TypeScript.

## Три уровня (строгий порядок вычисления)

1. **L1 Direct (Россия).** Зоны `.ru`, `.рф` (`xn--p1ai`), `.su` + курируемые
   RU CIDR (банки, госсайты, VK/Yandex/Mail) — `return` в цепочке
   `inet paneltiers marktier` ДО любых меток: трафик идёт напрямую через WAN,
   минуя и VPN-маркировку, и Zapret (dnsmasq nftset наполняет `tier1dyn`).
2. **L2 Zapret.** Домены, которые ТСПУ режет, но которые не банят российские
   IP (YouTube, googlevideo, пользовательский список) — IP из dnsmasq nftset
   `tier2` + статичные `tier2static` CIDR (пиннованные живые рёбра Meta для
   Instagram) — `return` до catch-all: прямой WAN через очереди nfqws.
3. **L3 VPN.** Весь остальной внешний трафик: `meta mark set` + `ip rule`
   `fwmark/mask table 258` → default dev sing-box TUN. `final="proxy"` в
   sing-box, узел выбирает балансировщик реальной пропускной способности.

Loop-guard инварианты (проверяются юнит-тестами):
- IP серверов подписки (`@nodeip`) — первая же проверка цепочки, никогда не
  маркируются (иначе VPN ест сам себя);
- цепочка трогает только `iifname br-lan`;
- сегмент TUN, приватные и link-local диапазоны — `return`;
- `tier3ExtraDomains` (Discord, принудительно проксируемые) маркируются ДО
  возвратов L2;
- sing-box-правила дублируют эти же условия (domain_suffix/ip_cidr) и держат
  `default_domain_resolver` вне узла-резолвера.

## Почему Discord в L3, а не L2 (измерено 2026-11)

Автоподбор стратегий (`panel-zaptest`, домен discord.com в пробах): контрольная
проверка 2/5; `fake ttl3`, `fake ttl5`, `fake ttl5+retries=2`, `syn-repeat`,
`fake+fuzz ttl4` — 4/5 с **FAIL discord во всех**. При этом через VPN-узел
discord отдаёт 200/401 за ~1 с. Вывод: на этой линии ТСПУ режет Cloudflare
IP-диапазоны Discord независимо от десинхронизации ClientHello → Discord
переведён в L3 (`DEFAULT_FORCED_PROXY_DOMAINS`), в UI L2 это поясняется.
Instagram при этом остаётся L2 (zapret его пробивает, 4/5).

## Компоненты

- `src/services/routing-engine/` — типы, генераторы nft/dnsmasq/iproute и
  sing-box, валидаторы (`validate.ts`: `detectLoops`, `detectDnsLeaks`),
  парсер подписок (VLESS/Reality, Trojan, SS SIP002/legacy, Hysteria2, VMess).
- `tests/routing-engine.test.ts` — 37 тестов движка: порядок правил, защита от
  петель, отсутствие утечек DNS, валидность nft (скобки, пустые сеты),
  политики Discord/YouTube.
- `rpcd-circumvention.sh` — `tiers_stage` (base64-чанки), `tiers_commit`
  (валидация `nft -c`/`sh -n` → бэкап → установка → перезапуск → само-
  проверка ядром; синхронизация доменов L2 в `zapret iphost`; регенерация
  sing-box из `/etc/orbix/tiers.json` с откатом), `tiers_disable`, `tiers_status`.
- `src/views/circumvention/RoutingEngineView.tsx` — редакторы трёх списков,
  статус активного узла, Apply / Disable / принудительное обновление подписки.

## Уроки реализации (OpenWrt 25.12, ядро nft 1.x)

- ucode `ARGV` **0-based**: `ARGV[0]` — первый аргумент. Ошибка индексов молча
  роняла генерацию sing-box-аутбунда (port 0 → early exit).
- Атомарная перезапись nft-фрагмента в `ruleset-post`: файл обязан начинаться
  с `table inet paneltiers` + `delete table inet paneltiers` + тело — иначе
  каждая загрузка fw4 дописывает второй копии правил в ту же цепочку.
- `flags interval,dynamic` на одном сете этот kernel не принимает — статика
  (interval) и динамика (timeout) разводятся по разным сетам.
- dnsmasq в ujail не читает файлы вне whitelist: `conf-file=/etc/orbix/...`
  молча не подхватывается; конфиг nftset инлайнится блоком между маркерами
  прямо в `/etc/dnsmasq.conf`.
- `sing-box check` при генерации логируется в `/tmp/orbx-sbcheck.log` —
  молчаливый `>/dev/null` стоил часы отладки.
- Проверка живьём: LAN curl-набором (vk/gosuslugi → direct, youtube → zapret,
  discord/ipinfo/tg → Paris, instagram → direct-zapret), counters в
  `nft list chain inet paneltiers marktier`.

## Статус

`npm test` 68/68, `npm run build` OK; движок задеплоен и активен на роутере
(NC-1812), E2E: vk 302, gosuslugi 200, youtube 200, discord 401(via VPN),
exit=Paris, instagram 404(reachable, direct), t.me 302. Бэкапы коммитов —
`/root/orbix-tiers-backup-*`, откат — `ubus call circumvention tiers_disable`.
