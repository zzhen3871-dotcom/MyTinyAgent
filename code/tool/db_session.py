# 专门管'连接'。创建连接池，提供 get_db 函数。这就是你说的那个可共享的'库'

"""
数据库会话管理（共享模块）
负责：
1. 创建 SQLAlchemy Engine (连接池)
2. 创建 SessionLocal (会话工厂)
3. 定义 Base (模型基类)
4. 提供 get_db (FastAPI 依赖注入)
5. 提供 init_db (初始化数据库表)
"""
import json
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from tool.ConfigTool import ConfigTool
from tool.LogTool import LogTool

# 1. 初始化日志
logger = LogTool.getLog(__name__)

# 2. 读取配置
try:
    # 直接使用 ConfigTool.get()
    DATABASE_URL = ConfigTool.get('database', 'url') 
    
    if not DATABASE_URL:
        # 我们从 config-dev.ini 读取 [database] url
        raise ValueError("数据库 'url' 未在 config-dev.ini 中配置")
        
    logger.info(f"数据库配置加载成功。URL: {DATABASE_URL[:15]}...") # 隐藏密码
except Exception as e:
    logger.error(f"加载数据库配置失败: {e}", exc_info=True)
    DATABASE_URL = "sqlite:///:memory:" # 备用内存数据库
    logger.warning("回退到内存数据库 (sqlite:///:memory:)")
# --- 修正结束 ---

# 3. 创建 SQLAlchemy Engine (连接池)
engine_args = {"pool_recycle": 3600}
if DATABASE_URL.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}

def toShow(obj):
    """
    ensure_ascii=False -> 让中文直接以字符形式存储
    """
    return json.dumps(obj, ensure_ascii=False)

try:
    engine = create_engine(DATABASE_URL, json_serializer=toShow, **engine_args)
    
    # 4. 创建 SessionLocal (会话工厂)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    
    # 5. 定义 Base (模型基类)
    # 所有模块的模型 (chat, user) 都将继承这个 Base
    Base = declarative_base()
    
    logger.info("SQLAlchemy Engine 和 SessionLocal 创建成功。")

except Exception as e:
    logger.error(f"创建 SQLAlchemy Engine 失败: {e}", exc_info=True)
    raise e

# 6. (函数) FastAPI 依赖注入
def get_db():
    """
    FastAPI 依赖注入函数
    为每个 API 请求提供一个数据库会话，并在请求结束后自动关闭
    """
    db = SessionLocal()
    try:
        yield db
    except Exception as e:
        logger.error(f"数据库会话出错: {e}", exc_info=True)
        db.rollback() 
        raise
    finally:
        db.close() 

# 7. (函数) 初始化数据库表
def init_db():
    """
    初始化数据库。
    它会找到所有继承了 Base 的模型类 (需要被提前导入)，并在数据库中创建对应的表。
    """
    try:
        logger.info("正在初始化数据库表...")
        
        # 这里的 Base.metadata 会自动收集所有继承了 Base 的类
        Base.metadata.create_all(bind=engine)
        logger.info("数据库表初始化完成。")
    except Exception as e:
        logger.error(f"数据库表初始化失败: {e}", exc_info=True)
        raise