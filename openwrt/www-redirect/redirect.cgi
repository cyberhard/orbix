#!/bin/sh
# ORBIX HTTP Interceptor & Error Router
# RFC 8952 / HTTP 307 Safe Redirector

RAW_HOST="$HTTP_HOST"
[ -z "$RAW_HOST" ] && RAW_HOST="unknown"

# Sanitize Host header to avoid header injection and XSS
SAFE_HOST=$(echo "$RAW_HOST" | tr -cd 'a-zA-Z0-9.-' | cut -c 1-128)
[ -z "$SAFE_HOST" ] && SAFE_HOST="unknown"

PORTAL_HOST="192.168.1.1"
if [ -f /etc/orbix/captive.json ]; then
  DH=$(jsonfilter -i /etc/orbix/captive.json -e '@.portal_domain' 2>/dev/null)
  [ -n "$DH" ] && PORTAL_HOST="$DH"
fi

# Avoid redirect loops on router portal itself
case "$SAFE_HOST" in
  192.168.1.1*|192.168.1.2*|localhost*|orbix.lan*|openwrt.lan*|"$PORTAL_HOST"*)
    echo 'Status: 302 Found'
    echo "Location: http://${PORTAL_HOST}/"
    echo 'Connection: close'
    echo ''
    exit 0
    ;;
esac

# Check KillSwitch state
KS_ACTIVE=0
if [ -f /etc/orbix/killswitch.json ]; then
  EN=$(jsonfilter -i /etc/orbix/killswitch.json -e '@.enabled' 2>/dev/null)
  [ "$EN" = "true" ] || [ "$EN" = "1" ] && KS_ACTIVE=1
fi

# Determine error code: 402 for policy blocks, 410 for kill switch
CODE="402"
if [ "$KS_ACTIVE" = "1" ]; then
  if grep -q " $SAFE_HOST" /tmp/hosts/orbix_policy_blocks 2>/dev/null; then
    CODE="402"
  else
    CODE="410"
  fi
fi

TARGET_URL="http://${PORTAL_HOST}/#/errors/${CODE}?domain=${SAFE_HOST}"

echo 'Status: 307 Temporary Redirect'
echo "Location: ${TARGET_URL}"
echo 'Cache-Control: no-cache, no-store, must-revalidate'
echo 'Connection: close'
echo 'Content-Type: text/html; charset=utf-8'
echo ''
echo "<!DOCTYPE html><html><head><meta http-equiv='refresh' content='0;url=${TARGET_URL}'><title>ORBIX Redirect</title></head><body><p>Redirecting to ORBIX Network Portal...</p></body></html>"
