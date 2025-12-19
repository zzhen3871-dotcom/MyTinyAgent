"""
Chat 模块的 API 路由 (API Layer) - V2.0
定义 API 的输入输出（Pydantic 模型），并调用 chat_crud.py 里的函数来完成工作。
接口层 (Controller)
作用：它是“前台接待”。
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from tool.db_session import get_db, logger 
import biz.chat.chat_crud as chat_crud

# 引入新的 Schemas
from biz.chat.chat_schemas import (
    UserCreate, UserDisplay, UserLogin,
    ChatCreate, ChatDisplay, ChatUpdate,
    ChatMessageCreate, # 输入
    MessageItem,       # 仅用于类型引用
)

router = APIRouter(prefix="/api/v1/chat", tags=["Chat System"])

# ==========================================
# 1. 用户模块 (User)
# ==========================================

@router.post("/users/register", response_model=UserDisplay)
def register(user: UserCreate, db: Session = Depends(get_db)):
    if chat_crud.get_user_by_name(db, user.user_name):
        raise HTTPException(status_code=400, detail="用户名已存在")
    return chat_crud.create_user(db, user)

@router.post("/users/login", response_model=UserDisplay)
def login(user_login: UserLogin, db: Session = Depends(get_db)):
    user = chat_crud.verify_login(db, user_login)
    if not user:
        raise HTTPException(status_code=400, detail="用户名或密码错误")
    # 可以在这里处理 status == 1 (禁用) 的情况
    if user.status == 1:
        raise HTTPException(status_code=403, detail="账号已被禁用")
    return user

# ==========================================
# 2. 会话模块 (Chat) - 单表操作
# ==========================================

@router.post("/chats", response_model=ChatDisplay)
def create_session(session: ChatCreate, db: Session = Depends(get_db)):
    """创建新会话"""
    return chat_crud.create_chat(db, session)

@router.get("/chats", response_model=List[ChatDisplay])
def get_sessions(user_id: int, db: Session = Depends(get_db)):
    """获取会话列表 (包含消息预览)"""
    return chat_crud.get_user_chats(db, user_id)

@router.put("/chats/{chat_id}", response_model=ChatDisplay)
def update_session(chat_id: int, update_data: ChatUpdate, db: Session = Depends(get_db)):
    """更新会话 (置顶/删除/改名)"""
    chat = chat_crud.update_chat_status(db, chat_id, update_data)
    if not chat:
        raise HTTPException(status_code=404, detail="Chat not found")
    return chat

# ==========================================
# 3. 消息模块 (Message) - JSON 追加
# ==========================================

@router.post("/messages", response_model=ChatDisplay)
def send_message(message: ChatMessageCreate, db: Session = Depends(get_db)):
    """
    发送消息
    注意：返回值不再是单条 Message，而是更新后的整个 Chat 对象！
    这样前端可以直接用新的 messages 列表覆盖旧的。
    """
    try:
        return chat_crud.add_message(db, message)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        logger.error(f"发消息失败: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

@router.get("/history/{chat_id}", response_model=List[MessageItem])
def get_history(chat_id: int, db: Session = Depends(get_db)):
    """
    获取历史消息
    直接把 Chat 表里的 messages JSON 吐出来
    """
    return chat_crud.get_chat_history(db, chat_id)

