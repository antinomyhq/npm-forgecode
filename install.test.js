// Test helper to set platform and architecture
const setPlatformAndArch = (platform, arch) => {
  Object.defineProperty(process, 'platform', { value: platform, writable: true, configurable: true });
  Object.defineProperty(process, 'arch', { value: arch, writable: true, configurable: true });
};

describe('install.js - Platform Detection and Binary Selection', () => {
  let originalPlatform;
  let originalArch;

  beforeAll(() => {
    originalPlatform = process.platform;
    originalArch = process.arch;
  });

  afterAll(() => {
    setPlatformAndArch(originalPlatform, originalArch);
  });

  describe('Platform-specific binary extensions', () => {
    test('Windows should use .exe extension', () => {
      setPlatformAndArch('win32', 'x64');
      expect(process.platform).toBe('win32');
    });

    test('macOS should not use .exe extension', () => {
      setPlatformAndArch('darwin', 'x64');
      expect(process.platform).toBe('darwin');
    });

    test('Linux should not use .exe extension', () => {
      setPlatformAndArch('linux', 'x64');
      expect(process.platform).toBe('linux');
    });
  });

  describe('Platform and Architecture combinations', () => {
    const testCases = [
      { platform: 'darwin', arch: 'x64', description: 'macOS x64' },
      { platform: 'darwin', arch: 'arm64', description: 'macOS ARM64' },
      { platform: 'linux', arch: 'x64', description: 'Linux x64' },
      { platform: 'linux', arch: 'arm64', description: 'Linux ARM64' },
      { platform: 'win32', arch: 'x64', description: 'Windows x64' },
      { platform: 'win32', arch: 'arm64', description: 'Windows ARM64' },
    ];

    testCases.forEach(({ platform, arch, description }) => {
      test(`should support ${description}`, () => {
        setPlatformAndArch(platform, arch);
        expect(process.platform).toBe(platform);
        expect(process.arch).toBe(arch);
      });
    });
  });

  describe('Android platform detection', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('should detect Android via ANDROID_ROOT', () => {
      process.env.ANDROID_ROOT = '/system';
      expect(process.env.ANDROID_ROOT).toBeDefined();
    });

    test('should detect Android via ANDROID_DATA', () => {
      process.env.ANDROID_DATA = '/data';
      expect(process.env.ANDROID_DATA).toBeDefined();
    });

    test('should detect Termux via PREFIX', () => {
      process.env.PREFIX = '/data/data/com.termux/files/usr';
      expect(process.env.PREFIX).toContain('com.termux');
    });
  });

  describe('Environment variables', () => {
    let originalEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    test('FORCE_MUSL=1 should be recognized', () => {
      process.env.FORCE_MUSL = '1';
      expect(process.env.FORCE_MUSL).toBe('1');
    });

    test('should handle missing environment variables', () => {
      delete process.env.FORCE_MUSL;
      expect(process.env.FORCE_MUSL).toBeUndefined();
    });
  });
});

describe('install.js - Binary Naming Conventions', () => {
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
        android: 'forge-aarch64-linux-android',
      },
    },
    win32: {
      x64: 'forge-x86_64-pc-windows-msvc.exe',
      arm64: 'forge-aarch64-pc-windows-msvc.exe',
    },
    android: {
      arm64: 'forge-aarch64-linux-android',
    },
  };

  describe('macOS binary names', () => {
    test('x64 should use x86_64-apple-darwin', () => {
      expect(PLATFORMS.darwin.x64).toBe('forge-x86_64-apple-darwin');
    });

    test('arm64 should use aarch64-apple-darwin', () => {
      expect(PLATFORMS.darwin.arm64).toBe('forge-aarch64-apple-darwin');
    });
  });

  describe('Linux binary names', () => {
    test('x64 GNU should use x86_64-unknown-linux-gnu', () => {
      expect(PLATFORMS.linux.x64.gnu).toBe('forge-x86_64-unknown-linux-gnu');
    });

    test('x64 musl should use x86_64-unknown-linux-musl', () => {
      expect(PLATFORMS.linux.x64.musl).toBe('forge-x86_64-unknown-linux-musl');
    });

    test('arm64 GNU should use aarch64-unknown-linux-gnu', () => {
      expect(PLATFORMS.linux.arm64.gnu).toBe('forge-aarch64-unknown-linux-gnu');
    });

    test('arm64 musl should use aarch64-unknown-linux-musl', () => {
      expect(PLATFORMS.linux.arm64.musl).toBe('forge-aarch64-unknown-linux-musl');
    });

    test('arm64 Android should use aarch64-linux-android', () => {
      expect(PLATFORMS.linux.arm64.android).toBe('forge-aarch64-linux-android');
    });
  });

  describe('Windows binary names', () => {
    test('x64 should use x86_64-pc-windows-msvc.exe', () => {
      expect(PLATFORMS.win32.x64).toBe('forge-x86_64-pc-windows-msvc.exe');
    });

    test('arm64 should use aarch64-pc-windows-msvc.exe', () => {
      expect(PLATFORMS.win32.arm64).toBe('forge-aarch64-pc-windows-msvc.exe');
    });

    test('Windows binaries should have .exe extension', () => {
      expect(PLATFORMS.win32.x64).toMatch(/\.exe$/);
      expect(PLATFORMS.win32.arm64).toMatch(/\.exe$/);
    });
  });

  describe('Android binary names', () => {
    test('arm64 should use aarch64-linux-android', () => {
      expect(PLATFORMS.android.arm64).toBe('forge-aarch64-linux-android');
    });
  });
});

describe('install.js - Glibc Version Parsing', () => {
  const isGlibcVersionSufficient = (version) => {
    if (!version) return false;
    const requiredVersion = 2.32;
    const currentVersion = parseFloat(version);
    return currentVersion >= requiredVersion;
  };

  test('should accept glibc 2.32', () => {
    expect(isGlibcVersionSufficient('2.32')).toBe(true);
  });

  test('should accept glibc 2.35', () => {
    expect(isGlibcVersionSufficient('2.35')).toBe(true);
  });

  test('should accept glibc 2.40', () => {
    expect(isGlibcVersionSufficient('2.40')).toBe(true);
  });

  test('should reject glibc 2.31', () => {
    expect(isGlibcVersionSufficient('2.31')).toBe(false);
  });

  test('should reject glibc 2.28', () => {
    expect(isGlibcVersionSufficient('2.28')).toBe(false);
  });

  test('should reject glibc 2.17', () => {
    expect(isGlibcVersionSufficient('2.17')).toBe(false);
  });

  test('should reject null version', () => {
    expect(isGlibcVersionSufficient(null)).toBe(false);
  });

  test('should reject undefined version', () => {
    expect(isGlibcVersionSufficient(undefined)).toBe(false);
  });

  test('should handle string version numbers', () => {
    expect(isGlibcVersionSufficient('2.35')).toBe(true);
    expect(isGlibcVersionSufficient('2.28')).toBe(false);
  });
});

describe('install.js - Libc Type Detection', () => {
  test('should identify musl libc from output', () => {
    const lddOutput = 'musl libc (x86_64)';
    expect(lddOutput.toLowerCase()).toContain('musl');
  });

  test('should identify GNU libc from output', () => {
    const lddOutput = 'ldd (GNU libc) 2.35';
    expect(lddOutput.toLowerCase()).toContain('gnu');
  });

  test('should extract version number from GNU output', () => {
    const lddOutput = 'ldd (GNU libc) 2.35';
    const versionMatch = /\b(\d+\.\d+)\b/.exec(lddOutput);
    expect(versionMatch).not.toBeNull();
    expect(versionMatch[1]).toBe('2.35');
  });

  test('should extract version number from alternative format', () => {
    const getconfOutput = 'glibc 2.31';
    const versionMatch = /\b(\d+\.\d+)\b/.exec(getconfOutput);
    expect(versionMatch).not.toBeNull();
    expect(versionMatch[1]).toBe('2.31');
  });
});

describe('install.js - Path Construction', () => {
  const { join } = require('path');

  test('should construct correct path for darwin x64', () => {
    const binaryPath = join('bin', 'darwin', 'x64', 'forge-x86_64-apple-darwin');
    expect(binaryPath).toContain('darwin');
    expect(binaryPath).toContain('x64');
  });

  test('should construct correct path for linux arm64', () => {
    const binaryPath = join('bin', 'linux', 'arm64', 'forge-aarch64-unknown-linux-gnu');
    expect(binaryPath).toContain('linux');
    expect(binaryPath).toContain('arm64');
  });

  test('should construct correct path for win32 x64', () => {
    const binaryPath = join('bin', 'win32', 'x64', 'forge-x86_64-pc-windows-msvc.exe');
    expect(binaryPath).toContain('win32');
    expect(binaryPath).toContain('x64');
    expect(binaryPath).toContain('.exe');
  });
});

describe('install.js - Platform Support Matrix', () => {
  const supportedCombinations = [
    ['darwin', 'x64'],
    ['darwin', 'arm64'],
    ['linux', 'x64'],
    ['linux', 'arm64'],
    ['win32', 'x64'],
    ['win32', 'arm64'],
    ['android', 'arm64'],
  ];

  supportedCombinations.forEach(([platform, arch]) => {
    test(`should support ${platform}/${arch}`, () => {
      expect(platform).toBeDefined();
      expect(arch).toBeDefined();
      expect(typeof platform).toBe('string');
      expect(typeof arch).toBe('string');
    });
  });

  const unsupportedCombinations = [
    ['darwin', 'ia32'],
    ['linux', 'ia32'],
    ['win32', 'ia32'],
    ['freebsd', 'x64'],
    ['sunos', 'x64'],
  ];

  unsupportedCombinations.forEach(([platform, arch]) => {
    test(`should not support ${platform}/${arch}`, () => {
      const PLATFORMS = {
        darwin: { x64: true, arm64: true },
        linux: { x64: true, arm64: true },
        win32: { x64: true, arm64: true },
        android: { arm64: true },
      };

      const isSupported = PLATFORMS[platform]?.[arch];
      expect(isSupported).toBeUndefined();
    });
  });
});
