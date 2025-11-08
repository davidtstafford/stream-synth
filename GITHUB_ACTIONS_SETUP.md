# Stream Synth - GitHub Actions Build Setup Complete! 🚀

## What's Been Set Up

You now have a fully automated build and release system for Stream Synth with GitHub Actions!

### Files Created

1. **GitHub Actions Workflows** (`.github/workflows/`)
   - `build-mac.yml` - Builds macOS installers
   - `build-windows.yml` - Builds Windows installers  
   - `build-all.yml` - Builds both + creates release

2. **Documentation**
   - `BUILD_AND_RELEASE.md` - Comprehensive build guide
   - `RELEASE_CHECKLIST.md` - Quick reference for releases
   - `assets/README.md` - Guide for creating custom icons

3. **Configuration**
   - Updated `package.json` with electron-builder config
   - Build scripts: `npm run dist:mac`, `npm run dist:win`, `npm run dist:all`

## How It Works

### When You Push to Main or Create a Tag
1. GitHub Actions automatically triggers
2. macOS runner builds DMG + ZIP installers
3. Windows runner builds NSIS + portable EXE installers
4. Artifacts stored for 30 days

### When You Create a Version Tag (v1.0.0, etc.)
1. All builds complete (same as above)
2. GitHub Release created automatically
3. All installers attached to release
4. Release notes auto-generated

## Quick Start

### Build Locally
```bash
# Install dependencies first
npm ci

# Build for macOS
npm run dist:mac

# Build for Windows (requires Windows or WSL)
npm run dist:win

# Build both
npm run dist:all

# Installers appear in ./release/
```

### Create a Release
```bash
# Option 1: Using npm version (recommended)
npm version patch  # or minor, major
git push --follow-tags

# Option 2: Manual
git tag v1.0.0
git push origin v1.0.0

# → GitHub Actions builds everything automatically!
```

## What Gets Built

### macOS
- **DMG**: Standard Mac installer
- **ZIP**: Portable archive for distribution

### Windows
- **NSIS Installer**: Standard Windows installer with uninstaller
- **Portable EXE**: Standalone executable, no installation needed

## Workflow Triggers

The workflows run on:
1. **Push to main branch** - Builds artifacts (no release created)
2. **Tag push** (v*) - Builds + creates GitHub Release
3. **Manual trigger** - Via GitHub Actions "Run workflow" button

## GitHub Secrets (Optional)

For code signing (requires paid certificates):

```yaml
# macOS Code Signing
APPLE_ID: your-apple-id@example.com
APPLE_PASSWORD: app-specific-password
APPLE_TEAM_ID: XXXXXXXXXX

# Windows Code Signing  
WINDOWS_SIGN_CERTIFICATE: base64-encoded-cert
WINDOWS_SIGN_PASSWORD: certificate-password
```

## File Size Estimates

- macOS DMG: 200-300 MB
- macOS ZIP: 150-250 MB
- Windows NSIS: 200-300 MB
- Windows Portable: 180-250 MB

## Important Notes

### First Release
- First build will take 15-20 minutes (installing dependencies)
- Subsequent builds faster due to GitHub Actions cache

### Node Version
- Using Node 20 LTS (compatible with Electron 35)
- Adjust in workflow files if needed

### Dependencies
- `better-sqlite3` requires native compilation (handled by `postinstall` script)
- All platform-specific dependencies handled automatically

### Database
- SQLite database stored in user data directory
- Not included in installers (user keeps their data)

## Testing the Workflow

### 1. Test Build (no release)
```bash
git add .
git commit -m "Setup build system"
git push origin main
# → Check GitHub Actions tab for build
```

### 2. Create Test Release
```bash
git tag v1.0.0
git push origin v1.0.0
# → GitHub Actions builds + creates release
# → Check Releases tab
```

## Troubleshooting

### Build Fails
1. Check workflow logs: Actions tab → click failed workflow
2. Common issues:
   - Node modules not installing (check network)
   - TypeScript compilation errors (fix in code)
   - Missing dependencies in package.json

### Artifacts Not Uploaded
- Check that glob patterns in workflow match output files
- Verify `npm run dist:mac` or `dist:win` produces files
- Check `release/` directory naming

### GitHub Release Not Created
- Must use a tag starting with `v` (e.g., v1.0.0)
- Check `create-release` job logs
- Verify `GITHUB_TOKEN` is available (automatically provided)

## Next Steps

1. **Commit these files**:
   ```bash
   git add .github/ package.json *.md .gitignore
   git commit -m "Add GitHub Actions build workflows"
   git push origin main
   ```

2. **Monitor the first build**:
   - Go to GitHub repository
   - Click "Actions" tab
   - Watch workflows complete

3. **Create your first release**:
   ```bash
   npm version patch
   git push --follow-tags
   ```

4. **Download and test installers**:
   - Go to Releases tab
   - Download installers
   - Test on both platforms

## Architecture

```
User pushes code
        ↓
GitHub detects push/tag
        ↓
Workflow runs on Mac & Windows runners (parallel)
        ↓
npm install & npm run build (compile TypeScript/Webpack)
        ↓
npm run dist:mac/dist:win (electron-builder)
        ↓
Installers created
        ↓
If tag: Create GitHub Release
If not: Just save artifacts
        ↓
Users can download installers
```

## Resources

- **Electron Builder Docs**: https://www.electron.build/
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Code Signing Guide**: https://www.electron.build/code-signing

## Support

For issues:
1. Check GitHub Actions logs
2. Run `npm run dist:mac` or `dist:win` locally
3. Review error messages carefully
4. Check electron-builder documentation

---

**Setup completed!** Your Stream Synth project is now ready for automated releases! 🎉
