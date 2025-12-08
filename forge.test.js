// Mock modules
const mockSpawn = jest.fn();
const mockExistsSync = jest.fn();

jest.mock('child_process', () => ({
  spawn: mockSpawn,
}));

jest.mock('fs', () => ({
  existsSync: mockExistsSync,
}));

jest.mock('path', () => ({
  join: (...args) => args.join('/'),
}));

describe('forge.js - Binary Launcher', () => {
  let originalPlatform;
  let originalArch;
  let originalArgv;
  let consoleErrorSpy;
  let processExitSpy;
  let processOnSpy;
  let mockForgeProcess;

  beforeEach(() => {
    // Store original values
    originalPlatform = process.platform;
    originalArch = process.arch;
    originalArgv = [...process.argv];

    // Mock console and process methods
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('process.exit called');
    });
    processOnSpy = jest.spyOn(process, 'on').mockImplementation((event, handler) => {
      // Store handlers for testing but don't actually register them
      return process;
    });

    // Create mock forge process
    mockForgeProcess = {
      kill: jest.fn(),
      on: jest.fn((event, handler) => mockForgeProcess),
    };

    // Reset all mocks
    jest.clearAllMocks();
    mockSpawn.mockReset();
    mockExistsSync.mockReset();
    mockSpawn.mockReturnValue(mockForgeProcess);

    // Clear the module cache
    jest.resetModules();
  });

  afterEach(() => {
    // Restore original values
    Object.defineProperty(process, 'platform', { value: originalPlatform, writable: true, configurable: true });
    Object.defineProperty(process, 'arch', { value: originalArch, writable: true, configurable: true });
    process.argv = originalArgv;

    // Restore spies
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    processOnSpy.mockRestore();
  });

  const setPlatformAndArch = (platform, arch) => {
    Object.defineProperty(process, 'platform', { value: platform, writable: true, configurable: true });
    Object.defineProperty(process, 'arch', { value: arch, writable: true, configurable: true });
  };

  const requireForge = () => {
    try {
      require('./forge.js');
    } catch (e) {
      // Catch process.exit throws
      if (!e.message.includes('process.exit called')) {
        throw e;
      }
    }
  };

  describe('Binary Path Resolution', () => {
    test('should use .exe extension on Windows', () => {
      setPlatformAndArch('win32', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      expect(mockExistsSync).toHaveBeenCalledWith(expect.stringContaining('forge.exe'));
    });

    test('should not use .exe extension on macOS', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const calls = mockExistsSync.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toMatch(/\/forge$/);
    });

    test('should not use .exe extension on Linux', () => {
      setPlatformAndArch('linux', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const calls = mockExistsSync.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
      expect(calls[0][0]).toMatch(/\/forge$/);
    });
  });

  describe('Binary Existence Check', () => {
    test('should exit with error when binary does not exist', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(false);

      requireForge();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Forge binary not found')
      );
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('npm install -g forgecode')
      );
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should include platform info in error message', () => {
      setPlatformAndArch('linux', 'arm64');
      mockExistsSync.mockReturnValue(false);

      requireForge();

      const errorCalls = consoleErrorSpy.mock.calls.map(call => call[0]).join(' ');
      expect(errorCalls).toContain('linux');
      expect(errorCalls).toContain('arm64');
    });
  });

  describe('Process Spawning', () => {
    test('should spawn forge process with correct arguments', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);
      process.argv = ['node', 'forge.js', 'build', '--watch'];

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('forge'),
        ['build', '--watch'],
        expect.objectContaining({ stdio: 'inherit' })
      );
    });

    test('should pass empty arguments array when no arguments provided', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);
      process.argv = ['node', 'forge.js'];

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('forge'),
        [],
        expect.objectContaining({ stdio: 'inherit' })
      );
    });

    test('should pass multiple arguments correctly', () => {
      setPlatformAndArch('linux', 'x64');
      mockExistsSync.mockReturnValue(true);
      process.argv = ['node', 'forge.js', 'test', '--verbose', '--coverage'];

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.stringContaining('forge'),
        ['test', '--verbose', '--coverage'],
        expect.any(Object)
      );
    });

    test('should use stdio: inherit for spawn options', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ stdio: 'inherit' })
      );
    });
  });

  describe('Signal Handling - SIGINT', () => {
    test('should kill forge process on SIGINT for Unix platforms', () => {
      setPlatformAndArch('linux', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      // Find the SIGINT handler
      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();
      
      const sigintHandler = sigintCall[1];
      sigintHandler();

      expect(mockForgeProcess.kill).toHaveBeenCalledWith('SIGINT');
    });

    test('should not kill forge process on SIGINT for Windows', () => {
      setPlatformAndArch('win32', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      expect(sigintCall).toBeDefined();
      
      const sigintHandler = sigintCall[1];
      sigintHandler();

      expect(mockForgeProcess.kill).not.toHaveBeenCalled();
    });

    test('should handle SIGINT on macOS', () => {
      setPlatformAndArch('darwin', 'arm64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const sigintCall = processOnSpy.mock.calls.find(call => call[0] === 'SIGINT');
      const sigintHandler = sigintCall[1];
      sigintHandler();

      expect(mockForgeProcess.kill).toHaveBeenCalledWith('SIGINT');
    });
  });

  describe('Process Exit Handling', () => {
    test('should exit with same code as forge process', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const exitCall = mockForgeProcess.on.mock.calls.find(call => call[0] === 'exit');
      expect(exitCall).toBeDefined();
      
      const exitHandler = exitCall[1];
      
      processExitSpy.mockClear();
      try {
        exitHandler(0);
      } catch (e) {
        // Expected to throw from process.exit
      }
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('should exit with error code when forge process fails', () => {
      setPlatformAndArch('linux', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const exitCall = mockForgeProcess.on.mock.calls.find(call => call[0] === 'exit');
      const exitHandler = exitCall[1];

      processExitSpy.mockClear();
      try {
        exitHandler(1);
      } catch (e) {
        // Expected to throw from process.exit
      }
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should not exit when code is null', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const exitCall = mockForgeProcess.on.mock.calls.find(call => call[0] === 'exit');
      const exitHandler = exitCall[1];

      processExitSpy.mockClear();
      exitHandler(null);
      expect(processExitSpy).not.toHaveBeenCalled();
    });

    test('should handle various exit codes', () => {
      setPlatformAndArch('linux', 'x64');
      mockExistsSync.mockReturnValue(true);

      requireForge();

      const exitCall = mockForgeProcess.on.mock.calls.find(call => call[0] === 'exit');
      const exitHandler = exitCall[1];

      const exitCodes = [0, 1, 2, 127, 130];

      exitCodes.forEach(code => {
        processExitSpy.mockClear();
        try {
          exitHandler(code);
        } catch (e) {
          // Expected to throw from process.exit
        }
        expect(processExitSpy).toHaveBeenCalledWith(code);
      });
    });
  });

  describe('Cross-Platform Compatibility', () => {
    const platforms = [
      { platform: 'darwin', arch: 'x64' },
      { platform: 'darwin', arch: 'arm64' },
      { platform: 'linux', arch: 'x64' },
      { platform: 'linux', arch: 'arm64' },
      { platform: 'win32', arch: 'x64' },
      { platform: 'win32', arch: 'arm64' },
    ];

    platforms.forEach(({ platform, arch }) => {
      test(`should work on ${platform}/${arch}`, () => {
        setPlatformAndArch(platform, arch);
        mockExistsSync.mockReturnValue(true);

        requireForge();

        expect(mockSpawn).toHaveBeenCalled();
        expect(mockForgeProcess.on).toHaveBeenCalledWith('exit', expect.any(Function));
      });
    });
  });

  describe('Edge Cases', () => {
    test('should handle arguments with special characters', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);
      process.argv = ['node', 'forge.js', 'echo', 'hello world', '--message="test"'];

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['echo', 'hello world', '--message="test"'],
        expect.any(Object)
      );
    });

    test('should handle empty string arguments', () => {
      setPlatformAndArch('linux', 'x64');
      mockExistsSync.mockReturnValue(true);
      process.argv = ['node', 'forge.js', ''];

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        [''],
        expect.any(Object)
      );
    });

    test('should handle arguments with dashes', () => {
      setPlatformAndArch('darwin', 'x64');
      mockExistsSync.mockReturnValue(true);
      process.argv = ['node', 'forge.js', '--', '--help'];

      requireForge();

      expect(mockSpawn).toHaveBeenCalledWith(
        expect.any(String),
        ['--', '--help'],
        expect.any(Object)
      );
    });
  });
});
