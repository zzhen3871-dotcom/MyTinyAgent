# 时间间隔记录工具，用于调试和监控
import time
from typing import Optional
from tool.LogTool import LogTool

log = LogTool.getLog(__name__)
class TimeTool:
    _last: Optional[float] = None  # 类变量，记录上一次调用时间

    @staticmethod
    def exec() -> Optional[float]:
        """
        打印当前时间，并返回与上一次调用的时间间隔（秒）。
        如果是第一次调用，返回 None。
        """
        now = time.time()
        if TimeTool._last is None:
            interval = None
        else:
            interval = now - TimeTool._last
        TimeTool._last = now
        log.info(f"[TimeTool] 当前时间: {now:.3f}s, 间隔: {interval}")
        return interval