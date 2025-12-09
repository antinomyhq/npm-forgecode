// Test helper to set platform and architecture
const setPlatformAndArch = (platform, arch) => {
  Object.defineProperty(process, 'platform', { value: platform, writable: true, configurable: true });
  Object.defineProperty(process, 'arch', { value: arch, writable: true, configurable: true });
};

describe('install.js - Basic Compatibility Check', () => {
  let originalPlatform;
  let originalArch;
  let consoleLogSpy;
  let consoleWarnSpy;

  beforeAll(() => {
    originalPlatform = process.platform;
    originalArch = process.arch;
  });

  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
  });

  afterAll(() => {
    setPlatformAndArch(originalPlatform, originalArch);
  });

  describe('Platform and Architecture Support', () => {
    const supportedCombinations = [
      { platform: 'darwin', arch: 'x64', description: 'macOS x64' },
      { platform: 'darwin', arch: 'arm64', description: 'macOS ARM64' },
      { platform: 'linux', arch: 'x64', description: 'Linux x64' },
      { platform: 'linux', arch: 'arm64', description: 'Linux ARM64' },
      { platform: 'win32', arch: 'x64', description: 'Windows x64' },
      { platform: 'win32', arch: 'arm64', description: 'Windows ARM64' },
    ];

    supportedCombinations.forEach(({ platform, arch, description }) => {
      test(`should support ${description}`, () => {
        setPlatformAndArch(platform, arch);
        
        // Clear module cache and require install.js
        jest.resetModules();
        require('./install.js');

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('System compatible')
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('Forge installed successfully')
        );
      });
    });

    test('should warn on unsupported platform', () => {
      setPlatformAndArch('freebsd', 'x64');
      
      jest.resetModules();
      require('./install.js');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Platform 'freebsd' might not be supported")
      );
    });

    test('should warn on unsupported architecture', () => {
      setPlatformAndArch('darwin', 'ia32');
      
      jest.resetModules();
      require('./install.js');

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Architecture 'ia32'")
      );
    });
  });

  describe('Install Output', () => {
    test('should display installation message', () => {
      setPlatformAndArch('darwin', 'arm64');
      
      jest.resetModules();
      require('./install.js');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Installing forge for darwin/arm64')
      );
    });

    test('should display success message', () => {
      setPlatformAndArch('linux', 'x64');
      
      jest.resetModules();
      require('./install.js');

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining("Forge installed successfully")
      );
    });
  });
});
