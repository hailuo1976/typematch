"""
TypeMaster LAN - 游戏核心逻辑模块
得分计算、游戏模式、输入判定
"""

import time
import random
from wordbank import get_random_word, get_config


class Player:
    """玩家状态"""
    def __init__(self, player_id, name="Player"):
        self.player_id = player_id
        self.name = name
        self.score = 0
        self.combo = 0
        self.max_combo = 0
        self.correct = 0
        self.wrong = 0
        self.total_input = 0
        self.consecutive_errors = 0
        self.lives = 3          # 生存模式用
        self.ready = False
        self.connected = True
        self.current_word = ""
        self.word_start_time = 0

    @property
    def accuracy(self):
        """准确率"""
        if self.total_input == 0:
            return 1.0
        return self.correct / self.total_input

    @property
    def wpm(self):
        """每分钟正确输入词数"""
        if self.correct == 0:
            return 0
        elapsed = time.time() - self.word_start_time if self.word_start_time else 1
        return (self.correct / max(elapsed, 1)) * 60

    def to_dict(self):
        """序列化为字典"""
        return {
            "player_id": self.player_id,
            "name": self.name,
            "score": self.score,
            "combo": self.combo,
            "max_combo": self.max_combo,
            "correct": self.correct,
            "wrong": self.wrong,
            "total_input": self.total_input,
            "accuracy": round(self.accuracy * 100, 1),
            "lives": self.lives,
            "ready": self.ready,
        }


class GameEngine:
    """游戏引擎 - 管理游戏逻辑"""

    def __init__(self, difficulty="easy", mode="classic", language="en"):
        self.difficulty = difficulty
        self.mode = mode              # classic / timed / survival
        self.language = language
        self.config = get_config(difficulty)
        self.players = {}             # player_id -> Player
        self.is_running = False
        self.is_finished = False
        self.start_time = 0
        self.word_queue = []          # 预生成的词队列
        self.current_word = ""
        self.word_index = 0

        # 模式参数
        self.target_score = 100       # 经典模式目标分
        self.time_limit = 120         # 限时模式(秒)
        self.elapsed_time = 0

    def add_player(self, player_id, name="Player"):
        """添加玩家"""
        self.players[player_id] = Player(player_id, name)

    def remove_player(self, player_id):
        """移除玩家"""
        if player_id in self.players:
            self.players[player_id].connected = False

    def prepare_words(self, count=200):
        """预生成词队列"""
        self.word_queue = []
        for _ in range(count):
            self.word_queue.append(get_random_word(self.language, self.difficulty))
        self.word_index = 0

    def next_word(self):
        """获取下一个词"""
        if self.word_index >= len(self.word_queue):
            self.prepare_words(200)
        self.current_word = self.word_queue[self.word_index]
        self.word_index += 1
        return self.current_word

    def start_game(self):
        """开始游戏"""
        self.is_running = True
        self.is_finished = False
        self.start_time = time.time()
        self.prepare_words()
        for p in self.players.values():
            p.word_start_time = time.time()
        self.next_word()

    def check_input(self, player_id, user_input, timestamp=None):
        """
        检查玩家输入，返回判定结果
        返回: {"correct": bool, "score_delta": int, "word": str, "combo": int, ...}
        """
        if not self.is_running or self.is_finished:
            return None

        player = self.players.get(player_id)
        if not player:
            return None

        word = self.current_word
        is_correct = (user_input.strip() == word)
        result = {
            "correct": is_correct,
            "word": word,
            "player_id": player_id,
            "player_name": player.name,
            "timestamp": timestamp or time.time(),
        }

        if is_correct:
            # 计算得分
            score_delta = self._calculate_score(player, word)
            player.score += score_delta
            player.combo += 1
            player.max_combo = max(player.max_combo, player.combo)
            player.correct += 1
            player.total_input += 1
            player.consecutive_errors = 0

            result["score_delta"] = score_delta
            result["score"] = player.score
            result["combo"] = player.combo

            # 下一个词
            self.next_word()
        else:
            # 错误惩罚
            player.combo = 0
            player.wrong += 1
            player.total_input += 1
            player.consecutive_errors += 1
            score_delta = -3

            # 连续错误3次额外惩罚
            if player.consecutive_errors >= 3:
                score_delta -= 10
                result["triple_error"] = True

            # 生存模式扣血
            if self.mode == "survival" and player.consecutive_errors % 3 == 0:
                player.lives -= 1
                result["life_lost"] = True

            player.score = max(0, player.score + score_delta)
            result["score_delta"] = score_delta
            result["score"] = player.score
            result["combo"] = 0

        # 检查游戏是否结束
        self._check_game_end(player_id)

        # 附带所有玩家排名
        result["rankings"] = self.get_rankings()

        return result

    def _calculate_score(self, player, word):
        """
        得分计算（PRD 3.5.3）
        单次得分 = 基础分 × 速度系数 × 准确率系数 × 连击系数
        """
        # 基础分
        base = 10 * self.config["multiplier"]

        # 速度系数
        word_len = len(word)
        standard_time = word_len * 0.3
        actual_time = time.time() - player.word_start_time if player.word_start_time else standard_time
        speed_factor = max(0.5, min(2.0, standard_time / max(actual_time, 0.01)))

        # 准确率系数
        acc = player.accuracy
        if acc < 0.8:
            acc_factor = 0.8
        else:
            acc_factor = 1 + (acc - 0.8) * 0.5

        # 连击系数
        combo_factor = 1 + min(0.5, player.combo / 100)

        # 更新单词开始时间
        player.word_start_time = time.time()

        return round(base * speed_factor * acc_factor * combo_factor)

    def _check_game_end(self, player_id=None):
        """检查游戏结束条件"""
        if self.mode == "classic":
            target = self.target_score
            for p in self.players.values():
                if p.score >= target:
                    self.is_finished = True
                    self.is_running = False
                    return

        elif self.mode == "timed":
            elapsed = time.time() - self.start_time
            if elapsed >= self.time_limit:
                self.is_finished = True
                self.is_running = False
                self.elapsed_time = elapsed
                return

        elif self.mode == "survival":
            alive = [p for p in self.players.values() if p.lives > 0 and p.connected]
            if len(alive) <= 1:
                self.is_finished = True
                self.is_running = False
                return

    def get_rankings(self):
        """获取当前排名"""
        active = [(p.player_id, p.name, p.score, p.accuracy, p.combo, p.lives)
                  for p in self.players.values() if p.connected]
        active.sort(key=lambda x: x[2], reverse=True)
        return [{"rank": i+1, "player_id": pid, "name": name,
                 "score": score, "accuracy": round(acc*100, 1), "combo": combo, "lives": lives}
                for i, (pid, name, score, acc, combo, lives) in enumerate(active)]

    def get_game_result(self):
        """获取最终结果"""
        return {
            "difficulty": self.difficulty,
            "mode": self.mode,
            "language": self.language,
            "duration": time.time() - self.start_time if self.start_time else 0,
            "rankings": self.get_rankings(),
            "players": {pid: p.to_dict() for pid, p in self.players.items()},
        }

    def handle_timeout(self, player_id):
        """处理超时未输入"""
        if not self.is_running:
            return None

        player = self.players.get(player_id)
        if not player:
            return None

        player.score = max(0, player.score - 5)
        player.combo = 0
        player.consecutive_errors += 1

        # 换一个新词
        self.next_word()

        return {
            "timeout": True,
            "player_id": player_id,
            "score_delta": -5,
            "score": player.score,
        }


# ========== 单机模式 ==========

class SinglePlayerGame:
    """单机游戏封装（用于测试和单人练习）"""

    def __init__(self, difficulty="easy", mode="classic", language="en"):
        self.engine = GameEngine(difficulty, mode, language)
        self.engine.add_player("local", "Player")

    def start(self):
        self.engine.start_game()
        return self.engine.current_word

    def type_word(self, user_input):
        return self.engine.check_input("local", user_input)

    @property
    def current_word(self):
        return self.engine.current_word

    @property
    def player(self):
        return self.engine.players["local"]

    @property
    def is_over(self):
        return self.engine.is_finished

    def result(self):
        return self.engine.get_game_result()
