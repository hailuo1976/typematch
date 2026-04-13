"""
TypeMaster LAN - 词库模块
中英文词库，支持4个难度等级
"""

import random

# ========== 英文词库 ==========

ENGLISH_WORDS = {
    # 简单：3-5字母
    "easy": [
        "cat", "dog", "run", "big", "red", "hot", "cup", "map", "box", "hat",
        "sun", "air", "fly", "top", "key", "ice", "arm", "egg", "old", "new",
        "boy", "girl", "fish", "tree", "book", "rain", "star", "moon", "fire",
        "bird", "door", "hand", "song", "blue", "dark", "cool", "home", "time",
        "play", "love", "code", "game", "fast", "good", "jump", "swim", "walk",
        "open", "show", "hero", "gift", "ride", "move", "grow", "kind", "save",
    ],
    # 中等：4-7字母
    "medium": [
        "apple", "beach", "dream", "earth", "green", "house", "juice", "light",
        "magic", "night", "ocean", "piano", "quiet", "river", "smile", "tiger",
        "water", "brave", "candy", "dance", "eagle", "flame", "grape", "happy",
        "internet", "jungle", "knight", "lemon", "music", "north", "party",
        "queen", "robot", "storm", "train", "video", "world", "cloud", "space",
        "power", "heart", "brain", "sword", "craft", "swift", "lucky", "smart",
        "plant", "stone", "color", "mouse", "phone", "table", "chair", "glass",
    ],
    # 困难：6-10字母
    "hard": [
        "abstract", "building", "computer", "database", "electron", "function",
        "generate", "hardware", "identify", "keyboard", "language", "material",
        "notebook", "operator", "platform", "question", "research", "software",
        "terminal", "universe", "vacation", "platform", "triangle", "strategy",
        "creative", "document", "elements", "feedback", "graphics", "hospital",
        "imagine", "junction", "kingdom", "lemonade", "magnetic", "national",
        "obstacle", "painting", "quantity", "rainbow", "schedule", "tomorrow",
        "universe", "velocity", "warriors", "exchange", "yourself", "penguin",
    ],
    # 大师：8-15字母
    "master": [
        "accomplish", "background", "calculator", "development", "experiment",
        "fascinating", "government", "horizontal", "illuminate", "journalism",
        "kindergarten", "laboratory", "maintenance", "negotiation", "organization",
        "photography", "quarantine", "renaissance", "spectacular", "thunderstorm",
        "unbelievable", "vulnerability", "wonderfully", "xylophone", "yesterday",
        "architectural", "biotechnology", "communication", "demonstrate", "environment",
        "frustration", "grammatical", "humanitarian", "independence", "justification",
        "knowledgeable", "manufacturer", "neighborhood", "psychological", "technological",
    ],
}

# ========== 中文词库 ==========

CHINESE_WORDS = {
    # 简单：2-3字
    "easy": [
        "编程", "电脑", "学习", "游戏", "快乐",
        "学校", "数学", "语文", "英语", "科学",
        "朋友", "老师", "运动", "音乐", "画画",
        "深圳", "科技", "创新", "未来", "梦想",
        "太阳", "月亮", "星星", "大海", "高山",
        "蓝天", "白云", "花草", "树木", "河流",
        "春天", "夏天", "秋天", "冬天", "风雪",
        "勇敢", "善良", "聪明", "勤奋", "诚实",
    ],
    # 中等：3-4字
    "medium": [
        "人工智能", "机器人", "宇宙飞船", "互联网",
        "探索发现", "知识海洋", "科技创新", "梦想起航",
        "电子科技", "深圳速度", "编程世界", "数字未来",
        "智慧城市", "绿色发展", "共享经济", "数据驱动",
        "人工智能", "虚拟现实", "区块链", "云计算",
        "搜索引擎", "自动驾驶", "智能家居", "远程教育",
        "北斗导航", "量子计算", "基因编辑", "太空探索",
        "深海探测", "超级计算", "智能制造", "新能源",
    ],
    # 困难：4-6字
    "hard": [
        "人工智能时代", "科技创新驱动", "深圳经济特区",
        "粤港澳大湾区", "中国特色社会主义", "改革开放政策",
        "互联网经济发展", "数字中国建设", "一带一路倡议",
        "人类命运共同体", "可持续发展战略", "创新驱动发展",
        "科学普及教育", "技术人才培养", "信息产业发展",
        "航空航天科技", "生物医药工程", "新材料技术",
        "环境保护工程", "智慧交通系统", "清洁能源开发",
        "量子通信技术", "基因工程应用", "深海科学考察",
    ],
    # 大师：5-8字
    "master": [
        "中国特色社会主义制度", "中华民族伟大复兴",
        "科技强国战略规划", "新一代人工智能发展",
        "量子信息技术突破", "生物多样性保护",
        "可持续发展战略目标", "粤港澳大湾区建设",
        "科技创新引领发展", "数字中国建设方案",
        "改革开放全面深化", "人类命运共同体构建",
        "全球生态环境治理", "新能源技术革命",
        "航空航天事业腾飞", "深海远洋科学考察",
        "信息化与工业化融合", "智能制造业转型升级",
        "教育现代化推进方案", "健康中国战略实施",
    ],
}

# 难度配置（对应PRD 3.5.1）
DIFFICULTY_CONFIG = {
    "easy": {
        "name": "简单",
        "name_en": "Easy",
        "speed": 0.5,       # 词/秒
        "timeout": 10,       # 每词倒计时(秒)
        "multiplier": 1.0,   # 难度系数
        "target_words": 50,
    },
    "medium": {
        "name": "中等",
        "name_en": "Medium",
        "speed": 0.8,
        "timeout": 7,
        "multiplier": 1.5,
        "target_words": 100,
    },
    "hard": {
        "name": "困难",
        "name_en": "Hard",
        "speed": 1.2,
        "timeout": 5,
        "multiplier": 2.0,
        "target_words": 150,
    },
    "master": {
        "name": "大师",
        "name_en": "Master",
        "speed": 1.8,
        "timeout": 3,
        "multiplier": 3.0,
        "target_words": 200,
    },
}


def get_words(language="en", difficulty="easy"):
    """获取指定语言和难度的词库"""
    if language == "en":
        return ENGLISH_WORDS.get(difficulty, ENGLISH_WORDS["easy"])
    else:
        return CHINESE_WORDS.get(difficulty, CHINESE_WORDS["easy"])


def get_random_word(language="en", difficulty="easy"):
    """获取一个随机词"""
    words = get_words(language, difficulty)
    return random.choice(words)


def get_config(difficulty="easy"):
    """获取难度配置"""
    return DIFFICULTY_CONFIG.get(difficulty, DIFFICULTY_CONFIG["easy"])
