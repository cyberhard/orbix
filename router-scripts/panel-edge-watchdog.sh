#!/bin/sh
# panel-edge-watchdog v3 — keeps two Instagram edge pools alive:
#  1) www edge (31.13.x.32): instagram.com API/www edges (any DC ok) -> pins + DNAT target
#  2) CDN edge (157.240.20x.x): *.cdninstagram.com scontent/static — signed-URL DC-bound,
#     must go to the REAL live CDN edge IP (no DNAT!) -> pins + nft exception
WWW_CUR=/tmp/.panel-edge-cur
CDN_CUR=/tmp/.panel-cdn-cur
DNAT=/usr/share/nftables.d/ruleset-post/44-panel-meta.nft

get_www() { cat "$WWW_CUR" 2>/dev/null || echo 31.13.72.32; }
get_cdn() { cat "$CDN_CUR" 2>/dev/null || echo 157.240.205.63; }

probe_www() { # any TLS HTTP answer from the www edge for instagram host
  curl -s -o /dev/null -w '%{http_code}' --connect-timeout 5 --resolve "www.instagram.com:443:$1" https://www.instagram.com/ 2>/dev/null
}

probe_cdn() { # vhost-level answer for scontent host from candidate CDN IP
  curl -sk -o /dev/null -w '%{http_code}' --connect-timeout 5 --resolve "scontent-hel3-1.cdninstagram.com:443:$1" https://scontent-hel3-1.cdninstagram.com/ 2>/dev/null
}

repin_www() {
  old="$1"; new="$2"
  for ip in $old; do uci del_list "dhcp.@dnsmasq[0].address=/instagram.com/$ip" 2>/dev/null; done
  for ip in $new; do uci add_list "dhcp.@dnsmasq[0].address=/instagram.com/$ip" 2>/dev/null; done
  uci commit dhcp
}

repin_cdn() {
  old="$1"; new="$2"
  for ip in $old; do uci del_list "dhcp.@dnsmasq[0].address=/cdninstagram.com/$ip" 2>/dev/null; done
  uci add_list "dhcp.@dnsmasq[0].address=/cdninstagram.com/$new" 2>/dev/null
  uci commit dhcp
  [ -f "$DNAT" ] && sed -i "s/ip daddr $old return/ip daddr $new return/;s/udp dport 443 dnat to $old\b/udp dport 443 dnat to 31.13.72.32/" "$DNAT"
  nft delete table inet panelmeta 2>/dev/null
  nft -f "$DNAT" 2>/dev/null
}

# --- pool 1: www edges ---
WWW=$(get_www)
WWW_OK=""
for ip in $WWW; do c=$(probe_www "$ip"); case "$c" in 000|""|429) ;; *) WWW_OK="$WWW_OK $ip";; esac; done
if [ -z "$WWW_OK" ]; then
  NEW=""
  for x in $(seq 64 95); do
    ip="31.13.$x.32"
    c=$(probe_www "$ip")
    case "$c" in 000|""|429) ;; *) NEW="$NEW $ip"; [ $(echo $NEW | wc -w) -ge 3 ] && break;; esac
  done
  if [ -n "$NEW" ]; then
    repin_www "$WWW" "$NEW"
    echo "$NEW" > "$WWW_CUR"
    [ -f "$DNAT" ] && sed -i "s/tcp dport 443 dnat to [0-9.]*/tcp dport 443 dnat to $(echo $NEW | awk '{print $1}')/;s/udp dport 443 dnat to [0-9.]*/udp dport 443 dnat to $(echo $NEW | awk '{print $1}')/" "$DNAT"
    nft delete table inet panelmeta 2>/dev/null; nft -f "$DNAT" 2>/dev/null
    /etc/init.d/dnsmasq restart 2>/dev/null
    logger -t panel-edge "www edges dead ($WWW) -> repinned$NEW"
  fi
else
  echo "$WWW_OK" > "$WWW_CUR"
fi

# --- pool 2: CDN (scontent) real edge ---
CDN=$(get_cdn)
c=$(probe_cdn "$CDN")
case "$c" in
  000|"" )
    NEW=""
    for net in 205 223 129 170 185 67 104; do
      for h in 63 60 33 1 34 61 62; do
        ip="157.240.$net.$h"
        [ "$ip" = "$CDN" ] && continue
        cc=$(probe_cdn "$ip")
        case "$cc" in 000|"" ) ;; *) NEW="$ip"; break 2;; esac
      done
    done
    if [ -n "$NEW" ]; then
      repin_cdn "$CDN" "$NEW"
      echo "$NEW" > "$CDN_CUR"
      /etc/init.d/dnsmasq restart 2>/dev/null
      logger -t panel-edge "cdn edge dead ($CDN) -> repinned $NEW"
    fi ;;
  * ) echo "$CDN" > "$CDN_CUR" ;;
esac
exit 0
