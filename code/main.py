from tool.ConfigTool import ConfigTool
from tool.LogTool import LogTool
from tool.TimeTool import TimeTool
import uvicorn

log = LogTool.getLog(__name__)

if __name__ == "__main__":
    log.info("My Tiny AI Agent Start!!!")
    ConfigTool.printAll()
    TimeTool.exec()
    uvicorn.run(
        "biz.MainServer:app",
        host=ConfigTool.get("server", "host", "0.0.0.0"),
        port=ConfigTool.getInt("server", "port", 5800),
        reload=True,
    )