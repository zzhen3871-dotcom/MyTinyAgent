from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from tool.LogTool import LogTool

from biz.llm.FakeLLMApi  import router as fakeLLMRouter

# 1. 导入数据库工具
from tool.db_session import init_db, engine, logger as db_logger
# 2. 导入聊天 API 路由 
# 旧: from chat.chat_api import router as chat_router
from biz.chat.chat_api import router as chat_router # 新: chat 在 biz 内部

# 3. 关键：确保模型被 Base 注册 
import biz.chat.db_models # 新: chat 在 biz 内部

# 获取日志
log = LogTool.getLog(__name__)

# 定义路由收集相关模块路由
routerList = [
    fakeLLMRouter,
    # --- 新增 ---
    chat_router  # 把我们的聊天路由加进去
    # --- 新增结束 ---
]

# 生命周期
@asynccontextmanager
async def lifespan(app: FastAPI):
  
  # --- 这是应用启动时 ---
    log.info("应用启动...")
    try:
        log.info("开始初始化数据库...")
        # 调用 init_db() 来创建表 (如果不存在)
        init_db()
        log.info("数据库初始化完成。")
    except Exception as e:
        db_logger.error(f"数据库初始化失败: {e}", exc_info=True)
        # 可以在这里选择是否停止应用
        # raise e

    yield
  # --- 这是应用关闭时 ---
    log.info("应用关闭...")
    try:
        if engine:
            engine.dispose()
            db_logger.info("数据库连接池已关闭。")
    except Exception as e:
        db_logger.error(f"关闭数据库连接池失败: {e}", exc_info=True)
    log.info("应用已关闭。")


# FastAPI 实例
app = FastAPI(
    title="LLM Server",
    version="0.1.0",
    lifespan=lifespan,
    
)

# 添加CORS中间件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允许所有来源，生产环境应限制为特定域名
    allow_credentials=True,
    allow_methods=["*"],  # 允许所有HTTP方法
    allow_headers=["*"],  # 允许所有HTTP头
)

# 加载其它路由
for curRouter in routerList:
    app.include_router(curRouter)

# 挂载静态文件目录
app.mount("/static", StaticFiles(directory="static"), name="static")

# 重定向到静态首页
@app.get("/")
async def redirect_to_static():
    return RedirectResponse(url="/static/index.html")

