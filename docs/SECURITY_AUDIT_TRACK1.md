# Комплексный отчет по аудиту безопасности ORBIX (Track 1)

**Дата проведения:** 15 ноября 2026 г.  
**Объект аудита:** Репозиторий ORBIX (`/home/quasar/.gemini/antigravity/scratch/orbix`)  
**Область аудита (Scope):**
1. Бэкенд: `rpcd-circumvention.sh`, `rpcd-circumvention-acl.json`, `install.sh`, `scripts/build-firmware.sh`, `mcp-server/src/index.ts`.
2. Фронтенд (TypeScript / React): `src/lib/ubus-client.ts`, `src/views/traffic/TrafficFlow.tsx`, `src/store/rollback-store.ts`, `src/services/config/crypto.ts`, `exporter.ts`, `importer.ts`, `validator.ts`, `auth-store.ts`.

---

## Сводная матрица уязвимостей (Executive Summary)

| ID | Уязвимый компонент | Название уязвимости | Severity | CWE |
|---|---|---|---|---|
| **ORBIX-SEC-01** | `src/services/config/crypto.ts` | Псевдошифрование XOR под видом AES-256-GCM и слабый PRNG `Math.random()` | **Critical** | CWE-327, CWE-338 |
| **ORBIX-SEC-02** | `rpcd-circumvention.sh` | DoS и завершение произвольных процессов root через PID-файл в `/tmp` | **High** | CWE-377, CWE-379 |
| **ORBIX-SEC-03** | `rpcd-circumvention.sh` | Утечка конфиденциальных конфигураций и токенов через небезопасные права в `/tmp` | **High** | CWE-732, CWE-200 |
| **ORBIX-SEC-04** | `rpcd-circumvention.sh` | Внедрение конфигурации (JSON Injection) в sing-box из-за обхода валидации | **High** | CWE-74, CWE-20 |
| **ORBIX-SEC-05** | `rpcd-circumvention.sh` | SSRF и сканирование внутренних сетей в `sub_decrypt_fetch` и `singbox_test_node` | **High** | CWE-918 |
| **ORBIX-SEC-06** | `mcp-server`, `ubus-client.ts` | Жестко закодированные учетные данные и приватные API-ключи | **High** | CWE-798 |
| **ORBIX-SEC-07** | `install.sh`, `build-firmware.sh` | Загрузка и исполнение не верифицированных бинарных архивов (RCE/File overwrite) | **High** | CWE-494, CWE-829 |
| **ORBIX-SEC-08** | `src/store/auth-store.ts` | Автоматическая аутентификация с дефолтными учетными данными `root:root` | **High** | CWE-287, CWE-798 |
| **ORBIX-SEC-09** | `rpcd-circumvention.sh` | Отсутствие проверки токена авторизации в методе `cancel_rollback` | **Medium** | CWE-306 |
| **ORBIX-SEC-10** | `rpcd-circumvention-acl.json` | Избыточные права ACL `read`, допускающие извлечение приватных ключей VPN | **Medium** | CWE-284, CWE-200 |
| **ORBIX-SEC-11** | `rpcd-circumvention.sh` | Обход защиты Kill Switch при выборе области `vpn_devices` (Traffic Leak) | **Medium** | CWE-693 |
| **ORBIX-SEC-12** | `src/lib/ubus-client.ts` | Состояние «зомби-сессии» из-за избирательной инвалидации сессии | **Medium** | CWE-613 |
| **ORBIX-SEC-13** | `src/lib/ubus-client.ts`, `mcp-server` | Зависание RPC-вызовов из-за отсутствия `AbortSignal` и сетевых таймаутов | **Medium** | CWE-400 |
| **ORBIX-SEC-14** | `src/services/config/importer.ts`, `validator.ts` | Отсутствие проверки контрольной суммы SHA-256 и DoS через `iterations` | **Medium** | CWE-353, CWE-400 |
| **ORBIX-SEC-15** | `src/store/rollback-store.ts` | Потеря состояния сторожевого таймера при перезагрузке страницы | **Medium** | CWE-362 |
| **ORBIX-SEC-16** | `src/views/traffic/TrafficFlow.tsx` | Утечка обработчиков мыши и рассинхронизация состояния drag-and-drop | **Low** | CWE-400, CWE-672 |
| **ORBIX-SEC-17** | `rpcd-circumvention.sh` | Потеря данных jshn в пайплайне BusyBox ash в методе `zapret_status` | **Low** | CWE-670 |

---

## Детальные карточки уязвимостей

### ORBIX-SEC-01: Псевдошифрование XOR под видом AES-256-GCM и слабый PRNG
- **Файл:** `src/services/config/crypto.ts` (строки 120–155, 166–167, 227–240)
- **Severity:** **Critical** (CVSS: 9.1)
- **CWE:** CWE-327 (Use of a Broken or Risky Cryptographic Algorithm), CWE-338 (Use of Cryptographically Weak Pseudo-Random Number Generator)
- **Описание:** 
  1. Генерация соли `salt` и вектора инициализации `iv` осуществляется через `Math.random().toString(36)` и `Date.now()`. `Math.random()` детерминирован и не является криптографически стойким PRNG.
  2. При доступе по HTTP (`http://192.168.1.1`), где интерфейс `window.crypto.subtle` заблокирован браузером из-за не-Secure Context, модуль шифрования автоматически переключается на самописный `xorCipher` — повторяющийся XOR по ключу `sha256(password:salt:iv)` с длиной периода 64 байта.
  3. Несмотря на использование тривиального XOR без аутентификации (без HMAC/GCM Tag), в метаданные экспортируемого файла записывается `"algorithm": "AES-GCM", "kdf": "PBKDF2"`. Это вводит администратора в опасное заблуждение относительно конфиденциальности бэкапа, содержащего Wi-Fi WPA-ключи, приватные ключи WireGuard и VLESS.
  4. Атакующий, зная статические заголовки JSON конфигурации (Known-Plaintext Attack), мгновенно вычисляет поток гаммы XOR и восстанавливает конфиденциальные ключи.
- **Механизм уязвимости:**
  ```typescript
  // crypto.ts:
  const salt = (Math.random().toString(36).substring(2) + Date.now().toString(36)).substring(0, 16);
  const iv = (Math.random().toString(36).substring(2) + Date.now().toString(36)).substring(0, 12);
  ...
  // Fallback в plain HTTP:
  const compositeKey = `${password}:${salt}:${iv}`;
  const ciphertext = this.xorCipher(plainTextJson, compositeKey);
  return { ciphertext, cryptoMetadata: { algorithm: "AES-GCM", kdf: "PBKDF2", ... } };
  ```
- **Рекомендации по исправлению:**
  1. Заменить генерацию энтропии на `window.crypto.getRandomValues()`.
  2. Запретить псевдошифрование XOR. Для сред без `SubtleCrypto` подключить сертифицированную чистую реализацию AES-256-GCM (например, `@noble/ciphers/webcrypto` или `@noble/ciphers/aes`) с обязательным тегом аутентификации (128-bit MAC).
  3. При невозможности надежного шифрования выбрасывать исключение с требованием HTTPS, а не шифровать слабым шифром.
- **Патч:**
  ```typescript
  // Исправление в src/services/config/crypto.ts
  public static generateSecureBytes(length: number): Uint8Array {
    const bytes = new Uint8Array(length);
    if (typeof window !== "undefined" && window.crypto?.getRandomValues) {
      window.crypto.getRandomValues(bytes);
      return bytes;
    }
    throw new Error("Криптографически стойкий генератор случайных чисел недоступен.");
  }

  public static bytesToHex(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  }

  public static hexToBytes(hex: string): Uint8Array {
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
  }
  ```

---

### ORBIX-SEC-02: DoS и завершение произвольных процессов root через PID-файл в `/tmp`
- **Файл:** `rpcd-circumvention.sh` (строки 1141–1149, 1178–1181, 1203–1211)
- **Severity:** **High** (CVSS: 8.2)
- **CWE:** CWE-377 (Insecure Temporary File), CWE-379 (Creation of Temporary File in Directory with Incorrect Permissions)
- **Описание:** 
  Скрипт `rpcd-circumvention.sh` выполняется демоном `rpcd` с правами суперпользователя `root`. При вызове методов `arm_rollback`, `confirm_rollback` и `cancel_rollback` скрипт читает PID из `/tmp/uci_watchdog.pid` и выполняет команду `kill -9 "$OLD_PID"`.
  Каталог `/tmp` в Linux/OpenWrt является разделяемым (mode `1777`). Любой локальный непривилегированный процесс может создать файл `/tmp/uci_watchdog.pid` и записать туда PID любого системного процесса (`uhttpd`, `rpcd`, `dnsmasq`, `dropbear`). При последующем вызове `arm_rollback` процесс `root` безусловно убивает указанный процесс через `SIGKILL`.
- **Механизм уязвимости:**
  ```sh
  # rpcd-circumvention.sh:
  OLD_PID=$(cat /tmp/uci_watchdog.pid 2>/dev/null | tr -d ' \r\n')
  if [ -n "$OLD_PID" ] && [ "$OLD_PID" -gt 1 ] 2>/dev/null; then
      OLD_CHILDREN=$(pgrep -P "$OLD_PID" 2>/dev/null)
      [ -n "$OLD_CHILDREN" ] && kill -9 $OLD_CHILDREN 2>/dev/null
      kill -9 "$OLD_PID" 2>/dev/null
  fi
  ```
- **Рекомендации по исправлению:**
  1. Перенести служебные файлы сторожевого таймера из общедоступного `/tmp` в закрытый каталог среды выполнения `/var/run/orbix` с правами `0700`, принадлежащий `root:root`.
  2. Проверять имя завершаемого процесса (process name verification), гарантируя, что завершается именно скрипт `uci_watchdog.sh`.
- **Патч:**
  ```sh
  RUNTIME_DIR="/var/run/orbix"
  mkdir -p -m 700 "$RUNTIME_DIR"

  if [ -f "$RUNTIME_DIR/watchdog.pid" ]; then
      OLD_PID=$(cat "$RUNTIME_DIR/watchdog.pid" 2>/dev/null | tr -d ' \r\n')
      if [ -n "$OLD_PID" ] && [ "$OLD_PID" -gt 1 ] 2>/dev/null; then
          # Проверяем, что PID действительно принадлежит нашему сторожевому процессу
          if grep -q "uci_watchdog" "/proc/$OLD_PID/cmdline" 2>/dev/null; then
              kill -TERM "$OLD_PID" 2>/dev/null
          fi
      fi
      rm -f "$RUNTIME_DIR/watchdog.pid"
  fi
  ```

---

### ORBIX-SEC-03: Утечка конфиденциальных конфигураций и токенов через права в `/tmp` и `/etc/orbix`
- **Файл:** `rpcd-circumvention.sh` (строки 1151–1156, 1494–1496)
- **Severity:** **High** (CVSS: 7.8)
- **CWE:** CWE-732 (Incorrect Permission Assignment for Critical Resource), CWE-200 (Exposure of Sensitive Information)
- **Описание:** 
  1. При выполнении резервного копирования для Rollback скрипт копирует конфиги:
     `cp -rf /etc/config/* /tmp/uci_rollback_backup/config/`
     `cp -rf /etc/sing-box/* /tmp/uci_rollback_backup/sing-box/`
     `echo "$TOKEN" > /tmp/uci_rollback_token`
     Каталоги и файлы в `/tmp` создаются с umask по умолчанию (`022`), то есть с правами `0755` и `0644` (доступны на чтение ВСЕМ пользователям и процессам системы).
  2. Файлы содержат: хеши паролей, WPA2/WPA3 Pre-Shared Keys, приватные ключи WireGuard/AmneziaWG (`/etc/config/network`), приватные ключи VLESS Reality и UUID (`/etc/sing-box/config.json`).
  3. В методе `sub_save_cache`: `echo "$input" ... > /etc/orbix/subscriptions.json` файл создается без явного `chmod 600`, позволяя непривилегированным процессам читать базы подписок.
- **Рекомендации по исправлению:**
  Создавать каталог резервной копии внутри `/var/run/orbix/rollback_backup` с обязательной установкой прав `0700` (`umask 077`). Файлы `rollback_token` и `subscriptions.json` создавать исключительно с правами `0600`.
- **Патч:**
  ```sh
  BACKUP_DIR="/var/run/orbix/rollback_backup"
  rm -rf "$BACKUP_DIR"
  mkdir -p -m 700 "$BACKUP_DIR/config" "$BACKUP_DIR/sing-box"
  cp -rf /etc/config/* "$BACKUP_DIR/config/" 2>/dev/null
  cp -rf /etc/sing-box/* "$BACKUP_DIR/sing-box/" 2>/dev/null
  chmod -R go-rwx "$BACKUP_DIR"

  TOKEN=$(head -c 32 /dev/urandom | hexdump -ve '1/1 "%.2x"')
  (umask 077 && printf "%s" "$TOKEN" > /var/run/orbix/rollback_token)
  ```

---

### ORBIX-SEC-04: Внедрение конфигурации (JSON Injection) в sing-box из-за обхода валидации
- **Файл:** `rpcd-circumvention.sh` (строки 27–62, 127–175, 1378–1412)
- **Severity:** **High** (CVSS: 8.5)
- **CWE:** CWE-74 (Improper Neutralization of Special Elements in Output - JSON Injection), CWE-20 (Improper Input Validation)
- **Описание:** 
  В функции `singbox_set_outbound` входные данные `$input` сохраняются напрямую в файл:
  `printf "%s\n" "$input" > /etc/sing-box/active_node.json`
  Далее локальные переменные `$RAW_SERVER`, `$RAW_UUID` фильтруются через регулярные выражения, однако функция `generate_singbox_config()` **не использует** эти локальные переменные! Она заново извлекает поля из `/etc/sing-box/active_node.json` и вставляет их в shell heredoc:
  `"server": "$SERVER", "uuid": "$UUID", ...`
  Если во входном JSON передать спецсимволы (двойные кавычки, обратные слеши, переносы строк), они не экранируются, ломают структуру `/tmp/singbox/config.json.tmp` и позволяют внедрить произвольные outbound-секции sing-box или перенаправить весь трафик маршрутизатора на контролируемый узел.
- **Рекомендации по исправлению:**
  1. В `singbox_set_outbound` сохранять в `active_node.json` **только** предварительно проверенные и отфильтрованные значения.
  2. В `generate_singbox_config()` производить валидацию каждого поля перед подстановкой, либо генерировать итоговый конфигурационный файл средствами `jshn` (`json_init`, `json_add_string`, `json_dump`).
- **Патч:**
  ```sh
  # rpcd-circumvention.sh:
  # Сохраняем в active_node.json ТОЛЬКО валидированные поля:
  json_init
  json_add_string "server" "$SERVER"
  json_add_int "port" "$PORT"
  json_add_string "uuid" "$UUID"
  json_add_string "flow" "$FLOW"
  json_add_string "sni" "$SNI"
  json_add_string "publicKey" "$PUBKEY"
  json_add_string "shortId" "$SHORTID"
  json_add_string "fingerprint" "$FP"
  json_dump > /etc/sing-box/active_node.json
  chmod 600 /etc/sing-box/active_node.json
  ```

---

### ORBIX-SEC-05: SSRF и сканирование внутренних сетей в `sub_decrypt_fetch` и `singbox_test_node`
- **Файл:** `rpcd-circumvention.sh` (строки 929–932, 1251–1283)
- **Severity:** **High** (CVSS: 8.6)
- **CWE:** CWE-918 (Server-Side Request Forgery - SSRF)
- **Описание:** 
  1. В методе `sub_decrypt_fetch` утилита `curl` вызывается с флагом `-L` (follow redirects) и загружает любой указанный `TARGET_URL`. Отсутствует фильтрация внутренних адресов (`127.0.0.1`, `10.0.0.0/8`, `192.168.0.0/16`, `169.254.169.254`). Это дает возможность злоумышленнику использовать роутер как прокси для обращения к локальным службам роутера (uhttpd, DNS, ubus HTTP) или облачным метаданным.
  2. Значение `DEC_URL`, полученное от внешнего стороннего сервера `happy-decoder.cc`, не проверяется на допустимую схему (`http`/`https`) перед передачей в `curl`.
  3. В методе `singbox_test_node` любой хост и порт опрашиваются через `curl --connect-timeout 3 "http://$HOST:$PORT"`, что позволяет проводить сканирование портов внутренней инфраструктуры от имени роутера.
- **Рекомендации по исправлению:**
  1. Ограничить протоколы `curl` строгими параметрами: `--proto =http,https --proto-redir =http,https --max-redirs 3`.
  2. Блокировать резолвинг и обращения к приватным и петлевым подсетям RFC 1918 / RFC 3927 / Loopback.
- **Патч:**
  ```sh
  # Проверка целевого IP на принадлежность к приватным/петлевым диапазонам
  is_private_ip() {
      case "$1" in
          127.*|10.*|172.1[6-9].*|172.2[0-9].*|172.3[0-1].*|192.168.*|169.254.*|0.*|::1|fe80:*) return 0 ;;
          *) return 1 ;;
      esac
  }
  # В curl:
  curl -sS --proto =http,https --proto-redir =http,https --max-redirs 3 --max-time 10 "$TARGET_URL"
  ```

---

### ORBIX-SEC-06: Жестко закодированные учетные данные и приватные API-ключи
- **Файлы:** `mcp-server/src/index.ts` (строки 13–14, 450), `src/lib/ubus-client.ts` (строка 558)
- **Severity:** **High** (CVSS: 7.5)
- **CWE:** CWE-798 (Use of Hard-coded Credentials)
- **Описание:** 
  1. В `mcp-server/src/index.ts` по умолчанию заданы учетные данные `root:root` для доступа к ubus API роутера по незашифрованному HTTP (`http://192.168.1.1`).
  2. В `mcp-server/src/index.ts` и `src/lib/ubus-client.ts` жестко зашит приватный Bearer токен Happy Decoder API:
     `api_key || "hd_889c9cc025a10885f358d1caefce6108"`.
     Любой пользователь, имеющий доступ к собранному веб-бандлу или исходному коду, получает несанкционированный доступ к стороннему сервису расшифровки подписок.
- **Рекомендации по исправлению:**
  Удалить жестко закодированный API-ключ. Запрашивать ключ у пользователя в интерфейсе либо считывать из защищенного хранилища UCI (`uci get orbix.api.happy_decoder_key`). В MCP-сервере требовать передачи учетных данных через переменные окружения без небезопасных значений по умолчанию.

---

### ORBIX-SEC-07: Загрузка и исполнение не верифицированных бинарных архивов
- **Файлы:** `install.sh` (строка 264), `scripts/build-firmware.sh` (строка 87)
- **Severity:** **High** (CVSS: 8.8)
- **CWE:** CWE-494 (Download of Code Without Integrity Check), CWE-829 (Inclusion of Functionality from Untrusted Control Sphere)
- **Описание:** 
  1. В `install.sh`:
     `curl -sSL "https://github.com/cyberhard/orbix/releases/latest/download/orbix-dist.tar.gz" | tar -C /www -xzf -`
     Дистрибутив веб-интерфейса распаковывается напрямую в корень веб-сервера `/www` без сверки контрольной суммы SHA-256 или подписи usign. Любая атака на сеть (DNS spoofing, компрометация репозитория) приводит к полной перезаписи веб-сервера вредоносным кодом.
  2. В `scripts/build-firmware.sh`:
     `curl -sSL "${IMAGEBUILDER_URL}" | tar -C "${BUILD_ROOT}" -xJf -`
     Архив OpenWrt ImageBuilder скачивается в `/tmp` и запускается на исполнение (`make -C ... image`) без сверки с официальным файлом `sha256sums` OpenWrt.
- **Рекомендации по исправлению:**
  Перед распаковкой обязательно загружать файл хеш-сумм `sha256sums`, проверять его цифровой подписью `usign -V` (или minisign/gpg), и верифицировать архив командой `sha256sum -c`.

---

### ORBIX-SEC-08: Автоматическая аутентификация с дефолтными учетными данными `root:root`
- **Файл:** `src/store/auth-store.ts` (строки 42–59)
- **Severity:** **High** (CVSS: 8.1)
- **CWE:** CWE-287 (Improper Authentication), CWE-798 (Use of Hard-coded Credentials)
- **Описание:** 
  В методе `useAuthStore.checkAuth` при обнаружении истекшей сессии или на старте приложения выполняется автоматическая попытка входа:
  ```typescript
  try {
    await ubusClient.login("root", "root");
    set({ isAuthenticated: true });
  } catch {
    set({ isAuthenticated: false });
  }
  ```
  Если роутер эксплуатируется с паролем по умолчанию (`root`), веб-приложение производит беспарольный вход, наделяя любого посетителя страницы полными административными полномочиями без явного подтверждения. Если администратор явно нажимает "Выйти" (`logout`), любая последующая проверка аутентификации снова входит под `root:root`.
- **Рекомендации по исправлению:**
  Полностью удалить автоматический вход `login("root", "root")`. При отсутствии валидной сессии перенаправлять пользователя на форму ввода логина и пароля.

---

### ORBIX-SEC-09: Отсутствие проверки токена авторизации в методе `cancel_rollback`
- **Файл:** `rpcd-circumvention.sh` (строки 1222–1249)
- **Severity:** **Medium** (CVSS: 6.5)
- **CWE:** CWE-306 (Missing Authentication for Critical Function)
- **Описание:** 
  Метод `confirm_rollback` строго сверяет переданный клиентом токен с `/tmp/uci_rollback_token`. В отличие от него, метод `cancel_rollback` **вообще не требует передачи токена** и не проверяет его. Любой вызов `ubus call circumvention cancel_rollback` моментально откатывает все системные настройки роутера к резервной копии и перезапускает сервисы, что может быть использовано для срыва процесса конфигурирования (DoS).
- **Рекомендации по исправлению:**
  Реализовать проверку токена в `cancel_rollback` аналогично `confirm_rollback`.
- **Патч:**
  ```sh
  cancel_rollback)
      read input
      USER_TOKEN=$(echo "$input" | jsonfilter -e '@.token' 2>/dev/null | tr -d ' \r\n\t')
      if [ ! -f "/var/run/orbix/rollback_token" ]; then
          return_error "No active rollback session armed"
      fi
      REAL_TOKEN=$(cat /var/run/orbix/rollback_token 2>/dev/null | tr -d ' \r\n\t')
      if [ -z "$USER_TOKEN" ] || [ "$USER_TOKEN" != "$REAL_TOKEN" ]; then
          return_error "Invalid rollback token"
      fi
      ...
  ```

---

### ORBIX-SEC-10: Избыточные права ACL `read`, допускающие извлечение приватных ключей VPN
- **Файл:** `rpcd-circumvention-acl.json` (строка 16)
- **Severity:** **Medium** (CVSS: 6.2)
- **CWE:** CWE-284 (Improper Access Control), CWE-200 (Exposure of Sensitive Information)
- **Описание:** 
  Метод `sub_get_cache` помещен в секцию `"read"` файла `rpcd-circumvention-acl.json`. Метод возвращает полное содержимое `/etc/orbix/subscriptions.json`, включающее расшифрованные конфигурации VPN-узлов, токены, UUID и ключи шифрования. Пользователь или токен, обладающий исключительно правами на чтение (read-only), может выгрузить все учетные данные VPN инфраструктуры.
- **Рекомендации по исправлению:**
  Перенести `sub_get_cache` в секцию `"write"` либо маскировать чувствительные поля при вызове метода.

---

### ORBIX-SEC-11: Обход защиты Kill Switch при выборе области `vpn_devices` (Traffic Leak)
- **Файл:** `rpcd-circumvention.sh` (строки 1434–1446)
- **Severity:** **Medium** (CVSS: 6.8)
- **CWE:** CWE-693 (Protection Mechanism Failure)
- **Описание:** 
  В методе `killswitch_set` создается цепочка `orbix_protection forward` с базовой политикой `policy accept`. Правило с действием `counter drop` добавляется **только** если переменная `$KS_SCOPE` равна `"all"`.
  Если пользователь выбирает режим защиты по умолчанию (`scope="vpn_devices"`), правило сброса трафика вообще не создается! При падении туннелей `awg0` или `singbox` трафик устройств, для которых включен Kill Switch, беспрепятственно утекает напрямую в WAN-интерфейс провайдера.
- **Рекомендации по исправлению:**
  В режиме `vpn_devices` формировать динамический nftables set с IP-адресами защищаемых клиентов и добавлять правило блокировки их трафика в сторону WAN при недоступности VPN-интерфейсов.

---

### ORBIX-SEC-12: Состояние «зомби-сессии» из-за избирательной инвалидации сессии
- **Файл:** `src/lib/ubus-client.ts` (строки 78–87, 97–105)
- **Severity:** **Medium** (CVSS: 5.3)
- **CWE:** CWE-613 (Insufficient Session Expiration)
- **Описание:** 
  В `UbusClient.call` инвалидация сессии при ошибке `status === 6` (`UBUS_STATUS_PERMISSION_DENIED`) или `-32002 Access denied` выполняется только если объект равен `"session"` или `"system.board"`:
  ```typescript
  if (status === 6 && (object === "session" || (object === "system" && method === "board"))) {
    this.sessionId = "00000000000000000000000000000000";
    ...
  }
  ```
  Если срок действия сессии rpcd истек во время нахождения пользователя на вкладке `Traffic`, `PBR` или `VPN`, вызовы `ubusClient.call` возвращают ошибку 6. Сессия **не инвалидируется**, свойство `isAuthenticated()` возвращает `true`, пользователь не перенаправляется на форму логина, а интерфейс начинает падать с бесконечными точечными ошибками.
- **Рекомендации по исправлению:**
  Инвалидировать сессию и вызывать событие `ubus_auth_expired` при получении кода статуса `6` или ошибки `Access denied` от **любого** объекта ubus.
- **Патч:**
  ```typescript
  // src/lib/ubus-client.ts:
  if (status === 6 || json.error?.code === -32002 || json.error?.message === "Access denied") {
    this.sessionId = "00000000000000000000000000000000";
    if (typeof window !== "undefined") {
      localStorage.removeItem("openwrt_session_id");
      window.dispatchEvent(new CustomEvent("ubus_auth_expired"));
    }
    throw new Error("Сессия истекла. Пожалуйста, выполните повторный вход.");
  }
  ```

---

### ORBIX-SEC-13: Зависание RPC-вызовов из-за отсутствия `AbortSignal` и сетевых таймаутов
- **Файлы:** `src/lib/ubus-client.ts` (строки 64–68), `mcp-server/src/index.ts` (строки 43–47)
- **Severity:** **Medium** (CVSS: 5.3)
- **CWE:** CWE-400 (Uncontrolled Resource Consumption)
- **Описание:** 
  Вызовы `fetch` выполняются без передачи `AbortSignal` и без ограничения времени ожидания ответа. При перезагрузке маршрутизатора, разрыве сетевого соединения или зависании демона `rpcd` сетевые запросы браузера и Node.js зависают на неограниченное время (до таймаута сокета ОС в несколько минут), блокируя интерфейс и приводя к утечке ресурсов.
- **Рекомендации по исправлению:**
  Реализовать использование `AbortController` с таймаутом по умолчанию (например, 10 секунд).
- **Патч:**
  ```typescript
  public async call<T = unknown>(
    object: string,
    method: string,
    params: Record<string, unknown> = {},
    timeoutMs = 10000
  ): Promise<T> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      ...
    } finally {
      clearTimeout(timeoutId);
    }
  }
  ```

---

### ORBIX-SEC-14: Отсутствие проверки контрольной суммы SHA-256 и DoS через `iterations`
- **Файлы:** `src/services/config/importer.ts` (строки 38–79), `validator.ts` (строки 60–67)
- **Severity:** **Medium** (CVSS: 5.9)
- **CWE:** CWE-353 (Missing Support for Integrity Check), CWE-400 (Uncontrolled Resource Consumption)
- **Описание:** 
  1. `ConfigExporter` генерирует хеш конфигурации `checksum_sha256`. Однако модуль импорта `ConfigImporter` и валидатор `ConfigValidator` вообще не сверяют хеш при импорте незашифрованных или расшифрованных данных.
  2. В объекте `crypto_metadata` валидатор не проверяет параметр `iterations`. Вредоносный файл может содержать `iterations: 1000000000`, что при попытке расшифровки вызовет 100% загрузку CPU браузера и полный отказ в обслуживании вкладки (Client-side DoS).
- **Рекомендации по исправлению:**
  1. Проверять совпадение вычисленного SHA-256 с `metadata.checksum_sha256`.
  2. Ограничить диапазон `iterations` допустимыми пределами (от 10 000 до 500 000).

---

### ORBIX-SEC-15: Потеря состояния сторожевого таймера при перезагрузке страницы
- **Файл:** `src/store/rollback-store.ts` (строки 30–70)
- **Severity:** **Medium** (CVSS: 4.8)
- **CWE:** CWE-362 (Concurrent Execution using Shared Resource with Improper Synchronization)
- **Описание:** 
  Состояние `useRollbackStore` (токен, статус `isArmed`, обратный отсчет) хранится исключительно в оперативной памяти Zustand. Если пользователь после применения сетевых настроек случайно обновит страницу (F5) или закроет вкладку, токен подтверждения безвозвратно теряется. Интерфейс возвращается в исходное состояние, однако на роутере фоновый скрипт `uci_watchdog.sh` продолжает обратный отсчет и через 75 секунд откатывает все настройки назад.
  Кроме того, в методе `confirm()` таймер `timerId` сбрасывается **до** успешного ответа сервера ubus. Если запрос завершился сетевым сбоем, таймер в UI перестает тикать, хотя на роутере откат неотвратимо приближается.
- **Рекомендации по исправлению:**
  Сохранять активную сессию отката (`token`, `armedAt`, `timeout`) в `sessionStorage`. При загрузке страницы восстанавливать обратный отсчет. Сбрасывать локальный таймер только после подтверждения успешного ответа от роутера.

---

### ORBIX-SEC-16: Утечка обработчиков мыши и рассинхронизация состояния drag-and-drop
- **Файл:** `src/views/traffic/TrafficFlow.tsx` (строки 603–648, 874–882)
- **Severity:** **Low** (CVSS: 3.5)
- **CWE:** CWE-400 (Uncontrolled Resource Consumption), CWE-672 (Operation on Resource after Expiration or Release)
- **Описание:** 
  События `onMouseMove` и `onMouseUp` привязаны непосредственно к DOM-элементу `<svg>`. Если пользователь зажимает узел и перемещает курсор за границы холста или отпускает кнопку мыши вне SVG-элемента, событие отпускания теряется. Компонент застревает в режиме перетаскивания. При этом в функции `handleMouseUp` сохранение `savePositions(nodePositions)` использует замкнутое состояние `nodePositions`, перезаписывая актуальные координаты устаревшими из замыкания рендера.
- **Рекомендации по исправлению:**
  Использовать механизм Pointer Capture (`setPointerCapture` / `releasePointerCapture`) на элементе SVG либо подписываться на глобальные события `window.addEventListener("pointermove")` и `pointerup` во время активного перетаскивания, освобождая их в cleanup-функции. Использовать `useRef` для сохранения актуальных координат.

---

### ORBIX-SEC-17: Потеря данных jshn в пайплайне BusyBox ash в методе `zapret_status`
- **Файл:** `rpcd-circumvention.sh` (строки 737–743, 752–757)
- **Severity:** **Low** (CVSS: 3.1)
- **CWE:** CWE-670 (Always-Incorrect Control Flow Implementation)
- **Описание:** 
  Конструкция `head -n 40 "$hfile" 2>/dev/null | while IFS= read -r d; do json_add_string "" "$d"; done` в оболочке BusyBox ash выполняет цикл `while` в изолированном подоболочке (subshell). Библиотека `jshn.sh` хранит состояние JSON в глобальных переменных окружения. Любые изменения, внесенные `json_add_string` внутри subshell, теряются при завершении подоболочки. В результате массив `hostlist` возвращается пустым или в поврежденном формате.
- **Рекомендации по исправлению:**
  Заменить конвейер `| while` на перенаправление ввода или считывание через временную переменную без порождения подоболочки:
  ```sh
  while IFS= read -r d; do
      case "$d" in \#*|"") continue ;; *) json_add_string "" "$d" ;; esac
  done << EOF
  $(head -n 40 "$hfile" 2>/dev/null)
  EOF
  ```

---

## План первоочередных мер по устранению (Remediation Roadmap)

1. **Фаза 1 (Немедленно - Критические угрозы):**
   - Устранить уязвимость `ORBIX-SEC-01`: удалить генерацию соли через `Math.random()`, ликвидировать псевдошифрование XOR, интегрировать надежный WebCrypto/полифилл.
   - Устранить `ORBIX-SEC-08`: удалить автоматический логин `root:root` в `auth-store.ts`.
   - Устранить `ORBIX-SEC-06`: убрать зашитые токены Happy Decoder из `mcp-server` и `ubus-client.ts`.
2. **Фаза 2 (Высокий приоритет - Системная безопасность OpenWrt):**
   - Устранить `ORBIX-SEC-02`, `ORBIX-SEC-03`: перенести служебные файлы в закрытую директорию `/var/run/orbix` (mode `0700`).
   - Устранить `ORBIX-SEC-04`: исправить инъекцию конфигурации в sing-box.
   - Устранить `ORBIX-SEC-05`: ограничить протоколы `curl` и закрыть SSRF во внутренние сети.
   - Устранить `ORBIX-SEC-07`: добавить проверку контрольных сумм в `install.sh` и `build-firmware.sh`.
   - Устранить `ORBIX-SEC-09`: добавить проверку токена в `cancel_rollback`.
3. **Фаза 3 (Средний приоритет - Надежность фронтенда и API):**
   - Исправить инвалидацию сессий `ORBIX-SEC-12` и добавить таймауты `ORBIX-SEC-13`.
   - Добавить проверку целостности архивов `ORBIX-SEC-14`.
   - Персистировать состояние Rollback Watchdog `ORBIX-SEC-15` в `sessionStorage`.
   - Исправить логику холста `TrafficFlow.tsx` `ORBIX-SEC-16`.
