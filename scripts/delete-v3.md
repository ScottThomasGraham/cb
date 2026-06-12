# Removing Claude-Browser-V3

Run these once cb is installed and verified. They are destructive; confirm before each.

1. Stop the app if running:
   `osascript -e 'quit app "Claude-Browser-V3"'` (ignore errors if not running)
2. Remove the app bundle:
   `rm -rf "/Applications/Claude-Browser-V3.app"`
3. Remove the source repo:
   `rm -rf ~/Projects/Claude-Browser-V3`
4. The old `claude-browser` symlink is replaced by cb's install (it now points at
   `~/Projects/cb/bin/cb.mjs`). If it still points at the old path, re-run:
   `node ~/Projects/cb/scripts/install.mjs`
5. Remove the old plugin cache + registration:
   - `rm -rf ~/.claude/plugins/cache/claude-browser-local`
   - delete the `"claude-browser-local"` key from
     `~/.claude/plugins/installed_plugins.json`
6. Verify: `cb status` works; `claude-browser status` (alias) works; the old app is gone
   (`ls /Applications | grep -i claude-browser` → nothing).
