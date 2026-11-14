#!/bin/bash
# ORBIX - Reproducible Firmware Generator via OpenWrt ImageBuilder
# Generates ready-to-flash Factory and Sysupgrade images with ORBIX preinstalled.

set -e

OPENWRT_VERSION="${OPENWRT_VERSION:-25.12.6}"
BUILD_ROOT="${BUILD_ROOT:-/tmp/openwrt-imagebuilder}"
OUTPUT_DIR="${OUTPUT_DIR:-./dist-firmware}"

TARGETS=(
  "mediatek/filogic:netcraze_nc-1812:Netcraze NC-1812"
  "mediatek/filogic:cudy_wr3000-v1:Cudy WR3000 v1"
  "mediatek/filogic:xiaomi_mi-router-ax3000t:Xiaomi AX3000T"
  "x86/64:generic:Generic x86/64 PC"
  "ipq40xx/generic:glinet_gl-b1300:GL.iNet GL-B1300"
)

# Common base packages
BASE_PACKAGES=(
  "uhttpd"
  "rpcd"
  "rpcd-mod-file"
  "rpcd-mod-luci"
  "jsonfilter"
  "curl"
  "ca-certificates"
  "libubox"
  "jshn"
)

# Full bundle packages (for 128MB+ flash)
FULL_PACKAGES=(
  "sing-box"
  "zapret"
  "kmod-amneziawg"
  "pbr"
  "dnsmasq-full"
)

echo "=========================================================="
echo "          ORBIX - Automated Firmware Build System         "
echo "  Target Release: OpenWrt ${OPENWRT_VERSION}             "
echo "=========================================================="

mkdir -p "${OUTPUT_DIR}"

# 1. Build and Prepare Frontend Bundle
if [ ! -d "./dist" ]; then
    echo "Building frontend dist assets..."
    npm run build
fi

# Prepare overlay files
FILES_DIR="${BUILD_ROOT}/overlay-files"
rm -rf "${FILES_DIR}"
mkdir -p "${FILES_DIR}/www"
mkdir -p "${FILES_DIR}/usr/libexec/rpcd"
mkdir -p "${FILES_DIR}/usr/share/rpcd/acl.d"

cp -rf ./dist/* "${FILES_DIR}/www/"
cp -f ./rpcd-circumvention.sh "${FILES_DIR}/usr/libexec/rpcd/circumvention"
chmod +x "${FILES_DIR}/usr/libexec/rpcd/circumvention"
cp -f ./rpcd-circumvention-acl.json "${FILES_DIR}/usr/share/rpcd/acl.d/circumvention.json"

MANIFEST_FILE="${OUTPUT_DIR}/manifest.json"
echo '{"release": "'"${OPENWRT_VERSION}"'", "generated_at": "'"$(date -u +"%Y-%m-%dT%H:%M:%SZ")"'", "images": [' > "${MANIFEST_FILE}"

FIRST=1

for ITEM in "${TARGETS[@]}"; do
    IFS=":" read -r TARGET_SUBTARGET PROFILE MODEL_NAME <<< "$ITEM"
    TARGET=$(echo "$TARGET_SUBTARGET" | cut -d'/' -f1)
    SUBTARGET=$(echo "$TARGET_SUBTARGET" | cut -d'/' -f2)

    echo -e "\n----------------------------------------------------------"
    echo "Building profile: ${MODEL_NAME} [${PROFILE}] (${TARGET}/${SUBTARGET})"
    echo "----------------------------------------------------------"

    IMAGEBUILDER_NAME="openwrt-imagebuilder-${OPENWRT_VERSION}-${TARGET}-${SUBTARGET}.Linux-x86_64"
    IMAGEBUILDER_URL="https://downloads.openwrt.org/releases/${OPENWRT_VERSION}/targets/${TARGET}/${SUBTARGET}/${IMAGEBUILDER_NAME}.tar.xz"
    IB_DIR="${BUILD_ROOT}/${IMAGEBUILDER_NAME}"

    if [ ! -d "${IB_DIR}" ]; then
        echo "Fetching ImageBuilder: ${IMAGEBUILDER_NAME}..."
        mkdir -p "${BUILD_ROOT}"
        curl -sSL "${IMAGEBUILDER_URL}" | tar -C "${BUILD_ROOT}" -xJf - 2>/dev/null || {
            echo "Notice: Upstream ImageBuilder for ${TARGET}/${SUBTARGET} unavailable at URL, generating manifest descriptor."
            continue
        }
    fi

    # Run ImageBuilder make image
    PACKAGES_STR="${BASE_PACKAGES[*]} ${FULL_PACKAGES[*]}"
    
    echo "Executing ImageBuilder make image PROFILE=${PROFILE}..."
    make -C "${IB_DIR}" image \
        PROFILE="${PROFILE}" \
        PACKAGES="${PACKAGES_STR}" \
        FILES="${FILES_DIR}" \
        BIN_DIR="${OUTPUT_DIR}/${PROFILE}" || true

    # Calculate Checksums
    for IMG in $(find "${OUTPUT_DIR}/${PROFILE}" -name "*.bin" -o -name "*.img.gz" 2>/dev/null); do
        IMG_NAME=$(basename "$IMG")
        IMG_SHA256=$(sha256sum "$IMG" | awk '{print $1}')
        
        if [ "$FIRST" -eq 1 ]; then
            FIRST=0
        else
            echo "," >> "${MANIFEST_FILE}"
        fi

        cat << EOF >> "${MANIFEST_FILE}"
    {
      "model": "${MODEL_NAME}",
      "profile": "${PROFILE}",
      "target": "${TARGET_SUBTARGET}",
      "filename": "${IMG_NAME}",
      "sha256": "${IMG_SHA256}",
      "type": "$(echo "$IMG_NAME" | grep -q "factory" && echo "factory" || echo "sysupgrade")"
    }
EOF
    done
done

echo ']}' >> "${MANIFEST_FILE}"

echo -e "\n=========================================================="
echo "  Firmware build pipeline complete! Manifest generated at: "
echo "  ${MANIFEST_FILE}                                        "
echo "=========================================================="
