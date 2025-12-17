#!/usr/bin/env node

const { join } = require('path');
const { spawn, spawnSync } = require('child_process');
const { existsSync } = require('fs');
const os = require('os');
const { platform, arch } = process;

// Function to check if running on Android
function isAndroid() {
  try {
    // Check for Android-specific system properties
    const result = spawnSync('getprop', ['ro.build.version.release'], { encoding: 'utf8' });
    if (result.status === 0 && result.stdout) {
      return true;
    }
  } catch (e) {
    // getprop command not available, probably not Android
  }

  // Check for Termux environment
  if (process.env.PREFIX && process.env.PREFIX.includes('com.termux')) {
    return true;
  }
  
  // Check for Android-specific environment variables
  if (process.env.ANDROID_ROOT || process.env.ANDROID_DATA) {
    return true;
  }

  // Check for Android-specific system properties
  if (existsSync('/system/build.prop')) {
    return true;
  }

  return false;
}

// Function to get the glibc version on Linux
function getGlibcVersion() {
  try {
    // Using ldd to get version info (common on most Linux distros)
    const lddOutput =
      spawnSync('ldd', ['--version'], { encoding: 'utf8' }).stderr.toString() ||
      spawnSync('ldd', ['--version'], { encoding: 'utf8' }).stdout.toString();

    // Check if this is musl libc
    if (lddOutput.toLowerCase().includes('musl')) {
      return { type: 'musl', version: null };
    }

    // Extract glibc version using regex
    const versionMatch = /\b(\d+\.\d+)\b/.exec(lddOutput);
    if (versionMatch && versionMatch[1]) {
      return { type: 'gnu', version: versionMatch[1] };
    }

    // Alternative method using GNU-specific getconf
    try {
      const getconfOutput = spawnSync('getconf', ['GNU_LIBC_VERSION'], {
        encoding: 'utf8',
      }).stdout.toString();
      const getconfMatch = /\b(\d+\.\d+)\b/.exec(getconfOutput);
      if (getconfMatch && getconfMatch[1]) {
        return { type: 'gnu', version: getconfMatch[1] };
      }
    } catch (e) {
      // Ignore error if getconf is not available
    }

    // If we got here, we couldn't get the specific version
    return { type: 'gnu', version: null };
  } catch (error) {
    return { type: 'unknown', version: null };
  }
}

// Check if the glibc version is sufficient for our binary
function isGlibcVersionSufficient(version) {
  if (!version) return false;

  // Our binary requires 2.39 or higher
  const requiredVersion = 2.39;
  const currentVersion = parseFloat(version);

  return currentVersion >= requiredVersion;
}

// Enhanced libc detection for Linux
function detectLibcType() {
  if (platform !== 'linux') {
    return null; // Not relevant for non-Linux platforms
  }

  const libcInfo = getGlibcVersion();

  // If it's musl, or if it's an older glibc version, prefer musl
  if (
    libcInfo.type === 'musl' ||
    (libcInfo.type === 'gnu' && !isGlibcVersionSufficient(libcInfo.version))
  ) {
    return 'musl';
  }

  return 'gnu';
}

// Map of supported platforms and architectures to binary names
const PLATFORMS = {
  darwin: {
    x64: 'forge-x86_64-apple-darwin',
    arm64: 'forge-aarch64-apple-darwin',
  },
  linux: {
    x64: {
      gnu: 'forge-x86_64-unknown-linux-gnu',
      musl: 'forge-x86_64-unknown-linux-musl',
    },
    arm64: {
      gnu: 'forge-aarch64-unknown-linux-gnu',
      musl: 'forge-aarch64-unknown-linux-musl',
    },
  },
  win32: {
    x64: 'forge-x86_64-pc-windows-msvc.exe',
    arm64: 'forge-aarch64-pc-windows-msvc.exe',
  },
  android: {
    arm64: 'forge-aarch64-linux-android',
  }
};

// Helper function to construct binary path
function buildBinaryPath(platformDir, archDir, binaryName) {
  return join(__dirname, 'bin', platformDir, archDir, binaryName);
}

// Determine the path to the correct binary
function getBinaryPath() {
  // Check for override
  if (process.env.FORGE_BINARY_PATH) {
    return process.env.FORGE_BINARY_PATH;
  }

  // Detect actual platform (override for Android)
  const isAndroidEnv = platform === 'linux' && isAndroid();
  const actualPlatform = isAndroidEnv ? 'android' : platform;

  // Handle Android
  if (actualPlatform === 'android') {
    const binaryName = PLATFORMS.android?.[arch];
    return binaryName ? buildBinaryPath('android', arch, binaryName) : null;
  }

  // Handle Linux with libc detection
  if (platform === 'linux') {
    const forceMusl = process.env.FORCE_MUSL === '1';
    const libcType = forceMusl ? 'musl' : (detectLibcType() || 'gnu');
    const binaryName = PLATFORMS.linux?.[arch]?.[libcType];
    return binaryName ? buildBinaryPath(platform, arch, binaryName) : null;
  }

  // Handle macOS and Windows
  const binaryName = PLATFORMS[actualPlatform]?.[arch];
  return binaryName ? buildBinaryPath(actualPlatform, arch, binaryName) : null;
}

// Export for testing
module.exports = { getBinaryPath };

/* istanbul ignore next */
// Only run if not being required as a module (i.e., being executed directly)
if (require.main === module) {
  const forgeBinaryPath = getBinaryPath();

  // Check if the binary exists
  if (!forgeBinaryPath || !existsSync(forgeBinaryPath)) {
    console.error(`❌ Forge binary not found for platform: ${platform} (${arch})`);
    console.error('Please check if your system is supported.');
    process.exit(1);
  }

  // Configure spawn options
  const spawnOptions = {
    stdio: 'inherit',
  };

  // Spawn the forge process
  const forgeProcess = spawn(forgeBinaryPath, process.argv.slice(2), spawnOptions);

  // Handle SIGINT (Ctrl+C) based on platform
  process.on('SIGINT', () => {
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
}
