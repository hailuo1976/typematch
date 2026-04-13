"""
TypeMaster LAN - 完整GUI应用
Tkinter界面，支持单机和局域网模式
"""

import tkinter as tk
from tkinter import ttk, messagebox, simpledialog
import threading
import time
import json
import os
import random

from network import (RoomScanner, RoomBroadcaster, GameServer, GameClient,
                     get_local_ip, TCP_PORT, UDP_PORT)
from game_engine import GameEngine, Player
from wordbank import get_config

# ============ 主题配色 ============
BG_DARK = "#0d1117"
BG_PANEL = "#161b22"
BG_INPUT = "#21262d"
ACCENT = "#58a6ff"
GREEN = "#3fb950"
RED = "#f85149"
YELLOW = "#d29922"
ORANGE = "#db6d28"
PURPLE = "#bc8cff"
TEXT = "#c9d1d9"
TEXT_DIM = "#8b949e"
TEXT_BRIGHT = "#f0f6fc"

DIFF_COLORS = {"easy": GREEN, "medium": YELLOW, "hard": RED, "master": PURPLE}
MODE_NAMES = {"classic": "经典模式", "timed": "限时模式", "survival": "生存模式"}
DIFF_NAMES = {"easy": "简单", "medium": "中等", "hard": "困难", "master": "大师"}


class TypeMasterApp(tk.Tk):
    """主应用窗口"""

    def __init__(self):
        super().__init__()
        self.title("TypeMaster LAN - 局域网打字竞技")
        self.geometry("960x680")
        self.configure(bg=BG_DARK)
        self.resizable(True, True)
        self.minsize(800, 600)

        # 居中
        self.update_idletasks()
        w, h = 960, 680
        x = (self.winfo_screenwidth() - w) // 2
        y = (self.winfo_screenheight() - h) // 2
        self.geometry(f"{w}x{h}+{x}+{y}")

        # 状态
        self.local_ip = get_local_ip()
        self.nickname = self._load_nickname()
        self.is_host = False
        self.player_id = None
        self.game_mode = "single"  # single / host / client

        # 网络组件
        self.server = None
        self.client = None
        self.broadcaster = None
        self.scanner = None

        # 游戏引擎
        self.engine = None

        # UI
        self.current_frame = None

        self.show_lobby()

    def _load_nickname(self):
        try:
            path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".nickname")
            if os.path.exists(path):
                with open(path, "r", encoding="utf-8") as f:
                    return f.read().strip()
        except Exception:
            pass
        return f"Player{random.randint(100, 999)}"

    def _save_nickname(self, name):
        try:
            path = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".nickname")
            with open(path, "w", encoding="utf-8") as f:
                f.write(name)
        except Exception:
            pass

    def switch_frame(self, frame_class, **kwargs):
        if self.current_frame:
            self.current_frame.destroy()
        self.current_frame = frame_class(self, **kwargs)
        self.current_frame.pack(fill=tk.BOTH, expand=True)

    def show_lobby(self):
        self._cleanup_network()
        self.is_host = False
        self.engine = None
        self.switch_frame(LobbyFrame)

    def show_room(self, is_host=False):
        self.switch_frame(RoomFrame, is_host=is_host)

    def show_game(self):
        self.switch_frame(GameFrame)

    def show_result(self, result_data):
        self.switch_frame(ResultFrame, result_data=result_data)

    def _cleanup_network(self):
        if self.broadcaster:
            try: self.broadcaster.stop()
            except Exception: pass
            self.broadcaster = None
        if self.scanner:
            try: self.scanner.stop()
            except Exception: pass
            self.scanner = None
        if self.server:
            try: self.server.stop()
            except Exception: pass
            self.server = None
        if self.client:
            try: self.client.disconnect()
            except Exception: pass
            self.client = None

    def safe_call(self, func, *args):
        """线程安全的UI更新"""
        try:
            self.after(0, func, *args)
        except Exception:
            pass


# ============ 大厅界面 ============

class LobbyFrame(tk.Frame):
    def __init__(self, app):
        super().__init__(app, bg=BG_DARK)
        self.app = app
        self._build_ui()
        self._start_scanner()

    def _build_ui(self):
        app = self.app

        # 顶栏
        header = tk.Frame(self, bg=BG_PANEL, pady=10, padx=15)
        header.pack(fill=tk.X)
        tk.Label(header, text="TypeMaster LAN", font=("Consolas", 18, "bold"),
                 fg=ACCENT, bg=BG_PANEL).pack(side=tk.LEFT)
        info_f = tk.Frame(header, bg=BG_PANEL)
        info_f.pack(side=tk.RIGHT)
        tk.Label(info_f, text=f"IP: {app.local_ip}", font=("Consolas", 10),
                 fg=TEXT_DIM, bg=BG_PANEL).pack(side=tk.RIGHT, padx=10)
        self.nick_label = tk.Label(info_f, text=f"{app.nickname}",
                                   font=("Microsoft YaHei", 11, "bold"),
                                   fg=TEXT_BRIGHT, bg=BG_PANEL, cursor="hand2")
        self.nick_label.pack(side=tk.RIGHT)
        self.nick_label.bind("<Button-1>", self._edit_nickname)

        # 主体
        body = tk.Frame(self, bg=BG_DARK)
        body.pack(fill=tk.BOTH, expand=True, padx=15, pady=10)

        # 左侧操作面板
        left = tk.Frame(body, bg=BG_PANEL, width=200)
        left.pack(side=tk.LEFT, fill=tk.Y, padx=(0, 10))
        left.pack_propagate(False)

        tk.Label(left, text="操作", font=("Microsoft YaHei", 13, "bold"),
                 fg=TEXT_BRIGHT, bg=BG_PANEL).pack(pady=(15, 10))

        self._action_btn(left, "单人练习", GREEN, self._single_player)
        self._action_btn(left, "创建房间", ACCENT, self._create_room)

        ttk.Separator(left, orient=tk.HORIZONTAL).pack(fill=tk.X, padx=15, pady=15)

        tk.Label(left, text="手动加入(IP)", font=("Microsoft YaHei", 10),
                 fg=TEXT_DIM, bg=BG_PANEL).pack(pady=(0, 5))
        ip_f = tk.Frame(left, bg=BG_PANEL)
        ip_f.pack(fill=tk.X, padx=15)
        self.ip_entry = tk.Entry(ip_f, bg=BG_INPUT, fg=TEXT,
                                 insertbackground=TEXT, font=("Consolas", 10),
                                 relief=tk.FLAT)
        self.ip_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)
        self.ip_entry.insert(0, "192.168.")
        tk.Button(ip_f, text="加入", bg=ACCENT, fg="white",
                  font=("Microsoft YaHei", 9), relief=tk.FLAT,
                  command=self._join_by_ip, cursor="hand2").pack(side=tk.RIGHT, padx=(5, 0))

        # 中间房间列表
        center = tk.Frame(body, bg=BG_DARK)
        center.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        lh = tk.Frame(center, bg=BG_DARK)
        lh.pack(fill=tk.X, pady=(0, 5))
        tk.Label(lh, text="局域网房间", font=("Microsoft YaHei", 13, "bold"),
                 fg=TEXT_BRIGHT, bg=BG_DARK).pack(side=tk.LEFT)
        self.count_label = tk.Label(lh, text="扫描中...", font=("Microsoft YaHei", 9),
                                    fg=TEXT_DIM, bg=BG_DARK)
        self.count_label.pack(side=tk.RIGHT)

        list_frame = tk.Frame(center, bg=BG_PANEL)
        list_frame.pack(fill=tk.BOTH, expand=True)
        self.room_canvas = tk.Canvas(list_frame, bg=BG_PANEL, highlightthickness=0)
        scrollbar = ttk.Scrollbar(list_frame, orient=tk.VERTICAL, command=self.room_canvas.yview)
        self.room_inner = tk.Frame(self.room_canvas, bg=BG_PANEL)
        self.room_inner.bind("<Configure>",
                             lambda e: self.room_canvas.configure(scrollregion=self.room_canvas.bbox("all")))
        self.room_canvas.create_window((0, 0), window=self.room_inner, anchor="nw")
        self.room_canvas.configure(yscrollcommand=scrollbar.set)
        self.room_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)

        self.empty_label = tk.Label(self.room_inner,
                                    text="正在扫描局域网房间...\n\n请确保其他设备已创建房间\n且处于同一WiFi网络下",
                                    font=("Microsoft YaHei", 11), fg=TEXT_DIM, bg=BG_PANEL,
                                    justify=tk.CENTER, pady=60)
        self.empty_label.pack(fill=tk.X)

    def _action_btn(self, parent, text, color, cmd):
        tk.Button(parent, text=text, font=("Microsoft YaHei", 12),
                  bg=color, fg="white", activebackground=color, activeforeground="white",
                  relief=tk.FLAT, cursor="hand2", command=cmd, width=14, height=2).pack(padx=15, pady=5)

    # ---- 扫描器 ----
    def _start_scanner(self):
        self.app.scanner = RoomScanner()
        self.app.scanner.on_room_found = lambda r: self.app.safe_call(self._refresh_rooms)
        self.app.scanner.on_room_lost = lambda r: self.app.safe_call(self._refresh_rooms)
        self.app.scanner.start()
        self._periodic_refresh()

    def _periodic_refresh(self):
        if not self.winfo_exists():
            return
        self._refresh_rooms()
        self.after(2000, self._periodic_refresh)

    def _refresh_rooms(self):
        if not self.app.scanner:
            return
        rooms = self.app.scanner.get_room_list()
        for w in self.room_inner.winfo_children():
            w.destroy()
        if not rooms:
            tk.Label(self.room_inner, text="未发现局域网房间\n\n请确保其他设备已创建房间\n且处于同一WiFi网络下",
                     font=("Microsoft YaHei", 11), fg=TEXT_DIM, bg=BG_PANEL,
                     justify=tk.CENTER, pady=60).pack(fill=tk.X)
            self.count_label.config(text="未发现房间")
            return
        self.count_label.config(text=f"发现 {len(rooms)} 个房间")
        for room in rooms:
            self._room_card(room)

    def _room_card(self, room):
        card = tk.Frame(self.room_inner, bg=BG_INPUT, pady=8, padx=12)
        card.pack(fill=tk.X, padx=10, pady=3)
        top = tk.Frame(card, bg=BG_INPUT)
        top.pack(fill=tk.X)
        status = room.get("status", "waiting")
        st_text = "等待中" if status == "waiting" else "游戏中"
        st_color = YELLOW if status == "waiting" else RED
        tk.Label(top, text=f"  {room.get('room_name', '?')}",
                 font=("Microsoft YaHei", 12, "bold"), fg=TEXT_BRIGHT, bg=BG_INPUT).pack(side=tk.LEFT)
        tk.Label(top, text=st_text, font=("Microsoft YaHei", 9),
                 fg=st_color, bg=BG_INPUT).pack(side=tk.RIGHT)
        bot = tk.Frame(card, bg=BG_INPUT)
        bot.pack(fill=tk.X, pady=(4, 0))
        diff = room.get("difficulty", "easy")
        mode = room.get("game_mode", "classic")
        cnt = room.get("player_count", 0)
        mx = room.get("max_players", 8)
        tk.Label(bot, text=f"{DIFF_NAMES.get(diff, diff)} | {MODE_NAMES.get(mode, mode)} | {cnt}/{mx}",
                 font=("Microsoft YaHei", 9), fg=TEXT_DIM, bg=BG_INPUT).pack(side=tk.LEFT)
        if status == "waiting" and cnt < mx:
            tk.Button(bot, text="加入", bg=ACCENT, fg="white", font=("Microsoft YaHei", 9),
                      relief=tk.FLAT, cursor="hand2",
                      command=lambda r=room: self._join_room(r)).pack(side=tk.RIGHT)
        else:
            tk.Label(bot, text="不可加入", font=("Microsoft YaHei", 9),
                     fg=TEXT_DIM, bg=BG_INPUT).pack(side=tk.RIGHT)

    # ---- 操作 ----
    def _edit_nickname(self, event=None):
        name = simpledialog.askstring("修改昵称", "请输入新昵称：",
                                      initialvalue=self.app.nickname, parent=self.app)
        if name and name.strip():
            self.app.nickname = name.strip()
            self.app._save_nickname(self.app.nickname)
            self.nick_label.config(text=self.app.nickname)

    def _single_player(self):
        dlg = GameSettingsDialog(self.app, single_player=True)
        self.app.wait_window(dlg)
        if dlg.result:
            r = dlg.result
            self._stop_scanner()
            self.app.engine = GameEngine(r["difficulty"], r["mode"], r["language"])
            self.app.player_id = "local"
            self.app.engine.add_player("local", self.app.nickname)
            self.app.game_mode = "single"
            self.app.show_game()

    def _create_room(self):
        dlg = GameSettingsDialog(self.app, single_player=False)
        self.app.wait_window(dlg)
        if dlg.result:
            r = dlg.result
            self._stop_scanner()

            # 启动TCP服务器
            srv = GameServer()
            srv.on_player_joined = self._host_player_joined
            srv.on_player_ready = self._host_player_ready
            srv.on_player_input = self._host_player_input
            srv.on_player_disconnected = self._host_player_disconnected
            srv.on_message = self._host_message
            srv.start()
            self.app.server = srv

            # 启动UDP广播
            bc = RoomBroadcaster(
                room_id=str(random.randint(100000, 999999)),
                room_name=r["room_name"],
                host_ip=self.app.local_ip,
                max_players=r["max_players"]
            )
            bc.difficulty = r["difficulty"]
            bc.mode = r["mode"]
            bc.player_count = 1
            bc.start()
            self.app.broadcaster = bc

            # 创建引擎 + 房主加入
            self.app.engine = GameEngine(r["difficulty"], r["mode"], r["language"])
            self.app.player_id = str(random.randint(10000, 99999))
            self.app.engine.add_player(self.app.player_id, self.app.nickname)
            self.app.is_host = True
            self.app.game_mode = "host"
            self.app.show_room(is_host=True)

    def _join_room(self, room):
        self._connect(room.get("host_ip"), room.get("host_port", TCP_PORT))

    def _join_by_ip(self):
        ip = self.ip_entry.get().strip()
        if ip:
            self._connect(ip, TCP_PORT)

    def _connect(self, host_ip, port):
        try:
            self._stop_scanner()
            cl = GameClient()
            cl.on_connected = lambda pid: self.app.safe_call(lambda: self.app.show_room(is_host=False))
            cl.on_game_start = self._client_game_start
            cl.on_word = self._client_word
            cl.on_score_update = self._client_score_update
            cl.on_game_end = self._client_game_end
            cl.on_player_joined = self._client_player_change
            cl.on_player_left = self._client_player_change
            cl.on_chat = self._client_chat
            cl.on_message = self._client_message
            self.app.client = cl
            self.app.player_id = cl.connect(host_ip, port, self.app.nickname)
            self.app.game_mode = "client"
            self.app.is_host = False
        except Exception as e:
            messagebox.showerror("连接失败", f"无法连接到房间:\n{e}")
            self.app.show_lobby()

    # ---- 房主回调 ----
    def _host_player_joined(self, pid, name):
        eng = self.app.engine
        if eng:
            eng.add_player(pid, name)
            if self.app.broadcaster:
                self.app.broadcaster.player_count = len([p for p in eng.players.values() if p.connected])
            self.app.server.broadcast({
                "type": "PLAYER_JOINED",
                "player_id": pid, "name": name,
                "players": [(i, p.name) for i, p in eng.players.items() if p.connected]
            })

    def _host_player_ready(self, pid, ready):
        eng = self.app.engine
        if eng and pid in eng.players:
            eng.players[pid].ready = ready

    def _host_player_input(self, pid, text, ts):
        eng = self.app.engine
        if not eng or not eng.is_running:
            return
        result = eng.check_input(pid, text, ts)
        if result:
            self.app.server.broadcast({
                "type": "SCORE_UPDATE",
                "word": eng.current_word,
                "rankings": result.get("rankings", [])
            })
            if eng.is_finished:
                gr = eng.get_game_result()
                self.app.server.broadcast({"type": "GAME_END", **gr})
                self.app.safe_call(lambda: self.app.show_result(gr))
            else:
                self.app.server.broadcast({"type": "WORD_GEN", "word": eng.current_word})

    def _host_player_disconnected(self, pid):
        eng = self.app.engine
        if eng:
            eng.remove_player(pid)
            if self.app.broadcaster:
                self.app.broadcaster.player_count = len([p for p in eng.players.values() if p.connected])
            self.app.server.broadcast({"type": "PLAYER_LEFT", "player_id": pid})

    def _host_message(self, pid, msg_type, data):
        if msg_type == "CHAT":
            eng = self.app.engine
            name = eng.players[pid].name if eng and pid in eng.players else "?"
            self.app.server.broadcast({"type": "CHAT", "name": name, "text": data})

    # ---- 客户端回调 ----
    def _client_game_start(self, data):
        eng = GameEngine(data.get("difficulty", "easy"), data.get("mode", "classic"))
        for p in data.get("players", []):
            eng.add_player(p["player_id"], p["name"])
        eng.current_word = data.get("word", "")
        eng.start_time = time.time()
        eng.is_running = True
        self.app.engine = eng
        # 给本地玩家设word_start_time
        lp = eng.players.get(self.app.player_id)
        if lp:
            lp.word_start_time = time.time()
        self.app.safe_call(lambda: self.app.show_game())

    def _client_word(self, word):
        eng = self.app.engine
        if eng:
            eng.current_word = word
            lp = eng.players.get(self.app.player_id)
            if lp:
                lp.word_start_time = time.time()
        self.app.safe_call(self._notify_game_word)

    def _notify_game_word(self):
        if self.app.current_frame and hasattr(self.app.current_frame, "update_word"):
            self.app.current_frame.update_word()

    def _client_score_update(self, data):
        eng = self.app.engine
        if eng:
            for r in data.get("rankings", []):
                pid = r.get("player_id")
                if pid in eng.players:
                    eng.players[pid].score = r.get("score", eng.players[pid].score)
        self.app.safe_call(self._notify_game_score)

    def _notify_game_score(self):
        if self.app.current_frame and hasattr(self.app.current_frame, "update_scoreboard"):
            self.app.current_frame.update_scoreboard()

    def _client_game_end(self, data):
        self.app.safe_call(lambda: self.app.show_result(data))

    def _client_player_change(self, data):
        pass

    def _client_chat(self, name, text):
        pass

    def _client_message(self, msg_type, data):
        pass

    def _stop_scanner(self):
        if self.app.scanner:
            try: self.app.scanner.stop()
            except Exception: pass
            self.app.scanner = None


# ============ 房间等待界面 ============

class RoomFrame(tk.Frame):
    def __init__(self, app, is_host=False):
        super().__init__(app, bg=BG_DARK)
        self.app = app
        self.is_host = is_host
        self._build_ui()
        self._refresh_players()

    def _build_ui(self):
        app = self.app
        room_name = self.app.broadcaster.room_name if self.app.broadcaster else "房间"

        # 顶栏
        header = tk.Frame(self, bg=BG_PANEL, pady=10, padx=15)
        header.pack(fill=tk.X)
        tk.Label(header, text=f"  {room_name}", font=("Microsoft YaHei", 16, "bold"),
                 fg=ACCENT, bg=BG_PANEL).pack(side=tk.LEFT)
        role = "房主" if self.is_host else "玩家"
        tk.Label(header, text=f"[{role}]", font=("Microsoft YaHei", 10),
                 fg=YELLOW if self.is_host else ACCENT, bg=BG_PANEL).pack(side=tk.LEFT, padx=10)
        tk.Button(header, text="离开房间", bg=RED, fg="white",
                  font=("Microsoft YaHei", 9), relief=tk.FLAT, cursor="hand2",
                  command=self._leave).pack(side=tk.RIGHT)

        body = tk.Frame(self, bg=BG_DARK)
        body.pack(fill=tk.BOTH, expand=True, padx=15, pady=10)

        # 玩家列表
        left = tk.Frame(body, bg=BG_PANEL)
        left.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=(0, 10))
        tk.Label(left, text="玩家列表", font=("Microsoft YaHei", 13, "bold"),
                 fg=TEXT_BRIGHT, bg=BG_PANEL).pack(pady=(10, 5), padx=10, anchor="w")
        self.player_frame = tk.Frame(left, bg=BG_PANEL)
        self.player_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        # 按钮
        bf = tk.Frame(left, bg=BG_PANEL)
        bf.pack(fill=tk.X, padx=10, pady=10)
        if self.is_host:
            tk.Button(bf, text="开始游戏", bg=GREEN, fg="white",
                      font=("Microsoft YaHei", 14, "bold"), relief=tk.FLAT, cursor="hand2",
                      command=self._start_game, height=2).pack(fill=tk.X)
        else:
            self.ready_btn = tk.Button(bf, text="准备", bg=ACCENT, fg="white",
                                       font=("Microsoft YaHei", 14, "bold"), relief=tk.FLAT,
                                       cursor="hand2", command=self._toggle_ready, height=2)
            self.ready_btn.pack(fill=tk.X)

        # 聊天
        right = tk.Frame(body, bg=BG_PANEL, width=260)
        right.pack(side=tk.RIGHT, fill=tk.Y)
        right.pack_propagate(False)
        tk.Label(right, text="聊天", font=("Microsoft YaHei", 13, "bold"),
                 fg=TEXT_BRIGHT, bg=BG_PANEL).pack(pady=(10, 5), padx=10, anchor="w")
        self.chat_display = tk.Text(right, bg=BG_INPUT, fg=TEXT, font=("Microsoft YaHei", 10),
                                    relief=tk.FLAT, wrap=tk.WORD, state=tk.DISABLED, height=15)
        self.chat_display.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)
        cf = tk.Frame(right, bg=BG_PANEL)
        cf.pack(fill=tk.X, padx=10, pady=(0, 10))
        self.chat_entry = tk.Entry(cf, bg=BG_INPUT, fg=TEXT, insertbackground=TEXT,
                                   font=("Microsoft YaHei", 10), relief=tk.FLAT)
        self.chat_entry.pack(side=tk.LEFT, fill=tk.X, expand=True, ipady=4)
        self.chat_entry.bind("<Return>", self._send_chat)
        tk.Button(cf, text="发送", bg=ACCENT, fg="white", font=("Microsoft YaHei", 9),
                  relief=tk.FLAT, command=self._send_chat).pack(side=tk.RIGHT, padx=(5, 0))

    def _refresh_players(self):
        if not self.winfo_exists():
            return
        for w in self.player_frame.winfo_children():
            w.destroy()
        eng = self.app.engine
        if not eng:
            self.after(1000, self._refresh_players)
            return
        for pid, p in eng.players.items():
            if not p.connected:
                continue
            row = tk.Frame(self.player_frame, bg=BG_INPUT, pady=6, padx=10)
            row.pack(fill=tk.X, pady=2)
            is_me = (pid == self.app.player_id)
            prefix = "[Host] " if (is_me and self.is_host) else ""
            suffix = " (你)" if is_me else ""
            tk.Label(row, text=f"{prefix}{p.name}{suffix}",
                     font=("Microsoft YaHei", 11),
                     fg=TEXT_BRIGHT if is_me else TEXT, bg=BG_INPUT).pack(side=tk.LEFT)
            if p.ready:
                tk.Label(row, text="已准备", font=("Microsoft YaHei", 9),
                         fg=GREEN, bg=BG_INPUT).pack(side=tk.RIGHT)
            else:
                tk.Label(row, text="未准备", font=("Microsoft YaHei", 9),
                         fg=TEXT_DIM, bg=BG_INPUT).pack(side=tk.RIGHT)
        self.after(1000, self._refresh_players)

    def _toggle_ready(self):
        if self.app.client:
            self.app.client.send_ready(True)
            self.ready_btn.config(text="已准备", bg=GREEN)

    def _start_game(self):
        eng = self.app.engine
        if not eng:
            return
        # 检查准备状态
        for p in eng.players.values():
            if p.connected and not p.ready and p.player_id != self.app.player_id:
                messagebox.showwarning("提示", "还有玩家未准备！")
                return
        eng.start_game()
        if self.app.broadcaster:
            self.app.broadcaster.status = "gaming"
        if self.app.server:
            self.app.server.broadcast({
                "type": "GAME_START",
                "difficulty": eng.difficulty, "mode": eng.mode,
                "players": [{"player_id": pid, "name": p.name} for pid, p in eng.players.items()],
                "word": eng.current_word
            })
        self.app.show_game()

    def _send_chat(self, event=None):
        text = self.chat_entry.get().strip()
        if not text:
            return
        self.chat_entry.delete(0, tk.END)
        self._append_chat(self.app.nickname, text)
        if self.app.client:
            self.app.client.send_chat(text)
        elif self.app.server:
            self.app.server.broadcast({"type": "CHAT", "name": self.app.nickname, "text": text})

    def _append_chat(self, name, text):
        self.chat_display.config(state=tk.NORMAL)
        self.chat_display.insert(tk.END, f"{name}: {text}\n")
        self.chat_display.see(tk.END)
        self.chat_display.config(state=tk.DISABLED)

    def _leave(self):
        self.app.show_lobby()


# ============ 游戏界面 ============

class GameFrame(tk.Frame):
    def __init__(self, app):
        super().__init__(app, bg=BG_DARK)
        self.app = app
        self.input_var = tk.StringVar()
        self._build_ui()
        self._start_loop()

    def _build_ui(self):
        app = self.app
        eng = app.engine
        mode_t = MODE_NAMES.get(eng.mode if eng else "classic", "")
        diff_t = DIFF_NAMES.get(eng.difficulty if eng else "easy", "")
        diff_c = DIFF_COLORS.get(eng.difficulty if eng else "easy", TEXT_DIM)

        # 顶栏
        top = tk.Frame(self, bg=BG_PANEL, pady=8, padx=15)
        top.pack(fill=tk.X)
        tk.Label(top, text=f"  {mode_t}  |  {diff_t}", font=("Microsoft YaHei", 11),
                 fg=diff_c, bg=BG_PANEL).pack(side=tk.LEFT)
        self.timer_label = tk.Label(top, text="00:00", font=("Consolas", 14, "bold"),
                                    fg=YELLOW, bg=BG_PANEL)
        self.timer_label.pack(side=tk.RIGHT)

        main = tk.Frame(self, bg=BG_DARK)
        main.pack(fill=tk.BOTH, expand=True, padx=15, pady=10)

        # 游戏区
        game = tk.Frame(main, bg=BG_DARK)
        game.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        # 单词显示
        wf = tk.Frame(game, bg=BG_PANEL, pady=25)
        wf.pack(fill=tk.X)
        tk.Label(wf, text="请输入:", font=("Microsoft YaHei", 10), fg=TEXT_DIM, bg=BG_PANEL).pack()
        self.word_label = tk.Label(wf, text=eng.current_word if eng else "",
                                   font=("Consolas", 34, "bold"), fg=TEXT_BRIGHT, bg=BG_PANEL)
        self.word_label.pack(pady=8)
        self.feedback_label = tk.Label(wf, text="", font=("Microsoft YaHei", 12), fg=GREEN, bg=BG_PANEL)
        self.feedback_label.pack()

        # 输入框
        self.input_entry = tk.Entry(game, textvariable=self.input_var,
                                    bg=BG_INPUT, fg=TEXT_BRIGHT, insertbackground=ACCENT,
                                    font=("Consolas", 18), relief=tk.FLAT, justify=tk.CENTER)
        self.input_entry.pack(fill=tk.X, ipady=10, pady=15)
        self.input_entry.bind("<Return>", self._on_submit)
        self.input_entry.bind("<space>", self._on_submit)
        self.input_entry.focus_set()

        # 个人统计
        sf = tk.Frame(game, bg=BG_PANEL, pady=10, padx=15)
        sf.pack(fill=tk.X)
        self.score_label = tk.Label(sf, text="得分: 0", font=("Microsoft YaHei", 14, "bold"),
                                    fg=YELLOW, bg=BG_PANEL)
        self.score_label.pack(side=tk.LEFT, padx=10)
        self.combo_label = tk.Label(sf, text="连击: 0", font=("Microsoft YaHei", 12),
                                    fg=ORANGE, bg=BG_PANEL)
        self.combo_label.pack(side=tk.LEFT, padx=10)
        self.acc_label = tk.Label(sf, text="准确率: 100%", font=("Microsoft YaHei", 12),
                                  fg=GREEN, bg=BG_PANEL)
        self.acc_label.pack(side=tk.LEFT, padx=10)
        self.lives_label = tk.Label(sf, text="", font=("Microsoft YaHei", 12),
                                    fg=RED, bg=BG_PANEL)
        self.lives_label.pack(side=tk.LEFT, padx=10)
        if eng and eng.mode == "survival":
            p = eng.players.get(app.player_id)
            if p:
                self.lives_label.config(text=f"HP: {p.lives}")

        # 排行榜
        right = tk.Frame(main, bg=BG_PANEL, width=210)
        right.pack(side=tk.RIGHT, fill=tk.Y, padx=(10, 0))
        right.pack_propagate(False)
        tk.Label(right, text="排名", font=("Microsoft YaHei", 12, "bold"),
                 fg=TEXT_BRIGHT, bg=BG_PANEL).pack(pady=(10, 5), padx=10, anchor="w")
        self.rank_frame = tk.Frame(right, bg=BG_PANEL)
        self.rank_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=5)

        self._update_stats()
        self._update_rankings()

    def _on_submit(self, event=None):
        text = self.input_var.get().strip()
        if not text:
            return
        self.input_var.set("")
        eng = self.app.engine
        if not eng:
            return

        if self.app.game_mode in ("single", "host"):
            result = eng.check_input(self.app.player_id, text)
            if result:
                self._handle_result(result)
                if eng.is_finished:
                    gr = eng.get_game_result()
                    if self.app.game_mode == "host" and self.app.server:
                        self.app.server.broadcast({"type": "GAME_END", **gr})
                    self.app.show_result(gr)
                    return
                self.word_label.config(text=eng.current_word)
                if self.app.game_mode == "host" and self.app.server:
                    self.app.server.broadcast({
                        "type": "SCORE_UPDATE",
                        "word": eng.current_word,
                        "rankings": result.get("rankings", [])
                    })
        elif self.app.game_mode == "client" and self.app.client:
            self.app.client.send_input(text)

    def _handle_result(self, result):
        if result.get("correct"):
            self.feedback_label.config(text=f"正确! +{result.get('score_delta', 0)}", fg=GREEN)
        else:
            self.feedback_label.config(text=f"错误 {result.get('score_delta', 0)}", fg=RED)
        self.after(1200, lambda: self.feedback_label.config(text=""))
        self._update_stats()
        self._update_rankings()

    def _update_stats(self):
        eng = self.app.engine
        p = eng.players.get(self.app.player_id) if eng else None
        if not p:
            return
        self.score_label.config(text=f"得分: {p.score}")
        self.combo_label.config(text=f"连击: {p.combo}x")
        self.acc_label.config(text=f"准确率: {round(p.accuracy * 100, 1)}%")
        if eng.mode == "survival":
            self.lives_label.config(text=f"HP: {p.lives}")

    def _update_rankings(self):
        eng = self.app.engine
        if not eng:
            return
        for w in self.rank_frame.winfo_children():
            w.destroy()
        for r in eng.get_rankings():
            is_me = r.get("player_id") == self.app.player_id
            bg = BG_INPUT if is_me else BG_PANEL
            row = tk.Frame(self.rank_frame, bg=bg, pady=4, padx=8)
            row.pack(fill=tk.X, pady=1)
            color = YELLOW if r["rank"] == 1 else TEXT_DIM
            tk.Label(row, text=f"#{r['rank']}", font=("Consolas", 11, "bold"),
                     fg=color, bg=bg).pack(side=tk.LEFT)
            name = r.get("name", "?")
            if is_me:
                name += " (你)"
            tk.Label(row, text=name, font=("Microsoft YaHei", 10),
                     fg=TEXT_BRIGHT if is_me else TEXT, bg=bg).pack(side=tk.LEFT, padx=5)
            tk.Label(row, text=str(r.get("score", 0)), font=("Consolas", 10),
                     fg=YELLOW, bg=bg).pack(side=tk.RIGHT)

    def update_word(self):
        """客户端收到新词时调用"""
        if self.winfo_exists() and self.app.engine:
            self.word_label.config(text=self.app.engine.current_word)
            self._update_stats()

    def update_scoreboard(self):
        """客户端收到得分更新时调用"""
        if self.winfo_exists():
            self._update_rankings()
            self._update_stats()

    def _start_loop(self):
        self._tick_timer()

    def _tick_timer(self):
        if not self.winfo_exists():
            return
        eng = self.app.engine
        if not eng or not eng.is_running:
            return
        elapsed = time.time() - eng.start_time
        if eng.mode == "timed":
            remain = max(0, eng.time_limit - elapsed)
            m, s = int(remain // 60), int(remain % 60)
            self.timer_label.config(text=f"{m:02d}:{s:02d}")
            if remain <= 0:
                eng.is_finished = True
                eng.is_running = False
                gr = eng.get_game_result()
                if self.app.game_mode == "host" and self.app.server:
                    self.app.server.broadcast({"type": "GAME_END", **gr})
                self.app.show_result(gr)
                return
        else:
            m, s = int(elapsed // 60), int(elapsed % 60)
            self.timer_label.config(text=f"{m:02d}:{s:02d}")
        self.after(200, self._tick_timer)


# ============ 结果界面 ============

class ResultFrame(tk.Frame):
    def __init__(self, app, result_data=None):
        super().__init__(app, bg=BG_DARK)
        self.app = app
        self.data = result_data or {}
        self._build_ui()

    def _build_ui(self):
        data = self.data

        header = tk.Frame(self, bg=BG_PANEL, pady=20)
        header.pack(fill=tk.X)
        tk.Label(header, text="游戏结束!", font=("Microsoft YaHei", 24, "bold"),
                 fg=YELLOW, bg=BG_PANEL).pack()

        body = tk.Frame(self, bg=BG_DARK)
        body.pack(fill=tk.BOTH, expand=True, padx=40, pady=20)

        rankings = data.get("rankings", [])
        if rankings:
            tk.Label(body, text="最终排名", font=("Microsoft YaHei", 14, "bold"),
                     fg=TEXT_BRIGHT, bg=BG_DARK).pack(anchor="w", pady=(0, 10))
            medals = {1: "[1st]", 2: "[2nd]", 3: "[3rd]"}
            for r in rankings:
                is_me = r.get("player_id") == self.app.player_id
                bg = BG_INPUT if is_me else BG_PANEL
                row = tk.Frame(body, bg=bg, pady=8, padx=15)
                row.pack(fill=tk.X, pady=2)
                medal = medals.get(r["rank"], f"#{r['rank']}")
                tk.Label(row, text=medal, font=("Consolas", 12, "bold"),
                         fg=YELLOW, bg=bg).pack(side=tk.LEFT, padx=(0, 10))
                name = r.get("name", "?") + (" (你)" if is_me else "")
                tk.Label(row, text=name, font=("Microsoft YaHei", 12),
                         fg=TEXT_BRIGHT if is_me else TEXT, bg=bg).pack(side=tk.LEFT)
                tk.Label(row, text=f"{r.get('score', 0)} 分", font=("Consolas", 12, "bold"),
                         fg=YELLOW, bg=bg).pack(side=tk.RIGHT, padx=10)
                tk.Label(row, text=f"准确率 {r.get('accuracy', 0)}%",
                         font=("Microsoft YaHei", 10), fg=GREEN, bg=bg).pack(side=tk.RIGHT, padx=10)

        # 个人数据
        players = data.get("players", {})
        my = players.get(self.app.player_id)
        if my:
            sf = tk.Frame(body, bg=BG_PANEL, pady=15, padx=20)
            sf.pack(fill=tk.X, pady=15)
            tk.Label(sf, text="你的数据", font=("Microsoft YaHei", 12, "bold"),
                     fg=ACCENT, bg=BG_PANEL).pack(anchor="w", pady=(0, 8))
            tk.Label(sf, text=(f"得分: {my.get('score', 0)}   "
                              f"正确: {my.get('correct', 0)}   "
                              f"错误: {my.get('wrong', 0)}   "
                              f"准确率: {my.get('accuracy', 0)}%   "
                              f"最大连击: {my.get('max_combo', 0)}"),
                     font=("Microsoft YaHei", 10), fg=TEXT, bg=BG_PANEL).pack(anchor="w")

        bf = tk.Frame(body, bg=BG_DARK)
        bf.pack(pady=20)
        tk.Button(bf, text="再来一局", bg=GREEN, fg="white", font=("Microsoft YaHei", 12),
                  relief=tk.FLAT, cursor="hand2", command=self._again, width=12, height=2
                  ).pack(side=tk.LEFT, padx=10)
        tk.Button(bf, text="返回大厅", bg=ACCENT, fg="white", font=("Microsoft YaHei", 12),
                  relief=tk.FLAT, cursor="hand2", command=self.app.show_lobby, width=12, height=2
                  ).pack(side=tk.LEFT, padx=10)

    def _again(self):
        eng = self.app.engine
        if eng:
            self.app.engine = GameEngine(eng.difficulty, eng.mode, eng.language)
            self.app.engine.add_player(self.app.player_id, self.app.nickname)
            if self.app.is_host and self.app.server:
                for pid, name in self.app.server.get_player_list():
                    self.app.engine.add_player(pid, name)
        if self.app.broadcaster:
            self.app.broadcaster.status = "waiting"
        self.app.show_room(is_host=self.app.is_host)


# ============ 设置对话框 ============

class GameSettingsDialog(tk.Toplevel):
    def __init__(self, parent, single_player=False):
        super().__init__(parent)
        self.result = None
        self.single_player = single_player
        self.title("单人游戏设置" if single_player else "创建房间")
        self.geometry("380x420")
        self.configure(bg=BG_DARK)
        self.resizable(False, False)
        self.transient(parent)
        self.grab_set()
        # 居中
        self.update_idletasks()
        x = parent.winfo_x() + (parent.winfo_width() - 380) // 2
        y = parent.winfo_y() + (parent.winfo_height() - 420) // 2
        self.geometry(f"+{x}+{y}")
        self._build_ui()

    def _build_ui(self):
        m = tk.Frame(self, bg=BG_DARK, padx=20, pady=15)
        m.pack(fill=tk.BOTH, expand=True)

        if not self.single_player:
            tk.Label(m, text="房间名称", font=("Microsoft YaHei", 10),
                     fg=TEXT_DIM, bg=BG_DARK).pack(anchor="w", pady=(5, 2))
            self.name_entry = tk.Entry(m, bg=BG_INPUT, fg=TEXT, insertbackground=TEXT,
                                       font=("Microsoft YaHei", 11), relief=tk.FLAT)
            self.name_entry.pack(fill=tk.X, ipady=4, pady=(0, 10))
            self.name_entry.insert(0, f"{self.master.nickname}的房间")

            tk.Label(m, text="最大人数", font=("Microsoft YaHei", 10),
                     fg=TEXT_DIM, bg=BG_DARK).pack(anchor="w", pady=(5, 2))
            self.max_var = tk.IntVar(value=4)
            mp = tk.Frame(m, bg=BG_DARK)
            mp.pack(fill=tk.X, pady=(0, 10))
            for n in [2, 4, 6, 8]:
                tk.Radiobutton(mp, text=str(n), variable=self.max_var, value=n,
                               bg=BG_DARK, fg=TEXT, selectcolor=BG_INPUT,
                               activebackground=BG_DARK, font=("Microsoft YaHei", 10)
                               ).pack(side=tk.LEFT, padx=5)

        tk.Label(m, text="语言", font=("Microsoft YaHei", 10),
                 fg=TEXT_DIM, bg=BG_DARK).pack(anchor="w", pady=(5, 2))
        self.lang_var = tk.StringVar(value="en")
        lf = tk.Frame(m, bg=BG_DARK)
        lf.pack(fill=tk.X, pady=(0, 10))
        tk.Radiobutton(lf, text="English", variable=self.lang_var, value="en",
                       bg=BG_DARK, fg=TEXT, selectcolor=BG_INPUT,
                       activebackground=BG_DARK, font=("Microsoft YaHei", 10)).pack(side=tk.LEFT, padx=5)
        tk.Radiobutton(lf, text="中文", variable=self.lang_var, value="zh",
                       bg=BG_DARK, fg=TEXT, selectcolor=BG_INPUT,
                       activebackground=BG_DARK, font=("Microsoft YaHei", 10)).pack(side=tk.LEFT, padx=5)

        tk.Label(m, text="难度", font=("Microsoft YaHei", 10),
                 fg=TEXT_DIM, bg=BG_DARK).pack(anchor="w", pady=(5, 2))
        self.diff_var = tk.StringVar(value="easy")
        df = tk.Frame(m, bg=BG_DARK)
        df.pack(fill=tk.X, pady=(0, 10))
        for k, name in DIFF_NAMES.items():
            tk.Radiobutton(df, text=name, variable=self.diff_var, value=k,
                           bg=BG_DARK, fg=DIFF_COLORS[k], selectcolor=BG_INPUT,
                           activebackground=BG_DARK, font=("Microsoft YaHei", 10)).pack(side=tk.LEFT, padx=3)

        tk.Label(m, text="游戏模式", font=("Microsoft YaHei", 10),
                 fg=TEXT_DIM, bg=BG_DARK).pack(anchor="w", pady=(5, 2))
        self.mode_var = tk.StringVar(value="classic")
        mf = tk.Frame(m, bg=BG_DARK)
        mf.pack(fill=tk.X, pady=(0, 15))
        for k, name in MODE_NAMES.items():
            tk.Radiobutton(mf, text=name, variable=self.mode_var, value=k,
                           bg=BG_DARK, fg=TEXT, selectcolor=BG_INPUT,
                           activebackground=BG_DARK, font=("Microsoft YaHei", 10)).pack(side=tk.LEFT, padx=5)

        bf = tk.Frame(m, bg=BG_DARK)
        bf.pack(fill=tk.X, pady=(10, 0))
        tk.Button(bf, text="取消", bg=BG_INPUT, fg=TEXT, font=("Microsoft YaHei", 10),
                  relief=tk.FLAT, command=self.destroy, width=8).pack(side=tk.RIGHT, padx=(5, 0))
        txt = "开始游戏" if self.single_player else "创建房间"
        tk.Button(bf, text=txt, bg=GREEN, fg="white", font=("Microsoft YaHei", 10, "bold"),
                  relief=tk.FLAT, command=self._confirm, width=12).pack(side=tk.RIGHT)

    def _confirm(self):
        self.result = {
            "room_name": getattr(self, "name_entry", None) and self.name_entry.get().strip() or "",
            "max_players": getattr(self, "max_var", None) and self.max_var.get() or 1,
            "difficulty": self.diff_var.get(),
            "mode": self.mode_var.get(),
            "language": self.lang_var.get(),
        }
        self.destroy()
