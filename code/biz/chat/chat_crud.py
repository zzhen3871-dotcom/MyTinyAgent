"""
Chat 模块的数据库操作 (DB Layer) - V2.0
数据库“增删改查” (CRUD) 操作,只负责和数据库打交道，不关心 API 的事。
逻辑层 (Service/DAO)
作用：它是“干活的苦力”。

它不管 HTTP 请求（那是 API 的事）。

它只负责：接收纯净的数据 -> 转换成数据库对象 -> 执行 SQL (INSERT/SELECT) -> 写入数据库。

为什么独立：这是业务逻辑的核心。如果别的模块（比如定时任务）想发消息，它不需要走 HTTP 接口，直接调用这里的函数就行。
"""
from sqlalchemy.orm import Session
from sqlalchemy import desc, and_, func
from typing import Dict, List, Optional
import time
from passlib.context import CryptContext

from biz.chat.db_models import User, Chat
from biz.chat.chat_schemas import (
    UserCreate, UserLogin, 
    ChatCreate, ChatUpdate, 
    ChatMessageCreate
)
from tool.db_session import logger

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)


# ==========================================
# Area 1: 用户管理
# ==========================================
def create_user(db: Session, user_in: UserCreate) -> User:
    hashed_pwd = get_password_hash(user_in.password)
    db_user = User(
        user_name=user_in.user_name,
        password=hashed_pwd,
        nick_name=user_in.nick_name,
        real_name=user_in.real_name,
        mobile=user_in.mobile,
        email=user_in.email,
        status=0,
        source=user_in.source if user_in.source is not None else 0,
        ip=user_in.register_ip,
        theme=0,
        sex=user_in.sex if user_in.sex is not None else 0,
        avatar=""
    )
    try:
        db.add(db_user)
        db.commit()
        db.refresh(db_user)
        return db_user
    except Exception as e:
        db.rollback()
        logger.error(f"创建用户失败: {e}")
        raise e

def get_user_by_name(db: Session, username: str) -> Optional[User]:
    return db.query(User).filter(User.user_name == username).first()

def verify_login(db: Session, login_data: UserLogin) -> Optional[User]:
    user = get_user_by_name(db, login_data.user_name)
    if not user:
        return None
    if verify_password(login_data.password, user.password):
        user.last_login_time = func.now()
        db.commit()
        return user
    return None


# ==========================================
# Area 2: 会话管理
# ==========================================
def create_chat(db: Session, chat_in: ChatCreate) -> Chat:
    db_chat = Chat(
        title=chat_in.title or "新会话",
        creator_id=chat_in.creator_id,
        # [保持复数] messages
        messages=[],  
        messages_num=0,
        is_pinned=0,
        is_deleted=0,
        is_archived=0
    )
    
    if chat_in.initial_message:
        current_time = str(int(time.time()))
        first_msg = {
            "role": "user",
            "content": chat_in.initial_message,
            "create_time": current_time
            # [移除] model_name
        }
        db_chat.messages = [first_msg]
        db_chat.messages_num = 1

    try:
        db.add(db_chat)
        db.commit()
        db.refresh(db_chat)
        return db_chat
    except Exception as e:
        db.rollback()
        logger.error(f"创建会话失败: {e}")
        raise e

def get_user_chats(db: Session, user_id: int, limit: int = 100) -> List[Chat]:
    return db.query(Chat)\
        .filter(and_(Chat.creator_id == user_id, Chat.is_deleted == 0))\
        .order_by(
            desc(Chat.is_pinned),  # 【关键】先按置顶降序 (1 在 0 前面)
            desc(Chat.update_time) # 再按更新时间降序
        )\
        .limit(limit)\
        .all()

def update_chat_status(db: Session, chat_id: int, update_in: ChatUpdate) -> Optional[Chat]:
    chat = db.query(Chat).filter(Chat.chat_id == chat_id).first()
    if not chat:
        return None
    
    # 【修改】逐个判断并更新
    # 只要字段不是 None，就更新它
    if update_in.title is not None:
        chat.title = update_in.title
        
    if update_in.is_pinned is not None:
        chat.is_pinned = update_in.is_pinned
        # 置顶时，顺便更新一下时间，让它浮上来？通常不需要，只看 is_pinned 即可
        
    if update_in.is_deleted is not None:
        chat.is_deleted = update_in.is_deleted
        
    if update_in.is_archived is not None:
        chat.is_archived = update_in.is_archived
        
    # 每次更新状态，都刷新一下 update_time (可选，看产品逻辑)
    chat.update_time = func.now() 
        
    try:
        db.commit()
        db.refresh(chat)
        return chat
    except Exception as e:
        db.rollback()
        logger.error(f"更新会话失败: {e}")
        raise e


# ==========================================
# Area 3: 消息管理
# ==========================================
def add_message(db: Session, msg_in: ChatMessageCreate) -> Chat:
    """
    核心逻辑：往 Chat 表的 messages (JSON字段) 追加一条新记录
    """
    # 1. 先查出是哪个会话
    chat = db.query(Chat).filter(Chat.chat_id == msg_in.chat_id).first()
    if not chat:
        raise ValueError(f"Chat {msg_in.chat_id} not found")

    # 2. 构造新消息的字典结构
    current_time = str(int(time.time()))
    new_msg_dict = {
        "role": msg_in.role,       # 'user' 或 'assistant'
        "content": msg_in.content, # 具体内容
        "create_time": current_time
    }

    # 3. 取出旧消息列表
    # 注意：SQLAlchemy 中修改 JSON 字段，最好先取出来转成 list，修改后再赋回去
    current_msgs = list(chat.messages) if chat.messages else []
    # 4. 追加新消息
    current_msgs.append(new_msg_dict)
    
    # 5. 重新赋值给数据库对象 (触发更新)
    chat.messages = current_msgs
    
    # 6. 更新统计信息
    chat.messages_num = len(current_msgs)
    chat.update_time = func.now() # 更新会话的最后修改时间

    # 7. 提交保存
    try:
        db.commit()
        db.refresh(chat) # 刷新数据
        return chat
    except Exception as e:
        db.rollback()
        logger.error(f"消息追加失败: {e}")
        raise e

def get_chat_history(db: Session, chat_id: int) -> List[Dict]:
    """获取历史消息"""
    chat = db.query(Chat).filter(Chat.chat_id == chat_id).first()
    # [保持复数] 使用 messages
    if not chat or not chat.messages:
        return []
    return chat.messages