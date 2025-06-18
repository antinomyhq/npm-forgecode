#!/bin/bash
# Script to update the forge npm package with new binary versions

# Exit on any error, undefined variable, or pipe failure
set -euo pipefail

# Enable debug mode if DEBUG is set
if [ "${DEBUG:-}" = "true" ]; then
  set -x
fi

VERSION=$1

if [ -z "$VERSION" ]; then
    echo "Usage: ./update-package.sh <version>"
    echo ""
    echo "Environment variables:"
    echo "  NPM_TOKEN   - If set, publishes the package to npm"
    echo "  AUTO_PUSH   - If set to 'true', automatically pushes changes without confirmation (recommended for CI)"
    echo "  CI          - If set to 'true', ensures the script runs in non-interactive mode"
    echo "  DEBUG       - If set to 'true', enables bash debug mode (set -x)"
    exit 1
fi

# Set CI mode if running in CI environment
if [ "${CI:-}" = "true" ]; then
    export AUTO_PUSH="true"
    echo "CI environment detected, enabling AUTO_PUSH"
fi

# Update version in package.json
echo "Updating package.json version to $VERSION..."
npm version $VERSION --no-git-tag-version --allow-same-version || {
  echo "ERROR: Failed to update npm version" >&2
  exit 1
}

# Create bin directories if they don't exist
mkdir -p bin/darwin/arm64
mkdir -p bin/darwin/x64
mkdir -p bin/linux/arm64
mkdir -p bin/linux/x64
mkdir -p bin/win32/arm64
mkdir -p bin/win32/x64

# Download binaries from GitHub release
echo "Downloading binaries for version $VERSION..."

# Function to download with proper error handling
download_binary() {
  local url="$1"
  local output="$2"
  echo "Downloading ${output}..."
  curl -L -f -S --retry 3 "$url" -o "$output" || {
    echo "ERROR: Failed to download $url" >&2
    return 1
  }
  echo "✓ Downloaded $output"
}

# macOS
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-aarch64-apple-darwin" "bin/darwin/arm64/forge-aarch64-apple-darwin"
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-x86_64-apple-darwin" "bin/darwin/x64/forge-x86_64-apple-darwin"

# Linux (glibc)
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-aarch64-unknown-linux-gnu" "bin/linux/arm64/forge-aarch64-unknown-linux-gnu"
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-x86_64-unknown-linux-gnu" "bin/linux/x64/forge-x86_64-unknown-linux-gnu"

# Linux (musl)
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-aarch64-unknown-linux-musl" "bin/linux/arm64/forge-aarch64-unknown-linux-musl" || echo "Warning: musl variant for ARM64 not available"
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-x86_64-unknown-linux-musl" "bin/linux/x64/forge-x86_64-unknown-linux-musl" || echo "Warning: musl variant for x64 not available"

# Windows
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-aarch64-pc-windows-msvc.exe" "bin/win32/arm64/forge-aarch64-pc-windows-msvc.exe"
download_binary "https://github.com/antinomyhq/forge/releases/download/$VERSION/forge-x86_64-pc-windows-msvc.exe" "bin/win32/x64/forge-x86_64-pc-windows-msvc.exe"

# Make binaries executable
chmod +x bin/darwin/arm64/forge-aarch64-apple-darwin
chmod +x bin/darwin/x64/forge-x86_64-apple-darwin
chmod +x bin/linux/arm64/forge-aarch64-unknown-linux-gnu
chmod +x bin/linux/x64/forge-x86_64-unknown-linux-gnu
# Make musl binaries executable if they exist
if [ -f bin/linux/arm64/forge-aarch64-unknown-linux-musl ]; then
    chmod +x bin/linux/arm64/forge-aarch64-unknown-linux-musl
fi
if [ -f bin/linux/x64/forge-x86_64-unknown-linux-musl ]; then
    chmod +x bin/linux/x64/forge-x86_64-unknown-linux-musl
fi

echo "Binaries downloaded and prepared for npm package"

# Publish to npm if NPM_TOKEN is available
if [ -n "${NPM_TOKEN:-}" ]; then
    echo "Publishing to npm..."
    echo "//registry.npmjs.org/:_authToken=$NPM_TOKEN" > .npmrc
    npm publish --access public || { 
      echo "ERROR: Failed to publish to npm" >&2
      rm -f .npmrc
      exit 1
    }
    rm -f .npmrc
    echo "✓ Package published to npm"
else
    echo "NPM_TOKEN not set, skipping publish"
fi

# Configure git for CI if needed
if [ "${CI:-}" = "true" ]; then
    # Setup git identity for CI
    git config --global user.name "CI Bot" || echo "Warning: Could not set git user name"
    git config --global user.email "ci@example.com" || echo "Warning: Could not set git user email"
    # Disable interactive prompts
    git config --global core.editor "cat"
fi

# Commit changes and push to git
echo "Committing changes to git..."
git add package.json bin/ || { echo "ERROR: Failed to stage files for commit" >&2; exit 1; }
git commit -m "Update package to version $VERSION" || { echo "ERROR: Failed to commit changes" >&2; exit 1; }
git tag -a "v$VERSION" -m "Release v$VERSION" || { echo "ERROR: Failed to create tag" >&2; exit 1; }

# Determine current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD) || {
  echo "ERROR: Failed to determine current branch" >&2
  exit 1
}

# Check if we should automatically push (useful for CI/CD)
if [ "${AUTO_PUSH:-}" == "true" ]; then
    echo "AUTO_PUSH is enabled. Pushing changes to origin/$CURRENT_BRANCH..."
    git push origin "$CURRENT_BRANCH" || { 
      echo "ERROR: Failed to push commits to origin/$CURRENT_BRANCH" >&2
      exit 1
    }
    git push origin --tags || { 
      echo "ERROR: Failed to push tags to origin" >&2
      exit 1
    }
    echo "✓ Changes committed and pushed to git"
else
    # Ask for confirmation before pushing (only in interactive mode)
    if [ "${CI:-}" = "true" ]; then
      echo "CI environment detected but AUTO_PUSH not enabled. Skipping push."
      echo "Changes committed locally. Remember to push manually."
    else
      read -p "Push changes to origin/$CURRENT_BRANCH? (y/n): " PUSH_CONFIRM
      if [ "$PUSH_CONFIRM" == "y" ] || [ "$PUSH_CONFIRM" == "Y" ]; then
          echo "Pushing changes to origin/$CURRENT_BRANCH..."
          git push origin "$CURRENT_BRANCH" || { 
            echo "ERROR: Failed to push commits to origin/$CURRENT_BRANCH" >&2
            exit 1
          }
          git push origin --tags || { 
            echo "ERROR: Failed to push tags to origin" >&2
            exit 1
          }
          echo "✓ Changes committed and pushed to git"
      else
          echo "Changes committed locally. Use git push when ready."
      fi
    fi
fi

echo "✓ All operations completed successfully for version $VERSION"
exit 0