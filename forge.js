#!/usr/bin/env node

const { join } = require('path');
const { spawn } = require('child_process');
const { existsSync } = require('fs');

// Get the correct binary extension based on platform
const getBinaryExtension = () => {
  return process.platform === 'win32' ? '.exe' : '';
};

// Get the path to the forge binary in the same directory as this script
const forgeBinaryPath = join(__dirname, 'forge' + getBinaryExtension());

// Check if the binary exists
if (!existsSync(forgeBinaryPath)) {
  console.error(`❌ Forge binary not found at: ${forgeBinaryPath}`);
  console.error('Please try reinstalling the package with: npm install -g forgecode');
  console.error(`System information: ${process.platform} (${process.arch})`);
  process.exit(1);
}

// Configure spawn options based on platform
const spawnOptions = {
  stdio: 'inherit',
};

// Spawn the forge process
const forgeProcess = spawn(forgeBinaryPath, process.argv.slice(2), spawnOptions);

// Handle SIGINT (Ctrl+C) based on platform
process.on('SIGINT', () => {
  // for windows, let the child process handle it
  if (process.platform !== 'win32') {
    forgeProcess.kill('SIGINT');
  }
});

// Handle process exit
forgeProcess.on('exit', code => {
  if (code !== null) {
    process.exit(code);
  }
});
