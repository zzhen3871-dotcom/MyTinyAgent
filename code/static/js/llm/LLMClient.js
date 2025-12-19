class LLMClient {
  constructor({
    apiBase,
    model,
    token,
    botId = 'bot-007',
    eventBus = new EventBus() // 默认新建一个，也可外部传入共享实例
  }) {
    this.apiBase = apiBase;
    this.model = model;
    this.token = token;
    this.botId = botId;
    this.eventBus = eventBus;

    this.ctrl = null;
    this.curBlock = null;
    this.messages = []; // 历史记录，可选
  }


  reset() {
    // 1. 若正在输出，先停掉
    this.stop();

    // 2. 清空历史
    this.messages = [];

    // 3. 清空当前块指针
    this.curBlock = null;
  }


  async send(prompt) {
    if (!prompt) return;
    this.push('user', prompt);
    this.emit('chat-start');

    this.ctrl = new AbortController();
    try {
      const res = await fetch(this.apiBase, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [{ role: 'user', content: prompt }],
          stream: true,

          // --- 核心控制参数 ---
          temperature: 0.7,       // [0-2] 随机性：越高越有创意，越低越严谨
          top_p: 1.0,            // [0-1] 核采样：与 temperature 类似，建议二选一调节
          
          // --- 长度与停止控制 ---
          max_tokens: 4096,       // 限制回答的最大 token 数（防止回答过长）
          stop: null,             // 遇到特定字符停止生成，例如 ["\n", "User:"]
          
          // --- 重复性惩罚 ---
          presence_penalty: 0.0,  // [-2.0 - 2.0] 话题新鲜度：正值鼓励模型谈论新话题
          frequency_penalty: 0.0, // [-2.0 - 2.0] 频率惩罚：正值减少逐字重复的可能性

          // --- 高级功能 (视模型支持情况而定) ---
          // response_format: { type: "json_object" }, // 强制输出 JSON 格式
          // seed: 123456,        // 设定随机种子，尝试让结果可复现
          // user: "user-123"     // 终端用户的 ID，用于风控或追踪
        }),
        signal: this.ctrl.signal
      });

      if (!res.ok) {
        let errorMessage = res.statusText;
        try {
          const err = await res.json();
          errorMessage = err?.error?.message || res.statusText;
        } catch (e) {
          // 如果无法解析为 JSON，使用默认错误信息
          errorMessage = `HTTP ${res.status}: ${res.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      this.curBlock = null;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();
        for (const line of lines) {
          if (!line.trim() || !line.startsWith('data:')) continue;
          const data = line.slice(5).trim();
          if (data === '[DONE]') return;
          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content || '';
            if (delta) {
              this.handleDelta(delta);
            }
          } catch (e) {
            console.warn('Failed to parse stream data:', data, e);
          }
        }
      }
    } catch (e) {
      if (e.name === 'AbortError') return;
      this.push('assistant', `**错误**：${e.message}`);
    } finally {
      // 1. 获取刚刚 AI 说完的完整内容
      // this.messages 是数组，最后一个就是刚刚 AI 说的话
      const lastMsg = this.messages[this.messages.length - 1];
      
      // 2. 发送 chat-done 信号时，把 content 带上！
      // 这样 index.html 里监听 chat:finish 时才能拿到 data.content
      this.emit('chat-done', { 
          role: 'assistant',
          content: lastMsg ? lastMsg.content : "" 
      });

      this.ctrl = null;
      this.curBlock = null;
    }
  }

  stop() {
    this.ctrl?.abort();
  }

  push(role, text = '') {
    if (!this.curBlock || this.curBlock.role !== role) {
      this.curBlock = { role, content: text };
      this.messages.push(this.curBlock);
      this.emit('chat-add', { ...this.curBlock });
    } else {
      this.curBlock.content += text;
      this.emit('chat-update', { ...this.curBlock });
    }
  }

  handleDelta(delta) {
    this.push('assistant', delta);
  }

  // 统一加上 botId 后发到总线
  emit(type, detail = {}) {
    this.eventBus.emit(type, { ...detail, botId: this.botId });
  }
}
