# 爱弥斯桌面宠物 🤖

A cute animated desktop robot pet that lives on your screen, wanders around, and responds to your interactions.

![爱弥斯桌面宠物](https://github.com/user-attachments/assets/04491730-b353-4ce0-8c63-387c23ff5060)

## Features

- **Animated robot character** — drawn entirely with Tkinter canvas shapes, no image assets required
- **Autonomous behavior** — randomly idles, walks left/right, and sits down on its own
- **Interactive**
  - 🖱️ **Drag** the pet anywhere on your screen with left-click
  - 🖱️ **Double-click** to make the pet do a happy dance
  - 🖱️ **Right-click** for a context menu: greet, sit, or quit
- **Always on top** — stays above other windows
- **Cross-platform** — works on Windows, macOS, and Linux (requires Python + Tkinter)

## Requirements

- Python 3.8+
- Tkinter (included with Python on Windows/macOS; on Linux: `sudo apt install python3-tk`)

## Usage

```bash
python main.py
```

## Controls

| Action | Effect |
|--------|--------|
| Left-click + drag | Move the pet |
| Double-click | Happy animation |
| Right-click | Context menu (greet / sit / quit) |

## File Structure

```
aimisiRobot/
├── main.py   # Entry point
├── pet.py    # Desktop pet logic and drawing
└── README.md
```
