#!/usr/bin/env python3
"""Check the Git index before publication, without printing matched contents.

Only tracked/indexed bytes are inspected: stage intended public files first.
This guard catches common leaks; it does not replace review or secret scanning.
No files, Git configuration, credentials or network services are modified.
"""

from pathlib import PurePosixPath
import re
import subprocess
import sys


PRIVATE_PARTS = {
    '.git', '.codex', '.claude', '.agents', '.cursor', '.gemini', '.qwen', '.idea', '.vscode',
    'skills', 'memories', 'handoffs', 'prompts',
    '.ssh', '.aws', '.azure', '.gnupg', '.venv', '.cache', '__pycache__',
    'node_modules', 'target', 'dist', 'build', 'coverage', 'backups', 'backup',
    'logs', 'private', 'credentials', 'certificates', 'screenshots',
}
PRIVATE_NAMES = {
    'agents.md', 'claude.md', 'gemini.md', 'qwen.md', 'memory.md', 'skill.md',
    'handoff.md', 'plan.md', '.ds_store', 'thumbs.db', '.npmrc', '.pypirc',
    'id_rsa', 'id_ed25519', 'credentials.json', 'cookies.txt',
}
PRIVATE_SUFFIXES = {
    '.pem', '.p12', '.pfx', '.key', '.cer', '.crt', '.mobileprovision',
    '.sqlite', '.sqlite3', '.db', '.db3', '.sql', '.log', '.bak', '.tmp',
    '.dmg', '.exe', '.msi', '.app', '.zip', '.tar', '.gz', '.7z', '.rar',
}
CONTENT_RULES = {
    'private-key-material': re.compile(rb'-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----'),
    'github-token': re.compile(rb'\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})\b'),
    'aws-access-key': re.compile(rb'\b(?:AKIA|ASIA)[A-Z0-9]{16}\b'),
    'service-api-key': re.compile(rb'\b(?:sk-(?:proj-|ant-)?[A-Za-z0-9_-]{32,}|AIza[A-Za-z0-9_-]{35}|xox[baprs]-[A-Za-z0-9-]{20,})\b'),
    'macos-personal-path': re.compile(rb'/Users/[A-Za-z0-9_.-]+(?:/|\b)'),
    'windows-personal-path': re.compile(rb'[A-Za-z]:\\(?:Users|Documents and Settings)\\[^\\\s"\']+', re.I),
    'linux-personal-path': re.compile(rb'/home/[A-Za-z0-9_.-]+/'),
    'credential-in-url': re.compile(rb'https?://[^\s/:"\']+:[^\s/@"\']+@', re.I),
}
LITERAL_CREDENTIAL = re.compile(
    rb'''(?ix)["']?(?:api[_-]?key|access[_-]?token|auth[_-]?token|client[_-]?secret|password|passwd)["']?\s*[:=]\s*["']([^"'\r\n]{8,})["']'''
)
PLACEHOLDERS = re.compile(rb'^(?:example|sample|dummy|test|fake|placeholder|your[_ -]|changeme|replace[_ -]|\$\{|<)', re.I)


def violations(path: str, data: bytes, mode: str = '100644') -> list[str]:
    normalized = PurePosixPath(path)
    lowered = PurePosixPath(path.lower())
    rules = []
    if mode not in {'100644', '100755'}:
        rules.append('non-regular-source-file')
    if normalized.is_absolute() or '..' in normalized.parts or any(part in PRIVATE_PARTS for part in lowered.parts):
        rules.append('private-or-generated-path')
    if lowered.name in PRIVATE_NAMES or lowered.name == '.env' or lowered.name.startswith('.env.'):
        rules.append('internal-or-local-file')
    if lowered.suffix in PRIVATE_SUFFIXES or lowered.name.endswith(('-wal', '-shm')):
        rules.append('private-data-or-distribution-file')
    if len(data) > 5 * 1024 * 1024:
        rules.append('source-file-too-large')
    for name, pattern in CONTENT_RULES.items():
        if pattern.search(data):
            rules.append(name)
    if any(not PLACEHOLDERS.search(match.group(1)) for match in LITERAL_CREDENTIAL.finditer(data)):
        rules.append('literal-credential')
    if b'\x00' in data and lowered.suffix not in {'.png', '.ico', '.icns', '.woff', '.woff2'}:
        rules.append('unreviewed-binary')
    return rules


def git(*arguments: str) -> bytes:
    return subprocess.run(['git', *arguments], check=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL).stdout


def main() -> int:
    try:
        records = [record for record in git('ls-files', '--stage', '-z').split(b'\0') if record]
        if not records:
            print('.: empty-git-index')
            return 1
        failures = 0
        for record in records:
            metadata, raw_path = record.split(b'\t', 1)
            mode, object_id, stage = metadata.decode('ascii').split()
            path = raw_path.decode('utf-8', errors='replace')
            if stage != '0':
                print(f'{ascii(path)}: unmerged-index-entry')
                failures += 1
                continue
            if mode in {'100644', '100755', '120000'}:
                if int(git('cat-file', '-s', object_id)) > 5 * 1024 * 1024:
                    print(f'{ascii(path)}: source-file-too-large')
                    failures += 1
                    continue
                data = git('cat-file', 'blob', object_id)
            else:
                data = b''
            for rule in violations(path, data, mode):
                print(f'{ascii(path)}: {rule}')
                failures += 1
        if failures:
            return 1
        print('.: public-source-audit-passed')
        return 0
    except (OSError, subprocess.CalledProcessError, ValueError):
        print('.: unable-to-audit-git-index')
        return 2


if __name__ == '__main__':
    sys.exit(main())
