# Build Assets

This directory contains application icons and images for the installer.

## Required Files

For a complete build, optionally add:

### Icon Files (optional but recommended)

Place in this directory:

- **macOS**: `icon.icns` (1024x1024+)
  - Convert from PNG: `iconutil -c icns icon.png -o icon.icns`

- **Windows**: `icon.ico` (256x256+)
  - Convert from PNG or use online converter

### Installer Background (optional)

- **macOS DMG**: `background.png` (920x600+)
- **Windows NSIS**: `banner.bmp` (150x57)

## How to Create Icons

### From PNG to ICNS (macOS):
```bash
# Requires imagemagick
convert icon.png -define icon:auto-resize=256,128,96,64,48,32,16 icon.icns
```

### From PNG to ICO (Windows):
```bash
# Online tools: icoconvert.com, convertico.com, etc.
# Or use imagemagick:
convert icon.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
```

## Notes

- Electron Builder will use default Electron icons if these are not provided
- To use custom icons, uncomment the `icon` field in `build` config in `package.json`
- Ensure icons are at least 256x256 pixels for quality
