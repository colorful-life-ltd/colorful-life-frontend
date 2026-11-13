"""Append-only publication of authenticated release assets; no deletion of assets."""
import os
from pathlib import Path, PurePosixPath
import re
import stat
import tempfile
import artifact

NAME = re.compile(r'[A-Za-z0-9][A-Za-z0-9_.-]*-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+')

def selected(record):
    result = {}
    for name, digest in record['files'].items():
        if not name.startswith('assets/'):
            continue
        p = PurePosixPath(name)
        if len(p.parts) != 2 or not NAME.fullmatch(p.name) or not artifact.DIGEST.fullmatch(digest):
            raise artifact.GateError('Unsafe or unhashed asset path')
        result[name] = digest
    if not result:raise artifact.GateError('Release has no hashed assets')
    return result

def publish(store, directory, record, controlled, fsync_dir, checkpoint=lambda _:None):
    """Caller holds release lock and has authenticated the complete source release."""
    files = selected(record)
    base = store.root/'asset-store'
    public = base/'assets'
    for path in [base, public]:
        try:
            path.mkdir(mode=0o755)
        except FileExistsError:
            pass
        else:
            # Normalize only directories created here, never repair unsafe existing paths.
            path.chmod(0o755, follow_symlinks=False)
        controlled(path, 0o755)
    fsync_dir(base); fsync_dir(store.root)
    for name, expected in sorted(files.items()):
        source = directory/'site'/name
        controlled(source)
        if source.is_symlink() or not source.is_file() or artifact.digest(source) != expected:
            raise artifact.GateError('Authenticated asset source differs')
        dest = public/PurePosixPath(name).name
        if dest.exists() or dest.is_symlink():
            verify_file(dest, expected, controlled)
            continue
        fd, temporary = tempfile.mkstemp(prefix='asset-', dir=store.control)
        try:
            with os.fdopen(fd, 'wb') as out, source.open('rb') as inp:
                os.fchmod(out.fileno(), 0o644)
                while chunk := inp.read(1024*1024):
                    out.write(chunk)
                out.flush(); os.fsync(out.fileno())
            if artifact.digest(temporary) != expected:
                raise artifact.GateError('Asset changed while publishing')
            checkpoint(name)
            try:
                os.link(temporary, dest, follow_symlinks=False)
            except FileExistsError:
                verify_file(dest, expected, controlled)
            fsync_dir(public)
            verify_file(dest, expected, controlled)
        finally:
            os.unlink(temporary)
    verify(store, record, controlled)

def verify_file(path, expected, controlled):
    controlled(path, 0o644)
    s = path.lstat()
    if not stat.S_ISREG(s.st_mode) or artifact.digest(path) != expected:
        raise artifact.GateError('Asset collision, permissions or integrity differs')

def verify(store, record, controlled):
    base=store.root/'asset-store'; public=base/'assets'
    controlled(base, 0o755); controlled(public, 0o755)
    for name, digest in selected(record).items():
        verify_file(public/PurePosixPath(name).name, digest, controlled)
