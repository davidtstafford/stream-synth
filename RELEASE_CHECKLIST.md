# Quick Release Checklist

## Pre-Release Checklist
- [ ] All features tested locally
- [ ] No console errors in DevTools
- [ ] Database migrations working
- [ ] Version number updated in `package.json`
- [ ] CHANGELOG updated (if applicable)
- [ ] All commits pushed to main

## Making a Release

### Option 1: Automatic Release (Recommended)
```bash
# 1. Update version
npm version patch  # or minor, major, etc.

# 2. Tag is created automatically, push it
git push --follow-tags

# → GitHub Actions builds everything automatically
```

### Option 2: Manual Release
```bash
# 1. Update version in package.json
# 2. Commit
git add package.json
git commit -m "Release v1.0.1"
git push origin main

# 3. Create and push tag
git tag v1.0.1
git push origin v1.0.1

# → GitHub Actions starts building
```

### Option 3: Local Build (Testing/Debug)
```bash
# macOS only
npm run dist:mac

# Windows only
npm run dist:win

# Both platforms
npm run dist:all

# Installers appear in ./release/
```

## After Release

1. **Check GitHub Actions** (Actions tab in GitHub)
   - Wait for Mac and Windows builds to complete
   - Each takes 10-15 minutes

2. **Verify Release** (Releases tab in GitHub)
   - All installers uploaded
   - Release notes generated
   - Prerelease flag set correctly (for beta/alpha)

3. **Download & Test**
   - Download installers from release
   - Test installation on both platforms
   - Verify app functions work

## Version Numbering

Use semantic versioning: `vMAJOR.MINOR.PATCH`

- `v1.0.0` - Full release
- `v1.0.1` - Bug fix release
- `v1.1.0` - New features (minor release)
- `v2.0.0` - Breaking changes (major release)
- `v1.0.0-beta.1` - Beta testing
- `v1.0.0-alpha.1` - Alpha testing

## Troubleshooting Quick Reference

| Problem | Solution |
|---------|----------|
| Build fails on macOS | Check Xcode Command Line Tools: `xcode-select --install` |
| Build fails on Windows | Install Visual C++ build tools: `npm install --global windows-build-tools` |
| GitHub Actions timeout | Workflows timeout after 360 min; usually complete in 10-15 min |
| No artifacts | Check workflow logs for specific error messages |
| Wrong files uploaded | Verify glob patterns in workflow file match actual output |

## Useful Commands

```bash
# View git tags
git tag -l

# Push all tags
git push --tags

# Delete local tag
git tag -d v1.0.0

# Delete remote tag
git push origin --delete v1.0.0

# Show current version
npm pkg get version
```

## File Locations After Build

```
release/
├── Stream\ Synth-1.0.0.dmg          (macOS installer)
├── Stream\ Synth-1.0.0.zip          (macOS portable)
├── Stream\ Synth\ Setup\ 1.0.0.exe   (Windows installer)
└── Stream\ Synth\ 1.0.0-portable.exe (Windows portable)
```

## Notes

- First build after repository setup may take 5+ minutes due to dependency installation
- Subsequent builds are faster due to npm cache
- GitHub Actions runners have 6-core CPUs, builds typically parallel efficiently
- All artifacts retained for 30 days before automatic cleanup
