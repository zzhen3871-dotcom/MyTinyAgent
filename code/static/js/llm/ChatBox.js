/**
 * ChatBox: 只接受 ID 字符串，不再接受任意选择器
 * 构造参数：
 *   client     : LLMClient 实例（内部已带 eventBus）
 *   idList     : {
 *         tips     : 提示
 *         chat     : 消息列表容器 id
 *         input    : 输入框 id
 *         sendBtn  : 发送按钮 id
 *         stopBtn  : 停止按钮 id
 *   }
 *   eventBus   : （可选）外部传入的 EventBus 实例，缺省使用 client.eventBus
 */
class ChatBox {
  constructor({ client, idList, eventBus = null }) {
    this.client = client;
    this.eventBus = eventBus || client.eventBus; // 取外部总线或默认总线
    this.chartRenderer = new ChartRenderer(); 
    this.bindDOM(idList);
    this.bindEvent();
    this.bindExternal();   // <-- 新增：监听外部信号
  }

  bindDOM(idList) {
    this.inp       = document.getElementById(idList.input);
    this.chat      = document.getElementById(idList.chat);
    this.sendBtn   = document.getElementById(idList.sendBtn);
    this.stopBtn   = document.getElementById(idList.stopBtn);
    this.tips      = document.getElementById(idList.tips);

    if (!this.chat || !this.inp || !this.sendBtn || !this.stopBtn) {
      throw new Error('ChatBox: 缺少必要 DOM ID');
    }
  }

  bindEvent() {
    // 统一通过 eventBus 监听
    this.eventBus.on('chat-start',  () => this.setLoading(true));
    this.eventBus.on('chat-done',   () => this.setLoading(false));
    this.eventBus.on('chat-add',    e => this.addChat(e));
    this.eventBus.on('chat-update', e => this.updateChat(e));

    this.sendBtn.onclick = () => this.send();
    this.stopBtn.onclick = () => this.client.stop();

    this.inp.addEventListener('keydown', e => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) this.send();
    });
  }

  bindExternal() {
    // 1. 外部直接塞文本并发送
    this.eventBus.on('chat-request', e => {
      const { text } = e.detail;
      if (!text) return;
      this.inp.value = text;      // 塞进输入框
      this.send();                // 立即发送
    });

    // 2. 外部要求停止
    this.eventBus.on('chat-stop', () => this.client.stop());

    // 3. 外部要求开启新会话
    this.eventBus.on('chat-reset', () => this.reset());
  }


  /*
  // 1. 任意地方触发「直接发送」
eventBus.emit('chat-request', { text: '帮我画上周销售饼图' });

// 2. 任意地方触发「停止」
eventBus.emit('chat-stop');

// 3. 任意地方触发「新会话」
eventBus.emit('chat-reset');
  */


  send() {
    const text = this.inp.value.trim();
    if (!text) return;
    this.inp.value = '';
    this.client.send(text);
  }

  setLoading(on) {
    this.sendBtn.style.display = on ? 'none' : 'inline-block';
    this.stopBtn.style.display = on ? 'inline-block' : 'none';
    this.tips.classList.toggle('loading', on);
  }

  reset() {
    // ① 先重置 LLMClient（会自己 stop）
    this.client.reset();

    // ② 再清自己
    this.chat.innerHTML = '';
    this.setLoading(false);
    this.inp.value = '';

    console.log('[ChatBox] 已开启新会话');
  }

  /**
   * 【核心方法】渲染单条消息
   * @param {string} role - 'user' 或 'assistant'
   * @param {string} content - 消息内容
   * @returns {HTMLElement} 渲染后的 section 元素
   */
  
  // 1. 【修改】把渲染单条消息的逻辑提取出来，变成一个通用方法
  renderMessage(role, content) {
    const isUser = role === 'user';
    const section = document.createElement('section');
    
    // 统一设置间距
    section.style.marginBottom = '24px'; 

    // 图片路径
    const avatarSrc = isUser ? '/static/img/avatar/user.svg' : '/static/img/avatar/assistant.svg';
    const name = isUser ? '用户' : 'Qwen32b'; 

    // Markdown 解析
    let contentHtml = content;
    if (!isUser && typeof marked !== 'undefined') {
        contentHtml = marked.parse(content);
    }
    // === 核心：这里定义了结构，以后改这就全改了 ===
    section.innerHTML = `
      <div class="msg-header" style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
        <img class="icon20" src="${avatarSrc}" style="width:24px; height:24px; border-radius:50%;">
        <div style="font-weight:bold; font-size:14px; color:#444;">${name}</div>
      </div>
      <div class="msg-content markdown-body" style="padding-left:34px;">
        ${contentHtml}
      </div>`;
    
    // 代码高亮
    if (!isUser && typeof hljs !== 'undefined') {
        section.querySelectorAll('pre code').forEach((block) => {
            hljs.highlightElement(block);
        });
    }

    return section;
  }
  
//修改
  addChat(e) {
    console.log('[ChatBox] 新建聊天块', e.detail);
    const section = this.renderMessage(e.detail.role, e.detail.content);
    this.chat.appendChild(section);
    this.chat.scrollTop = this.chat.scrollHeight;
  }

  updateChat(e) {
    // 找到最后一个 section 的内容区域
    const lastSection = this.chat.lastElementChild;
    if (!lastSection) return;

    const contentDiv = lastSection.querySelector('.msg-content');
    
    if (contentDiv) {
        // AI 回复时实时渲染 Markdown
        contentDiv.innerHTML = marked.parse(e.detail.content);
        
        // 代码高亮 (如果有 hljs)
        if (typeof hljs !== 'undefined') {
            contentDiv.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }
    }

    this.chartRenderer.render();
    this.chat.scrollTop = this.chat.scrollHeight;
  }
}