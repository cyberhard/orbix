// ORBIX Centralized Error Code Registry
// Strictly adhering to shadcn/ui Zinc design language specifications
import { ErrorDefinition, ErrorCategory, ErrorSeverity } from "@/types/errors";

export const ERROR_REGISTRY: Record<number, ErrorDefinition> = {
  // ==========================================
  // 100–199: System & Initialization
  // ==========================================
  100: {
    code: 100,
    identifier: "SYSTEM_INITIALIZATION_FAILED",
    category: "system",
    severity: "critical",
    internalDescription: "Core procd/init system failed to initialize essential runtime daemons",
    title: {
      en: "System Initialization Failed",
      ru: "Сбой инициализации системы",
    },
    description: {
      en: "The router operating system failed to start essential core runtime services during boot.",
      ru: "Операционная система роутера не смогла запустить критические системные службы при загрузке.",
    },
    triggerConditions: {
      en: ["procd init script execution failure", "Missing core socket or IPC endpoint", "Corrupted init state"],
      ru: ["Сбой скрипта инициализации procd", "Отсутствие системного сокета или IPC точки", "Повреждение начального состояния"],
    },
    remediation: {
      en: [
        "Reboot the router in standard mode",
        "Check system boot log via dmesg / logread",
        "If the issue persists, trigger failsafe recovery",
      ],
      ru: [
        "Перезагрузите роутер в штатном режиме",
        "Проверьте журнал загрузки через dmesg / logread",
        "Если ошибка повторяется, используйте режим восстановления failsafe",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "procd",
  },
  101: {
    code: 101,
    identifier: "SYSTEM_STARTING",
    category: "system",
    severity: "info",
    internalDescription: "System daemons and network subsystems are currently starting up",
    title: {
      en: "System Starting Up",
      ru: "Запуск системы",
    },
    description: {
      en: "ORBIX system daemons and network interfaces are currently booting and stabilizing.",
      ru: "Службы ORBIX и сетевые интерфейсы находятся в процессе запуска и стабилизации.",
    },
    triggerConditions: {
      en: ["Uptime less than 30 seconds", "Services reporting pending startup state"],
      ru: ["Аптайм роутера менее 30 секунд", "Службы находятся в состоянии ожидания старта"],
    },
    remediation: {
      en: ["Wait 10–20 seconds for services to complete initialization"],
      ru: ["Подождите 10–20 секунд для завершения инициализации сервисов"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "init",
  },
  102: {
    code: 102,
    identifier: "SYSTEM_UPDATE_FAILED",
    category: "system",
    severity: "error",
    internalDescription: "Firmware sysupgrade or package repository transaction failed",
    title: {
      en: "Firmware Update Failed",
      ru: "Сбой обновления прошивки",
    },
    description: {
      en: "The sysupgrade verification or image flashing process encountered an error and was halted.",
      ru: "Процесс верификации или прошивки sysupgrade завершился ошибкой и был остановлен для защиты устройства.",
    },
    triggerConditions: {
      en: ["Image checksum mismatch", "Insufficient flash storage in /tmp", "Incompatible device architecture"],
      ru: ["Несовпадение контрольной суммы образа", "Недостаточно места во flash-памяти", "Несовместимая архитектура платформы"],
    },
    remediation: {
      en: [
        "Verify firmware file integrity (SHA256 checksum)",
        "Ensure sufficient RAM and overlay storage space",
        "Do not power off the router during active flashing",
      ],
      ru: [
        "Проверьте целостность образа (контрольную сумму SHA256)",
        "Убедитесь в наличии свободной оперативной памяти",
        "Не выключайте питание роутера во время записи прошивки",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "sysupgrade",
  },
  103: {
    code: 103,
    identifier: "SYSTEM_RECOVERY",
    category: "system",
    severity: "warning",
    internalDescription: "Device is running in Failsafe or Recovery mode",
    title: {
      en: "System Recovery Mode Active",
      ru: "Режим аварийного восстановления",
    },
    description: {
      en: "The router has booted into emergency failsafe mode. Only core maintenance functions are available.",
      ru: "Роутер загружен в аварийном режиме failsafe. Доступны только базовые функции обслуживания и отката.",
    },
    triggerConditions: {
      en: ["Failsafe button pressed during boot", "Rootfs mount failure forced read-only fallback"],
      ru: ["Кнопка сброса зажата при старте", "Сбой монтирования rootfs перевел систему в режим только для чтения"],
    },
    remediation: {
      en: [
        "Connect to router via Telnet / SSH at 192.168.1.1 in failsafe",
        "Run firstboot or restore a valid configuration backup",
        "Reboot after resolving file system integrity",
      ],
      ru: [
        "Подключитесь по Telnet / SSH к 192.168.1.1",
        "Выполните команду firstboot или восстановите бэкап",
        "Перезагрузите устройство после проверки файловой системы",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "failsafe",
  },
  104: {
    code: 104,
    identifier: "SYSTEM_INTEGRITY_FAILED",
    category: "system",
    severity: "critical",
    internalDescription: "Hardware board detect or squashfs partition integrity verification failed",
    title: {
      en: "System Integrity Check Failed",
      ru: "Нарушение целостности системы",
    },
    description: {
      en: "Corrupted system binaries or partition table anomaly detected on the storage device.",
      ru: "Обнаружено повреждение системных файлов или аномалия разделов накопителя устройства.",
    },
    triggerConditions: {
      en: ["Bad flash sectors on NAND/NOR", "Integrity hash mismatch on /rom"],
      ru: ["Сбойные сектора памяти NAND/NOR", "Несовпадение контрольных хэшей /rom"],
    },
    remediation: {
      en: [
        "Flash a clean factory firmware image via TFTP / sysupgrade",
        "Check hardware flash health in bootloader",
      ],
      ru: [
        "Выполните чистую перепрошивку через TFTP / sysupgrade",
        "Проверьте состояние чипа памяти в загрузчике",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "board_detect",
  },

  // ==========================================
  // 200–299: Network Connectivity
  // ==========================================
  200: {
    code: 200,
    identifier: "NETWORK_CONNECTED",
    category: "network",
    severity: "info",
    internalDescription: "WAN interface is up and default route is active",
    title: {
      en: "Network Connected",
      ru: "Сеть подключена",
    },
    description: {
      en: "WAN interface has established an uplink and Internet connectivity is verified.",
      ru: "Интерфейс WAN успешно установил соединение с провайдером. Доступ в Интернет активен.",
    },
    triggerConditions: {
      en: ["netifd reports WAN status up", "Gateway ping check succeeds"],
      ru: ["netifd сообщает о статусе WAN up", "Пинг до шлюза успешен"],
    },
    remediation: {
      en: ["No action required"],
      ru: ["Действия не требуются"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "netifd",
  },
  201: {
    code: 201,
    identifier: "NETWORK_INITIALIZING",
    category: "network",
    severity: "info",
    internalDescription: "Network interfaces and bridge devices are being brought up",
    title: {
      en: "Network Initializing",
      ru: "Инициализация сети",
    },
    description: {
      en: "Network device drivers and bridge topologies are configuring port links.",
      ru: "Сетевые драйверы и мосты настраивают параметры портов и линков.",
    },
    triggerConditions: {
      en: ["Interface state transition pending", "STP forwarding delay active"],
      ru: ["Переходное состояние интерфейсов", "Задержка STP на мостах"],
    },
    remediation: {
      en: ["Wait 5 seconds for network convergence"],
      ru: ["Подождите 5 секунд для стабилизации линков"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "netifd",
  },
  202: {
    code: 202,
    identifier: "WAN_CONNECTING",
    category: "network",
    severity: "info",
    internalDescription: "WAN interface is attempting DHCP discovery or PPPoE handshake",
    title: {
      en: "WAN Connecting",
      ru: "Подключение WAN",
    },
    description: {
      en: "The router is negotiating IP configuration with your Internet Service Provider.",
      ru: "Роутер выполняет согласование IP-параметров с оборудованием интернет-провайдера.",
    },
    triggerConditions: {
      en: ["DHCP discover packets in flight", "PPPoE PADI/PADS exchange active"],
      ru: ["Отправка DHCP Discover", "Согласование сессии PPPoE"],
    },
    remediation: {
      en: ["Allow up to 30 seconds for your ISP to assign an IP lease"],
      ru: ["Подождите до 30 секунд для получения сетевого адреса"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "netifd",
  },
  203: {
    code: 203,
    identifier: "WAN_UNAVAILABLE",
    category: "network",
    severity: "error",
    internalDescription: "Physical WAN Ethernet link is down or cable disconnected",
    title: {
      en: "WAN Uplink Unavailable",
      ru: "Аплинк WAN недоступен",
    },
    description: {
      en: "No physical signal detected on the WAN port. The network cable may be unplugged.",
      ru: "На порту WAN отсутствует физический сигнал. Проверьте подключение кабеля провайдера.",
    },
    triggerConditions: {
      en: ["Carrier loss on eth0/wan", "PHY report link partner down"],
      ru: ["Потеря несущей частоты на eth0/wan", "PHY сообщает об отсутствии линка"],
    },
    remediation: {
      en: [
        "Check that the Ethernet cable is securely plugged into the WAN port",
        "Verify your ISP modem or optical terminal (ONT) has power",
        "Test with another Ethernet patch cord",
      ],
      ru: [
        "Проверьте надежность подключения кабеля в порт WAN",
        "Убедитесь, что оптический терминал (ONT) или модем включен в сеть",
        "Попробуйте заменить соединительный патч-корд",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "netifd",
  },
  204: {
    code: 204,
    identifier: "NO_INTERNET",
    category: "network",
    severity: "error",
    internalDescription: "WAN interface is up but external ICMP/HTTP reachability test failed",
    title: {
      en: "No Internet Access",
      ru: "Отсутствует доступ в Интернет",
    },
    description: {
      en: "The router has an IP address from your ISP, but cannot reach public Internet hosts.",
      ru: "Роутер получил IP-адрес от провайдера, но публичные узлы сети Интернет не отвечают.",
    },
    triggerConditions: {
      en: ["ICMP echo to 1.1.1.1 / 8.8.8.8 timed out", "HTTP connectivity check failed"],
      ru: ["Таймаут ICMP до 1.1.1.1 / 8.8.8.8", "Сбой проверки HTTP connectivity"],
    },
    remediation: {
      en: [
        "Check your ISP account balance and service status",
        "Verify whether your ISP requires MAC address cloning",
        "Restart your ISP optical terminal / modem",
      ],
      ru: [
        "Проверьте баланс лицевого счета и статус услуг у провайдера",
        "Уточните у провайдера, требуется ли привязка MAC-адреса",
        "Перезагрузите терминал провайдера / модем",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "netifd",
  },
  205: {
    code: 205,
    identifier: "GATEWAY_UNREACHABLE",
    category: "network",
    severity: "error",
    internalDescription: "Default gateway assigned by DHCP does not respond to ARP requests",
    title: {
      en: "Default Gateway Unreachable",
      ru: "Основной шлюз недоступен",
    },
    description: {
      en: "The router cannot communicate with the default gateway IP provided by your ISP.",
      ru: "Роутер не получает ответов по протоколу ARP от IP-адреса шлюза провайдера.",
    },
    triggerConditions: {
      en: ["ARP resolution failure for default nexthop", "ICMP host unreachable"],
      ru: ["Сбой разрешения ARP для основного шлюза", "Сообщение ICMP Host Unreachable"],
    },
    remediation: {
      en: [
        "Renew the DHCP lease on the WAN interface",
        "Verify static IP gateway configuration if using manual settings",
      ],
      ru: [
        "Перезапросите аренду DHCP на интерфейсе WAN",
        "Проверьте правильность адреса шлюза при статической настройке",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "netifd",
  },
  206: {
    code: 206,
    identifier: "DHCP_FAILURE",
    category: "network",
    severity: "error",
    internalDescription: "Local DHCP server (dnsmasq/odhcpd) failed to lease an address or pool exhausted",
    title: {
      en: "DHCP Server Error",
      ru: "Ошибка службы DHCP",
    },
    description: {
      en: "The internal DHCP server could not allocate an IP address for a connecting client.",
      ru: "Встроенный DHCP-сервер не смог выделить IP-адрес для подключающегося устройства.",
    },
    triggerConditions: {
      en: ["DHCP address pool exhausted", "dnsmasq daemon unresponsive"],
      ru: ["Пул свободных адресов DHCP исчерпан", "Служба dnsmasq не отвечает"],
    },
    remediation: {
      en: [
        "Expand the DHCP IP range in Network > DHCP and DNS",
        "Restart the dnsmasq service via System > Startup Services",
      ],
      ru: [
        "Расширьте диапазон адресов в разделе Сеть > DHCP и DNS",
        "Перезапустите службу dnsmasq в меню Службы автозапуска",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "odhcpd",
  },
  207: {
    code: 207,
    identifier: "IP_CONFLICT",
    category: "network",
    severity: "warning",
    internalDescription: "Duplicate IP address detected on the local LAN network segment",
    title: {
      en: "IP Address Conflict Detected",
      ru: "Конфликт IP-адресов",
    },
    description: {
      en: "Two devices on your network are attempting to use the exact same IP address.",
      ru: "Два устройства в локальной сети пытаются использовать одинаковый IP-адрес.",
    },
    triggerConditions: {
      en: ["Gratuitous ARP received for already bound IP address"],
      ru: ["Получен Gratuitous ARP для уже занятого адреса"],
    },
    remediation: {
      en: [
        "Review static IP assignments on connected devices",
        "Configure static DHCP leases in ORBIX Network settings",
      ],
      ru: [
        "Проверьте ручные статические настройки IP на устройствах",
        "Назначьте статическую привязку IP к MAC в настройках сети",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "arp",
  },
  208: {
    code: 208,
    identifier: "SUBNET_COLLISION",
    category: "network",
    severity: "warning",
    internalDescription: "WAN IP subnet matches LAN bridge subnet (e.g. 192.168.1.0/24)",
    title: {
      en: "Subnet Collision Detected",
      ru: "Коллизия подсетей WAN и LAN",
    },
    description: {
      en: "Your ISP modem is using the same network subnet as your local router network (192.168.1.0/24).",
      ru: "Подсеть вышестоящего модема провайдера совпадает с локальной подсетью роутера (192.168.1.0/24).",
    },
    triggerConditions: {
      en: ["WAN interface IP is in 192.168.1.0/24 and LAN is 192.168.1.0/24"],
      ru: ["Адрес WAN находится в подсети 192.168.1.0/24 при LAN 192.168.1.0/24"],
    },
    remediation: {
      en: [
        "Change the router LAN IP address to 192.168.2.1 or 10.0.0.1 in Network > Interfaces",
      ],
      ru: [
        "Измените локальный адрес роутера на 192.168.2.1 или 10.0.0.1 в Сеть > Интерфейсы",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "netifd",
  },
  209: {
    code: 209,
    identifier: "INTERFACE_DOWN",
    category: "network",
    severity: "warning",
    internalDescription: "Configured network interface transitioned to down state",
    title: {
      en: "Network Interface Down",
      ru: "Сетевой интерфейс отключен",
    },
    description: {
      en: "A configured network device or bridge interface has been disabled or lost link.",
      ru: "Один из сконфигурированных сетевых интерфейсов или мостов перешел в состояние down.",
    },
    triggerConditions: {
      en: ["netifd interface down notification", "Physical port unplugged"],
      ru: ["Уведомление netifd об отключении интерфейса", "Физический кабель извлечен"],
    },
    remediation: {
      en: ["Inspect interface status in Network > Interfaces", "Check physical cabling"],
      ru: ["Проверьте статус в Сеть > Интерфейсы", "Проверьте физическое подключение"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "netifd",
  },
  210: {
    code: 210,
    identifier: "LINK_DEGRADED",
    category: "network",
    severity: "warning",
    internalDescription: "Ethernet port negotiated reduced speed (e.g. 100M instead of 1G) or duplex mismatch",
    title: {
      en: "Link Speed Degraded",
      ru: "Снижена скорость линка",
    },
    description: {
      en: "An Ethernet port negotiated 100 Mbps or Half-Duplex instead of Gigabit speed.",
      ru: "Порт Ethernet согласовал скорость 100 Мбит/с или полудуплекс вместо 1 Гбит/с.",
    },
    triggerConditions: {
      en: ["Port speed drops from 1000F to 100F", "High CRC error rate on PHY"],
      ru: ["Падение скорости с 1000F до 100F", "Рост счетчика ошибок CRC на PHY"],
    },
    remediation: {
      en: [
        "Check Ethernet cable quality — 1 Gbps requires all 8 wires intact (Cat 5e or better)",
        "Inspect RJ45 connectors for oxidation or damage",
      ],
      ru: [
        "Проверьте витую пару — для 1 Гбит/с необходимы все 8 жил (категория Cat 5e+)",
        "Осмотрите коннекторы RJ45 на наличие повреждений",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "ethtool",
  },
  211: {
    code: 211,
    identifier: "NETWORK_RECONFIGURING",
    category: "network",
    severity: "info",
    internalDescription: "Network subsystems are applying atomic UCI changes",
    title: {
      en: "Network Reconfiguring",
      ru: "Применение настроек сети",
    },
    description: {
      en: "Network interfaces are momentarily reloading to apply updated configurations.",
      ru: "Сетевые интерфейсы перезагружаются для применения обновленной конфигурации.",
    },
    triggerConditions: {
      en: ["ubus call uci apply invoked", "netifd reload running"],
      ru: ["Вызов uci apply", "Перезапуск конфигурации netifd"],
    },
    remediation: {
      en: ["Please wait a few moments for changes to settle"],
      ru: ["Подождите несколько секунд до завершения операции"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "netifd",
  },

  // ==========================================
  // 300–399: Routing & Traffic
  // ==========================================
  300: {
    code: 300,
    identifier: "ROUTE_UNAVAILABLE",
    category: "routing",
    severity: "error",
    internalDescription: "Routing table lookup failed for target destination",
    title: {
      en: "Route Unavailable",
      ru: "Маршрут недоступен",
    },
    description: {
      en: "The kernel routing table does not have an active path to the requested destination.",
      ru: "В таблице маршрутизации ядра отсутствует путь к запрашиваемому адресу назначения.",
    },
    triggerConditions: {
      en: ["FIB lookup returns RTN_UNREACHABLE", "Default gateway interface down"],
      ru: ["Поиск в FIB вернул RTN_UNREACHABLE", "Интерфейс шлюза по умолчанию отключен"],
    },
    remediation: {
      en: ["Check WAN uplink status", "Inspect routing policies in Routing > Policy Routing"],
      ru: ["Проверьте статус аплинка WAN", "Проверьте правила в Маршрутизация > PBR"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "ip_route",
  },
  301: {
    code: 301,
    identifier: "NO_VALID_ROUTE",
    category: "routing",
    severity: "error",
    internalDescription: "Packet discarded due to missing default or specific route entry",
    title: {
      en: "No Valid Route",
      ru: "Отсутствует корректный маршрут",
    },
    description: {
      en: "Traffic cannot be forwarded because no default gateway exists in the active routing table.",
      ru: "Трафик не может быть перенаправлен из-за отсутствия шлюза в активной таблице маршрутизации.",
    },
    triggerConditions: {
      en: ["ip route show table main has no default route"],
      ru: ["В таблице main отсутствует маршрут default"],
    },
    remediation: {
      en: ["Verify WAN DHCP client is receiving gateway options from ISP"],
      ru: ["Убедитесь, что DHCP-клиент WAN получает параметры шлюза"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "ip_route",
  },
  302: {
    code: 302,
    identifier: "POLICY_ROUTING_FAILED",
    category: "routing",
    severity: "error",
    internalDescription: "PBR policy engine rule evaluation encountered an unreachable target table",
    title: {
      en: "Policy-Based Routing Error",
      ru: "Ошибка политик маршрутизации (PBR)",
    },
    description: {
      en: "A Policy-Based Routing rule attempted to forward traffic to an uninitialized tunnel table.",
      ru: "Правило PBR попыталось направить трафик в неинициализированную таблицу туннеля.",
    },
    triggerConditions: {
      en: ["ip rule points to empty table", "Target VPN interface is disabled"],
      ru: ["Правило ip rule ссылается на пустую таблицу", "Целевой интерфейс VPN отключен"],
    },
    remediation: {
      en: [
        "Verify the VPN tunnel assigned to this policy is active",
        "Review rules in Policy Routing (PBR)",
      ],
      ru: [
        "Убедитесь, что VPN-туннель для этой политики запущен",
        "Проверьте правила в меню Маршрутизация (PBR)",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "pbr",
  },
  303: {
    code: 303,
    identifier: "TRAFFIC_MISROUTED",
    category: "routing",
    severity: "warning",
    internalDescription: "Traffic destined for VPN exited via direct WAN or vice versa",
    title: {
      en: "Traffic Misrouted",
      ru: "Некорректная маршрутизация трафика",
    },
    description: {
      en: "Packets matched a VPN bypass list but egressed over the direct WAN interface.",
      ru: "Пакеты из списка обхода туннеля вышли через прямой интерфейс WAN или наоборот.",
    },
    triggerConditions: {
      en: ["PBR fwmark not honored by netfilter", "Interface bind mismatch"],
      ru: ["Метка fwmark не была учтена netfilter", "Несовпадение привязки интерфейса"],
    },
    remediation: {
      en: ["Reapply routing policies in Routing > Unified Policies"],
      ru: ["Перепримените политики в разделе Единые политики"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "pbr",
  },
  304: {
    code: 304,
    identifier: "ROUTING_LOOP",
    category: "routing",
    severity: "critical",
    internalDescription: "TTL expired on looped routing path between VPN and default gateway",
    title: {
      en: "Routing Loop Detected",
      ru: "Обнаружена петля маршрутизации",
    },
    description: {
      en: "Traffic is looping between network interfaces until its Time-To-Live (TTL) expires.",
      ru: "Трафик циклически перенаправляется между интерфейсами до истечения времени жизни пакета (TTL).",
    },
    triggerConditions: {
      en: ["High rate of ICMP Time Exceeded packets", "VPN server IP routed into its own tunnel"],
      ru: ["Высокая частота пакетов ICMP Time Exceeded", "IP сервера VPN направлен в собственный туннель"],
    },
    remediation: {
      en: [
        "Ensure VPN server endpoint IP is routed via direct WAN, not via VPN tunnel",
        "Check static routes in Network > Interfaces",
      ],
      ru: [
        "Убедитесь, что IP-адрес сервера VPN маршрутизируется через WAN, а не через туннель",
        "Проверьте статические маршруты в Сеть > Интерфейсы",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "ip_route",
  },
  305: {
    code: 305,
    identifier: "TRAFFIC_BLACKHOLED",
    category: "routing",
    severity: "error",
    internalDescription: "Packets discarded by deliberate blackhole or unreachable route",
    title: {
      en: "Traffic Blackholed",
      ru: "Трафик сброшен (Blackhole)",
    },
    description: {
      en: "Traffic to this destination is intentionally dropped by an active routing policy.",
      ru: "Трафик к этому ресурсу сбрасывается активным правилом изоляции маршрутизации.",
    },
    triggerConditions: {
      en: ["Match against blackhole routing table", "Kill Switch route discard"],
      ru: ["Совпадение с таблицей blackhole", "Сброс маршрута Kill Switch"],
    },
    remediation: {
      en: ["Review active blocking rules in Routing Policies"],
      ru: ["Проверьте правила блокировки в Политиках маршрутизации"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "pbr",
  },
  306: {
    code: 306,
    identifier: "ROUTE_CONFLICT",
    category: "routing",
    severity: "warning",
    internalDescription: "Multiple identical metric routes exist for the same network prefix",
    title: {
      en: "Route Conflict",
      ru: "Конфликт маршрутов",
    },
    description: {
      en: "Conflicting routing rules with identical priorities detected across network interfaces.",
      ru: "Обнаружены конфликтующие маршруты с одинаковым приоритетом на разных интерфейсах.",
    },
    triggerConditions: {
      en: ["Dual default gateways with same metric"],
      ru: ["Несколько шлюзов по умолчанию с одинаковой метрикой"],
    },
    remediation: {
      en: ["Assign distinct route metrics in Network > Interfaces"],
      ru: ["Укажите разные метрики для интерфейсов в Сеть > Интерфейсы"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "ip_route",
  },
  307: {
    code: 307,
    identifier: "MTU_MISMATCH",
    category: "routing",
    severity: "warning",
    internalDescription: "Path MTU discovery failure or packet size exceeds interface MTU without fragmentation",
    title: {
      en: "MTU Size Mismatch",
      ru: "Несоответствие размера MTU",
    },
    description: {
      en: "Large packets are being dropped by tunnel overhead. Clamping MSS is recommended.",
      ru: "Пакеты большого размера сбрасываются из-за оверхеда туннеля. Рекомендуется включить MSS clamping.",
    },
    triggerConditions: {
      en: ["ICMP Fragmentation Needed drops", "TCP stalls on TLS handshake"],
      ru: ["Сброс пакетов ICMP Fragmentation Needed", "Зависание соединений на фазе TLS Client Hello"],
    },
    remediation: {
      en: [
        "Enable MSS Clamping in Network > Firewall",
        "Set WireGuard / AmneziaWG MTU to 1360 or 1280",
      ],
      ru: [
        "Включите MSS Clamping в разделе Сеть > Межсетевой экран",
        "Установите MTU для AmneziaWG/WireGuard на 1360 или 1280",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "netifd",
  },
  308: {
    code: 308,
    identifier: "PACKET_DROPPED",
    category: "routing",
    severity: "warning",
    internalDescription: "Packets dropped due to queue congestion or buffer overrun",
    title: {
      en: "Packet Loss Detected",
      ru: "Потеря пакетов (Packet Loss)",
    },
    description: {
      en: "Network interface transmit or receive queues experienced packet drops.",
      ru: "Очереди сетевого интерфейса переполнены, зафиксирован сброс сетевых пакетов.",
    },
    triggerConditions: {
      en: ["tx_dropped or rx_dropped counter incrementing"],
      ru: ["Рост счетчиков tx_dropped или rx_dropped"],
    },
    remediation: {
      en: ["Check for network saturation or CPU throttling on router"],
      ru: ["Проверьте загрузку канала и процессора роутера"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "nftables",
  },
  309: {
    code: 309,
    identifier: "TRAFFIC_QUARANTINED",
    category: "routing",
    severity: "warning",
    internalDescription: "Client host traffic redirected to captive quarantine zone",
    title: {
      en: "Traffic Quarantined",
      ru: "Трафик изолирован (Карантин)",
    },
    description: {
      en: "An unauthenticated or suspicious device has been isolated from the local network.",
      ru: "Неавторизованное или подозрительное устройство помещено в изолированный сегмент сети.",
    },
    triggerConditions: {
      en: ["Client assigned to guest quarantine VLAN"],
      ru: ["Устройство определено в гостевой карантинный VLAN"],
    },
    remediation: {
      en: ["Approve device in Connected Clients or complete captive portal login"],
      ru: ["Подтвердите устройство в Подключенных устройствах"],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "firewall",
  },
  310: {
    code: 310,
    identifier: "INTERFACE_UNAVAILABLE",
    category: "routing",
    severity: "error",
    internalDescription: "Interface required by active routing entry does not exist in kernel",
    title: {
      en: "Target Interface Unavailable",
      ru: "Целевой интерфейс недоступен",
    },
    description: {
      en: "A routing rule specifies a virtual interface that has not been created.",
      ru: "Правило маршрутизации ссылается на виртуальный интерфейс, который отсутствует в ядре.",
    },
    triggerConditions: {
      en: ["tun0 / awg0 device missing when route is populated"],
      ru: ["Устройство tun0 / awg0 отсутствует при наличии маршрута"],
    },
    remediation: {
      en: ["Ensure the underlying VPN service (Sing-box / AmneziaWG) is running"],
      ru: ["Убедитесь, что служба VPN (Sing-box / AmneziaWG) запущена"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "netifd",
  },

  // ==========================================
  // 400–499: Security & Firewall
  // ==========================================
  400: {
    code: 400,
    identifier: "FIREWALL_BLOCKED",
    category: "security",
    severity: "warning",
    internalDescription: "Packet blocked by nftables firewall forward or input policy rule",
    title: {
      en: "Connection Blocked by Firewall",
      ru: "Соединение заблокировано файрволом",
    },
    description: {
      en: "The firewall rejected an incoming or outgoing connection based on active security rules.",
      ru: "Межсетевой экран отклонил соединение согласно действующим правилам безопасности.",
    },
    triggerConditions: {
      en: ["nftables drop rule hit in inet fw4", "Unsolicited WAN inbound attempt"],
      ru: ["Срабатывание правила drop в nftables", "Несанкционированная входящая попытка из WAN"],
    },
    remediation: {
      en: ["Check firewall port forwarding and traffic rules in Network > Firewall"],
      ru: ["Проверьте правила проброса портов в Сеть > Межсетевой экран"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "firewall4",
  },
  401: {
    code: 401,
    identifier: "UNAUTHORIZED_ACCESS",
    category: "security",
    severity: "critical",
    internalDescription: "Repeated failed login attempts or unauthorized RPC access token",
    title: {
      en: "Unauthorized Access Attempt",
      ru: "Попытка несанкционированного доступа",
    },
    description: {
      en: "Multiple failed authentication attempts detected against router management services.",
      ru: "Зафиксированы повторные неудачные попытки входа в панель управления роутером.",
    },
    triggerConditions: {
      en: ["More than 5 invalid login attempts in 60s", "Invalid session token submitted"],
      ru: ["Более 5 неудачных попыток входа за 60 секунд", "Недействительный токен сессии"],
    },
    remediation: {
      en: [
        "Verify your router credentials",
        "Ensure remote WAN SSH/Web access is disabled unless protected by VPN",
      ],
      ru: [
        "Проверьте правильность вводимых учетных данных",
        "Убедитесь, что доступ к админке из внешнего WAN отключен",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "uhttpd",
  },
  402: {
    code: 402,
    identifier: "POLICY_DENIED",
    category: "security",
    severity: "warning",
    internalDescription: "Traffic rejected by user intent-based policy (e.g. Parental Control / Category Filter)",
    title: {
      en: "Access Denied by Policy",
      ru: "Доступ ограничен политикой безопасности",
    },
    description: {
      en: "This website or service is blocked by your content filtering or security policy.",
      ru: "Доступ к данному ресурсу ограничен правилами фильтрации контента или политикой доступа.",
    },
    triggerConditions: {
      en: ["Match against category blocklist", "Scheduled access restriction active"],
      ru: ["Совпадение с черным списком категорий", "Ограничение по расписанию"],
    },
    remediation: {
      en: ["Review filtering rules in Routing > Category Feeds or Unified Policies"],
      ru: ["Проверьте правила в разделе Категории и списки"],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "firewall4",
  },
  403: {
    code: 403,
    identifier: "INTRUSION_DETECTED",
    category: "security",
    severity: "critical",
    internalDescription: "SYN flood, port scan or known exploit signature detected on network interface",
    title: {
      en: "Port Scan / Intrusion Detected",
      ru: "Обнаружено сканирование сети / вторжение",
    },
    description: {
      en: "A remote host performed rapid port scanning or sent suspicious flood traffic.",
      ru: "Удаленный узел выполнил быстрое сканирование портов или отправку аномального трафика.",
    },
    triggerConditions: {
      en: ["Rate of TCP SYN packets exceeds threshold", "Sequential port probing detected"],
      ru: ["Превышен порог пакетов TCP SYN", "Зафиксировано последовательное сканирование портов"],
    },
    remediation: {
      en: [
        "The attacking IP has been temporarily blacklisted by the firewall",
        "Inspect connection logs in Status > System Logs",
      ],
      ru: [
        "Атакующий IP-адрес временно заблокирован межсетевым экраном",
        "Проверьте логи в Статус > Системные логи",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "firewall4",
  },
  404: {
    code: 404,
    identifier: "PORT_UNAVAILABLE",
    category: "security",
    severity: "warning",
    internalDescription: "Port forwarding target host is unreachable or port closed",
    title: {
      en: "Forwarded Port Closed / Host Down",
      ru: "Порт недоступен / хост отключен",
    },
    description: {
      en: "An external request was forwarded to an internal LAN host, but the host rejected the connection.",
      ru: "Запрос перенаправлен на внутреннее устройство, но устройство отклонило соединение.",
    },
    triggerConditions: {
      en: ["Target LAN IP does not reply with SYN-ACK on forwarded port"],
      ru: ["Внутренний хост не отвечает SYN-ACK на проброшенном порту"],
    },
    remediation: {
      en: ["Check that the service is running on the local device and firewall permits traffic"],
      ru: ["Убедитесь, что служба запущена на локальном компьютере и файрвол хоста открыт"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "firewall4",
  },
  405: {
    code: 405,
    identifier: "GEO_RESTRICTION",
    category: "security",
    severity: "warning",
    internalDescription: "Destination is restricted by geo-blocking or regional sanctions rule",
    title: {
      en: "Geoblocked Service",
      ru: "Геоблокировка сервиса",
    },
    description: {
      en: "The target service restricts connections originating from your current physical region.",
      ru: "Запрашиваемый сервис блокирует подключения из вашего текущего географического региона.",
    },
    triggerConditions: {
      en: ["Target domain is in Geoblocked / RuNet blocklist", "Direct connection drops at BGP level"],
      ru: ["Домен находится в списке геоблокировок", "Соединение блокируется на уровне ТСПУ/BGP"],
    },
    remediation: {
      en: [
        "Enable the 'Geoblocked Services & Instagram' policy in Simple Policy Manager",
        "Route traffic through an international VLESS or AmneziaWG tunnel",
      ],
      ru: [
        "Включите политику 'Зарубежные сервисы и Instagram' в простом режиме",
        "Направьте трафик через зарубежный сервер VLESS или AmneziaWG",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "pbr",
  },
  406: {
    code: 406,
    identifier: "TRAFFIC_FILTERED",
    category: "security",
    severity: "info",
    internalDescription: "Packet altered by DPI circumvention engine (Zapret nfqws / tpws)",
    title: {
      en: "DPI Desynchronization Applied",
      ru: "Применена модификация пакетов (DPI)",
    },
    description: {
      en: "ORBIX Zapret engine successfully modified packet headers to bypass deep packet inspection.",
      ru: "Модуль Zapret успешно модифицировал заголовки пакетов для обхода фильтрации ТСПУ/DPI.",
    },
    triggerConditions: {
      en: ["nfqws packet split / fake payload injected"],
      ru: ["Инъекция фейкового пакета или сплит через nfqws"],
    },
    remediation: {
      en: ["No action required. Connection successfully protected."],
      ru: ["Действия не требуются. Соединение успешно защищено."],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "nftables",
  },
  407: {
    code: 407,
    identifier: "RATE_LIMITED",
    category: "security",
    severity: "warning",
    internalDescription: "Traffic volume exceeded bandwidth cap or connection rate limit",
    title: {
      en: "Connection Rate Limited",
      ru: "Превышен лимит скорости / соединений",
    },
    description: {
      en: "The device exceeded the configured concurrent connection rate or bandwidth limit.",
      ru: "Устройство превысило допустимый лимит одновременных соединений или полосы пропускания.",
    },
    triggerConditions: {
      en: ["nftables limit rate rule hit"],
      ru: ["Срабатывание правила ограничения частоты пакетов"],
    },
    remediation: {
      en: ["Review Quality of Service (QoS) and bandwidth rules in Network settings"],
      ru: ["Проверьте ограничения QoS и полосы пропускания в настройках"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "nftables",
  },
  408: {
    code: 408,
    identifier: "DNS_LEAK_DETECTED",
    category: "security",
    severity: "critical",
    internalDescription: "DNS queries bypassing encrypted VPN tunnel and leaking to ISP resolver",
    title: {
      en: "DNS Leak Detected",
      ru: "Обнаружена утечка DNS",
    },
    description: {
      en: "DNS requests are escaping the protected VPN tunnel and being sent unencrypted to your ISP.",
      ru: "DNS-запросы выходят за пределы защищенного VPN-туннеля и передаются открыто провайдеру.",
    },
    triggerConditions: {
      en: [
        "Port 53 UDP traffic observed on WAN while VPN active",
        "ISP DNS server returned in DNS leak audit",
      ],
      ru: [
        "Трафик UDP 53 зафиксирован на интерфейсе WAN при активном VPN",
        "Аудит выявил использование DNS-серверов провайдера",
      ],
    },
    remediation: {
      en: [
        "Enable 'Strict DNS Leak Protection' in Security Settings",
        "Force all local DNS traffic to internal encrypted resolver (DoH / Sing-box)",
        "Check that client devices do not have manual third-party DNS configured",
      ],
      ru: [
        "Включите 'Строгую защиту от утечек DNS' в настройках безопасности",
        "Направьте весь DNS-трафик через встроенный защищенный резолвер (DoH / Sing-box)",
        "Убедитесь, что на клиентских устройствах не прописаны сторонние DNS вручную",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "leak_detector",
  },
  409: {
    code: 409,
    identifier: "IP_LEAK_DETECTED",
    category: "security",
    severity: "critical",
    internalDescription: "Protected traffic egressing via regular WAN gateway exposing real public IP",
    title: {
      en: "IP Address Leak Detected",
      ru: "Обнаружена утечка реального IP-адреса",
    },
    description: {
      en: "Traffic designated for VPN protection is exiting directly via the unencrypted WAN interface.",
      ru: "Трафик, подлежащий защите через VPN, выходит напрямую через незашифрованный интерфейс WAN.",
    },
    triggerConditions: {
      en: [
        "Protected client device connects directly to external IP without tunnel encapsulation",
        "Routing table default route fallback occurred",
      ],
      ru: [
        "Устройство подключается напрямую к внешнему IP в обход туннеля",
        "Произошел откат на дефолтный маршрут WAN",
      ],
    },
    remediation: {
      en: [
        "Enable Kill Switch immediately to block unprotected WAN fallback",
        "Verify Policy Routing rules for protected devices",
      ],
      ru: [
        "Включите Kill Switch для немедленной блокировки утечек в WAN",
        "Проверьте правила маршрутизации для защищаемых устройств",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "leak_detector",
  },
  410: {
    code: 410,
    identifier: "KILL_SWITCH_TRIGGERED",
    category: "security",
    severity: "critical",
    internalDescription: "VPN tunnel disconnected; Kill Switch firewall dropped all unencrypted WAN fallback",
    title: {
      en: "Kill Switch Activated",
      ru: "Сработала аварийная защита (Kill Switch)",
    },
    description: {
      en: "Your protected VPN connection was interrupted. ORBIX has blocked all unencrypted traffic to prevent your real IP and data from leaking to the Internet.",
      ru: "Защищенное VPN-подключение было прервано. ORBIX мгновенно заблокировал весь незашифрованный трафик, чтобы предотвратить утечку вашего реального IP-адреса и данных.",
    },
    triggerConditions: {
      en: [
        "VPN tunnel down while Kill Switch enabled",
        "Tunnel healthcheck timeout exceeded",
      ],
      ru: [
        "Падение VPN-туннеля при активном режиме Kill Switch",
        "Превышен таймаут проверки доступности VPN-сервера",
      ],
    },
    remediation: {
      en: [
        "Check VPN server status in Circumvention & VPN > VPN Manager",
        "Verify internet uplink connectivity",
        "Click 'Retry VPN Connection' to re-establish the secure tunnel",
        "If you intentionally want to browse directly, disable Kill Switch in Security Settings",
      ],
      ru: [
        "Проверьте статус сервера в меню Обход блокировок и VPN > Менеджер VPN",
        "Проверьте подключение к Интернету (WAN)",
        "Нажмите 'Повторить подключение VPN' для восстановления туннеля",
        "Если вы хотите продолжить работу напрямую, отключите Kill Switch в настройках",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "kill_switch",
  },
  411: {
    code: 411,
    identifier: "WAN_ISOLATED",
    category: "security",
    severity: "critical",
    internalDescription: "All WAN traffic intentionally isolated from local network by security administrator",
    title: {
      en: "WAN Completely Isolated",
      ru: "Внешняя сеть WAN полностью изолирована",
    },
    description: {
      en: "The router has cut all incoming and outgoing Internet traffic. Only local LAN access is allowed.",
      ru: "Роутер полностью заблокировал внешний интернет-трафик. Разрешен только доступ к локальной сети.",
    },
    triggerConditions: {
      en: ["Emergency WAN isolation switch activated in Security settings"],
      ru: ["Активирован ручной переключатель экстренной изоляции WAN"],
    },
    remediation: {
      en: ["Disable emergency isolation in Security Settings to restore Internet access"],
      ru: ["Отключите режим экстренной изоляции в настройках безопасности"],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "kill_switch",
  },
  412: {
    code: 412,
    identifier: "SUSPICIOUS_CONNECTION",
    category: "security",
    severity: "warning",
    internalDescription: "Outbound connection attempted to known malicious or botnet command-and-control IP",
    title: {
      en: "Suspicious Outbound Connection Blocked",
      ru: "Подозрительное исходящее соединение",
    },
    description: {
      en: "A device on your network attempted to contact an IP address associated with known malware.",
      ru: "Одно из устройств в локальной сети пыталось связаться с известным вредоносным узлом.",
    },
    triggerConditions: {
      en: ["Destination IP matches threat intelligence feed"],
      ru: ["IP назначения совпадает с базой вредоносных узлов"],
    },
    remediation: {
      en: [
        "Identify the source client device from the event details",
        "Scan the device for malware or unwanted background software",
      ],
      ru: [
        "Определите устройство-источник в подробностях события",
        "Проверьте устройство на наличие вредоносного ПО",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "firewall4",
  },

  // ==========================================
  // 500–599: VPN & Tunnels
  // ==========================================
  500: {
    code: 500,
    identifier: "VPN_UNAVAILABLE",
    category: "vpn",
    severity: "error",
    internalDescription: "VPN core service daemon is stopped or not configured",
    title: {
      en: "VPN Service Unavailable",
      ru: "Служба VPN недоступна",
    },
    description: {
      en: "The VPN daemon (Sing-box or AmneziaWG) is not running on the router.",
      ru: "Служба VPN (Sing-box или AmneziaWG) остановлена или не настроена.",
    },
    triggerConditions: {
      en: ["sing-box process dead", "No VPN profiles configured"],
      ru: ["Процесс sing-box остановлен", "Отсутствуют настроенные профили VPN"],
    },
    remediation: {
      en: [
        "Add or import a VPN configuration in Circumvention & VPN",
        "Start the VPN service in Startup Services",
      ],
      ru: [
        "Добавьте или импортируйте конфигурацию в Обход блокировок и VPN",
        "Запустите службу в меню Службы автозапуска",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "sing-box",
  },
  501: {
    code: 501,
    identifier: "VPN_DISCONNECTED",
    category: "vpn",
    severity: "error",
    internalDescription: "Active VPN tunnel closed or remote server terminated connection",
    title: {
      en: "VPN Tunnel Disconnected",
      ru: "VPN-туннель отключен",
    },
    description: {
      en: "The active VPN connection was closed by the remote server or network timeout.",
      ru: "Активное VPN-подключение было разорвано удаленным сервером или по таймауту.",
    },
    triggerConditions: {
      en: ["TLS connection EOF received", "WireGuard handshake timeout > 180s"],
      ru: ["Получен сигнал закрытия TLS соединения", "Таймаут рукопожатия WireGuard > 180 сек"],
    },
    remediation: {
      en: [
        "Verify your Internet connection is working",
        "Switch to another VPN node in Happ Subscriptions or VPN Manager",
      ],
      ru: [
        "Проверьте доступность Интернета",
        "Переключитесь на резервный сервер в Подписках Happ VPN или Менеджере VPN",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "sing-box",
  },
  502: {
    code: 502,
    identifier: "VPN_HANDSHAKE_FAILED",
    category: "vpn",
    severity: "error",
    internalDescription: "AmneziaWG / WireGuard handshake did not complete with remote peer",
    title: {
      en: "VPN Handshake Failed",
      ru: "Сбой рукопожатия VPN (Handshake)",
    },
    description: {
      en: "The router sent handshake initiation packets, but received no reply from the VPN peer.",
      ru: "Роутер отправил пакеты инициализации сессии, но не получил ответа от VPN-сервера.",
    },
    triggerConditions: {
      en: ["Latest handshake remains 0 after 30s", "Junk packet headers rejected by server"],
      ru: ["Время последнего рукопожатия равно 0 более 30 сек", "Неверные параметры обфускации"],
    },
    remediation: {
      en: [
        "Check that the server endpoint and port are correct",
        "Verify AmneziaWG obfuscation parameters (Jc, Jmin, Jmax, H1-H4)",
        "Confirm your subscription or peer key is still valid",
      ],
      ru: [
        "Проверьте IP-адрес и порт сервера VPN",
        "Проверьте параметры обфускации AmneziaWG (Jc, Jmin, Jmax, H1-H4)",
        "Убедитесь, что ключи доступа и подписка активны",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "amneziawg",
  },
  503: {
    code: 503,
    identifier: "VPN_SERVER_UNREACHABLE",
    category: "vpn",
    severity: "error",
    internalDescription: "Remote VPN server IP or port is blocked or unreachable across WAN",
    title: {
      en: "VPN Server Unreachable",
      ru: "VPN-сервер недоступен",
    },
    description: {
      en: "The router cannot reach the remote VPN server IP address. The server may be blocked by your ISP.",
      ru: "Роутер не может связаться с IP-адресом VPN-сервера. Возможно, сервер заблокирован провайдером.",
    },
    triggerConditions: {
      en: ["ICMP / TCP connect to VPN endpoint fails with timeout or connection reset"],
      ru: ["Таймаут подключения или TCP Reset при соединении с сервером VPN"],
    },
    remediation: {
      en: [
        "Try connecting with VLESS XTLS Reality (which masquerades as legitimate HTTPS)",
        "Select another geographic location in your subscription",
      ],
      ru: [
        "Используйте протокол VLESS XTLS Reality (маскируется под обычный HTTPS)",
        "Выберите другую локацию сервера в списке подписок",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "sing-box",
  },
  504: {
    code: 504,
    identifier: "VPN_AUTH_FAILED",
    category: "vpn",
    severity: "error",
    internalDescription: "VPN credentials, UUID, private key or public key rejected by remote peer",
    title: {
      en: "VPN Authentication Failed",
      ru: "Сбой аутентификации VPN",
    },
    description: {
      en: "The VPN server rejected the authorization credentials (UUID, password or private key).",
      ru: "VPN-сервер отклонил учетные данные (UUID, ключ или пароль).",
    },
    triggerConditions: {
      en: ["Server returns authentication error in tunnel log"],
      ru: ["Сервер вернул ошибку авторизации в лог туннеля"],
    },
    remediation: {
      en: [
        "Update your subscription in Circumvention & VPN > Subscriptions",
        "Check that your account has not expired",
      ],
      ru: [
        "Обновите подписку в меню Подписки Happ VPN",
        "Проверьте срок действия подписки у вашего провайдера VPN",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "sing-box",
  },
  505: {
    code: 505,
    identifier: "TUNNEL_FAILURE",
    category: "vpn",
    severity: "critical",
    internalDescription: "Kernel TUN/TAP virtual network device crashed or was removed",
    title: {
      en: "Virtual Tunnel Interface Failure",
      ru: "Критический сбой туннельного интерфейса",
    },
    description: {
      en: "The virtual tunnel interface (tun0) crashed or encountered a kernel driver fault.",
      ru: "Виртуальный сетевой интерфейс туннеля (tun0) аварийно завершил работу.",
    },
    triggerConditions: {
      en: ["tun0 interface disappeared unexpectedly", "IOCTL TUNSETIFF error"],
      ru: ["Внезапное исчезновение интерфейса tun0", "Ошибка IOCTL TUNSETIFF в ядре"],
    },
    remediation: {
      en: ["Restart the Sing-box / VPN service to re-create the virtual tunnel device"],
      ru: ["Перезапустите службу Sing-box для пересоздания виртуального устройства"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "sing-box",
  },
  506: {
    code: 506,
    identifier: "TUNNEL_TIMEOUT",
    category: "vpn",
    severity: "warning",
    internalDescription: "High latency or packet timeout observed on active VPN tunnel",
    title: {
      en: "VPN Tunnel Latency Timeout",
      ru: "Высокая задержка / таймаут туннеля",
    },
    description: {
      en: "The active VPN tunnel is experiencing severe latency (>500ms) or dropped packets.",
      ru: "Зафиксирована критически высокая задержка (>500 мс) или потеря пакетов внутри туннеля.",
    },
    triggerConditions: {
      en: ["RTT test latency exceeds 500ms", "Periodic probe timeout"],
      ru: ["Задержка RTT превышает 500 мс", "Таймаут периодического зонда"],
    },
    remediation: {
      en: ["Switch to a geographically closer server node with lower ping"],
      ru: ["Переключитесь на сервер с меньшей задержкой (ping)"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "sing-box",
  },
  507: {
    code: 507,
    identifier: "ENCRYPTION_FAILURE",
    category: "vpn",
    severity: "critical",
    internalDescription: "Crypto engine error or TLS cipher negotiation failure",
    title: {
      en: "Tunnel Encryption Error",
      ru: "Сбой криптографического шифрования",
    },
    description: {
      en: "A cryptographic error occurred during TLS or ChaCha20-Poly1305 session negotiation.",
      ru: "Произошла ошибка при согласовании шифра сессии (TLS или ChaCha20-Poly1305).",
    },
    triggerConditions: {
      en: ["OpenSSL / mbedTLS handshake cipher error"],
      ru: ["Ошибка согласования шифра в библиотеке криптографии"],
    },
    remediation: {
      en: ["Verify router system clock is synchronized via NTP"],
      ru: ["Убедитесь, что системные часы роутера синхронизированы по NTP"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "crypto",
  },
  508: {
    code: 508,
    identifier: "ROUTE_MISMATCH",
    category: "vpn",
    severity: "warning",
    internalDescription: "VPN routing table does not match intended AllowedIPs or PBR rules",
    title: {
      en: "VPN Routing Mismatch",
      ru: "Несоответствие маршрутов VPN",
    },
    description: {
      en: "The routes installed by the VPN connection conflict with local network policies.",
      ru: "Маршруты, установленные подключением VPN, конфликтуют с локальными правилами сети.",
    },
    triggerConditions: {
      en: ["AllowedIPs 0.0.0.0/0 conflicts with local LAN route"],
      ru: ["Маршрут AllowedIPs 0.0.0.0/0 перекрывает локальную сеть LAN"],
    },
    remediation: {
      en: ["Review AllowedIPs setting to ensure LAN 192.168.1.0/24 is excluded"],
      ru: ["Проверьте список AllowedIPs, исключив локальную подсеть 192.168.1.0/24"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "pbr",
  },
  509: {
    code: 509,
    identifier: "VPN_RECONNECTING",
    category: "vpn",
    severity: "info",
    internalDescription: "VPN service is attempting automatic tunnel reconnection",
    title: {
      en: "VPN Reconnecting",
      ru: "Переподключение VPN",
    },
    description: {
      en: "The router is automatically attempting to re-establish the VPN tunnel.",
      ru: "Роутер выполняет автоматическую попытку переподключения к VPN-серверу.",
    },
    triggerConditions: {
      en: ["Reconnect retry backoff loop active"],
      ru: ["Активен цикл повторного подключения"],
    },
    remediation: {
      en: ["Please wait. Reconnection in progress."],
      ru: ["Пожалуйста, подождите. Идет восстановление связи."],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "sing-box",
  },
  510: {
    code: 510,
    identifier: "VPN_CONFIGURATION_INVALID",
    category: "vpn",
    severity: "error",
    internalDescription: "Syntax or schema error in /etc/sing-box/config.json or awg0.conf",
    title: {
      en: "Invalid VPN Configuration",
      ru: "Ошибка в конфигурации VPN",
    },
    description: {
      en: "The VPN configuration file contains a syntax error or unsupported parameters.",
      ru: "Файл конфигурации VPN содержит синтаксическую ошибку или неподдерживаемые опции.",
    },
    triggerConditions: {
      en: ["sing-box check returns JSON syntax error", "awg-quick invalid line in conf"],
      ru: ["Синтаксическая ошибка JSON в конфиге sing-box", "Некорректная строка в awg0.conf"],
    },
    remediation: {
      en: ["Re-import a clean subscription URL or configuration file in VPN Manager"],
      ru: ["Импортируйте корректную ссылку на подписку заново в Менеджере VPN"],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "sing-box",
  },
  511: {
    code: 511,
    identifier: "VPN_HEALTHCHECK_FAILED",
    category: "vpn",
    severity: "error",
    internalDescription: "Automated latency or egress IP check through tunnel failed",
    title: {
      en: "VPN Healthcheck Failed",
      ru: "Сбой проверки работоспособности VPN",
    },
    description: {
      en: "The VPN tunnel is established, but test requests sent through it timed out.",
      ru: "Туннель поднят, но тестовые проверочные запросы через него не проходят.",
    },
    triggerConditions: {
      en: ["Health probe to captive portal check host timed out"],
      ru: ["Таймаут проверочного зонда через туннель"],
    },
    remediation: {
      en: ["Switch to another server node in Happ Subscriptions"],
      ru: ["Переключитесь на другой узел в Подписках Happ VPN"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "healthcheck",
  },

  // ==========================================
  // 600–699: DNS & Resolution
  // ==========================================
  600: {
    code: 600,
    identifier: "DNS_UNAVAILABLE",
    category: "dns",
    severity: "error",
    internalDescription: "Local DNS resolver daemon (dnsmasq) is stopped or not listening on port 53",
    title: {
      en: "DNS Resolver Unavailable",
      ru: "Служба DNS недоступна",
    },
    description: {
      en: "The router's DNS server is not responding to domain resolution requests.",
      ru: "Встроенный DNS-сервер роутера не отвечает на запросы преобразования доменных имен.",
    },
    triggerConditions: {
      en: ["dnsmasq daemon not running", "Port 53 not listening on 192.168.1.1"],
      ru: ["Процесс dnsmasq остановлен", "Порт 53 не слушает на 192.168.1.1"],
    },
    remediation: {
      en: ["Restart dnsmasq in System > Startup Services"],
      ru: ["Перезапустите dnsmasq в меню Службы автозапуска"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "dnsmasq",
  },
  601: {
    code: 601,
    identifier: "DNS_TIMEOUT",
    category: "dns",
    severity: "warning",
    internalDescription: "Upstream DNS servers did not answer within query timeout window",
    title: {
      en: "DNS Query Timeout",
      ru: "Таймаут DNS-запроса",
    },
    description: {
      en: "Upstream DNS resolvers did not respond in time. Websites may load slowly or fail.",
      ru: "Вышестоящие DNS-серверы не ответили вовремя. Сайты могут открываться с задержкой.",
    },
    triggerConditions: {
      en: ["dnsmasq query timeout to upstream forwarder"],
      ru: ["Таймаут перенаправления запроса в dnsmasq"],
    },
    remediation: {
      en: [
        "Configure fast reliable upstream resolvers (e.g. 1.1.1.1, 8.8.8.8, 77.88.8.8)",
        "Check DNS settings in Routing > DNS Routing Center",
      ],
      ru: [
        "Укажите надежные DNS-серверы (1.1.1.1, 8.8.8.8, 77.88.8.8)",
        "Проверьте настройки в меню Маршрутизация > Маршрутизация DNS",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "dnsmasq",
  },
  602: {
    code: 602,
    identifier: "DNS_RESOLUTION_FAILED",
    category: "dns",
    severity: "error",
    internalDescription: "Server returned SERVFAIL or query resolution failed completely",
    title: {
      en: "Domain Name Resolution Failed",
      ru: "Ошибка разрешения доменного имени",
    },
    description: {
      en: "The domain name could not be converted to an IP address.",
      ru: "Не удалось преобразовать доменное имя в сетевой IP-адрес.",
    },
    triggerConditions: {
      en: ["Resolver returned RCODE 2 (SERVFAIL)"],
      ru: ["Резолвер вернул ошибку SERVFAIL"],
    },
    remediation: {
      en: ["Check domain name spelling and test resolution with another upstream DNS"],
      ru: ["Проверьте правильность написания адреса и смените апстрим DNS"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "dnsmasq",
  },
  603: {
    code: 603,
    identifier: "DNS_BLOCKED",
    category: "dns",
    severity: "warning",
    internalDescription: "Domain blocked by local ad-blocker or parental control filter",
    title: {
      en: "Domain Blocked by Filter",
      ru: "Домен заблокирован фильтром",
    },
    description: {
      en: "Access to this domain was blocked by your ad-blocking or category filter rules.",
      ru: "Доступ к домену заблокирован фильтром рекламы или списком родительского контроля.",
    },
    triggerConditions: {
      en: ["Domain returned 0.0.0.0 or NXDOMAIN via adblock list"],
      ru: ["Домен вернул 0.0.0.0 или NXDOMAIN по списку adblock"],
    },
    remediation: {
      en: ["Whitelist the domain in Routing > Category Feeds if this is a false positive"],
      ru: ["Добавьте домен в белый список в меню Категории и списки"],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "dnsmasq",
  },
  604: {
    code: 604,
    identifier: "DNS_UPSTREAM_FAILED",
    category: "dns",
    severity: "error",
    internalDescription: "All configured upstream DNS forwarders are unreachable",
    title: {
      en: "All DNS Upstreams Failed",
      ru: "Все апстрим DNS-серверы недоступны",
    },
    description: {
      en: "None of the configured external DNS servers are responding.",
      ru: "Ни один из настроенных внешних DNS-серверов не отвечает на запросы.",
    },
    triggerConditions: {
      en: ["100% loss on DNS forwarder healthchecks"],
      ru: ["100% потеря пакетов на проверках DNS-серверов"],
    },
    remediation: {
      en: ["Verify WAN internet connectivity and update DNS forwarders in Network > DHCP and DNS"],
      ru: ["Проверьте доступ в Интернет и обновите адреса DNS в Сеть > DHCP и DNS"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "dnsmasq",
  },
  605: {
    code: 605,
    identifier: "DNSSEC_VALIDATION_FAILED",
    category: "dns",
    severity: "error",
    internalDescription: "Cryptographic signature validation failed for DNSSEC-signed domain",
    title: {
      en: "DNSSEC Validation Failed",
      ru: "Сбой валидации DNSSEC",
    },
    description: {
      en: "The cryptographic security signature of this domain could not be verified (possible spoofing).",
      ru: "Криптографическая подпись домена не прошла проверку (возможна подмена ответа).",
    },
    triggerConditions: {
      en: ["RRSIG verification mismatch", "Bogus DNSSEC response"],
      ru: ["Несовпадение подписи RRSIG", "Ответ помечен как Bogus DNSSEC"],
    },
    remediation: {
      en: [
        "Check that your router's clock is synchronized via NTP (accurate time is required for DNSSEC)",
        "Do not proceed if you suspect DNS tampering on your network",
      ],
      ru: [
        "Убедитесь, что время роутера точно синхронизировано по NTP",
        "Не переходите на сайт, если подозреваете попытку фишинга",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: false,
    relatedService: "dnsmasq",
  },
  606: {
    code: 606,
    identifier: "DNS_REBINDING_BLOCKED",
    category: "dns",
    severity: "warning",
    internalDescription: "External domain attempted to resolve to a private RFC1918 LAN IP address",
    title: {
      en: "DNS Rebinding Attack Blocked",
      ru: "Заблокирована атака DNS Rebinding",
    },
    description: {
      en: "An external domain attempted to point to a private local IP address (192.168.1.x). Blocked for security.",
      ru: "Внешний домен попытался разрешиться в локальный адрес сети (192.168.1.x). Заблокировано в целях безопасности.",
    },
    triggerConditions: {
      en: ["Public domain returns private RFC1918 address with rebind protection active"],
      ru: ["Публичный домен вернул частный адрес RFC1918"],
    },
    remediation: {
      en: [
        "No action needed. ORBIX successfully protected your local network devices from browser hijacking.",
      ],
      ru: [
        "Действия не требуются. ORBIX защитил устройства вашей локальной сети от взлома.",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "dnsmasq",
  },
  607: {
    code: 607,
    identifier: "DNS_POLICY_VIOLATION",
    category: "dns",
    severity: "warning",
    internalDescription: "DNS request routed to forbidden upstream violating split-horizon policy",
    title: {
      en: "DNS Policy Violation",
      ru: "Нарушение политики маршрутизации DNS",
    },
    description: {
      en: "A Russian (.ru) domain was sent to an international resolver or vice versa.",
      ru: "Запрос к домену .ru был ошибочно направлен на зарубежный DNS вместо национального резолвера.",
    },
    triggerConditions: {
      en: ["Split DNS rule mismatch in DnsRoutingCenter"],
      ru: ["Несоответствие правила раздельного DNS в центре маршрутизации"],
    },
    remediation: {
      en: ["Check Smart DNS split rules in Routing > DNS Routing Center"],
      ru: ["Проверьте правила в меню Маршрутизация > Маршрутизация DNS"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "dnsmasq",
  },
  608: {
    code: 608,
    identifier: "DOH_UNAVAILABLE",
    category: "dns",
    severity: "warning",
    internalDescription: "DNS-over-HTTPS upstream endpoint unreachable or TLS handshake timed out",
    title: {
      en: "DNS-over-HTTPS (DoH) Down",
      ru: "Служба DNS-over-HTTPS (DoH) недоступна",
    },
    description: {
      en: "The encrypted DNS-over-HTTPS upstream resolver is not responding.",
      ru: "Зашифрованный апстрим DNS-over-HTTPS не отвечает на защищенные запросы.",
    },
    triggerConditions: {
      en: ["HTTPS connection to DoH endpoint timed out"],
      ru: ["Таймаут HTTPS соединения к DoH эндпоинту"],
    },
    remediation: {
      en: ["ORBIX will automatically fall back to secondary encrypted DNS or standard upstream"],
      ru: ["ORBIX автоматически переключится на резервный защищенный DNS"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "https-dns",
  },
  609: {
    code: 609,
    identifier: "DOT_UNAVAILABLE",
    category: "dns",
    severity: "warning",
    internalDescription: "DNS-over-TLS (port 853) upstream blocked or certificate invalid",
    title: {
      en: "DNS-over-TLS (DoT) Down",
      ru: "Служба DNS-over-TLS (DoT) недоступна",
    },
    description: {
      en: "Port 853 DNS-over-TLS connection failed. Your ISP may be blocking port 853.",
      ru: "Соединение DNS-over-TLS (порт 853) не удалось. Возможно, провайдер блокирует порт 853.",
    },
    triggerConditions: {
      en: ["TCP port 853 connection dropped or reset"],
      ru: ["Сброс соединения TCP на порт 853"],
    },
    remediation: {
      en: ["Switch to DNS-over-HTTPS (DoH, port 443) which cannot be easily port-blocked"],
      ru: ["Используйте DNS-over-HTTPS (порт 443), который не блокируется по номеру порта"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "tls-dns",
  },

  // ==========================================
  // 700–799: Configuration
  // ==========================================
  700: {
    code: 700,
    identifier: "CONFIGURATION_INVALID",
    category: "config",
    severity: "error",
    internalDescription: "UCI validation failed against OpenWrt schema or syntax error in config file",
    title: {
      en: "Configuration Syntax Invalid",
      ru: "Некорректная конфигурация",
    },
    description: {
      en: "A setting contains an invalid value or violates the system configuration schema.",
      ru: "Один из параметров конфигурации содержит недопустимое значение или нарушает схему UCI.",
    },
    triggerConditions: {
      en: ["uci -q get validation failure"],
      ru: ["Сбой валидации параметров uci"],
    },
    remediation: {
      en: ["Revert pending changes in the top notification bar or fix invalid inputs"],
      ru: ["Откатите несохраненные изменения в верхней панели или исправьте значение"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "uci",
  },
  701: {
    code: 701,
    identifier: "CONFIGURATION_CONFLICT",
    category: "config",
    severity: "warning",
    internalDescription: "Two active configurations conflict (e.g. duplicate VLAN ID or subnet overlap)",
    title: {
      en: "Configuration Conflict",
      ru: "Конфликт параметров конфигурации",
    },
    description: {
      en: "Multiple settings conflict with each other (e.g. duplicate VLAN ID or subnet overlap).",
      ru: "Несколько параметров конфликтуют друг с другом (например, дубликат VLAN ID или перекрытие подсетей).",
    },
    triggerConditions: {
      en: ["Duplicate VLAN ID or conflicting firewall zone names"],
      ru: ["Дубликат номера VLAN или конфликт имен зон файрвола"],
    },
    remediation: {
      en: ["Review conflicting values before applying changes"],
      ru: ["Проверьте конфликтующие значения перед сохранением"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "uci",
  },
  702: {
    code: 702,
    identifier: "CONFIGURATION_APPLY_FAILED",
    category: "config",
    severity: "error",
    internalDescription: "ubus call uci apply failed or service reload returned non-zero exit code",
    title: {
      en: "Failed to Apply Settings",
      ru: "Сбой применения конфигурации",
    },
    description: {
      en: "The system encountered an error while writing and applying settings to the router.",
      ru: "Произошла ошибка при сохранении и применении настроек в операционной системе роутера.",
    },
    triggerConditions: {
      en: ["uci commit failure", "service reload exit code != 0"],
      ru: ["Сбой uci commit", "Код возврата перезагрузки службы отличен от нуля"],
    },
    remediation: {
      en: [
        "ORBIX Safety Rollback will automatically restore your previous working configuration",
        "Inspect system logs in Status > System Logs",
      ],
      ru: [
        "Сторожевой таймер ORBIX автоматически восстановит рабочую конфигурацию",
        "Проверьте системные логи в меню Статус > Системные логи",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "uci",
  },
  703: {
    code: 703,
    identifier: "CONFIGURATION_ROLLBACK",
    category: "config",
    severity: "warning",
    internalDescription: "Safety Rollback Watchdog restored previous configuration to prevent lockout",
    title: {
      en: "Configuration Safely Rolled Back",
      ru: "Сработал защитный откат конфигурации",
    },
    description: {
      en: "The Safety Watchdog automatically reverted recent network changes because confirmation timed out.",
      ru: "Сторожевой таймер безопасности автоматически вернул предыдущие настройки для предотвращения потери доступа.",
    },
    triggerConditions: {
      en: ["uci rollback timer expired without user confirmation token"],
      ru: ["Истекло время подтверждения конфигурации без получения токена"],
    },
    remediation: {
      en: [
        "Your previous working configuration has been fully restored",
        "Review changes that caused connection loss before trying again",
      ],
      ru: [
        "Ваша предыдущая рабочая конфигурация полностью восстановлена",
        "Убедитесь, что новые настройки не блокируют сетевой доступ к роутеру",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "rollback_watchdog",
  },
  704: {
    code: 704,
    identifier: "CONFIGURATION_LOCKED",
    category: "config",
    severity: "warning",
    internalDescription: "UCI lockfile held by another process or concurrent administrator session",
    title: {
      en: "Configuration Database Locked",
      ru: "Конфигурация заблокирована другим процессом",
    },
    description: {
      en: "Another process or administrative session is currently modifying router settings.",
      ru: "Другой процесс или параллельная сессия администратора сейчас изменяет настройки.",
    },
    triggerConditions: {
      en: ["/var/lock/uci.lock file exists and held"],
      ru: ["Существует активный файл блокировки /var/lock/uci.lock"],
    },
    remediation: {
      en: ["Wait a few seconds for the active operation to complete"],
      ru: ["Подождите несколько секунд до завершения текущей операции"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "uci",
  },
  705: {
    code: 705,
    identifier: "CONFIGURATION_MIGRATION_FAILED",
    category: "config",
    severity: "error",
    internalDescription: "Configuration schema migration failed when upgrading between ORBIX versions",
    title: {
      en: "Settings Migration Failed",
      ru: "Сбой миграции настроек",
    },
    description: {
      en: "Old settings could not be automatically converted to the new format during upgrade.",
      ru: "Предыдущие параметры конфигурации не удалось автоматически сконвертировать в новый формат.",
    },
    triggerConditions: {
      en: ["Legacy JSON config schema mismatch"],
      ru: ["Несовпадение схемы структуры устаревшего JSON файла"],
    },
    remediation: {
      en: ["Restore settings from a fresh JSON export or reconfigure via First-Run Wizard"],
      ru: ["Восстановите параметры из актуального бэкапа или настройте через Мастер настройки"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "migration",
  },

  // ==========================================
  // 800–899: Hardware & Compatibility
  // ==========================================
  800: {
    code: 800,
    identifier: "HARDWARE_UNSUPPORTED",
    category: "hardware",
    severity: "critical",
    internalDescription: "Hardware target architecture or CPU missing required instruction sets (e.g. crypto AES)",
    title: {
      en: "Hardware Feature Unsupported",
      ru: "Аппаратная функция не поддерживается",
    },
    description: {
      en: "The router CPU does not support hardware cryptographic acceleration required for this mode.",
      ru: "Процессор роутера не поддерживает аппаратное шифрование (AES-NI / NEON), необходимое для этого профиля.",
    },
    triggerConditions: {
      en: ["Missing CPU feature flags in /proc/cpuinfo"],
      ru: ["Отсутствие флагов инструкций в /proc/cpuinfo"],
    },
    remediation: {
      en: ["Use ChaCha20-Poly1305 software cipher which runs efficiently on non-AES CPUs"],
      ru: ["Используйте шифр ChaCha20-Poly1305, оптимизированный для процессоров без AES"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "kernel",
  },
  801: {
    code: 801,
    identifier: "DRIVER_UNAVAILABLE",
    category: "hardware",
    severity: "error",
    internalDescription: "Kernel module (kmod) for wireless radio or network adapter failed to load",
    title: {
      en: "Hardware Driver Unavailable",
      ru: "Драйвер оборудования недоступен",
    },
    description: {
      en: "A required kernel module for the Wi-Fi chip or USB network adapter could not be loaded.",
      ru: "Необходимый модуль ядра для Wi-Fi чипа или адаптера не смог загрузиться.",
    },
    triggerConditions: {
      en: ["modprobe kmod failure", "Missing firmware binary in /lib/firmware"],
      ru: ["Сбой modprobe", "Отсутствие файла микрокода в /lib/firmware"],
    },
    remediation: {
      en: ["Install the missing driver package via System > Software Packages"],
      ru: ["Установите соответствующий пакет драйвера в меню Пакеты ПО"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "kmod",
  },
  802: {
    code: 802,
    identifier: "CAPABILITY_MISSING",
    category: "hardware",
    severity: "warning",
    internalDescription: "Feature requires additional RAM or flash storage not present on this hardware",
    title: {
      en: "Hardware Capability Missing",
      ru: "Недостаточно аппаратных ресурсов",
    },
    description: {
      en: "This feature requires more RAM or storage than is available on this router model.",
      ru: "Для этой функции требуется больше оперативной или flash-памяти, чем доступно на устройстве.",
    },
    triggerConditions: {
      en: ["Total RAM < 256MB for resource-heavy services"],
      ru: ["Объем RAM менее 256MB для ресурсоемких служб"],
    },
    remediation: {
      en: ["Enable memory-saving mode or disable unnecessary background daemons"],
      ru: ["Используйте облегченный режим работы и отключите неиспользуемые службы"],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "hal",
  },

  // ==========================================
  // 900–999: Services & Internal Errors
  // ==========================================
  900: {
    code: 900,
    identifier: "SERVICE_UNAVAILABLE",
    category: "services",
    severity: "error",
    internalDescription: "System daemon procd service unit is inactive or failed",
    title: {
      en: "System Service Unavailable",
      ru: "Служба системы недоступна",
    },
    description: {
      en: "A background system daemon is stopped and not responding to requests.",
      ru: "Системная фоновая служба остановлена и не отвечает на вызовы API.",
    },
    triggerConditions: {
      en: ["ubus call service list shows running: false"],
      ru: ["Служба сообщает статус running: false"],
    },
    remediation: {
      en: ["Start or restart the service in System > Startup Services"],
      ru: ["Запустите службу в меню Система > Службы автозапуска"],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "procd",
  },
  901: {
    code: 901,
    identifier: "SERVICE_CRASHED",
    category: "services",
    severity: "critical",
    internalDescription: "Process terminated unexpectedly by signal (SIGSEGV, SIGABRT, OOM)",
    title: {
      en: "Service Crashed Unexpectedly",
      ru: "Аварийное завершение службы",
    },
    description: {
      en: "A network service crashed unexpectedly due to an exception or memory fault.",
      ru: "Сетевая служба аварийно завершила работу из-за системного сбоя или нехватки памяти.",
    },
    triggerConditions: {
      en: ["Process exited with signal 11 or was killed by OOM killer"],
      ru: ["Процесс завершился с сигналом 11 или был убит OOM killer"],
    },
    remediation: {
      en: [
        "ORBIX procd watchdog will automatically attempt to restart the daemon",
        "Inspect crash backtrace in Status > System Logs",
      ],
      ru: [
        "Сторожевой таймер procd автоматически попытается перезапустить службу",
        "Проверьте лог сбоя в меню Статус > Системные логи",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "procd",
  },
  902: {
    code: 902,
    identifier: "RESOURCE_EXHAUSTED",
    category: "services",
    severity: "critical",
    internalDescription: "System RAM usage exceeded 95% or kernel conntrack table is full",
    title: {
      en: "System Resources Exhausted",
      ru: "Критическое исчерпание ресурсов",
    },
    description: {
      en: "Router RAM is over 95% full or the connection tracking table has reached maximum capacity.",
      ru: "Оперативная память роутера заполнена более чем на 95% или переполнена таблица соединений (conntrack).",
    },
    triggerConditions: {
      en: ["MemAvailable < 15MB", "nf_conntrack_count >= nf_conntrack_max"],
      ru: ["Свободной памяти менее 15 МБ", "Таблица nf_conntrack переполнена"],
    },
    remediation: {
      en: [
        "Reboot the router to flush stale connection tables",
        "Disable torrent/P2P traffic on local network",
      ],
      ru: [
        "Перезагрузите роутер для очистки таблиц соединений",
        "Ограничьте торрент-трафик в локальной сети",
      ],
    },
    httpRedirectApplicable: true,
    autoRecovery: true,
    relatedService: "kernel",
  },
  903: {
    code: 903,
    identifier: "STORAGE_FULL",
    category: "services",
    severity: "critical",
    internalDescription: "Writable flash storage overlay (/overlay) has zero bytes available",
    title: {
      en: "Flash Storage Full",
      ru: "Flash-память переполнена",
    },
    description: {
      en: "The router's writable flash storage is completely full (100%). Settings cannot be saved.",
      ru: "Перезаписываемая память роутера (/overlay) заполнена на 100%. Сохранение настроек невозможно.",
    },
    triggerConditions: {
      en: ["df /overlay reports 0 bytes available"],
      ru: ["df /overlay сообщает о 0 байт свободного места"],
    },
    remediation: {
      en: [
        "Delete unnecessary installed packages in System > Software Packages",
        "Clear log files or temporary cache files",
      ],
      ru: [
        "Удалите неиспользуемые пакеты в меню Система > Пакеты ПО",
        "Очистите временные файлы и кэш",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "overlayfs",
  },
  904: {
    code: 904,
    identifier: "INTERNAL_ERROR",
    category: "services",
    severity: "error",
    internalDescription: "Uncaught RPC exception or internal API handler error",
    title: {
      en: "Internal System Error",
      ru: "Внутренняя системная ошибка",
    },
    description: {
      en: "An unexpected error occurred while processing an internal system request.",
      ru: "Произошла непредвиденная ошибка при обработке системного запроса.",
    },
    triggerConditions: {
      en: ["ubus call returns error code -32000"],
      ru: ["Вызов ubus вернул внутреннюю ошибку -32000"],
    },
    remediation: {
      en: ["Refresh the page or check system daemon logs in System Logs"],
      ru: ["Обновите страницу или проверьте лог службы в Системных логах"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "rpcd",
  },
  905: {
    code: 905,
    identifier: "WATCHDOG_TRIGGERED",
    category: "services",
    severity: "critical",
    internalDescription: "Hardware or software watchdog timer timed out indicating system freeze",
    title: {
      en: "System Watchdog Triggered",
      ru: "Сработал сторожевой таймер (Watchdog)",
    },
    description: {
      en: "The hardware watchdog rebooted the router after detecting an unresponsive kernel or daemon.",
      ru: "Аппаратный сторожевой таймер перезагрузил устройство после обнаружения зависания системы.",
    },
    triggerConditions: {
      en: ["/dev/watchdog keepalive missed by userspace daemon"],
      ru: ["Пропущен сигнал keepalive в /dev/watchdog"],
    },
    remediation: {
      en: ["System has automatically rebooted and recovered to a stable state"],
      ru: ["Система была автоматически перезагружена и восстановлена"],
    },
    httpRedirectApplicable: false,
    autoRecovery: true,
    relatedService: "watchdog",
  },
};

// Registry helper lookups
export const getErrorByCode = (code: number): ErrorDefinition => {
  if (ERROR_REGISTRY[code]) {
    return ERROR_REGISTRY[code];
  }
  // Safe fallback for unknown error code
  return {
    code,
    identifier: `UNKNOWN_ERROR_${code}`,
    category: "services",
    severity: "error",
    internalDescription: `Unregistered system event code ${code}`,
    title: {
      en: `System Event (${code})`,
      ru: `Системное событие (${code})`,
    },
    description: {
      en: `An unclassified network or system event with code ${code} was reported.`,
      ru: `Зафиксировано неклассифицированное системное событие с кодом ${code}.`,
    },
    triggerConditions: {
      en: ["Unregistered internal event received"],
      ru: ["Получен незарегистрированный внутренний код"],
    },
    remediation: {
      en: [
        "Inspect recent entries in Status > System Logs",
        "Return to Network Overview",
      ],
      ru: [
        "Проверьте последние записи в меню Статус > Системные логи",
        "Вернитесь в Обзор системы",
      ],
    },
    httpRedirectApplicable: false,
    autoRecovery: false,
    relatedService: "system",
  };
};

export const getErrorByIdentifier = (identifier: string): ErrorDefinition | undefined => {
  return Object.values(ERROR_REGISTRY).find((e) => e.identifier === identifier);
};

export const getErrorsByCategory = (category: ErrorCategory): ErrorDefinition[] => {
  return Object.values(ERROR_REGISTRY).filter((e) => e.category === category);
};

export const getErrorsBySeverity = (severity: ErrorSeverity): ErrorDefinition[] => {
  return Object.values(ERROR_REGISTRY).filter((e) => e.severity === severity);
};
