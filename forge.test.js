// Mock modules
const path = require('path');
const mockSpawn = jest.fn();
const mockSpawnSync = jest.fn();
const mockExistsSync = jest.fn();

jest.mock('child_process', () => ({
  spawn: mockSpawn,
  spawnSync: mockSpawnSync,
}));

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

describe('forge.js - Platform Detection and Binary Naming', () => {
  let originalPlatform;
  let originalArch;
  let originalEnv;

  // Helper to create mock spawnSync result with proper toString() methods
  const createSpawnSyncResult = (status, stdout, stderr) => ({
    status,
    stdout: { toString: () => stdout },
    stderr: { toString: () => stderr }
  });
  
  // Helper to mock Linux libc detection
  const mockLinuxLibc = (libcOutput) => {
    mockSpawnSync.mockImplementation((cmd, args) => {
      if (cmd === 'ldd') {
        return createSpawnSyncResult(0, '', libcOutput);
      }
      if (cmd === 'getprop') {
        return createSpawnSyncResult(1, '', ''); // Android check fails
      }
      return createSpawnSyncResult(1, '', '');
    });
  };

  beforeEach(() => {
    originalPlatform = process.platform;
    originalArch = process.arch;
    originalEnv = { ...process.env };

    jest.resetModules();
    mockSpawn.mockClear();
    mockSpawnSync.mockClear();
    mockExistsSync.mockClear();
    
    // Clean env variables
    delete process.env.ANDROID_ROOT;
    delete process.env.ANDROID_DATA;
    delete process.env.PREFIX;
    delete process.env.FORGE_BINARY_PATH;
    delete process.env.FORCE_MUSL;
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true, configurable: true });
    Object.defineProperty(process, 'arch', { value: originalArch, writable: true, configurable: true });
    process.env = originalEnv;
  });

  describe('Binary naming conventions', () => {
    test('macOS x64 should use x86_64-apple-darwin', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-x86_64-apple-darwin');
    });

    test('macOS ARM64 should use aarch64-apple-darwin', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-aarch64-apple-darwin');
    });

    test('Linux x64 GNU should use x86_64-unknown-linux-gnu', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockLinuxLibc('ldd (GNU libc) 2.39');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-x86_64-unknown-linux-gnu');
    });

    test('Linux x64 musl should use x86_64-unknown-linux-musl', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });
      process.env.FORCE_MUSL = '1';

      mockLinuxLibc('musl libc');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-x86_64-unknown-linux-musl');
    });

    test('Linux ARM64 GNU should use aarch64-unknown-linux-gnu', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });

      mockLinuxLibc('ldd (GNU libc) 2.39');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-aarch64-unknown-linux-gnu');
    });

    test('Linux ARM64 musl should use aarch64-unknown-linux-musl', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });
      process.env.FORCE_MUSL = '1';

      mockLinuxLibc('musl libc');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-aarch64-unknown-linux-musl');
    });

    test('Android ARM64 should use aarch64-linux-android', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });
      process.env.ANDROID_ROOT = '/system';

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => path.includes('/system/build.prop') || !path.includes('/system'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-aarch64-linux-android');
    });

    test('Windows x64 should use x86_64-pc-windows-msvc.exe', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-x86_64-pc-windows-msvc.exe');
    });

    test('Windows ARM64 should use aarch64-pc-windows-msvc.exe', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('forge-aarch64-pc-windows-msvc.exe');
    });
  });

  describe('Android detection', () => {
    test('should detect Android via ANDROID_ROOT', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });
      process.env.ANDROID_ROOT = '/system';

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => path.includes('/system/build.prop') || !path.includes('/system'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('android');
    });

    test('should detect Android via ANDROID_DATA', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });
      process.env.ANDROID_DATA = '/data';

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => path.includes('/system/build.prop') || !path.includes('/system'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('android');
    });

    test('should detect Termux via PREFIX', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });
      process.env.PREFIX = '/data/data/com.termux/files/usr';

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => path.includes('/system/build.prop') || !path.includes('/system'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('android');
    });

    test('should detect Android via /system/build.prop', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('android');
    });
  });

  describe('Glibc version detection', () => {
    test('should detect glibc 2.39 as sufficient', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockLinuxLibc('ldd (GNU libc) 2.39');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('gnu');
    });

    test('should detect glibc 2.40 as sufficient', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockLinuxLibc('ldd (GNU libc) 2.40');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('gnu');
    });

    test('should fall back to musl for glibc 2.28', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockLinuxLibc('ldd (GNU libc) 2.28');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('musl');
    });

    test('should detect musl libc', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockLinuxLibc('musl libc (x86_64)');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('musl');
    });
  });

  describe('Environment variable overrides', () => {
    test('should respect FORGE_BINARY_PATH override', () => {
      process.env.FORGE_BINARY_PATH = '/custom/path/to/forge';

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockReturnValue(true);

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toBe('/custom/path/to/forge');
    });

    test('should respect FORCE_MUSL flag on Linux', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });
      process.env.FORCE_MUSL = '1';

      mockLinuxLibc('ldd (GNU libc) 2.35');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('musl');
    });
  });

  describe('Binary path construction', () => {
    test('should construct correct path for darwin x64', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      const binaryPath = forge.getBinaryPath();
      // Use path.join for OS-agnostic path comparison
      expect(binaryPath).toContain(path.join('bin', 'darwin', 'x64'));
      expect(binaryPath).toContain('forge-x86_64-apple-darwin');
    });

    test('should construct correct path for linux arm64', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'arm64', writable: true, configurable: true });

      mockLinuxLibc('ldd (GNU libc) 2.39');
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      const binaryPath = forge.getBinaryPath();
      // Use path.join for OS-agnostic path comparison
      expect(binaryPath).toContain(path.join('bin', 'linux', 'arm64'));
      expect(binaryPath).toContain('forge-aarch64-unknown-linux-gnu');
    });

    test('should construct correct path for win32 x64', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      const binaryPath = forge.getBinaryPath();
      // Use path.join for OS-agnostic path comparison
      expect(binaryPath).toContain(path.join('bin', 'win32', 'x64'));
      expect(binaryPath).toContain('forge-x86_64-pc-windows-msvc.exe');
    });
  });

  describe('Edge cases and error handling', () => {
    test('should handle when ldd returns no version but getconf works', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockImplementation((cmd, args) => {
        if (cmd === 'ldd') {
          // ldd returns no version info
          return createSpawnSyncResult(0, '', 'ldd');
        }
        if (cmd === 'getconf') {
          // getconf returns version
          return createSpawnSyncResult(0, 'glibc 2.39', '');
        }
        if (cmd === 'getprop') {
          return createSpawnSyncResult(1, '', '');
        }
        return createSpawnSyncResult(1, '', '');
      });
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toContain('gnu');
    });

    test('should handle when ldd fails completely and fall back to musl', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockImplementation((cmd, args) => {
        if (cmd === 'ldd') {
          // ldd returns nothing useful
          return createSpawnSyncResult(0, '', '');
        }
        if (cmd === 'getconf') {
          // getconf also fails
          return createSpawnSyncResult(1, '', '');
        }
        if (cmd === 'getprop') {
          return createSpawnSyncResult(1, '', '');
        }
        return createSpawnSyncResult(1, '', '');
      });
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      // Should fall back to musl when no version info available (safer default)
      expect(forge.getBinaryPath()).toContain('musl');
    });

    test('should return null for unsupported platform', () => {
      Object.defineProperty(process, 'platform', { value: 'freebsd', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockReturnValue(false);

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toBeNull();
    });

    test('should return null for unsupported architecture', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'ia32', writable: true, configurable: true });

      mockSpawnSync.mockReturnValue(createSpawnSyncResult(0, '', ''));
      mockExistsSync.mockReturnValue(false);

      const forge = require('./forge.js');
      expect(forge.getBinaryPath()).toBeNull();
    });

    test('should handle getconf with no version match and fall back to musl', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockImplementation((cmd, args) => {
        if (cmd === 'ldd') {
          return createSpawnSyncResult(0, '', 'some text without version');
        }
        if (cmd === 'getconf') {
          return createSpawnSyncResult(0, 'no version here', '');
        }
        if (cmd === 'getprop') {
          return createSpawnSyncResult(1, '', '');
        }
        return createSpawnSyncResult(1, '', '');
      });
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      // Should fall back to musl when version cannot be parsed (safer default)
      expect(forge.getBinaryPath()).toContain('musl');
    });

    test('should handle spawnSync throwing error and default to gnu', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', writable: true, configurable: true });
      Object.defineProperty(process, 'arch', { value: 'x64', writable: true, configurable: true });

      mockSpawnSync.mockImplementation((cmd, args) => {
        if (cmd === 'ldd') {
          throw new Error('Command not found');
        }
        if (cmd === 'getprop') {
          return createSpawnSyncResult(1, '', '');
        }
        return createSpawnSyncResult(1, '', '');
      });
      mockExistsSync.mockImplementation(path => !path.includes('/system/build.prop'));

      const forge = require('./forge.js');
      // When error is caught, returns 'unknown' type which defaults to gnu
      expect(forge.getBinaryPath()).toContain('gnu');
    });
  });
});
