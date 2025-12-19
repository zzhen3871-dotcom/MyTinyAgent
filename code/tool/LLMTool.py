import time
import json
import asyncio
class LLMTool:
    @staticmethod  # 调用静态方法，不需要创建类的实例
    def getChunk(text, id="fake-id",model="fake-model", stop=None):
        chunk = {
            "id": id,
            "object": "chat.completion.chunk",
            "created": int(time.time()),
            "model": model,
            "choices": [{"index": 0,"delta": {"content": text},"finish_reason": stop}]
        }
        return json.dumps(chunk)

    @staticmethod
    async def putChar( text, id="fake-id",  model="fake-model",  sleepTime = 0.01):
        for ch in text:
            chunk = LLMTool.getChunk(ch,id, model)
            yield f"data: {chunk}\n\n"
            if sleepTime > 0:
                await asyncio.sleep(sleepTime)

    @staticmethod
    async def putLine(text, id="fake-id",  model="fake-model",  sleepTime = 0.01):
        for line in text.splitlines(keepends=True):   # keepends=True 保留原始换行
            chunk = LLMTool.getChunk(line,id,model)
            yield f"data: {chunk}\n\n"
            if sleepTime > 0:
                await asyncio.sleep(sleepTime)
            
    @staticmethod
    async def putEnd(id="fake-id",  model="fake-model"):
        end_chunk = LLMTool.getChunk("",id,model, "stop")
        yield f"data: {end_chunk}\n\n"
        yield "data: [DONE]\n\n"

    @staticmethod
    def getModeListJson():
        modeList  = {
            "object": "list",
            "data": [
                {
                "id": "mywen:4b",
                "object": "model",
                "created": 1758116481,
                "owned_by": "fake-llm-org"
                },
                {
                "id": "mywen:8b",
                "object": "model",
                "created": 1758116501,
                "owned_by": "fake-llm-org"
                }
            ]
        }
        return modeList