"""
爱弥斯桌面宠物 (Aimis Desktop Pet)
A cute animated desktop pet that roams around your screen.
"""

import tkinter as tk
import random
import math


# Animation frame data for the robot character
# Each frame is a list of drawing commands: (shape, color, coords, kwargs)
FRAMES = {
    "idle": [
        # idle has 2 frames with slight breathing animation
        [
            ("body",),
            ("eyes_open",),
            ("antenna_neutral",),
        ],
        [
            ("body",),
            ("eyes_open",),
            ("antenna_neutral",),
            ("blink",),
        ],
    ],
    "walk_right": [
        [("body",), ("eyes_open",), ("antenna_right",), ("legs_step1",)],
        [("body",), ("eyes_open",), ("antenna_right",), ("legs_step2",)],
        [("body",), ("eyes_open",), ("antenna_right",), ("legs_step1",)],
        [("body",), ("eyes_open",), ("antenna_right",), ("legs_step2",)],
    ],
    "walk_left": [
        [("body",), ("eyes_open",), ("antenna_left",), ("legs_step1",)],
        [("body",), ("eyes_open",), ("antenna_left",), ("legs_step2",)],
        [("body",), ("eyes_open",), ("antenna_left",), ("legs_step1",)],
        [("body",), ("eyes_open",), ("antenna_left",), ("legs_step2",)],
    ],
    "happy": [
        [("body",), ("eyes_happy",), ("antenna_up",), ("arms_up",)],
        [("body",), ("eyes_happy",), ("antenna_up",), ("arms_wave",)],
    ],
    "sit": [
        [("body_sit",), ("eyes_open",), ("antenna_neutral",)],
    ],
}

# Color palette
COLORS = {
    "body_main": "#5B9BD5",
    "body_dark": "#2F75B6",
    "body_light": "#BDD7EE",
    "eye_white": "#FFFFFF",
    "eye_pupil": "#1F3864",
    "eye_shine": "#FFFFFF",
    "antenna": "#FF6B6B",
    "antenna_tip": "#FFE066",
    "arm": "#5B9BD5",
    "leg": "#2F75B6",
    "chest": "#BDD7EE",
    "cheek": "#FFB6C1",
    "mouth": "#1F3864",
    "shadow": "#2F75B6",
}


def draw_robot(canvas, cx, cy, state_parts, direction=1, scale=1.0):
    """Draw the robot character on the canvas at position (cx, cy).
    direction: 1 = right, -1 = left
    """
    canvas.delete("robot")
    s = scale

    def sx(x):
        return cx + x * s * direction

    def sy(y):
        return cy + y * s

    parts = set(p[0] for p in state_parts)

    # --- Shadow ---
    canvas.create_oval(
        sx(-18), sy(42), sx(18), sy(50),
        fill="#CCCCCC", outline="", tags="robot"
    )

    # --- Legs ---
    if "legs_step1" in parts:
        # Left leg forward, right leg back
        canvas.create_rectangle(
            sx(-12), sy(28), sx(-5), sy(44),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        canvas.create_rectangle(
            sx(5), sy(28), sx(12), sy(40),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        # Feet
        canvas.create_oval(
            sx(-14), sy(40), sx(-3), sy(46),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
        canvas.create_oval(
            sx(3), sy(36), sx(14), sy(42),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
    elif "legs_step2" in parts:
        # Right leg forward, left leg back
        canvas.create_rectangle(
            sx(-12), sy(28), sx(-5), sy(40),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        canvas.create_rectangle(
            sx(5), sy(28), sx(12), sy(44),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        # Feet
        canvas.create_oval(
            sx(-14), sy(36), sx(-3), sy(42),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
        canvas.create_oval(
            sx(3), sy(40), sx(14), sy(46),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
    elif "body_sit" not in parts:
        # Standing still
        canvas.create_rectangle(
            sx(-12), sy(28), sx(-5), sy(42),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        canvas.create_rectangle(
            sx(5), sy(28), sx(12), sy(42),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        # Feet
        canvas.create_oval(
            sx(-14), sy(38), sx(-3), sy(44),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
        canvas.create_oval(
            sx(3), sy(38), sx(14), sy(44),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
    else:
        # Sitting position
        canvas.create_rectangle(
            sx(-12), sy(30), sx(-3), sy(38),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        canvas.create_rectangle(
            sx(3), sy(30), sx(12), sy(38),
            fill=COLORS["leg"], outline=COLORS["body_dark"], width=1, tags="robot"
        )
        canvas.create_oval(
            sx(-16), sy(35), sx(-1), sy(43),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )
        canvas.create_oval(
            sx(1), sy(35), sx(16), sy(43),
            fill=COLORS["body_dark"], outline="", tags="robot"
        )

    # --- Arms ---
    if "arms_up" in parts:
        canvas.create_line(
            sx(-16), sy(10), sx(-22), sy(-2),
            fill=COLORS["arm"], width=int(6 * s), capstyle="round", tags="robot"
        )
        canvas.create_line(
            sx(16), sy(10), sx(22), sy(-2),
            fill=COLORS["arm"], width=int(6 * s), capstyle="round", tags="robot"
        )
    elif "arms_wave" in parts:
        canvas.create_line(
            sx(-16), sy(10), sx(-24), sy(2),
            fill=COLORS["arm"], width=int(6 * s), capstyle="round", tags="robot"
        )
        canvas.create_line(
            sx(16), sy(10), sx(26), sy(-4),
            fill=COLORS["arm"], width=int(6 * s), capstyle="round", tags="robot"
        )
    else:
        canvas.create_line(
            sx(-16), sy(10), sx(-20), sy(20),
            fill=COLORS["arm"], width=int(6 * s), capstyle="round", tags="robot"
        )
        canvas.create_line(
            sx(16), sy(10), sx(20), sy(20),
            fill=COLORS["arm"], width=int(6 * s), capstyle="round", tags="robot"
        )

    # --- Body ---
    if "body_sit" in parts:
        body_top = 2
    else:
        body_top = -2

    # Body main
    canvas.create_rectangle(
        sx(-16), sy(body_top), sx(16), sy(30),
        fill=COLORS["body_main"], outline=COLORS["body_dark"], width=2, tags="robot"
    )
    # Chest plate
    canvas.create_rectangle(
        sx(-10), sy(body_top + 6), sx(10), sy(20),
        fill=COLORS["chest"], outline=COLORS["body_dark"], width=1, tags="robot"
    )
    # Chest button
    canvas.create_oval(
        sx(-3), sy(body_top + 8), sx(3), sy(body_top + 14),
        fill=COLORS["antenna"], outline=COLORS["body_dark"], width=1, tags="robot"
    )

    # --- Head ---
    # Head shape
    canvas.create_rectangle(
        sx(-14), sy(-22), sx(14), sy(2),
        fill=COLORS["body_main"], outline=COLORS["body_dark"], width=2, tags="robot"
    )
    # Head top rounded
    canvas.create_oval(
        sx(-14), sy(-28), sx(14), sy(-14),
        fill=COLORS["body_main"], outline=COLORS["body_dark"], width=2, tags="robot"
    )

    # --- Antenna ---
    if "antenna_up" in parts:
        canvas.create_line(
            sx(0), sy(-27), sx(0), sy(-38),
            fill=COLORS["antenna"], width=3, tags="robot"
        )
        canvas.create_oval(
            sx(-4), sy(-43), sx(4), sy(-35),
            fill=COLORS["antenna_tip"], outline=COLORS["antenna"], width=1,
            tags="robot"
        )
    elif "antenna_right" in parts:
        canvas.create_line(
            sx(0), sy(-27), sx(4), sy(-36),
            fill=COLORS["antenna"], width=3, tags="robot"
        )
        canvas.create_oval(
            sx(1), sy(-41), sx(9), sy(-33),
            fill=COLORS["antenna_tip"], outline=COLORS["antenna"], width=1,
            tags="robot"
        )
    elif "antenna_left" in parts:
        canvas.create_line(
            sx(0), sy(-27), sx(-4), sy(-36),
            fill=COLORS["antenna"], width=3, tags="robot"
        )
        canvas.create_oval(
            sx(-9), sy(-41), sx(-1), sy(-33),
            fill=COLORS["antenna_tip"], outline=COLORS["antenna"], width=1,
            tags="robot"
        )
    else:
        canvas.create_line(
            sx(0), sy(-27), sx(0), sy(-36),
            fill=COLORS["antenna"], width=3, tags="robot"
        )
        canvas.create_oval(
            sx(-4), sy(-41), sx(4), sy(-33),
            fill=COLORS["antenna_tip"], outline=COLORS["antenna"], width=1,
            tags="robot"
        )

    # --- Eyes ---
    if "blink" in parts:
        # Closed eyes (blink)
        canvas.create_line(
            sx(-8), sy(-16), sx(-3), sy(-16),
            fill=COLORS["eye_pupil"], width=2, tags="robot"
        )
        canvas.create_line(
            sx(3), sy(-16), sx(8), sy(-16),
            fill=COLORS["eye_pupil"], width=2, tags="robot"
        )
    elif "eyes_happy" in parts:
        # Happy curved eyes
        canvas.create_arc(
            sx(-10), sy(-20), sx(-3), sy(-12),
            start=0, extent=180,
            outline=COLORS["eye_pupil"], width=2, style="arc", tags="robot"
        )
        canvas.create_arc(
            sx(3), sy(-20), sx(10), sy(-12),
            start=0, extent=180,
            outline=COLORS["eye_pupil"], width=2, style="arc", tags="robot"
        )
    else:
        # Normal open eyes
        canvas.create_oval(
            sx(-10), sy(-20), sx(-3), sy(-13),
            fill=COLORS["eye_white"], outline=COLORS["body_dark"], width=1,
            tags="robot"
        )
        canvas.create_oval(
            sx(3), sy(-20), sx(10), sy(-13),
            fill=COLORS["eye_white"], outline=COLORS["body_dark"], width=1,
            tags="robot"
        )
        # Pupils
        canvas.create_oval(
            sx(-8), sy(-18), sx(-5), sy(-15),
            fill=COLORS["eye_pupil"], outline="", tags="robot"
        )
        canvas.create_oval(
            sx(5), sy(-18), sx(8), sy(-15),
            fill=COLORS["eye_pupil"], outline="", tags="robot"
        )
        # Eye shine
        canvas.create_oval(
            sx(-8), sy(-18), sx(-7), sy(-17),
            fill=COLORS["eye_shine"], outline="", tags="robot"
        )
        canvas.create_oval(
            sx(5), sy(-18), sx(6), sy(-17),
            fill=COLORS["eye_shine"], outline="", tags="robot"
        )

    # --- Cheeks ---
    canvas.create_oval(
        sx(-13), sy(-14), sx(-7), sy(-10),
        fill=COLORS["cheek"], outline="", tags="robot"
    )
    canvas.create_oval(
        sx(7), sy(-14), sx(13), sy(-10),
        fill=COLORS["cheek"], outline="", tags="robot"
    )

    # --- Mouth ---
    canvas.create_arc(
        sx(-5), sy(-12), sx(5), sy(-6),
        start=200, extent=140,
        outline=COLORS["mouth"], width=2, style="arc", tags="robot"
    )


class DesktopPet:
    """爱弥斯桌面宠物 - Aimis Desktop Pet"""

    IDLE_DURATION_MIN = 80    # ticks
    IDLE_DURATION_MAX = 200
    WALK_DURATION_MIN = 40
    WALK_DURATION_MAX = 120
    HAPPY_DURATION = 20
    SIT_DURATION_MIN = 60
    SIT_DURATION_MAX = 150

    WALK_SPEED = 2            # pixels per tick
    ANIM_INTERVAL = 100       # ms between animation frames
    BEHAVIOR_INTERVAL = 50    # ms between behavior ticks

    PET_WIDTH = 80
    PET_HEIGHT = 100

    def __init__(self, root):
        self.root = root
        self._configure_window()
        self._setup_canvas()
        self._init_state()
        self._bind_events()
        self._start_loops()

    def _configure_window(self):
        self.root.overrideredirect(True)
        self.root.attributes("-topmost", True)
        # "-transparentcolor" is only supported on Windows
        if self.root.tk.call("tk", "windowingsystem") == "win32":
            self.root.attributes("-transparentcolor", "white")
        self.root.config(bg="white")

        screen_w = self.root.winfo_screenwidth()
        screen_h = self.root.winfo_screenheight()
        x = random.randint(100, screen_w - 200)
        y = screen_h - 160

        self.root.geometry(f"{self.PET_WIDTH + 20}x{self.PET_HEIGHT + 20}+{x}+{y}")
        self.x = x
        self.y = y

    def _setup_canvas(self):
        self.canvas = tk.Canvas(
            self.root,
            width=self.PET_WIDTH + 20,
            height=self.PET_HEIGHT + 20,
            bg="white",
            highlightthickness=0,
        )
        self.canvas.pack()

    def _init_state(self):
        self.state = "idle"
        self.direction = 1          # 1=right, -1=left
        self.anim_frame = 0
        self.behavior_tick = 0
        self.behavior_duration = random.randint(
            self.IDLE_DURATION_MIN, self.IDLE_DURATION_MAX
        )
        self._dragging = False
        self._drag_offset_x = 0
        self._drag_offset_y = 0
        self.screen_w = self.root.winfo_screenwidth()
        self.screen_h = self.root.winfo_screenheight()

    def _bind_events(self):
        self.canvas.bind("<ButtonPress-1>", self._on_drag_start)
        self.canvas.bind("<B1-Motion>", self._on_drag_motion)
        self.canvas.bind("<ButtonRelease-1>", self._on_drag_end)
        self.canvas.bind("<ButtonPress-3>", self._on_right_click)
        self.canvas.bind("<Double-Button-1>", self._on_double_click)

    def _start_loops(self):
        self._animate()
        self._update_behavior()

    # --- Drawing ---

    def _draw(self):
        frames = FRAMES.get(self.state, FRAMES["idle"])
        frame_idx = self.anim_frame % len(frames)
        parts = frames[frame_idx]
        cx = (self.PET_WIDTH + 20) // 2
        cy = (self.PET_HEIGHT + 20) // 2 + 10
        draw_robot(self.canvas, cx, cy, parts, direction=self.direction)

    # --- Animation loop ---

    def _animate(self):
        self.anim_frame += 1
        self._draw()
        self.root.after(self.ANIM_INTERVAL, self._animate)

    # --- Behavior loop ---

    def _update_behavior(self):
        if not self._dragging:
            self.behavior_tick += 1
            if self.behavior_tick >= self.behavior_duration:
                self._choose_next_behavior()

            if self.state in ("walk_right", "walk_left"):
                self._walk()

        self.root.after(self.BEHAVIOR_INTERVAL, self._update_behavior)

    def _choose_next_behavior(self):
        self.behavior_tick = 0
        choices = ["idle", "walk_right", "walk_left", "idle", "sit"]
        if self.state in ("walk_right", "walk_left"):
            choices = ["idle", "idle", "sit"]
        elif self.state == "sit":
            choices = ["idle", "walk_right", "walk_left"]

        self.state = random.choice(choices)

        if self.state == "idle":
            self.behavior_duration = random.randint(
                self.IDLE_DURATION_MIN, self.IDLE_DURATION_MAX
            )
        elif self.state in ("walk_right", "walk_left"):
            self.behavior_duration = random.randint(
                self.WALK_DURATION_MIN, self.WALK_DURATION_MAX
            )
            self.direction = 1 if self.state == "walk_right" else -1
        elif self.state == "sit":
            self.behavior_duration = random.randint(
                self.SIT_DURATION_MIN, self.SIT_DURATION_MAX
            )

        self.anim_frame = 0

    def _walk(self):
        dx = self.WALK_SPEED * self.direction
        new_x = self.x + dx
        margin = 50

        if new_x < -margin:
            new_x = -margin
            self.state = "walk_right"
            self.direction = 1
        elif new_x > self.screen_w - self.PET_WIDTH + margin:
            new_x = self.screen_w - self.PET_WIDTH + margin
            self.state = "walk_left"
            self.direction = -1

        self.x = new_x
        self.root.geometry(f"+{int(self.x)}+{int(self.y)}")

    # --- Mouse events ---

    def _on_drag_start(self, event):
        self._dragging = True
        self._drag_offset_x = event.x_root - self.x
        self._drag_offset_y = event.y_root - self.y
        self.state = "happy"
        self.anim_frame = 0

    def _on_drag_motion(self, event):
        if self._dragging:
            self.x = event.x_root - self._drag_offset_x
            self.y = event.y_root - self._drag_offset_y
            self.root.geometry(f"+{int(self.x)}+{int(self.y)}")

    def _on_drag_end(self, event):
        self._dragging = False
        self.state = "idle"
        self.anim_frame = 0
        self.behavior_tick = 0
        self.behavior_duration = random.randint(
            self.IDLE_DURATION_MIN, self.IDLE_DURATION_MAX
        )

    def _on_double_click(self, event):
        self.state = "happy"
        self.anim_frame = 0
        self.behavior_tick = 0
        self.behavior_duration = self.HAPPY_DURATION
        self.root.after(
            self.HAPPY_DURATION * self.BEHAVIOR_INTERVAL,
            lambda: self._set_idle(),
        )

    def _set_idle(self):
        if not self._dragging:
            self.state = "idle"
            self.anim_frame = 0

    def _on_right_click(self, event):
        menu = tk.Menu(self.root, tearoff=0)
        menu.add_command(label="🐾 爱弥斯桌面宠物", state="disabled")
        menu.add_separator()
        menu.add_command(label="👋 打招呼", command=self._say_hello)
        menu.add_command(label="💤 休息一下", command=self._sit_down)
        menu.add_separator()
        menu.add_command(label="❌ 退出", command=self.root.quit)
        menu.tk_popup(event.x_root, event.y_root)

    def _say_hello(self):
        self.state = "happy"
        self.anim_frame = 0
        self.behavior_tick = 0
        self.behavior_duration = self.HAPPY_DURATION

        popup = tk.Toplevel(self.root)
        popup.overrideredirect(True)
        popup.attributes("-topmost", True)
        popup.config(bg="#FFFDE7")
        popup.geometry(f"+{int(self.x) + 60}+{int(self.y) - 40}")

        msg = tk.Label(
            popup,
            text="你好！我是爱弥斯！(≧▽≦)/",
            font=("微软雅黑", "PingFang SC", "Helvetica", 11),
            bg="#FFFDE7",
            fg="#5B9BD5",
            padx=10, pady=6,
        )
        msg.pack()

        border = tk.Frame(popup, bg="#5B9BD5", bd=2)
        border.place(relwidth=1, relheight=1)
        msg.lift()

        popup.after(2000, popup.destroy)
        self.root.after(
            self.HAPPY_DURATION * self.BEHAVIOR_INTERVAL,
            lambda: self._set_idle(),
        )

    def _sit_down(self):
        self.state = "sit"
        self.anim_frame = 0
        self.behavior_tick = 0
        self.behavior_duration = random.randint(
            self.SIT_DURATION_MIN, self.SIT_DURATION_MAX
        )
