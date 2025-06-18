# Code Forge CLI

Code Forge is an AI-powered coding assistant CLI that helps you write, review, and understand code.

## Installation

### Global Installation (Recommended)

You can install Code Forge globally to use it with the simple `forge` command:

```bash
npm install -g @antinomyhq/forge
```

After installation, you can run the command from anywhere:

```bash
forge --help
```

### Using npx (No Installation)

If you prefer not to install anything globally, you can use npx to run Code Forge directly:

```bash
npx @antinomyhq/forge
```

Both methods will automatically download the appropriate binary for your platform.

## Supported Platforms

- macOS (Intel, Apple Silicon)
- Linux (x64, ARM64)
- Windows (x64, ARM64)

## Usage

Once installed, you can use the `forge` command:

```bash
# If installed globally
forge --version

# Or with npx
npx @antinomyhq/forge --version
```

## Troubleshooting

### Linux glibc Compatibility Issues

If you encounter errors like:

```
/lib/x86_64-linux-gnu/libc.so.6: version `GLIBC_2.XX' not found
```

This means the binary requires a newer version of glibc than what's available on your system. You can use one of these solutions:

1. **Force using the musl binary** (recommended for environments like Codespaces):
   ```bash
   # Set environment variable to force musl before installing
   export FORCE_MUSL=1
   npm install -g @antinomyhq/forge
   ```

2. **Update your system's glibc** (if you have administrative access)

3. **Use a Docker container with a newer Linux distribution**

The musl binary has fewer system dependencies and should work on most Linux systems regardless of glibc version.

## License

MIT
