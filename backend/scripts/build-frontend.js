const { spawnSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..', '..');
const frontendDir = path.join(rootDir, 'frontend');
const viteEntry = path.join(frontendDir, 'node_modules', 'vite', 'bin', 'vite.js');
const result = spawnSync(process.execPath, [viteEntry, 'build'], {
  cwd: frontendDir,
  stdio: 'inherit',
  windowsHide: true,
});

if (result.error) {
  console.error('Could not start the frontend build:', result.error.message);
  process.exit(1);
}

process.exit(typeof result.status === 'number' ? result.status : 1);
