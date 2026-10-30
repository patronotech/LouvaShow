#!/usr/bin/env python3
"""Release guard tests: synthetic bundles/PE and disposable signing keys only."""
import base64
import importlib.util
import io
import os
from pathlib import Path
import plistlib
import shutil
import struct
import subprocess
import tarfile
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('updater_release', Path(__file__).with_name('prepare-updater.py'))
release = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(release)


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.root = Path(self.directory.name)
        self.app = self.root / release.APP
        for name in release.REQUIRED:
            path = self.app / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b'synthetic runtime')
            path.chmod(0o755 if name.endswith('/louvashow') else 0o644)
        (self.app / 'Contents/Info.plist').write_bytes(plistlib.dumps({
            'CFBundleIdentifier': 'app.louvashow.desktop',
            'CFBundleExecutable': 'louvashow', 'CFBundleShortVersionString': '0.7.0',
        }))

    def test_tar_roundtrip_keeps_only_runtime_and_modes(self):
        output = self.root / 'public.tar.gz'
        with patch.object(release, 'native_app_checks') as checks:
            release.archive_app(self.app, output, '0.7.0', 'arm64')
        self.assertEqual(checks.call_count, 2)
        extracted = self.root / 'unpacked'
        extracted.mkdir()
        self.assertEqual(release.app_inventory(self.app, '0.7.0'), release.inspect_archive(output, '0.7.0', extracted))
        with tarfile.open(output) as archive:
            self.assertTrue(all(m.uid == m.gid == 0 and not m.uname and not m.pax_headers for m in archive))
        with self.assertRaises(ValueError):
            release.archive_app(self.app, output, '0.7.0', 'arm64')

    def test_private_file_and_symlink_never_enter_archive(self):
        private = self.app / 'Contents/Resources/hc_xml.zip'
        private.write_bytes(b'synthetic private fixture')
        with self.assertRaises(ValueError):
            release.app_inventory(self.app, '0.7.0')
        private.unlink()
        private.symlink_to(self.app / 'Contents/Info.plist')
        with self.assertRaises(ValueError):
            release.app_inventory(self.app, '0.7.0')

    def test_versions_and_ticket_are_required(self):
        with self.assertRaises(ValueError):
            release.app_inventory(self.app, '0.7.1')
        (self.app / 'Contents/CodeResources').unlink()
        with self.assertRaises(ValueError):
            release.app_inventory(self.app, '0.7.0')

    def test_archive_rejects_traversal_duplicate_links_and_user_metadata(self):
        for kind in ['traversal', 'duplicate', 'symlink', 'username', 'pax']:
            with self.subTest(kind=kind):
                path = self.root / f'{kind}.tar.gz'
                with tarfile.open(path, 'w:gz') as archive:
                    member = tarfile.TarInfo(f'{release.APP}/Contents/Info.plist')
                    data = (self.app / 'Contents/Info.plist').read_bytes()
                    member.size = len(data)
                    if kind == 'traversal': member.name = f'{release.APP}/../Info.plist'
                    if kind == 'symlink': member.type, member.linkname = tarfile.SYMTYPE, '/tmp/private'
                    if kind == 'username': member.uname = 'private-local-user'
                    if kind == 'pax': member.pax_headers = {'comment': 'internal metadata'}
                    archive.addfile(member, io.BytesIO(data))
                    if kind == 'duplicate': archive.addfile(member, io.BytesIO(data))
                with self.assertRaises(ValueError): release.inspect_archive(path, '0.7.0')

    def test_reads_nsis_version_without_executing_it(self):
        data = bytearray(1024)
        data[:2] = b'MZ'; struct.pack_into('<I', data, 60, 64)
        data[64:68] = b'PE\0\0'
        struct.pack_into('<H', data, 70, 1); struct.pack_into('<H', data, 84, 224)
        struct.pack_into('<H', data, 88, 0x10b)
        struct.pack_into('<II', data, 200, 4096, 256)
        struct.pack_into('<IIII', data, 320, 256, 4096, 512, 512)
        for offset in [0, 24, 48]: struct.pack_into('<HH', data, 512 + offset + 12, 0, 1)
        struct.pack_into('<II', data, 528, 16, 0x80000018)
        struct.pack_into('<II', data, 552, 1, 0x80000030)
        struct.pack_into('<II', data, 576, 1033, 72)
        struct.pack_into('<II', data, 584, 4096 + 88, 92)
        key = 'VS_VERSION_INFO\0'.encode('utf-16le')
        data[606:606 + len(key)] = key
        struct.pack_into('<IIII', data, 640, 0xfeef04bd, 0, 7, 0)
        path = self.root / 'synthetic.exe'; path.write_bytes(data)
        self.assertEqual(release.windows_version(path), (0, 7, 0, 0))
        data[528:532] = bytes(4); path.write_bytes(data)
        with self.assertRaises(ValueError): release.windows_version(path)

    @unittest.skipUnless(shutil.which('minisign') and (release.ROOT / 'node_modules/.bin/tauri').exists(), 'Requires local minisign and locked CLI')
    def test_disposable_key_signature_tampering_and_version(self):
        environment = {key: value for key, value in os.environ.items()
                       if not key.startswith(('TAURI_SIGNING_', 'TAURI_PRIVATE_'))}
        environment['TAURI_SIGNING_PRIVATE_KEY_PASSWORD'] = ''
        cli = str(release.ROOT / 'node_modules/.bin/tauri')
        key = self.root / 'disposable-signing-key'
        # --write-keys prevents secret material from being printed; no real key is read.
        subprocess.run([cli, 'signer', 'generate', '--ci', '--write-keys', str(key)], env=environment,
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        artifact = self.root / 'synthetic.bin'; artifact.write_bytes(b'synthetic artifact\n')
        subprocess.run([cli, 'signer', 'sign', '--private-key-path', str(key), '--app-version', '0.7.0', str(artifact)],
                       env=environment, check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        public = Path(str(key) + '.pub').read_text()
        signature = Path(str(artifact) + '.sig').read_text()
        release.verify_signature(artifact, signature, public, '0.7.0', self.root)
        with self.assertRaises(ValueError): release.verify_signature(artifact, signature, public, '0.7.1', self.root)
        artifact.write_bytes(b'tampered artifact\n')
        with self.assertRaises(ValueError): release.verify_signature(artifact, signature, public, '0.7.0', self.root)


if __name__ == '__main__':
    unittest.main()
