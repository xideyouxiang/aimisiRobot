"""
爱弥斯桌面宠物 (Aimis Desktop Pet)
Entry point for the desktop pet application.

Usage:
    python main.py
"""

import tkinter as tk
from pet import DesktopPet


def main():
    root = tk.Tk()
    root.title("爱弥斯桌面宠物")
    pet = DesktopPet(root)
    root.mainloop()


if __name__ == "__main__":
    main()
