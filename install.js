#!/usr/bin/env node

const { platform, arch } = process;
const { join } = require('path');
const { chmodSync, copyFileSync, existsSync } = require('fs');
const { spawnSync } = require('child_process');
const os = require('os');

// Function to get the glibc version on Linux
function getGlibcVersion() {
  try {
    // Using ldd to get version info (common on most Linux distros)
    const lddOutput = spawnSync('ldd', ['--version'], { encoding: 'utf8' }).stderr.toString() || 
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
      const getconfOutput = spawnSync('getconf', ['GNU_LIBC_VERSION'], { encoding: 'utf8' }).stdout.toString();
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
    console.warn('Warning: Could not detect libc version details.');
    return { type: 'unknown', version: null };
  }
}

// Check if the glibc version is sufficient for our binary
function isGlibcVersionSufficient(version) {
  if (!version) return false;
  
  // Our binary requires 2.32 or higher based on the error message
  const requiredVersion = 2.32;
  const currentVersion = parseFloat(version);
  
  return currentVersion >= requiredVersion;
}

// Enhanced libc detection for Linux
function detectLibcType() {
  if (platform !== 'linux') {
    return null; // Not relevant for non-Linux platforms
  }

  const libcInfo = getGlibcVersion();
  console.log(`🔍 Detected libc: ${libcInfo.type}${libcInfo.version ? ` version ${libcInfo.version}` : ''}`);
  
  // If it's musl, or if it's an older glibc version, prefer musl
  if (libcInfo.type === 'musl' || 
      (libcInfo.type === 'gnu' && !isGlibcVersionSufficient(libcInfo.version))) {
    return 'musl';
  }
  
  return 'gnu';
}

// Test if a binary will run on this system
function testBinary(binaryPath) {
  try {
    const result = spawnSync(binaryPath, ['--version'], { 
      encoding: 'utf8',
      timeout: 5000 // 5 second timeout
    });
    
    // Check if execution was successful (return code 0)
    if (result.status === 0) {
      return true;
    }
    
    // Check specific errors that indicate glibc version problems
    if (result.stderr && result.stderr.includes('GLIBC_')) {
      console.warn(`⚠️  Binary compatibility issue: ${result.stderr.split('\n')[0]}`);
      return false;
    }
    
    return false;
  } catch (error) {
    console.warn(`⚠️  Binary test failed: ${error.message}`);
    return false;
  }
}

// Map of supported platforms and architectures to binary names
const PLATFORMS = {
  'darwin': {
    'x64': 'forge-x86_64-apple-darwin',
    'arm64': 'forge-aarch64-apple-darwin'
  },
  'linux': {
    'x64': {
      'gnu': 'forge-x86_64-unknown-linux-gnu',
      'musl': 'forge-x86_64-unknown-linux-musl'
    },
    'arm64': {
      'gnu': 'forge-aarch64-unknown-linux-gnu',
      'musl': 'forge-aarch64-unknown-linux-musl'
    }
  },
  'win32': {
    'x64': 'forge-x86_64-pc-windows-msvc.exe',
    'arm64': 'forge-aarch64-pc-windows-msvc.exe'
  }
};

// Platform-specific binary extension
function getBinaryExtension() {
  return platform === 'win32' ? '.exe' : '';
}

// Print available platform information for debugging
function printPlatformInfo() {
  console.log('System Information:');
  console.log(` - Platform: ${platform}`);
  console.log(` - Architecture: ${arch}`);
  console.log(` - Node.js: ${process.version}`);
  console.log(` - OS: ${os.type()} ${os.release()}`);
  
  if (platform === 'linux') {
    const libcInfo = getGlibcVersion();
    console.log(` - Libc: ${libcInfo.type}${libcInfo.version ? ` version ${libcInfo.version}` : ''}`);
    
    try {
      const distroInfo = spawnSync('cat', ['/etc/os-release'], { encoding: 'utf8' }).stdout.toString();
      const distroName = /PRETTY_NAME="([^"]+)"/.exec(distroInfo);
      if (distroName && distroName[1]) {
        console.log(` - Distribution: ${distroName[1]}`);
      }
    } catch (e) {
      // Ignore if we can't get distribution info
    }
  }
}

// Install binary based on platform and architecture
function install() {
  printPlatformInfo();
  
  // Check if platform is supported
  if (!PLATFORMS[platform]) {
    console.error(`❌ Unsupported platform: ${platform}`);
    console.error('Supported platforms: macOS, Linux, Windows');
    process.exit(1);
  }

  // Check if architecture is supported
  if (!PLATFORMS[platform][arch]) {
    console.error(`❌ Unsupported architecture: ${arch} for platform ${platform}`);
    console.error(`Supported architectures for ${platform}: ${Object.keys(PLATFORMS[platform]).join(', ')}`);
    process.exit(1);
  }

  let binaryName;
  let binaryPath;
  const targetPath = join(__dirname, 'forge' + getBinaryExtension());

  // Handle Linux specially for libc type
  if (platform === 'linux') {
    let libcType = detectLibcType();
    
    // Always try musl first if available (it's more portable)
    const muslBinaryName = PLATFORMS[platform][arch]['musl'];
    const muslBinaryPath = join(__dirname, 'bin', platform, arch, muslBinaryName);
    
    // Check if musl binary exists
    if (existsSync(muslBinaryPath)) {
      console.log('📦 Found musl binary, which should work on most Linux systems');
      binaryName = muslBinaryName;
      binaryPath = muslBinaryPath;
    } 
    // Fall back to detected libc type
    else {
      // Check if the detected libc type is supported in our binaries
      if (!PLATFORMS[platform][arch][libcType]) {
        // If not supported, try the alternative
        libcType = (libcType === 'gnu') ? 'musl' : 'gnu';
        console.warn(`⚠️  Detected libc type is not supported, trying ${libcType} instead`);
      }
      
      binaryName = PLATFORMS[platform][arch][libcType];
      binaryPath = join(__dirname, 'bin', platform, arch, binaryName);
    }
    
    // If binary doesn't exist, try the alternative
    if (!existsSync(binaryPath)) {
      const alternativeLibc = libcType === 'gnu' ? 'musl' : 'gnu';
      const alternativeBinaryName = PLATFORMS[platform][arch][alternativeLibc];
      const alternativeBinaryPath = join(__dirname, 'bin', platform, arch, alternativeBinaryName);
      
      if (existsSync(alternativeBinaryPath)) {
        console.warn(`⚠️  Binary for ${libcType} not found, trying ${alternativeLibc} instead`);
        binaryName = alternativeBinaryName;
        binaryPath = alternativeBinaryPath;
      }
    }
  } else {
    binaryName = PLATFORMS[platform][arch];
    binaryPath = join(__dirname, 'bin', platform, arch, binaryName);
  }

  // Check if binary exists
  if (!existsSync(binaryPath)) {
    console.error(`❌ Binary not found: ${binaryPath}`);
    console.error('If this is a new architecture or platform, please check the repository for updates.');
    process.exit(1);
  }

  try {
    // Copy binary to target location
    copyFileSync(binaryPath, targetPath);
    // Make binary executable (not needed on Windows)
    if (platform !== 'win32') {
      chmodSync(targetPath, '755');
    }
    
    // For Linux, test if the binary will actually run
    if (platform === 'linux') {
      console.log('🧪 Testing binary compatibility...');
      if (!testBinary(targetPath)) {
        // If current binary fails and we haven't tried musl yet, try the musl version
        if (binaryName.includes('-gnu')) {
          const muslBinaryName = binaryName.replace('-gnu', '-musl');
          const muslBinaryPath = join(__dirname, 'bin', platform, arch, muslBinaryName);
          
          if (existsSync(muslBinaryPath)) {
            console.log('🔄 GNU binary not compatible, trying musl binary instead');
            copyFileSync(muslBinaryPath, targetPath);
            chmodSync(targetPath, '755');
            
            if (!testBinary(targetPath)) {
              console.error('❌ Both GNU and musl binaries failed to run on this system.');
              reportCompatibilityError();
              process.exit(1);
            }
          } else {
            console.error('❌ GNU binary not compatible, and musl binary not available.');
            reportCompatibilityError();
            process.exit(1);
          }
        } else {
          console.error('❌ Binary compatibility test failed.');
          reportCompatibilityError();
          process.exit(1);
        }
      }
    }
    
    console.log(`✅ Successfully installed forge for ${platform}/${arch}`);
  } catch (error) {
    console.error(`❌ Error installing binary: ${error.message}`);
    reportCompatibilityError();
    process.exit(1);
  }
}

function reportCompatibilityError() {
  console.error('\n🔧 Possible solutions:');
  console.error('1. Try using the musl binary, which has fewer system dependencies:');
  console.error('   - Set FORCE_MUSL=1 before installing');
  console.error('2. Update your system\'s glibc to a newer version');
  console.error('3. Contact support with the following information:');
  printPlatformInfo();
}

// Check for environment variable to force musl
if (process.env.FORCE_MUSL === '1' && platform === 'linux') {
  console.log('🔧 FORCE_MUSL=1 environment variable detected, forcing musl binary');
  process.env.FORCE_LIBC = 'musl';
}

// Run installation
install();