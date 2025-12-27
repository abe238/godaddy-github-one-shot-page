# Nano Banana Pro Mockup Prompts

Use these prompts with Google Gemini's Nano Banana Pro (select "Thinking" model and "Create images" tool) to generate professional OS mockups for gg-deploy screenshots.

## Workflow

1. Upload the raw screenshot (e.g., `webui-main.png`)
2. Use the corresponding prompt below
3. Save output to `img/mockup-{os}-{type}.png`

---

## macOS Mockups

### Web UI Main Screen
```
Transform this screenshot into a professional macOS desktop mockup. Place it inside a Safari browser window with the rounded macOS Sequoia window chrome (traffic light buttons: red, yellow, green). The browser should be on a clean macOS desktop with the default Sequoia wallpaper (purple and blue gradient with subtle light effects). Add a subtle drop shadow under the window. The dock should be visible at the bottom with default app icons. Use 16:10 aspect ratio, photorealistic rendering, professional product photography lighting. The screenshot content should be sharp and readable.
```

### Web UI Settings Modal
```
Create a professional macOS product shot showing this settings modal screenshot. Display it in a centered Safari window on a macOS Sequoia desktop (purple-blue gradient wallpaper). The modal overlay should appear natural within the browser window. Include the macOS menu bar at top with Apple logo and time, and the dock at bottom. Soft ambient lighting, subtle window shadow, 16:10 aspect ratio, crisp 2K quality. Make the interface text readable and professional.
```

### CLI Terminal
```
Transform this terminal screenshot into an authentic macOS Terminal.app mockup. Place it in a Terminal window with the macOS Sequoia window decorations. The terminal should have the "Pro" theme (dark background with light text). Position on a clean macOS desktop with the Sequoia gradient wallpaper visible. Include the dock at bottom and menu bar at top. Professional product photography style, subtle depth of field, 16:10 aspect ratio. Keep all terminal text sharp and legible.
```

---

## Windows Mockups

### Web UI Main Screen
```
Transform this screenshot into a professional Windows 11 desktop mockup. Display it inside an Edge browser window with the Windows 11 Fluent Design window chrome (rounded corners, centered title bar buttons, Mica blur effect). The desktop should show the Windows 11 default "Bloom" wallpaper (blue flowing fabric). Include the centered Windows 11 taskbar at bottom with Start menu icon. Use 16:9 aspect ratio, clean professional lighting, subtle window shadow, product showcase quality. Keep the application content crisp and readable.
```

### Web UI Settings Modal
```
Create a Windows 11 product mockup showing this settings modal screenshot. Place it in a Microsoft Edge window on the Windows 11 Bloom wallpaper (flowing blue fabric). The modal should appear centered in the browser. Include the Windows 11 taskbar at bottom (centered icons) and the system tray. Apply the Fluent Design aesthetic with rounded corners and Mica transparency effect on the title bar. 16:9 aspect ratio, professional product photography, crisp text rendering.
```

### CLI Terminal
```
Transform this terminal screenshot into a Windows Terminal mockup. Display it in Windows Terminal with the Windows 11 Fluent Design chrome (rounded corners, Mica blur title bar). Use a dark theme that matches the screenshot content. Position on Windows 11 desktop with the Bloom wallpaper. Include the centered taskbar at bottom. Modern product photography style, 16:9 aspect ratio, ensure all terminal text remains sharp and professional.
```

---

## Linux Mockups

### Web UI Main Screen
```
Create a professional Linux desktop mockup for this screenshot. Display it in Firefox browser on Ubuntu 24.04 with the GNOME 46 desktop environment. Use the default Ubuntu Jellyfish wallpaper (orange and purple gradient). Show the top panel with activities button and system indicators, and the dock on the left side. The Firefox window should have GNOME's Adwaita window decorations (modern rounded corners). 16:9 aspect ratio, professional product shot style, realistic shadows and lighting. Keep the application interface clear and readable.
```

### Web UI Settings Modal
```
Transform this settings modal screenshot into an Ubuntu Linux desktop mockup. Place it in a Firefox window on the GNOME 46 desktop with Ubuntu Jellyfish wallpaper. Include the top panel with Ubuntu branding and the left dock with application icons. The modal should appear naturally within the browser. Apply GNOME's Adwaita styling with clean rounded corners. Professional photography quality, 16:9 aspect ratio, legible text, subtle realistic shadows.
```

### CLI Terminal
```
Create a Linux terminal mockup showing this screenshot. Display it in GNOME Terminal on Ubuntu 24.04 desktop. Use the default dark terminal theme. The window should have GNOME Adwaita decorations. Background shows the Ubuntu Jellyfish wallpaper with the left dock visible and top panel with system indicators. Professional product mockup quality, 16:9 aspect ratio, realistic lighting, all terminal text must remain sharp and readable.
```

---

## Tips for Best Results

1. **Upload the actual screenshot first** before entering the prompt
2. **Use "Thinking" model** (Nano Banana Pro) for best quality
3. **Request 2K resolution** if the initial output seems low quality
4. **Iterate**: Ask Gemini to adjust specific elements if needed
5. **Check text legibility**: The most important thing is that the app content is readable

## Output Filenames

Save the generated mockups as:
- `img/mockup-macos-webui.png`
- `img/mockup-macos-settings.png`
- `img/mockup-macos-cli.png`
- `img/mockup-windows-webui.png`
- `img/mockup-windows-settings.png`
- `img/mockup-windows-cli.png`
- `img/mockup-linux-webui.png`
- `img/mockup-linux-settings.png`
- `img/mockup-linux-cli.png`
