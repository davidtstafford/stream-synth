# Stream Synth - Build and Release Guide

## Overview

This guide explains how to build and release Stream Synth installers for macOS and Windows using GitHub Actions.

## Local Build

To build installers locally:

### Build for macOS:
```bash
npm run dist:mac
```
Output: DMG and ZIP files in `release/` directory

### Build for Windows:
```bash
npm run dist:win
```
Output: NSIS installer and portable EXE in `release/` directory

### Build for both platforms:
```bash
npm run dist:all
```

## GitHub Actions Workflows

Three workflows are configured:

### 1. `build-mac.yml` - macOS Only
- **Trigger**: Push to `main` or tag push (v*)
- **Runs on**: macOS Latest
- **Output**: 
  - `.dmg` (standard installer)
  - `.zip` (portable archive)
- **Artifacts**: Stored for 30 days

### 2. `build-windows.yml` - Windows Only
- **Trigger**: Push to `main` or tag push (v*)
- **Runs on**: Windows Latest
- **Output**:
  - `.exe` (NSIS installer)
  - `-portable.exe` (standalone executable)
- **Artifacts**: Stored for 30 days

### 3. `build-all.yml` - Recommended for Releases
- **Trigger**: Push to `main` or tag push (v*)
- **Parallel builds**: Both Mac and Windows build simultaneously
- **Release creation**: Automatically creates GitHub release with all installers
- **Prerelease detection**: Tags with `beta` or `alpha` are marked as prerelease

## Release Process

### To create a release:

1. **Update version** in `package.json`:
   ```json
   "version": "1.0.1"
   ```

2. **Commit and push to main**:
   ```bash
   git add package.json
   git commit -m "Release v1.0.1"
   git push origin main
   ```

3. **Create a git tag**:
   ```bash
   git tag v1.0.1
   git push origin v1.0.1
   ```

4. **GitHub Actions automatically**:
   - Builds macOS DMG and ZIP
   - Builds Windows NSIS and portable EXE
   - Creates GitHub release with all installers
   - Uploads release notes automatically

### For beta/alpha releases:

Use tags like `v1.0.0-beta`, `v1.0.0-alpha` - they'll automatically be marked as prerelease.

## File Structure

```
stream-synth/
├── .github/
│   └── workflows/
│       ├── build-mac.yml
│       ├── build-windows.yml
│       └── build-all.yml
├── dist/              (compiled output)
├── release/           (built installers)
├── src/
├── package.json       (with build config)
└── electron-builder config (in package.json)
```

## Build Configuration

The build configuration in `package.json` includes:

### macOS:
- **Formats**: DMG (installer) and ZIP (portable)
- **Features**:
  - Hardened runtime enabled
  - Gatekeeper assessment disabled
  - Code signing ready (configure via GitHub secrets if needed)

### Windows:
- **Formats**: NSIS installer and portable EXE
- **Features**:
  - Custom installer directory option
  - Desktop shortcuts
  - Start menu shortcuts
  - Code signing ready (configure via GitHub secrets if needed)

## Code Signing (Optional)

To enable code signing:

### macOS:
1. Create a provisioning profile and certificate in Apple Developer
2. Add GitHub Secrets:
   - `APPLE_ID`: Your Apple ID
   - `APPLE_PASSWORD`: App-specific password
   - `APPLE_TEAM_ID`: Your team ID
3. Update `build-mac.yml` to enable notarization

### Windows:
1. Obtain an EV code signing certificate
2. Add GitHub Secret:
   - `WINDOWS_SIGN_CERTIFICATE`: Base64-encoded certificate
   - `WINDOWS_SIGN_PASSWORD`: Certificate password
3. Update build configuration to use certificate

## Troubleshooting

### Build fails locally:
```bash
npm ci                    # Clean install dependencies
npm run build            # Rebuild TypeScript/webpack
npm run dist:mac         # Try building again
```

### Missing dependencies on Windows:
Windows builds may need Visual C++ build tools installed:
```bash
npm install --global windows-build-tools
```

### GitHub Actions fails:
1. Check the workflow logs in GitHub Actions tab
2. Ensure `.github/workflows/` files are committed and pushed
3. Verify `package.json` is valid JSON
4. Check that all dependencies install successfully

## Automatic Updates

To add auto-update functionality later:
1. Install `electron-updater`: `npm install electron-updater`
2. Configure in main process to check releases
3. Host installers on GitHub releases or S3

## Supported Platforms

- **macOS**: 10.13+
- **Windows**: 7+

## File Sizes (Approximate)

- macOS DMG: ~200-300 MB
- macOS ZIP: ~150-250 MB
- Windows NSIS: ~200-300 MB
- Windows Portable: ~180-250 MB
