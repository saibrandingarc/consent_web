#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APP_NAME="${1:?usage: assemble.sh web|admin}"
SRC_DEPLOY="${ROOT}/azure-${APP_NAME}"
SRC_APP="${ROOT}/apps/${APP_NAME}"
OUT="${ROOT}/azure-site-${APP_NAME}"

write_deploy_meta() {
  local dir="$1"
  cat > "${dir}/.deployment" <<'EOF'
[config]
SCM_DO_BUILD_DURING_DEPLOYMENT=false
EOF
  rm -f "${dir}/oryx-manifest.toml" "${dir}/node_modules.tar.gz"
}

copy_real_pkg() {
  local name="$1"
  local dest_parent="$2"
  local optional="${3:-}"
  local pkg_json
  pkg_json="$(find "${ROOT}/node_modules/.pnpm" -path "*/node_modules/${name}/package.json" | head -1 || true)"
  if [[ -z "${pkg_json}" ]]; then
    if [[ -n "${optional}" ]]; then
      echo "skip missing optional ${name}"
      return 0
    fi
    echo "missing ${name} in pnpm store" >&2
    exit 1
  fi
  mkdir -p "${dest_parent}"
  rm -rf "${dest_parent}/${name}"
  mkdir -p "$(dirname "${dest_parent}/${name}")"
  cp -aL "$(dirname "${pkg_json}")" "${dest_parent}/${name}"
  echo "real copy ${name} -> ${dest_parent}/${name}"
}

copy_next_runtime() {
  local dest="$1"
  copy_real_pkg next "${dest}"
  copy_real_pkg react "${dest}"
  copy_real_pkg react-dom "${dest}"
  local next_pkg="${dest}/next/package.json"
  local dep
  while IFS= read -r dep; do
    [[ -z "${dep}" ]] && continue
    copy_real_pkg "${dep}" "${dest}"
  done < <(node -e 'const p=require(process.argv[1]); Object.keys(p.dependencies||{}).forEach((k)=>console.log(k));' "${next_pkg}")
  copy_real_pkg @next/swc-linux-x64-gnu "${dest}" optional
}

deref_node_modules() {
  local dir="$1"
  if [[ ! -d "${dir}/node_modules" ]]; then
    return 0
  fi
  find "${dir}/node_modules" -xtype l -print -delete || true
  local tmp
  tmp="$(mktemp -d)"
  set +e
  rsync -a --copy-links --exclude '.bin/' "${dir}/node_modules/" "${tmp}/"
  local rc=$?
  set -e
  if [[ "${rc}" -ne 0 && "${rc}" -ne 23 && "${rc}" -ne 24 ]]; then
    echo "rsync failed in ${dir} with ${rc}" >&2
    exit "${rc}"
  fi
  rm -rf "${dir}/node_modules"
  mv "${tmp}" "${dir}/node_modules"
}

rm -rf "${OUT}"
mkdir -p "${OUT}"
test -d "${SRC_DEPLOY}"
cp -a "${SRC_DEPLOY}/." "${OUT}/"
rm -rf "${OUT}/.next"
cp -a "${SRC_APP}/.next" "${OUT}/.next"
if [[ -d "${SRC_APP}/public" ]]; then
  mkdir -p "${OUT}/public"
  cp -a "${SRC_APP}/public/." "${OUT}/public/"
fi
deref_node_modules "${OUT}"
copy_next_runtime "${OUT}/node_modules"
cp "${ROOT}/deploy/azure/start-next.js" "${OUT}/start-next.js"
cat > "${OUT}/package.json" <<EOF
{
  "name": "consent_${APP_NAME}",
  "private": true,
  "author": "saibrandingarc",
  "scripts": { "start": "node start-next.js" },
  "engines": { "node": "22.x" }
}
EOF
write_deploy_meta "${OUT}"
test -f "${OUT}/node_modules/next/dist/bin/next"
test -f "${OUT}/node_modules/@next/env/package.json"
echo "assembled ${OUT}"
