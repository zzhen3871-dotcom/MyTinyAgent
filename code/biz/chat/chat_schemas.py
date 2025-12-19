"""
Chat 模块的 Pydantic Schemas 协议层 (Data Contract)
作用：它是 API 的“翻译官”和“安检员”。

它定义了前端传给后端的数据必须长什么样（比如：注册必须有用户名和密码）。

它定义了后端还给前端的数据长什么样（比如：不许返回加密后的密码字段）。

为什么独立：它不依赖数据库，也不依赖逻辑。它是最纯净的“字典定义”。所有人都引用它，但它不引用别人。
"""
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

# ==========================================
# 0. 基础组件 (Message Item)
# ==========================================
class MessageItem(BaseModel):
    role: str = Field(..., description="user 或 assistant")
    content: str
    # [移除] model_name
    token_count: int = 0
    data: Optional[Dict[str, Any]] = None
    create_time: str 

    class Config:
        from_attributes = True

# ==========================================
# 1. 用户模块 (User)
# ==========================================
class UserCreate(BaseModel):
    user_name: str
    password: str
    nick_name: Optional[str] = None
    real_name: Optional[str] = None 
    sex: Optional[int] = 0
    mobile: Optional[str] = None
    email: Optional[str] = None
    source: Optional[int] = 0 
    register_ip: Optional[str] = None 

class UserLogin(BaseModel):
    user_name: str
    password: str

class UserDisplay(BaseModel):
    uid: int 
    user_name: str
    nick_name: Optional[str]
    real_name: Optional[str]
    avatar: Optional[str]
    sex: Optional[int]
    status: int
    theme: int
    province: Optional[str]
    city: Optional[str]
    area: Optional[str]
    create_time: Optional[datetime]
    last_login_time: Optional[datetime]

    class Config:
        from_attributes = True

# ==========================================
# 2. 会话模块 (Chat)
# ==========================================
class ChatCreate(BaseModel):
    title: Optional[str] = None 
    creator_id: int 
    initial_message: Optional[str] = None 

class ChatUpdate(BaseModel):
    title: Optional[str] = None
    is_pinned: Optional[int] = None   
    is_deleted: Optional[int] = None  
    is_archived: Optional[int] = None 

class ChatDisplay(BaseModel):
    chat_id: int
    title: str
    creator_id: int
    is_pinned: int
    is_deleted: int
    is_archived: int
    messages_num: int
    
    # [保持复数] messages
    messages: List[MessageItem] = [] 
    
    create_time: datetime
    update_time: datetime

    class Config:
        from_attributes = True

# ==========================================
# 3. 发送消息 (输入)
# ==========================================
class ChatMessageCreate(BaseModel):
    chat_id: int
    role: str
    content: str
    # [移除] model_name
    data: Optional[Dict[str, Any]] = None