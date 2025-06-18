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
  console.error('Please try reinstalling the package with: npm install -g @antinomyhq/forge');
  console.error(`System information: ${process.platform} (${process.arch})`);
  process.exit(1);
}

// Execute the binary with the same arguments
const forgeProcess = spawn(forgeBinaryPath, process.argv.slice(2), { 
  stdio: 'inherit',
  shell: process.platform === 'win32' // Use shell on Windows
});

// Pass through SIGINT signals to the child process
process.on('SIGINT', () => {
  // Instead of handling here, forward to the child
  forgeProcess.kill('SIGINT');
  // Don't exit - let the child process determine what happens
});

// Handle process exit
forgeProcess.on('exit', (code) => {
  // Only exit with code when the child actually exits
  process.exit(code || 0);
});