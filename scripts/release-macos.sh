#!/bin/bash
# Local macOS delivery (Apple Silicon or Intel target). Never uploads to GitHub or a download server.
# Required: APPLE_SIGNING_IDENTITY (Developer ID Application), NOTARY_KEYCHAIN_PROFILE.
# Optional: INCLUDE_BUNDLED_HYMNS=1, BUILD_APP=0 (already built release app),
# APP_SOURCE=/absolute/LouvaShow.app, RELEASE_DIR=/absolute/output/directory.
# Signing credentials remain in the existing login keychain; never export them.
set -euo pipefail
umask 077

fail() { printf 'Erro: %s\n' "$*" >&2; exit 1; }
[[ "$(uname -s)" == Darwin && "$(uname -m)" == arm64 ]] || fail 'Este fluxo local exige macOS em Apple Silicon.'
: "${APPLE_SIGNING_IDENTITY:?Defina APPLE_SIGNING_IDENTITY com uma identidade Developer ID Application do Keychain.}"
: "${NOTARY_KEYCHAIN_PROFILE:?Defina NOTARY_KEYCHAIN_PROFILE com um perfil existente no Keychain.}"
[[ "$APPLE_SIGNING_IDENTITY" == 'Developer ID Application: '* ]] || fail 'A identidade deve ser Developer ID Application.'
INCLUDE_BUNDLED_HYMNS="${INCLUDE_BUNDLED_HYMNS:-0}"
BUILD_APP="${BUILD_APP:-1}"
MACOS_ARCH="${MACOS_ARCH:-arm64}"
case "$MACOS_ARCH" in
  arm64) MACOS_TARGET=aarch64-apple-darwin ;;
  intel) MACOS_TARGET=x86_64-apple-darwin ;;
  *) fail "MACOS_ARCH deve ser arm64 ou intel." ;;
esac
[[ "$INCLUDE_BUNDLED_HYMNS" == 0 || "$INCLUDE_BUNDLED_HYMNS" == 1 ]] || fail 'INCLUDE_BUNDLED_HYMNS deve ser 0 ou 1.'
[[ "$BUILD_APP" == 0 || "$BUILD_APP" == 1 ]] || fail 'BUILD_APP deve ser 0 ou 1.'
[[ "$BUILD_APP" == 1 || "$INCLUDE_BUNDLED_HYMNS" == 1 ]] || fail 'A distribuição pública exige build novo sem o hinário privado; não reutilize APP_SOURCE.'

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"
VERSION="$(python3 -c 'import json; print(json.load(open("src-tauri/tauri.conf.json"))["version"])')"
[[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || fail 'Versão inválida no manifesto.'
RELEASE_DIR="${RELEASE_DIR:-$PROJECT_ROOT/releases/$VERSION/macos-$MACOS_ARCH}"
APP_SOURCE="${APP_SOURCE:-$PROJECT_ROOT/src-tauri/target/$MACOS_TARGET/release/bundle/macos/LouvaShow.app}"
[[ "$RELEASE_DIR" == /* && "$APP_SOURCE" == /* ]] || fail 'APP_SOURCE e RELEASE_DIR devem ser caminhos absolutos.'
[[ ! -e "$RELEASE_DIR" ]] || fail 'O diretório final já existe. Escolha outro para preservar entregas anteriores.'

RELEASE_WORK="$(mktemp -d "${TMPDIR:-/tmp}/louvashow-release.XXXXXX")"
MOUNTED=0
cleanup() {
  if [[ "$MOUNTED" == 1 ]]; then hdiutil detach "$RELEASE_WORK/mount" >/dev/null 2>&1 || true; fi
  rm -rf "$RELEASE_WORK"
}
trap cleanup EXIT
mkdir -p "$RELEASE_WORK/evidence" "$RELEASE_WORK/stage/LouvaShow.app/Contents/MacOS"

if [[ "$INCLUDE_BUNDLED_HYMNS" == 1 ]]; then
  [[ -f "$PROJECT_ROOT/src-tauri/resources/hc_xml.zip" ]] || fail 'O pacote local de hinos está ausente.'
  /usr/bin/unzip -tqq "$PROJECT_ROOT/src-tauri/resources/hc_xml.zip"
fi

if [[ "$BUILD_APP" == 1 ]]; then
  printf 'Compilando LouvaShow %s para macOS %s.\n' "$VERSION" "$MACOS_ARCH"
  BUILD_ARGS=(run tauri build -- --target "$MACOS_TARGET" --bundles app)
  if [[ "$INCLUDE_BUNDLED_HYMNS" == 1 ]]; then
    BUILD_ARGS+=(--features bundled-hymns)
  fi
  BUILD_ARGS+=(-- --locked --no-default-features)
  # Avoid inheriting unrelated certificate/password exports. The signing step
  # below uses only the installed identity and the existing Keychain profile.
  env -u APPLE_CERTIFICATE -u APPLE_CERTIFICATE_PASSWORD -u APPLE_ID \
    -u APPLE_PASSWORD -u APPLE_API_KEY -u APPLE_API_ISSUER -u APPLE_API_KEY_PATH \
    -u APPLE_SIGNING_IDENTITY npm "${BUILD_ARGS[@]}"
fi
[[ -d "$APP_SOURCE" ]] || fail 'O bundle release não foi encontrado.'

STAGED_APP="$RELEASE_WORK/stage/LouvaShow.app"
# Build a clean public artifact from exact runtime paths. New resources require
# an explicit review of this allowlist; never recursively copy a project root.
python3 - "$APP_SOURCE" "$STAGED_APP" "$VERSION" "$INCLUDE_BUNDLED_HYMNS" <<'PY'
import os, pathlib, plistlib, shutil, sys
source, target = map(pathlib.Path, sys.argv[1:3])
version, hymns = sys.argv[3:]
allowed = {
    'Contents/Info.plist', 'Contents/MacOS/louvashow',
    'Contents/PkgInfo', 'Contents/Resources/icon.icns',
    'Contents/Resources/BIBLE-NOTICES.txt',
}
if hymns == '1':
    allowed.add('Contents/Resources/hc_xml.zip')
required = {'Contents/Info.plist', 'Contents/MacOS/louvashow', 'Contents/Resources/BIBLE-NOTICES.txt'}
found = set()
for path in source.rglob('*'):
    if path.is_symlink():
        raise SystemExit(f'Bundle contém link não autorizado: {path.relative_to(source)}')
    if not path.is_file():
        continue
    relative = path.relative_to(source).as_posix()
    # Source signatures are replaced on the clean staging copy.
    if relative == 'Contents/_CodeSignature/CodeResources':
        continue
    if relative not in allowed:
        raise SystemExit(f'Arquivo fora da lista de runtime: {relative}')
    found.add(relative)
    destination = target / relative
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(path, destination)
    destination.chmod(0o755 if relative == 'Contents/MacOS/louvashow' else 0o644)
if not required.issubset(found):
    raise SystemExit('O bundle não contém todos os arquivos obrigatórios de runtime.')
with (target / 'Contents/Info.plist').open('rb') as handle:
    info = plistlib.load(handle)
if info.get('CFBundleIdentifier') != 'app.louvashow.desktop':
    raise SystemExit('Identificador inesperado no bundle.')
if info.get('CFBundleShortVersionString') != version:
    raise SystemExit('Versão do bundle diferente da versão solicitada.')
if info.get('CFBundleExecutable') != 'louvashow':
    raise SystemExit('Executável inesperado no bundle.')
for directory in [target.parent, target, *(p for p in target.rglob('*') if p.is_dir())]:
    directory.chmod(0o755)
print('Runtime inspecionado: ' + ', '.join(sorted(found)))
PY

EXPECTED_ARCH=arm64
[[ "$MACOS_ARCH" == intel ]] && EXPECTED_ARCH=x86_64
[[ "$(/usr/bin/lipo -archs "$STAGED_APP/Contents/MacOS/louvashow")" == "$EXPECTED_ARCH" ]] || fail "Arquitetura inesperada no executável."
/usr/bin/codesign --force --options runtime --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$STAGED_APP/Contents/MacOS/louvashow"
/usr/bin/codesign --force --options runtime --timestamp --entitlements "$PROJECT_ROOT/src-tauri/entitlements.plist" --sign "$APPLE_SIGNING_IDENTITY" "$STAGED_APP"
/usr/bin/codesign --verify --deep --strict --verbose=2 "$STAGED_APP"

# Submit once. Each wait is capped at 50 seconds and prints a concise heartbeat.
# The caller can poll the running release process and keep the user informed.
notarize() {
  local artifact="$1" name="$2" submission status attempt
  xcrun notarytool submit "$artifact" --keychain-profile "$NOTARY_KEYCHAIN_PROFILE" \
    --output-format json > "$RELEASE_WORK/evidence/$name-submit.json"
  submission="$(python3 - "$RELEASE_WORK/evidence/$name-submit.json" <<'PY'
import json, sys, uuid
value=json.load(open(sys.argv[1]))['id']
uuid.UUID(value)
print(value)
PY
)"
  printf 'Notarização %s enviada: %s\n' "$name" "$submission"
  for attempt in $(seq 1 60); do
    xcrun notarytool wait "$submission" --keychain-profile "$NOTARY_KEYCHAIN_PROFILE" \
      --timeout 50s --output-format json > "$RELEASE_WORK/evidence/$name-wait.json" 2>/dev/null || true
    if ! xcrun notarytool info "$submission" --keychain-profile "$NOTARY_KEYCHAIN_PROFILE" \
      --output-format json > "$RELEASE_WORK/evidence/$name-status.json" 2>/dev/null; then
      printf 'Consulta temporariamente indisponível para %s; mantendo a submissão existente.\n' "$name"
      sleep 5
      continue
    fi
    status="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["status"])' "$RELEASE_WORK/evidence/$name-status.json")"
    printf 'Notarização %s: %s (consulta %s).\n' "$name" "$status" "$attempt"
    case "$status" in
      Accepted) return 0 ;;
      Invalid|Rejected) fail "A Apple recusou $name. Consulte a submissão $submission antes de repetir." ;;
      'In Progress') ;;
      *) fail "Estado inesperado da notarização de $name: $status." ;;
    esac
  done
  fail "A notarização continua pendente. Consulte $submission antes de enviar outro artefato."
}

/usr/bin/ditto -c -k --keepParent --norsrc "$STAGED_APP" "$RELEASE_WORK/LouvaShow.zip"
/usr/bin/unzip -tqq "$RELEASE_WORK/LouvaShow.zip"
notarize "$RELEASE_WORK/LouvaShow.zip" app
xcrun stapler staple "$STAGED_APP"
xcrun stapler validate "$STAGED_APP"
/usr/sbin/spctl --assess --type execute --verbose=2 "$STAGED_APP"

ln -s /Applications "$RELEASE_WORK/stage/Applications"
DMG_NAME="LouvaShow_${VERSION}_macOS_${MACOS_ARCH}.dmg"
STAGED_DMG="$RELEASE_WORK/$DMG_NAME"
hdiutil create -volname "LouvaShow $VERSION" -srcfolder "$RELEASE_WORK/stage" \
  -format UDZO -fs HFS+ "$STAGED_DMG"
/usr/bin/codesign --force --timestamp --sign "$APPLE_SIGNING_IDENTITY" "$STAGED_DMG"
notarize "$STAGED_DMG" dmg
xcrun stapler staple "$STAGED_DMG"
xcrun stapler validate "$STAGED_DMG"
hdiutil verify "$STAGED_DMG"
/usr/bin/codesign --verify --verbose=2 "$STAGED_DMG"
/usr/sbin/spctl --assess --type open --context context:primary-signature --verbose=2 "$STAGED_DMG"

# Read back the actual disk image without launching or touching a running app.
mkdir "$RELEASE_WORK/mount"
hdiutil attach -readonly -nobrowse -mountpoint "$RELEASE_WORK/mount" "$STAGED_DMG" >/dev/null
MOUNTED=1
python3 - "$RELEASE_WORK/mount" "$STAGED_APP" <<'PY'
import hashlib, pathlib, sys
mount, staged = map(pathlib.Path, sys.argv[1:])
permitted = {'LouvaShow.app', 'Applications', '.fseventsd', '.Trashes', '.DS_Store', '.HFS+ Private Directory Data\r'}
if any(p.name not in permitted for p in mount.iterdir()):
    raise SystemExit('O DMG contém arquivos inesperados na raiz.')
applications=mount/'Applications'
if not applications.is_symlink() or str(applications.readlink()) != '/Applications':
    raise SystemExit('Link Applications incorreto no DMG.')
def inventory(root):
    return {p.relative_to(root).as_posix():hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob('*') if p.is_file()}
if inventory(staged) != inventory(mount/'LouvaShow.app'):
    raise SystemExit('O aplicativo dentro do DMG não corresponde ao aplicativo validado.')
print('Conteúdo do DMG conferido por leitura e SHA-256 de cada arquivo runtime.')
PY
/usr/bin/codesign --verify --deep --strict --verbose=2 "$RELEASE_WORK/mount/LouvaShow.app"
xcrun stapler validate "$RELEASE_WORK/mount/LouvaShow.app"
/usr/sbin/spctl --assess --type execute --verbose=2 "$RELEASE_WORK/mount/LouvaShow.app"
hdiutil detach "$RELEASE_WORK/mount" >/dev/null
MOUNTED=0

# Evidence remains in a sibling internal folder, never inside the DMG or ZIP.
mkdir -p "$RELEASE_DIR" "$RELEASE_DIR-evidence"
cp "$RELEASE_WORK/evidence/"*.json "$RELEASE_DIR-evidence/"
/usr/bin/ditto "$STAGED_DMG" "$RELEASE_DIR/$DMG_NAME"
chmod 644 "$RELEASE_DIR/$DMG_NAME"
cmp "$STAGED_DMG" "$RELEASE_DIR/$DMG_NAME"
(cd "$RELEASE_DIR" && /usr/bin/shasum -a 256 "$DMG_NAME" > "$DMG_NAME.sha256")
chmod 644 "$RELEASE_DIR/$DMG_NAME.sha256"
printf 'Entrega local assinada e notarizada: %s\n' "$RELEASE_DIR/$DMG_NAME"
printf 'Arquitetura: macOS %s. Sem publicação remota.\n' "$MACOS_ARCH"
