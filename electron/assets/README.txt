ICON ASSETS
===========

Replace these files with your actual branded icons before building:

  icon.ico      — Windows app icon (256x256, multi-resolution ICO)
                  Used for: installer, taskbar, window title bar
                  Required for: npm run build:win

  tray-icon.png — System tray icon (16x16 or 32x32 PNG, ideally transparent bg)
                  Used for: Windows system tray notification area

HOW TO CREATE icon.ico
-----------------------
1. Start with a 512x512 PNG of your logo
2. Use https://www.icoconverter.com/ or ImageMagick:
   magick convert logo.png -define icon:auto-resize=256,128,64,48,32,16 icon.ico
3. Place the .ico file in this folder

QUICK METHOD (no design needed)
---------------------------------
Copy client/public/logo.png into this folder and rename it, then convert:
   magick convert "../../../client/public/logo.png" -resize 256x256 icon.ico

The tray-icon.png currently in this folder is a placeholder gradient.
Replace it with a 32x32 version of your logo PNG (transparent background recommended).
