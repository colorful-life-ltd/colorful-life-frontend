"""Unchanged Store initialization/atomic-pointer methods from Infra b9a1fc00,
ops/ec2/storefront/deploy_storefront.py. No Sandbox configuration or entry point.
"""
import os
from pathlib import Path

class Store:
    def __init__(self, root):
        self.root = Path(root)
        self.releases = self.root / 'releases'
        self.current = self.root / 'current'
        self.state_file = self.root / 'state.json'
    def point(self, sha):
        """Atomically repoint `current` (rename over the old symlink)."""
        temp = self.root / '.current.next'
        if temp.is_symlink() or temp.exists():
            temp.unlink()
        if sha is None:
            if self.current.is_symlink():
                self.current.unlink()
            return
        os.symlink(Path('releases') / sha, temp)
        os.replace(temp, self.current)
