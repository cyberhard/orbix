// Generate tier artifacts exactly like the UI does, for a live apply test.
import { writeFileSync } from "fs";
import {
  defaultConfig, validateConfig, genTierNft, genDnsmasqTiers, genIprouteScript,
} from "./src/services/routing-engine";

const nodeServers = process.env.NODE_SERVERS ? process.env.NODE_SERVERS.split(/\s+/).filter(Boolean) : [];
const cfg = { ...defaultConfig(), withAntizapret: true };
const problems = validateConfig(cfg);
if (problems.length) {
  console.error("VALIDATE_FAIL: " + problems.join(" | "));
  process.exit(1);
}
const nft = genTierNft({ cfg, nodeServers });
const dns = genDnsmasqTiers(cfg);
const routes = genIprouteScript(cfg);
const tiers = JSON.stringify({ ...cfg, withAntizapret: true });
writeFileSync("/tmp/orbx-art.nft", nft);
writeFileSync("/tmp/orbx-art.dnsmasq", dns);
writeFileSync("/tmp/orbx-art.routes", routes);
writeFileSync("/tmp/orbx-art.tiers", tiers);
console.log("OK nft=" + nft.length + " dns=" + dns.length + " routes=" + routes.length + " tiers=" + tiers.length + " nodeServers=" + nodeServers.length);
