# PHANTOM AUDIT — Orbix (openwrt-modern-panel)

Дата: 2026-11-18. Объём: `src/`, `scripts/`, `rpcd-circumvention.sh`, `rpcd-circumvention-acl.json`.
Критерий: каждый оставленный элемент управления имеет сквозную связку
Frontend → ubus RPC → shell/UCI/nftables; никаких mock-данных, хардкода и пустых обработчиков.

## Методика

1. Инвентаризация backend: все dispatch-методы `rpcd-circumvention.sh` (43 метода, строки
   dispatch) + ACL-файл — сверка 1:1. Итог: ACL покрывает все 42 бизнес-метода + `run_cmd`,
   лишних записей нет.
2. Анти-stub скан тел методов: регистр реальных примитивов (`uci|ubus|ip|nft|jsonfilter|file|
   init|sysupgrade|…`) в каждом методе; тела с <2 примитивами вычитаны вручную:
   `zapret_list_files`, `podkop_update`, `sub_get_cache`, `policy_status`, `kid_status` — все
   реальны (обход каталогов, честный ответ «не установлено», файловые кэши, хелперы kid_*).
3. Инвентаризация frontend: каждый `call("object","method")` в `src/lib/ubus-client.ts` →
   только `circumvention` + штатные объекты OpenWrt (`uci`, `file`, `rc`, `system`, `log`,
   `network.*`, `luci-rpc` с честным fallback на `file`/`network.wireless`). Методов, которых
   нет в rpcd, — не найдено.
4. Парсер обработчиков (brace-matching по `onClick|onChange|onCheckedChange|onSubmit`): эвристика
   «success-текст без backend-вызова» → 2 срабатывания, оба — ссылки на вынесенные функции
   (`Administration.handleSaveDropbear` → uci+commit+initService restart;
   `StartupServices.handleAction` → `rc.init`). Реальных фейковых обработчиков — 0.
5. Пардер мёртвых контролов (открывающий тег `<Button>` без какоголибо обработчика).
6. Проверка mock/hardcode: `grep mock|fake|dummy|TODO|скоро|в разработ|Math.random` — все hits
   ложные (терминология zapret «fake/multisplit», salt/iv в crypto.ts); `mock`-режим из
   прошлых аудитов уже выпиллен (только 2 мёртвых i18n-ключа — удалены в этом аудите).
7. Сквозная проверка policy-движка: `policy-store.applyPoliciesToRouter` → `arm_rollback` →
   `policy_apply` (пишет `/etc/orbix/policies.json`, `generate_singbox_config` читает
   blocked/direct/proxy домены из файла, честные коды ошибок) → `pbr_set_device_rule` →
   `confirm_rollback`. Связка полная.

## Найденные фантомы и что сделано

| # | Фантом | Решение |
|---|--------|---------|
| 1 | `src/views/network/Interfaces.tsx:34` — кнопка «Добавить интерфейс» без onClick | Удалена. Страница переименована в честный «мониторинг + перезапуск»; заголовок/подпись больше не обещают управление VLAN |
| 2 | `src/views/network/Interfaces.tsx:91` — «Настроить» (Edit) без onClick на каждой карточке | Заменена на рабочую «Перезапустить»: новый `ubusClient.restartInterface()` → `network.interface.<name> restart` (netifd), sanitize имени, busy-состояние, confirm, честная обработка кодов netifd (0/2/3/4/9) |
| 3 | `src/components/layout/CommandPalette.tsx:79` — пункт «Hysteria 2» — функционала Hysteria нет нигде (ни UI, ни rpcd) | Удалён (+ почистен неиспользуемый импорт Zap) |
| 4-5 | `src/i18n/translations.ts:27,272` — мёртвые ключи `mockMode` («Mock Mode» / «Мок-режим») от давно удалённого мок-режима | Удалены; `nav.interfacesVlans` переименован в «Интерфейсы / Interfaces» |

### ACL (`rpcd-circumvention-acl.json`)
Добавлено granting `network.interface.*: ["restart"]` в write — без него вызов restart упирался
в `Access denied` на ubus-сессии. Развёрнуто на роутер в
`/usr/share/rpcd/acl.d/circumvention.json`, rpcd перезапущен.

## Верификация

- `npx vitest run`: **31/31 passed**; `npm run build`: **OK** (без ошибок).
- Транспорт панели (uhttpd `/ubus` JSON-RPC + session.login root) — живой тест на роутере:
  - до патча ACL: `network.interface.loopback restart` → `-32002 Access denied` (фантопуть закрыт);
  - после патча ACL: вызов доходит до netifd и получает осмысленный ответ (code 3 —
    протокол `loopback` не поддерживает restart; панель покажет это текстом).
  - Полный перезапуск `lan` наживо не выполнялся (живая сеть пользователя не трогаем без
    явного согласия) — цепочка проверена до netifd включительно.
- Финальный скан мёртвых контролов: 0 реальных (единственный hit — label-обёртка скрытого
  `input type=file` в BackupFlash — рабочий паттерн).

## Остальное: честно, но отмечено

- **policy-store живёт в localStorage браузера** — состояние черновика; на роутер попадает
  только по «Применить» (policy_apply) с rollback-якорем. Реконсил из роутера (policy_status)
  в UI не подмешивается — осознанно, не является обманом индикаторов.
- **ExplainRoute** — локальный симулятор политик; баннер «this is a panel-side simulator,
  not the router kernel» уже стоит. Честно.
- **PodkopView** — при отсутствии пакета rpcd честно возвращает
  `installed:0 + message`, UI это показывает.
- **`src/services/security/leak-detector.ts`** — orphan-модуль: ни один UI его не вызывает.
  Не фантом (ничего не обещает), удалён не был; кандидат на подключение к Diagnostics.
- **`run_cmd` whitelist**: `ping/traceroute/nslookup/logread/dmesg/apk/nft/sysupgrade/firstboot/
  date/uptime/wg/awg/netstat/ip` + фильтр символов аргументов. `nft` и `apk` — мощные
  примитивы (сессия root), допустимо для root-панели, отмечено как surface.
- **BackupFlash**: JSON-экспорт читает реальный UCI с роутера (exporter: getUci ×6 + board +
  info); sysupgrade-tar идёт через `exec sysupgrade -b` + `file.read base64` (бинарь не
  портится); firstboot/reset — с confirm.
- **ConnectedClients «Сделать статическим»** — стейджит UCI-изменение и прямо просит
  применить через нижнюю UCI-панель, а не врал про «готово».
- Все Switch-элементы (35 проверенных) имеют `onCheckedChange` с backend-вызовом;
  kill-switch, kid, zapret, pbr, wireless, dns, firewall — все через rpcd/uci.

## Итог

43 dispatch-метода rpcd все реальные (shell/uci/ubus/nft/sysupgrade), ACL 1:1, в UI не осталось
ни одной кнопки/переключателя/индикатора без сквозной связки; mock-данных и пустых onClick нет.
Тесты и сборка зелёные. Изменения не коммитились (в дереве параллельно работает другой агент).
