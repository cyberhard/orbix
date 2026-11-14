// Device Groups Definitions for Policy Engine
import { DeviceGroup } from "./types";

export const DEFAULT_DEVICE_GROUPS: DeviceGroup[] = [
  {
    id: "smartphones",
    name: "Smartphones & Tablets",
    nameRu: "Смартфоны и планшеты",
    icon: "Smartphone",
    deviceIps: ["192.168.1.130", "192.168.1.195"],
    defaultAction: "default",
  },
  {
    id: "computers",
    name: "Workstations & Laptops",
    nameRu: "Компьютеры и ноутбуки",
    icon: "Laptop",
    deviceIps: ["192.168.1.5", "192.168.1.150"],
    defaultAction: "default",
  },
  {
    id: "smart_tvs",
    name: "Smart TVs & Media Boxes",
    nameRu: "Телевизоры и медиа-приставки",
    icon: "Tv",
    deviceIps: ["192.168.1.180"],
    defaultAction: "default",
  },
  {
    id: "iot",
    name: "IoT & Smart Home",
    nameRu: "Умный дом и IoT",
    icon: "Radio",
    deviceIps: [],
    defaultAction: "direct_wan",
  },
  {
    id: "guests",
    name: "Guest Network",
    nameRu: "Гостевые устройства",
    icon: "Users",
    deviceIps: [],
    defaultAction: "default",
  },
];
