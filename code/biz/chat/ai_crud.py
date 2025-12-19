"""
AI Config 模块业务逻辑 (Service Layer) - V3.1 (无加密版)
变更：
1. API Key 不再加密，直接明文存储 (方便调试)
2. ID 使用数据库自增
"""
from sqlalchemy.orm import Session
from typing import List, Optional
from tool.db_session import logger

# 导入定义的 Model 和 Schema
from biz.chat.db_models import AiProviderConfig, AiModelConfig
from biz.chat.chat_schemas import AiProviderCreate, AiModelCreate

# ==========================================
# Area 1: Provider Management (服务商)
# ==========================================

def create_provider(db: Session, provider_in: AiProviderCreate, user_id: int = 0) -> AiProviderConfig:
    """
    创建 AI 服务商配置
    """
    # 1. 直接使用明文 Key
    # 为了兼容数据库表结构，我们依然存入 api_key_encrypted 字段，但内容是明文
    raw_key = provider_in.api_key
    
    # 2. 构建 DB 对象 (ID 由数据库自增)
    db_provider = AiProviderConfig(
        user_id=user_id,
        provider_name=provider_in.provider_name,
        base_url=provider_in.base_url,
        api_key_encrypted=raw_key,  # 存入明文
        is_enabled=True,
        # [新增] 字段赋值
        verified_status=provider_in.verified_status or 0
    )
    
    # 3. 入库
    try:
        db.add(db_provider)
        db.commit()
        db.refresh(db_provider)
        logger.info(f"创建 AI 服务商成功: {provider_in.provider_name}")
        return db_provider
    except Exception as e:
        db.rollback()
        logger.error(f"创建 AI 服务商失败: {e}")
        raise e

def get_providers(db: Session, user_id: int) -> List[AiProviderConfig]:
    """
    获取可见的服务商列表
    """
    return db.query(AiProviderConfig)\
             .filter((AiProviderConfig.user_id == 0) | (AiProviderConfig.user_id == user_id))\
             .filter(AiProviderConfig.is_enabled == True)\
             .all()

def get_provider_by_id(db: Session, provider_id: int) -> Optional[AiProviderConfig]:
    return db.query(AiProviderConfig).filter(AiProviderConfig.id == provider_id).first()


# ==========================================
# Area 2: Model Management (模型)
# ==========================================

def create_model(db: Session, model_in: AiModelCreate) -> AiModelConfig:
    """添加模型"""
    
    # 构建对象 (ID 自增)
    db_model = AiModelConfig(
        provider_id=model_in.provider_id,
        model_name=model_in.model_name,
        model_id=model_in.model_id,
        max_tokens=model_in.max_tokens,
        has_vision=model_in.has_vision,
        # [新增] 字段赋值
        source=model_in.source,
        is_enabled=model_in.is_enabled,
        temperature=model_in.temperature
    )
    
    try:
        db.add(db_model)
        db.commit()
        db.refresh(db_model)
        return db_model
    except Exception as e:
        db.rollback()
        logger.error(f"添加模型失败: {e}")
        raise e

def get_models_by_provider(db: Session, provider_id: int) -> List[AiModelConfig]:
    return db.query(AiModelConfig)\
             .filter(AiModelConfig.provider_id == provider_id)\
             .all()