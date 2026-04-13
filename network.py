"""
TypeMaster LAN - 网络模块
UDP广播房间发现 + TCP游戏通信
"""

import socket
import json
import threading
import time
import uuid

# 默认端口
UDP_PORT = 25565
TCP_PORT = 25566


def get_local_ip():
    """获取本机局域网IP"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def send_json(sock, data, addr=None):
    """发送JSON数据"""
    msg = json.dumps(data, ensure_ascii=False).encode("utf-8")
    if addr:
        sock.sendto(msg, addr)
    else:
        sock.sendall(msg)


def recv_json(sock, bufsize=4096):
    """接收JSON数据（UDP版）"""
    data, addr = sock.recvfrom(bufsize)
    return json.loads(data.decode("utf-8")), addr


# ========== UDP广播器（房主用）==========

class RoomBroadcaster:
    """房主定期广播房间信息"""

    def __init__(self, room_id, room_name, host_ip, host_port=TCP_PORT,
                 udp_port=UDP_PORT, max_players=8):
        self.room_id = room_id
        self.room_name = room_name
        self.host_ip = host_ip
        self.host_port = host_port
        self.udp_port = udp_port
        self.max_players = max_players
        self.player_count = 0
        self.difficulty = "easy"
        self.mode = "classic"
        self.status = "waiting"  # waiting / gaming
        self._running = False
        self._thread = None
        self._sock = None

    def start(self):
        """开始广播"""
        self._running = True
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
        self._thread = threading.Thread(target=self._broadcast_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """停止广播"""
        self._running = False
        if self._sock:
            self._sock.close()

    def _broadcast_loop(self):
        """每2秒广播一次"""
        while self._running:
            try:
                msg = {
                    "type": "room_announce",
                    "room_id": self.room_id,
                    "room_name": self.room_name,
                    "player_count": self.player_count,
                    "max_players": self.max_players,
                    "difficulty": self.difficulty,
                    "game_mode": self.mode,
                    "status": self.status,
                    "host_ip": self.host_ip,
                    "host_port": self.host_port,
                }
                data = json.dumps(msg, ensure_ascii=False).encode("utf-8")
                self._sock.sendto(data, ("<broadcast>", self.udp_port))
            except Exception:
                pass
            time.sleep(2)


class RoomScanner:
    """客户端扫描局域网房间"""

    def __init__(self, udp_port=UDP_PORT, timeout=6):
        self.udp_port = udp_port
        self.timeout = timeout
        self.rooms = {}  # room_id -> room_info
        self._running = False
        self._thread = None
        self._sock = None
        self.on_room_found = None      # callback(room_info)
        self.on_room_lost = None       # callback(room_id)

    def start(self):
        """开始扫描"""
        self._running = True
        self._sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._sock.bind(("", self.udp_port))
        self._sock.settimeout(2)
        self._thread = threading.Thread(target=self._scan_loop, daemon=True)
        self._thread.start()

    def stop(self):
        """停止扫描"""
        self._running = False
        if self._sock:
            self._sock.close()

    def _scan_loop(self):
        """持续监听广播"""
        while self._running:
            try:
                data, addr = self._sock.recvfrom(4096)
                msg = json.loads(data.decode("utf-8"))
                if msg.get("type") == "room_announce":
                    room_id = msg["room_id"]
                    msg["_last_seen"] = time.time()
                    is_new = room_id not in self.rooms
                    self.rooms[room_id] = msg
                    if is_new and self.on_room_found:
                        self.on_room_found(msg)
            except socket.timeout:
                # 检查过期房间
                now = time.time()
                expired = [rid for rid, info in self.rooms.items()
                           if now - info.get("_last_seen", 0) > self.timeout]
                for rid in expired:
                    del self.rooms[rid]
                    if self.on_room_lost:
                        self.on_room_lost(rid)
            except Exception:
                pass

    def get_room_list(self):
        """获取当前发现的房间列表"""
        return list(self.rooms.values())


# ========== TCP服务端（房主用）==========

class GameServer:
    """房主TCP服务器，管理所有客户端连接"""

    def __init__(self, host="0.0.0.0", port=TCP_PORT):
        self.host = host
        self.port = port
        self.server_sock = None
        self.clients = {}       # player_id -> (socket, name)
        self._running = False
        self._lock = threading.Lock()

        # 回调
        self.on_player_joined = None     # callback(player_id, name)
        self.on_player_ready = None      # callback(player_id, ready)
        self.on_player_input = None      # callback(player_id, input_text, timestamp)
        self.on_player_disconnected = None  # callback(player_id)
        self.on_message = None           # callback(player_id, msg_type, data)

    def start(self):
        """启动服务器"""
        self.server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.server_sock.bind((self.host, self.port))
        self.server_sock.listen(8)
        self.server_sock.settimeout(1)
        self._running = True
        threading.Thread(target=self._accept_loop, daemon=True).start()

    def stop(self):
        """停止服务器"""
        self._running = False
        with self._lock:
            for pid, (sock, name) in self.clients.items():
                try:
                    sock.close()
                except Exception:
                    pass
            self.clients.clear()
        if self.server_sock:
            self.server_sock.close()

    def _accept_loop(self):
        """接受客户端连接"""
        while self._running:
            try:
                client_sock, addr = self.server_sock.accept()
                client_sock.settimeout(5)
                # 先读取JOIN消息
                try:
                    data = client_sock.recv(4096).decode("utf-8")
                    msg = json.loads(data)
                    if msg.get("type") == "JOIN":
                        player_id = msg.get("player_id", str(uuid.uuid4())[:8])
                        name = msg.get("name", "Player")
                        with self._lock:
                            self.clients[player_id] = (client_sock, name)
                        # 回复加入成功
                        self._send_to_client(client_sock, {
                            "type": "JOIN_ACK",
                            "player_id": player_id,
                            "status": "ok",
                        })
                        if self.on_player_joined:
                            self.on_player_joined(player_id, name)
                        # 开始监听该客户端
                        threading.Thread(
                            target=self._client_loop,
                            args=(player_id, client_sock),
                            daemon=True
                        ).start()
                except Exception:
                    client_sock.close()
            except socket.timeout:
                continue
            except Exception:
                pass

    def _client_loop(self, player_id, client_sock):
        """监听单个客户端的消息"""
        client_sock.settimeout(1)
        while self._running:
            try:
                data = client_sock.recv(4096).decode("utf-8")
                if not data:
                    break
                # 可能一次收到多条消息（用换行分隔）
                for line in data.strip().split("\n"):
                    if not line.strip():
                        continue
                    try:
                        msg = json.loads(line)
                        msg_type = msg.get("type", "")
                        if msg_type == "PLAYER_READY":
                            if self.on_player_ready:
                                self.on_player_ready(player_id, msg.get("ready", True))
                        elif msg_type == "INPUT_REPORT":
                            if self.on_player_input:
                                self.on_player_input(
                                    player_id,
                                    msg.get("input", ""),
                                    msg.get("timestamp", time.time())
                                )
                        elif msg_type == "CHAT":
                            if self.on_message:
                                self.on_message(player_id, "CHAT", msg.get("text", ""))
                        else:
                            if self.on_message:
                                self.on_message(player_id, msg_type, msg)
                    except json.JSONDecodeError:
                        pass
            except socket.timeout:
                continue
            except Exception:
                break

        # 客户端断开
        with self._lock:
            self.clients.pop(player_id, None)
        if self.on_player_disconnected:
            self.on_player_disconnected(player_id)

    def broadcast(self, data):
        """向所有客户端广播消息"""
        msg = json.dumps(data, ensure_ascii=False).encode("utf-8") + b"\n"
        with self._lock:
            for pid, (sock, name) in list(self.clients.items()):
                try:
                    sock.sendall(msg)
                except Exception:
                    pass

    def send_to_player(self, player_id, data):
        """向指定玩家发送消息"""
        with self._lock:
            entry = self.clients.get(player_id)
            if entry:
                try:
                    self._send_to_client(entry[0], data)
                except Exception:
                    pass

    def _send_to_client(self, sock, data):
        """发送数据给客户端"""
        msg = json.dumps(data, ensure_ascii=False).encode("utf-8") + b"\n"
        sock.sendall(msg)

    def get_player_list(self):
        """获取所有玩家列表"""
        with self._lock:
            return [(pid, name) for pid, (sock, name) in self.clients.items()]


# ========== TCP客户端（加入者用）==========

class GameClient:
    """客户端TCP连接"""

    def __init__(self):
        self.sock = None
        self.player_id = None
        self._running = False
        self._lock = threading.Lock()

        # 回调
        self.on_connected = None
        self.on_game_start = None      # callback(data)
        self.on_word = None            # callback(word)
        self.on_score_update = None    # callback(data)
        self.on_game_end = None        # callback(data)
        self.on_player_joined = None   # callback(data)
        self.on_player_left = None     # callback(data)
        self.on_chat = None            # callback(player_name, text)
        self.on_message = None         # callback(msg_type, data)

    def connect(self, host_ip, port=TCP_PORT, name="Player", player_id=None):
        """连接到房主服务器"""
        self.sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.sock.settimeout(5)
        self.sock.connect((host_ip, port))

        # 发送JOIN
        join_msg = {
            "type": "JOIN",
            "name": name,
            "player_id": player_id or str(uuid.uuid4())[:8],
        }
        self.sock.sendall(json.dumps(join_msg, ensure_ascii=False).encode("utf-8") + b"\n")

        # 等待确认
        data = self.sock.recv(4096).decode("utf-8").strip()
        ack = json.loads(data.split("\n")[0])
        if ack.get("type") == "JOIN_ACK":
            self.player_id = ack["player_id"]

        self.sock.settimeout(1)
        self._running = True
        threading.Thread(target=self._recv_loop, daemon=True).start()

        if self.on_connected:
            self.on_connected(self.player_id)

        return self.player_id

    def disconnect(self):
        """断开连接"""
        self._running = False
        if self.sock:
            try:
                self.sock.close()
            except Exception:
                pass

    def _recv_loop(self):
        """接收消息循环"""
        while self._running:
            try:
                data = self.sock.recv(4096).decode("utf-8")
                if not data:
                    break
                for line in data.strip().split("\n"):
                    if not line.strip():
                        continue
                    try:
                        msg = json.loads(line)
                        self._handle_message(msg)
                    except json.JSONDecodeError:
                        pass
            except socket.timeout:
                continue
            except Exception:
                break

        self._running = False

    def _handle_message(self, msg):
        """处理服务器消息"""
        msg_type = msg.get("type", "")
        if msg_type == "GAME_START":
            if self.on_game_start:
                self.on_game_start(msg)
        elif msg_type == "WORD_GEN":
            if self.on_word:
                self.on_word(msg.get("word", ""))
        elif msg_type == "SCORE_UPDATE":
            if self.on_score_update:
                self.on_score_update(msg)
        elif msg_type == "GAME_END":
            if self.on_game_end:
                self.on_game_end(msg)
        elif msg_type == "PLAYER_JOINED":
            if self.on_player_joined:
                self.on_player_joined(msg)
        elif msg_type == "PLAYER_LEFT":
            if self.on_player_left:
                self.on_player_left(msg)
        elif msg_type == "CHAT":
            if self.on_chat:
                self.on_chat(msg.get("name", ""), msg.get("text", ""))
        else:
            if self.on_message:
                self.on_message(msg_type, msg)

    def send_ready(self, ready=True):
        """发送准备状态"""
        self._send({"type": "PLAYER_READY", "ready": ready})

    def send_input(self, text):
        """上报输入"""
        self._send({"type": "INPUT_REPORT", "input": text, "timestamp": time.time()})

    def send_chat(self, text):
        """发送聊天消息"""
        self._send({"type": "CHAT", "text": text})

    def _send(self, data):
        """发送消息"""
        with self._lock:
            if self.sock:
                try:
                    msg = json.dumps(data, ensure_ascii=False).encode("utf-8") + b"\n"
                    self.sock.sendall(msg)
                except Exception:
                    pass
