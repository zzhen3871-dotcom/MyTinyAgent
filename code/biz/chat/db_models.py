# 专门管'表结构'。定义 ChatMessage 表长什么样。

"""
数据库表模型 包含 User, ChatSession, ChatMessage 三张表及其关联
数据层 (Data Structure)
作用：它是数据库的“蓝图”。
为什么独立：它只关心数据库结构。如果以后要换数据库或改表结构，只改这一个文件。
"""
from sqlalchemy import Column, Integer, String, SmallInteger, DateTime, BigInteger, JSON
from sqlalchemy.sql import func
from tool.db_session import Base

# ==========================================
# 1. 用户表 (User) - V3新版
# ==========================================
class User(Base):
    __tablename__ = "user"

    # 主键 uid: bigint(20)
    uid = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # 核心身份
    user_name = Column(String(255), unique=True, index=True, nullable=False)
    nick_name = Column(String(128)) 
    real_name = Column(String(32))
    password = Column(String(128), nullable=False)
    
    # 联系方式
    mobile = Column(String(24))
    email = Column(String(255))
    
    # 资料
    avatar = Column(String(800))
    sex = Column(SmallInteger, default=0)    # tinyint(4)
    profile = Column(String(1024))
    
    # 状态与配置 (全部使用 int)
    status = Column(SmallInteger, default=0) # 0 启用, 1 禁用
    source = Column(SmallInteger, default=0) # 0 注册, 1 导入
    theme = Column(SmallInteger, default=0)  # 0 自动, 1 浅色, 2 深色
    
    # 归属地与网络
    province = Column(String(32))
    city = Column(String(32))
    area = Column(String(255))
    ip = Column(String(32))
    
    # 审计
    creator_id = Column(BigInteger, nullable=True) # 注册为空
    create_time = Column(DateTime(timezone=True), server_default=func.now())
    update_time = Column(DateTime(timezone=True), onupdate=func.now())
    last_login_time = Column(DateTime(timezone=True))


# ==========================================
# 2. 聊天表 (Chat) - V3新版 (JSON存储)
# ==========================================
class Chat(Base):
    __tablename__ = "chat"

    # chat_id: bigint(20)
    chat_id = Column(BigInteger, primary_key=True, index=True, autoincrement=True)
    
    # 基础信息
    title = Column(String(255), default="新会话")
    creator_id = Column(BigInteger, index=True, nullable=False) # 关联 User.uid
    
    # 核心数据: messages (JSON 类型)
    # 存储: [{role, content, create_time...}, ...]
    messages = Column(JSON, default=list) 
    
    # 状态标记 (严格使用 Integer/SmallInteger)
    is_pinned = Column(SmallInteger, default=0)   # 1-置顶, 0-正常
    is_deleted = Column(SmallInteger, default=0)  # 1-已删除, 0-正常
    is_archived = Column(SmallInteger, default=0) # 1-归档
    
    # 统计
    messages_num = Column(Integer, default=0)

    # 时间
    create_time = Column(DateTime(timezone=True), server_default=func.now())
    update_time = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())