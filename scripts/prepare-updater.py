#!/usr/bin/env python3
"""Prepare public updater artifacts locally. Never publishes or reads private key bytes.

Requires the locked Tauri CLI, minisign and macOS validation tools. The private
key path/password are forwarded to the signer through its existing environment.
"""

import argparse
import base64
from datetime import datetime, timezone
import gzip
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import plistlib
import re
import shutil
import stat
import struct
import subprocess
import sys
import tarfile
import tempfile


ROOT = Path(__file__).resolve().parent.parent
APP = 'LouvaShow.app'
RUNTIME = {
    'Contents/Info.plist', 'Contents/MacOS/louvashow', 'Contents/PkgInfo',
    'Contents/Resources/icon.icns', 'Contents/Resources/BIBLE-NOTICES.txt',
    'Contents/_CodeSignature/CodeResources', 'Contents/CodeResources',
}
REQUIRED = RUNTIME - {'Contents/PkgInfo', 'Contents/Resources/icon.icns'}
DIRECTORIES = {APP}
for relative in RUNTIME:
    DIRECTORIES.update(str(parent) for parent in PurePosixPath(APP, relative).parents if str(parent) != '.')
PACKAGES = {
    'windows-x86_64': 'LouvaShow-windows-x64-setup.exe',
    'darwin-aarch64': 'LouvaShow-macos-arm64.app.tar.gz',
    'darwin-x86_64': 'LouvaShow-macos-intel.app.tar.gz',
}
DMGS = {'arm64': 'LouvaShow-macos-arm64.dmg', 'intel': 'LouvaShow-macos-intel.dmg'}
INPUT_FILES = set(PACKAGES.values()) | set(DMGS.values())
MAX_ARCHIVE_SIZE = 1024 * 1024 * 1024


def require(condition, message):
    if not condition:
        raise ValueError(message)


def digest(path):
    with path.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def run(command, *, cwd=None):
    # Suppress tool output: errors must not accidentally echo environment secrets.
    result = subprocess.run(command, cwd=cwd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    require(result.returncode == 0, f'Falhou a verificação: {Path(command[0]).name}. Nenhum pacote foi publicado.')
    return result.stdout


def version_value(value):
    require(re.fullmatch(r'(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)', value) is not None,
            'A versão deve ser estável, no formato MAJOR.MINOR.PATCH.')
    return value


def check_plist(data, version):
    info = plistlib.loads(data)
    require(info.get('CFBundleIdentifier') == 'app.louvashow.desktop', 'Identificador macOS incorreto.')
    require(info.get('CFBundleExecutable') == 'louvashow', 'Executável macOS incorreto.')
    require(info.get('CFBundleShortVersionString') == version, 'Versão macOS diferente da release.')
    return info


def app_inventory(app, version):
    require(app.name == APP and app.is_dir() and not app.is_symlink(), 'Bundle esperado: LouvaShow.app regular.')
    files = {}
    for item in app.rglob('*'):
        relative = item.relative_to(app).as_posix()
        require(not item.is_symlink(), 'Link não autorizado no aplicativo.')
        if item.is_dir():
            require(f'{APP}/{relative}' in DIRECTORIES, 'Diretório extra no aplicativo.')
            continue
        require(item.is_file() and relative in RUNTIME, 'Arquivo fora da lista de runtime público.')
        require(not (item.stat().st_mode & 0o7000), 'Permissão especial não autorizada no aplicativo.')
        files[relative] = (digest(item), stat.S_IMODE(item.stat().st_mode))
    require(REQUIRED <= files.keys(), 'Faltam runtime, assinatura ou ticket de notarização no aplicativo.')
    check_plist((app / 'Contents/Info.plist').read_bytes(), version)
    require(files['Contents/MacOS/louvashow'][1] & 0o111, 'Executável macOS sem permissão de execução.')
    return files


def inspect_archive(path, version, destination=None):
    """Allowlist before extraction; no links, extra roots, traversal or metadata leaks."""
    files = {}
    seen = set()
    expanded = 0
    with tarfile.open(path, 'r:gz') as archive:
        for member in archive:
            name = member.name.rstrip('/')
            require(len(seen) < 64 and name not in seen, 'Tar com entradas extras ou duplicadas.')
            seen.add(name)
            require(not member.pax_headers, 'Metadados extras não autorizados no tar.')
            require(member.uid == member.gid == 0 and not member.uname and not member.gname,
                    'Tar contém identidade local de usuário/grupo.')
            require(not (member.mode & 0o7000), 'Tar contém permissões especiais.')
            if member.isdir():
                require(name in DIRECTORIES, 'Diretório fora da lista permitida no tar.')
                require(member.mode == 0o755, 'Diretório do tar deve ter permissão pública 0755.')
                if destination is not None:
                    target = destination / name
                    target.mkdir(parents=True, exist_ok=True)
                    target.chmod(0o755)
                continue
            relative = name.removeprefix(APP + '/')
            require(member.isfile() and name.startswith(APP + '/') and relative in RUNTIME,
                    'Arquivo fora da lista de runtime público no tar.')
            expanded += member.size
            require(0 <= member.size <= MAX_ARCHIVE_SIZE and expanded <= MAX_ARCHIVE_SIZE,
                    'Tar excede o limite de tamanho descompactado.')
            source = archive.extractfile(member)
            require(source is not None, 'Arquivo do tar sem conteúdo.')
            data = source.read(member.size + 1)
            require(len(data) == member.size, 'Conteúdo truncado no tar.')
            files[relative] = (hashlib.sha256(data).hexdigest(), member.mode)
            if relative == 'Contents/Info.plist':
                check_plist(data, version)
            if destination is not None:
                target = destination / name
                target.parent.mkdir(parents=True, exist_ok=True)
                with target.open('xb') as stream:
                    stream.write(data)
                target.chmod(member.mode)
    require(REQUIRED <= files.keys(), 'Tar incompleto: faltam runtime, assinatura ou ticket Apple.')
    require(DIRECTORIES <= seen, 'Tar incompleto: faltam diretórios públicos e suas permissões.')
    require(files['Contents/MacOS/louvashow'][1] & 0o111, 'Executável no tar sem permissão de execução.')
    return files


def native_app_checks(app, arch):
    require(sys.platform == 'darwin', 'A finalização pública exige macOS para validar assinatura e notarização.')
    expected = 'arm64' if arch == 'arm64' else 'x86_64'
    architecture = run(['/usr/bin/lipo', '-archs', str(app / 'Contents/MacOS/louvashow')]).decode().strip()
    require(architecture == expected, 'Arquitetura macOS incorreta.')
    run(['/usr/bin/codesign', '--verify', '--deep', '--strict', str(app)])
    run(['xcrun', 'stapler', 'validate', str(app)])
    run(['/usr/sbin/spctl', '--assess', '--type', 'execute', str(app)])


def archive_app(app, output, version, arch):
    require(not output.exists(), 'O tar de destino já existe; escolha outro caminho.')
    original = app_inventory(app, version)
    native_app_checks(app, arch)
    output.parent.mkdir(parents=True, exist_ok=True)
    # A temporary sibling ensures partially written archives never become final outputs.
    with tempfile.TemporaryDirectory(prefix='.updater-archive-', dir=output.parent) as work:
        archive_path = Path(work) / output.name
        with archive_path.open('xb') as raw, gzip.GzipFile(filename='', fileobj=raw, mode='wb', mtime=0) as zipped:
            with tarfile.open(fileobj=zipped, mode='w', format=tarfile.USTAR_FORMAT) as archive:
                for name in sorted(DIRECTORIES, key=lambda value: (value.count('/'), value)):
                    member = tarfile.TarInfo(name)
                    member.type = tarfile.DIRTYPE
                    member.mode = 0o755
                    member.mtime = 0
                    archive.addfile(member)
                for relative in sorted(original):
                    item = app / relative
                    member = tarfile.TarInfo(f'{APP}/{relative}')
                    member.size = item.stat().st_size
                    member.mode = stat.S_IMODE(item.stat().st_mode)
                    member.mtime = 0
                    with item.open('rb') as stream:
                        archive.addfile(member, stream)
        extracted = Path(work) / 'extract'
        extracted.mkdir()
        require(inspect_archive(archive_path, version, extracted) == original, 'Tar diferente do aplicativo auditado.')
        native_app_checks(extracted / APP, arch)
        # Hard-link publication is atomic and refuses to overwrite an existing output.
        os.link(archive_path, output)
        output.chmod(0o644)
    print(f'Tar público auditado: {output.name}')


def windows_version(path):
    """Read the NSIS PE VERSION resource, without executing the installer."""
    data = path.read_bytes()
    require(data[:2] == b'MZ' and len(data) >= 64, 'Instalador Windows sem cabeçalho PE.')
    pe = struct.unpack_from('<I', data, 60)[0]
    require(data[pe:pe + 4] == b'PE\0\0', 'Assinatura PE inválida.')
    sections = struct.unpack_from('<H', data, pe + 6)[0]
    optional_size = struct.unpack_from('<H', data, pe + 20)[0]
    optional = pe + 24
    magic = struct.unpack_from('<H', data, optional)[0]
    require(magic in (0x10b, 0x20b), 'Formato opcional PE inválido.')
    directories = optional + (96 if magic == 0x10b else 112)
    resource_rva, resource_size = struct.unpack_from('<II', data, directories + 16)
    require(resource_rva and resource_size, 'Instalador Windows sem recursos de versão.')
    table = optional + optional_size

    def physical(rva, size):
        for index in range(sections):
            section = table + index * 40
            _, virtual, raw_size, raw = struct.unpack_from('<IIII', data, section + 8)
            if virtual <= rva and rva + size <= virtual + raw_size:
                result = raw + rva - virtual
                require(result + size <= len(data), 'Recurso PE truncado.')
                return result
        raise ValueError('Recurso PE fora de uma seção válida.')

    base = physical(resource_rva, resource_size)

    def entries(offset):
        require(0 <= offset and offset + 16 <= resource_size, 'Diretório de recursos PE inválido.')
        named, numbered = struct.unpack_from('<HH', data, base + offset + 12)
        count = named + numbered
        require(count <= 1024 and offset + 16 + count * 8 <= resource_size, 'Entradas PE inválidas.')
        return [struct.unpack_from('<II', data, base + offset + 16 + i * 8) for i in range(count)]

    nodes = [value for key, value in entries(0) if key == 16]  # RT_VERSION
    require(len(nodes) == 1, 'Recurso de versão Windows ausente ou duplicado.')
    versions = set()

    def visit(node, depth):
        require(depth <= 3, 'Árvore de recursos PE inválida.')
        if node & 0x80000000:
            for _, child in entries(node & 0x7fffffff):
                visit(child, depth + 1)
            return
        require(node + 16 <= resource_size, 'Entrada de dados PE inválida.')
        rva, length = struct.unpack_from('<II', data, base + node)
        offset = physical(rva, length)
        block = data[offset:offset + length]
        key = 'VS_VERSION_INFO\0'.encode('utf-16le')
        require(block[6:6 + len(key)] == key, 'Estrutura de versão Windows inválida.')
        fixed = (6 + len(key) + 3) & ~3
        signature, structure, high, low = struct.unpack_from('<IIII', block, fixed)
        # NSIS emits dwStrucVersion=0; other PE writers use VS_FFI_STRUCVERSION.
        require(signature == 0xfeef04bd and structure in (0, 0x10000), 'Versão fixa Windows inválida.')
        versions.add((high >> 16, high & 65535, low >> 16, low & 65535))

    visit(nodes[0], 0)
    require(len(versions) == 1, 'Recursos Windows têm versões divergentes.')
    return versions.pop()


def check_dmg(path, expected_inventory, version, arch, work):
    run(['hdiutil', 'verify', str(path)])
    run(['/usr/bin/codesign', '--verify', str(path)])
    run(['xcrun', 'stapler', 'validate', str(path)])
    run(['/usr/sbin/spctl', '--assess', '--type', 'open', '--context', 'context:primary-signature', str(path)])
    mount = work / f'mount-{arch}'
    mount.mkdir()
    run(['hdiutil', 'attach', '-readonly', '-nobrowse', '-mountpoint', str(mount), str(path)])
    try:
        allowed = {APP, 'Applications', '.fseventsd', '.Trashes', '.DS_Store', '.HFS+ Private Directory Data\r'}
        require(all(item.name in allowed for item in mount.iterdir()), 'DMG contém arquivos extras.')
        link = mount / 'Applications'
        require(link.is_symlink() and os.readlink(link) == '/Applications', 'Link Applications incorreto no DMG.')
        require(app_inventory(mount / APP, version) == expected_inventory, 'DMG e tar não contêm o mesmo aplicativo.')
        native_app_checks(mount / APP, arch)
    finally:
        run(['hdiutil', 'detach', str(mount)])


def verify_signature(artifact, signature, public_key, version, work):
    # Tauri wraps a standard Minisign public key and detached signature in base64.
    public_text = base64.b64decode(public_key, validate=True).decode('utf-8')
    signature_text = base64.b64decode(signature, validate=True).decode('utf-8')
    public_file = work / 'verification.pub'
    signature_file = work / 'verification.minisig'
    public_file.write_text(public_text)
    signature_file.write_text(signature_text)
    run(['minisign', '-Vm', str(artifact), '-p', str(public_file), '-x', str(signature_file)])
    trusted = [line.removeprefix('trusted comment: ') for line in signature_text.splitlines()
               if line.startswith('trusted comment: ')]
    require(len(trusted) == 1 and trusted[0].split('\t').count(f'version:{version}') == 1,
            'A assinatura não está vinculada à versão publicada.')


def finalize(source, output, version):
    require(sys.platform == 'darwin', 'Finalize em macOS para auditar os aplicativos notarizados.')
    require(not output.exists(), 'Diretório final já existe; nada será sobrescrito.')
    require(source.is_dir() and not source.is_symlink(), 'Pasta de origem inválida.')
    require({item.name for item in source.iterdir()} == INPUT_FILES, 'A origem deve conter exatamente os cinco pacotes públicos esperados.')
    require(all(item.is_file() and not item.is_symlink() and 0 < item.stat().st_size <= MAX_ARCHIVE_SIZE for item in source.iterdir()),
            'Pacotes precisam ser arquivos regulares entre 1 byte e 1 GiB.')
    config = json.loads((ROOT / 'src-tauri/tauri.conf.json').read_text())
    require(config['version'] == version, 'Versão solicitada difere do manifesto Tauri.')
    public_key = config.get('plugins', {}).get('updater', {}).get('pubkey')
    require(isinstance(public_key, str) and public_key, 'Configure a chave pública do updater antes de finalizar.')
    require(os.environ.get('TAURI_SIGNING_PRIVATE_KEY_PATH'), 'Defina TAURI_SIGNING_PRIVATE_KEY_PATH no ambiente local.')
    require(not os.environ.get('TAURI_SIGNING_PRIVATE_KEY'), 'Use somente TAURI_SIGNING_PRIVATE_KEY_PATH, não a chave literal.')
    require(shutil.which('minisign'), 'Instale minisign para verificar as assinaturas independentemente do Tauri CLI.')
    require(windows_version(source / PACKAGES['windows-x86_64']) == (*map(int, version.split('.')), 0),
            'Versão do instalador Windows diferente da release.')
    output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='.updater-final-', dir=output.parent) as temporary:
        work = Path(temporary)
        stage = work / 'public'
        stage.mkdir()
        for name in sorted(INPUT_FILES):
            shutil.copyfile(source / name, stage / name)
            (stage / name).chmod(0o644)
        for arch, target in [('arm64', 'darwin-aarch64'), ('intel', 'darwin-x86_64')]:
            extracted = work / f'extract-{arch}'
            extracted.mkdir()
            inventory = inspect_archive(stage / PACKAGES[target], version, extracted)
            native_app_checks(extracted / APP, arch)
            check_dmg(stage / DMGS[arch], inventory, version, arch, work)
        platforms = {}
        for target, name in PACKAGES.items():
            artifact = stage / name
            before = digest(artifact)
            run(['npm', 'run', 'tauri', '--', 'signer', 'sign', '--app-version', version, str(artifact)], cwd=ROOT)
            require(digest(artifact) == before, 'O artefato mudou durante a assinatura.')
            signature_path = stage / (name + '.sig')
            signature = signature_path.read_text().strip()
            verify_signature(artifact, signature, public_key, version, work)
            signature_path.chmod(0o644)
            platforms[target] = {
                'url': f'https://github.com/dantetesta/LouvaShow/releases/download/v{version}/{name}',
                'signature': signature,
            }
        manifest = {
            'version': version,
            'notes': f'LouvaShow {version}. Consulte as notas da release antes de atualizar.',
            'pub_date': datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
            'platforms': platforms,
        }
        (stage / 'latest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
        allowed = INPUT_FILES | {name + '.sig' for name in PACKAGES.values()} | {'latest.json'}
        require({item.name for item in stage.iterdir()} == allowed, 'Arquivos extras no diretório público.')
        (stage / 'SHA256SUMS.txt').write_text(''.join(f'{digest(stage / name)}  {name}\n' for name in sorted(allowed)))
        for item in stage.iterdir():
            item.chmod(0o644)
        # Reserve the destination without overwriting; copy the exact final allowlist.
        output.mkdir(mode=0o755)
        try:
            for item in stage.iterdir():
                shutil.copyfile(item, output / item.name)
                (output / item.name).chmod(0o644)
            require(all(digest(item) == digest(output / item.name) for item in stage.iterdir()),
                    'A cópia final diverge dos artefatos verificados.')
        except BaseException:
            shutil.rmtree(output)
            raise
    print('Finalização local concluída: cinco pacotes, três assinaturas, latest.json e SHA256SUMS.txt.')
    print('Nenhum upload foi realizado. Revise o inventário e publique todos os arquivos juntos no draft da tag.')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    commands = parser.add_subparsers(dest='command', required=True)
    archive = commands.add_parser('archive-macos', help='Criar tar público a partir do .app já notarizado e stapled.')
    archive.add_argument('--app', type=Path, required=True)
    archive.add_argument('--output', type=Path, required=True)
    archive.add_argument('--version', required=True)
    archive.add_argument('--arch', choices=['arm64', 'intel'], required=True)
    release = commands.add_parser('finalize', help='Auditar e assinar os cinco pacotes públicos locais.')
    release.add_argument('--input', type=Path, required=True)
    release.add_argument('--output', type=Path, required=True)
    release.add_argument('--version', required=True)
    arguments = parser.parse_args()
    try:
        version = version_value(arguments.version)
        if arguments.command == 'archive-macos':
            archive_app(arguments.app.resolve(), arguments.output.absolute(), version, arguments.arch)
        else:
            finalize(arguments.input.resolve(), arguments.output.absolute(), version)
    except (OSError, ValueError, KeyError, TypeError, EOFError, struct.error, tarfile.TarError, plistlib.InvalidFileException) as error:
        # Do not print arbitrary parser/tool exception text containing file contents.
        print(f'Erro: {error if type(error) is ValueError else "arquivo inválido ou operação indisponível"}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
