#!/usr/bin/env node

const { platform, arch } = process;
const { spawnSync } = require('child_process');
const { existsSync } = require('fs');

// Note: This script now only checks for compatibility.
// It does NOT copy the binary, to avoid permission issues during npm install.
// The forge.js entry point now resolves the correct binary at runtime.

// Function to check if running on Android
function isAndroid() {
  try {
    const result = spawnSync('getprop', ['ro.build.version.release'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) return true;
  } catch (e) {}
  if (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) return true;
  if (process.env.ANDROID_ROOT || process.env.ANDROID_DATA) return true;
  try {
     if (existsSync('/system/build.prop')) return true;
  } catch(e) {}
  return false;
}

const PLATFORMS = {
  darwin: { x64: true, arm64: true },
  linux: { x64: true, arm64: true },
  win32: { x64: true, arm64: true },
  android: { arm64: true }
};

function install() {
  // Simple compatibility check
  let actualPlatform = platform;
  if (platform === 'linux' && isAndroid()) {
    actualPlatform = 'android';
  }

  if (!PLATFORMS[actualPlatform]) {
    console.warn(`⚠️  Warning: Platform '${actualPlatform}' might not be supported.`);
  } else if (!PLATFORMS[actualPlatform][arch]) {
    console.warn(`⚠️  Warning: Architecture '${arch}' on '${actualPlatform}' might not be supported.`);
  } else {
    console.log(`✅ System appears compatible: ${actualPlatform}/${arch}`);
  }
  
  console.log("Forge installed successfully. Run 'forge' to start.");
}

install();
