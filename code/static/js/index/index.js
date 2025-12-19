/**
 * code\static\js\index.js
 * 负责 index.html 的主要交互逻辑
 */

// ================= 1. UI 组件初始化 =================
const tabs = new Tabs('#myTabs', {
    initialTab: 0,
    animation: true,
    showCloseButton: false,
    onChange: (index) => {
        console.log(`切换到标签页: ${index}`);
    }
});

document.addEventListener('DOMContentLoaded', function () {
    // 搜索下拉框
    const select2 = new Select('#select2', {
        search: true,
        onChange: (value, text) => {
            console.log('选择2:', value, text);
        }
    });

    // 初始化 Split.js (左右拖拽布局)
    const mySplit = new MySplit("#left", "#main", "#right");
});

// ============================================================
    // ▼▼▼ 新增：侧边栏收起/展开逻辑 ▼▼▼
    // ============================================================
    const sidebarBtn = document.querySelector('.closeBar'); // 获取图标按钮
    const leftPanel = document.getElementById('left');      // 获取左侧栏

    if (sidebarBtn && leftPanel) {
        sidebarBtn.style.cursor = 'pointer'; // 鼠标放上去变小手

        sidebarBtn.onclick = () => {
            // 获取当前左侧栏的宽度
            const currentWidth = leftPanel.getBoundingClientRect().width;

            if (currentWidth > 0) {
                // --- 收起逻辑 ---
                // 1. 记录收起前的宽度，方便下次展开恢复 (存到 dataset 里)
                leftPanel.dataset.oldWidth = currentWidth;
                
                // 2. 调用 Split.js 的 collapse 方法 (假设你的 MySplit 封装了这个，或者直接操作 DOM)
                // 如果 MySplit 是对 Split.js 的简单封装，通常可以直接设置 size
                // 这里我们用最通用的 DOM 操作：强制宽度为 0
                leftPanel.style.width = '0px';
                leftPanel.style.minWidth = '0px'; // 防止 min-width 撑开
                leftPanel.style.padding = '0';    // 去掉 padding 防止还有缝隙
                leftPanel.style.overflow = 'hidden'; // 隐藏内容
                
                // 3. 既然收起了，给 main 腾地方 (Split.js 通常会自动处理 flex，但手动改 width 后可能需要重置)
                // 简单粗暴的方法：直接让 left 消失
                // leftPanel.style.display = 'none'; // 也可以用这个，更彻底
            } else {
                // --- 展开逻辑 ---
                // leftPanel.style.display = 'flex'; // 如果上面用了 display: none，这里要改回 flex
                
                // 恢复之前的宽度，如果没有记录就给个默认值 (比如 260px)
                const oldWidth = leftPanel.dataset.oldWidth || '260';
                leftPanel.style.width = oldWidth + 'px';
                leftPanel.style.minWidth = ''; // 恢复 CSS 里的默认值
                leftPanel.style.padding = '';  // 恢复默认
            }
        };
    }




// ================= 2. LLM 核心模块初始化 =================
const apiBase = 'http://127.0.0.1:5800/fakeLLM/v1/chat/completions';
const model = 'mywen3:0.1b';
const bus = new EventBus();

// Client 添加 window. 前缀
window.client = new LLMClient({
    apiBase: apiBase,
    model: model,
    token: 'sk-test',
    botId: 'bot-007',
    eventBus: bus
});

// ChatBox 添加 window. 前缀，方便全局调用
window.chatBoxInstance = new ChatBox({
    client: window.client,
    idList: {
        'chat': 'chat',
        'input': 'prompt',
        'tips': 'loading',
        'sendBtn': 'sendBtn',
        'stopBtn': 'stopBtn'
    }
});

// ================= 3. 全局状态与视图逻辑 =================
let currentUser = null;

// --- 视图切换函数 (iframe vs 聊天框) ---
function switchView(viewName) {
    const iframe = document.getElementById('newChatFrame');
    const chatView = document.getElementById('conversation-view');

    if (viewName === 'new') {
        iframe.style.display = 'block';
        chatView.style.display = 'none';
    } else {
        iframe.style.display = 'none';
        chatView.style.display = 'flex';
    }
}

// --- 监听 iframe (新建对话页) 传来的消息 ---
window.addEventListener('message', function (event) {
    if (!event.data) return;

    // 情况 A: 子页面发消息说“我要发送文本”
    if (event.data.type === 'new-chat-message') {
        const content = event.data.content;
        switchView('chat');
        const mainPrompt = document.getElementById('prompt');
        const mainSendBtn = document.getElementById('sendBtn');
        if (mainPrompt && mainSendBtn) {
            mainPrompt.value = content;
            mainSendBtn.click();
        }
    }

    // 情况 B: 子页面发消息说“我被点击了” -> 关闭父页面的菜单
    if (event.data.type === 'global-click') {
        if (typeof window._globalMenuClickListener === 'function') {
            window._globalMenuClickListener();
        }
    }
});

// ================= 4. 用户系统 (登录/注册) =================
function showRegister() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('registerModal').style.display = 'flex';
    document.getElementById('regMsg').innerText = '';
}

function showLogin() {
    document.getElementById('registerModal').style.display = 'none';
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('loginMsg').innerText = '';
}

async function doLogin() {
    const user_name = document.getElementById('loginUser').value;
    const password = document.getElementById('loginPwd').value;
    const msgBox = document.getElementById('loginMsg');

    if (!user_name || !password) {
        msgBox.innerText = "请输入用户名和密码";
        return;
    }

    msgBox.innerText = "登录中...";

    try {
        const response = await fetch('/api/v1/chat/users/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_name, password })
        });

        if (response.ok) {
            currentUser = await response.json();
            document.getElementById('loginModal').style.display = 'none';
            document.querySelector('.user').innerHTML =
                `<img class="avatar" src="/static/img/avatar.png">${currentUser.nick_name || currentUser.user_name}`;

            loadSessionList();
        } else {
            const err = await response.json();
            msgBox.innerText = err.detail || "登录失败";
        }
    } catch (e) {
        msgBox.innerText = "网络错误，请检查服务是否启动";
        console.error(e);
    }
}

async function doRegister() {
    const user_name = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPwd').value.trim();
    const nick_name = document.getElementById('regNick').value.trim();
    const real_name = document.getElementById('regReal').value.trim();
    const mobile = document.getElementById('regMobile').value.trim();
    const sex = parseInt(document.getElementById('regSex').value);
    const msgBox = document.getElementById('regMsg');

    if (!user_name || !password) {
        msgBox.innerText = "用户名和密码不能为空";
        return;
    }

    msgBox.innerText = "提交中...";

    try {
        const payload = {
            user_name,
            password,
            nick_name: nick_name || user_name,
            real_name: real_name || null,
            mobile: mobile || null,
            sex: sex,
            source: 0
        };

        const response = await fetch('/api/v1/chat/users/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            alert("注册成功！请登录。");
            showLogin();
            document.getElementById('loginUser').value = user_name;
        } else {
            const err = await response.json();
            msgBox.innerText = err.detail || "注册失败";
        }
    } catch (e) {
        console.error(e);
        msgBox.innerText = "网络错误";
    }
}

// ================= 5. 会话管理 (新建/列表/历史/重命名) =================

// 监听 "newChatBtn" 按钮
const newChatBtn = document.getElementById('newChatBtn');
if (newChatBtn) {
    newChatBtn.onclick = () => {
        console.log("点击新建对话");

        // 1. 置空 Session
        if (window.client) {
            window.client.currentSessionId = null;
            window.client.history = [];
        }
        // 2. UI 更新
        document.querySelectorAll('.left .item').forEach(el => el.classList.remove('active'));
        bus.emit('chat-reset');
        switchView('new');  // 切换回 iframe 首页
    };
}

async function updateSessionStatus(chatId, data) {
    try {
        const res = await fetch(`/api/v1/chat/chats/${chatId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        if (res.ok) {
            await loadSessionList();
        } else {
            console.error("更新失败");
        }
    } catch (e) {
        console.error("网络错误", e);
    }
}

// 打开重命名弹窗
function openRenameModal(chatId, currentTitle) {
    const modal = document.getElementById('renameModal');
    const input = document.getElementById('renameInput');
    const confirmBtn = document.getElementById('renameConfirmBtn');
    const cancelBtn = document.getElementById('renameCancelBtn');
    const closeBtn = document.getElementById('renameCloseBtn');

    input.value = currentTitle;
    modal.style.display = 'flex';
    setTimeout(() => input.focus(), 50);

    const closeModal = () => {
        modal.style.display = 'none';
    };

    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;

    confirmBtn.onclick = async () => {
        const newTitle = input.value.trim();
        if (newTitle && newTitle !== "") {
            await updateSessionStatus(chatId, { title: newTitle });
            closeModal();
        } else {
            alert("名称不能为空");
        }
    };

    input.onkeydown = (e) => {
        if (e.key === 'Enter') confirmBtn.click();
    };
}

// --- 弹窗逻辑：删除 (新增) ---
function openDeleteModal(chatId) {
    const modal = document.getElementById('deleteModal');
    if (!modal) return console.error("找不到 deleteModal");

    const confirmBtn = document.getElementById('deleteConfirmBtn');
    const cancelBtn = document.getElementById('deleteCancelBtn');

    modal.style.display = 'flex';

    const closeModal = () => {
        modal.style.display = 'none';
    };

    cancelBtn.onclick = closeModal;

    // 绑定删除按钮
    confirmBtn.onclick = async () => {
        // 调用删除接口
        await updateSessionStatus(chatId, { is_deleted: 1 });
        
        // 如果当前正在看这个会话，则重置回新建页
        if (window.client && window.client.currentSessionId === chatId) {
            const newChatBtn = document.getElementById('newChatBtn');
            if (newChatBtn) newChatBtn.click();
        }
        closeModal();
    };
}

// 加载侧边栏列表
async function loadSessionList() {
    if (!currentUser) return;

    try {
        const res = await fetch(`/api/v1/chat/chats?user_id=${currentUser.uid}`);
        const sessions = await res.json();

        const listDiv = document.querySelector('.logList');
        listDiv.innerHTML = '';

        const preventScroll = (e) => { e.preventDefault(); };

        const closeMenuAndUnlockScroll = () => {
            document.querySelectorAll('.pop-menu').forEach(el => el.remove());
            if (listDiv) {
                listDiv.removeEventListener('wheel', preventScroll);
                listDiv.removeEventListener('touchmove', preventScroll);
            }
        };

        if (window._globalMenuClickListener) {
            document.removeEventListener('click', window._globalMenuClickListener);
        }
        window._globalMenuClickListener = () => { closeMenuAndUnlockScroll(); };
        document.addEventListener('click', window._globalMenuClickListener);

        sessions.forEach(sess => {
            const item = document.createElement('div');
            item.className = 'item';
            if (window.client && window.client.currentSessionId === sess.chat_id) {
                item.classList.add('active');
            }

            const textSpan = document.createElement('span');
            textSpan.className = 'item-text';
            textSpan.innerText = sess.title || "未命名会话";
            item.appendChild(textSpan);

            // 图标与菜单逻辑
            const actionBtn = document.createElement('img');
            actionBtn.className = 'item-icon';
            const iconPin = '/static/img/svg/pin.svg';
            const iconOther = '/static/img/svg/other.svg';

            if (sess.is_pinned) {
                actionBtn.src = iconPin;
                actionBtn.style.opacity = '1';
            } else {
                actionBtn.src = iconOther;
            }

            actionBtn.onmouseenter = () => { actionBtn.src = iconOther; };
            actionBtn.onmouseleave = () => {
                if (sess.is_pinned) actionBtn.src = iconPin;
                else actionBtn.src = iconOther;
            };

            actionBtn.onclick = (e) => {
                e.stopPropagation();
                closeMenuAndUnlockScroll();
                listDiv.addEventListener('wheel', preventScroll, { passive: false });
                listDiv.addEventListener('touchmove', preventScroll, { passive: false });

                const menu = document.createElement('div');
                menu.className = 'pop-menu';

                const createMenuItem = (text, iconPath, onClick, isDanger = false) => {
                    const div = document.createElement('div');
                    div.className = `pop-menu-item ${isDanger ? 'danger' : ''}`;
                    const img = document.createElement('img');
                    img.src = iconPath;
                    img.className = 'menu-icon';
                    div.appendChild(img);
                    const span = document.createElement('span');
                    span.innerText = text;
                    div.appendChild(span);
                    div.onclick = (evt) => { 
                        evt.stopPropagation(); // 关键：阻止冒泡，防止误关弹窗
                        onClick(); 
                    };
                    return div;
                };

                // 菜单项
                const pinText = sess.is_pinned ? "取消置顶" : "置顶会话";
                const pinIconPath = sess.is_pinned ? '/static/img/svg/nopin.svg' : '/static/img/svg/pin.svg';
                
                menu.appendChild(createMenuItem(pinText, pinIconPath, () => {
                    updateSessionStatus(sess.chat_id, { is_pinned: sess.is_pinned ? 0 : 1 });
                }));

                menu.appendChild(createMenuItem("重命名", "/static/img/svg/rename.svg", () => {
                    closeMenuAndUnlockScroll();
                    openRenameModal(sess.chat_id, sess.title);
                }));

                menu.appendChild(createMenuItem("删除会话", "/static/img/svg/delete.svg", () => {
                    closeMenuAndUnlockScroll(); // 先关闭菜单
                    openDeleteModal(sess.chat_id); // 打开自定义弹窗
                }, true));

                menu.style.top = (e.clientY + 10) + 'px';
                menu.style.left = (e.clientX - 80) + 'px';
                menu.style.display = 'block';
                document.body.appendChild(menu);
            };

            item.appendChild(actionBtn);

            item.onclick = (e) => {
                if (e.target === actionBtn) return;
                document.querySelectorAll('.left .item').forEach(el => el.classList.remove('active'));
                item.classList.add('active');
                loadChatHistory(sess.chat_id);
            };

            listDiv.appendChild(item);
        });

    } catch (e) {
        console.error("加载列表失败", e);
    }
}

// 加载聊天历史
async function loadChatHistory(sessionId) {
    console.log("正在加载会话ID:", sessionId);
    switchView('chat'); // 必须显示聊天界面

    const chatContainer = document.getElementById('chat');
    chatContainer.innerHTML = '<div style="text-align:center;color:#999;margin-top:20px;"><i class="fas fa-spinner fa-spin"></i> 加载历史记录...</div>';

    try {
        if (window.client) {
            window.client.reset();
            window.client.currentSessionId = sessionId;
        }

        const res = await fetch(`/api/v1/chat/history/${sessionId}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);

        const history = await res.json();
        chatContainer.innerHTML = '';

        if (!Array.isArray(history)) {
            chatContainer.innerHTML = '<div style="text-align:center;color:red;">数据格式错误</div>';
            return;
        }

        if (window.client) {
            window.client.history = history.map(msg => ({
                role: msg.role,
                content: msg.content
            }));
        }

        if (window.chatBoxInstance) {
            history.forEach(msg => {
                const section = window.chatBoxInstance.renderMessage(msg.role, msg.content);
                chatContainer.appendChild(section);
            });
        }

        if (typeof hljs !== 'undefined') {
            chatContainer.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });
        }

        chatContainer.scrollTop = chatContainer.scrollHeight;
        console.log(`✅ 成功加载 ${history.length} 条历史记录`);

    } catch (e) {
        console.error("加载历史失败", e);
        chatContainer.innerHTML = '<div style="text-align:center;color:red;">加载失败，请检查网络</div>';
    }
}

// ================= 6. 消息监听与持久化 =================

// 监听 chat-add (用户发言)
bus.on('chat-add', async (event) => {
    const { role, content } = event.detail;
    if (role !== 'user') return;

    if (document.getElementById('conversation-view').style.display === 'none') {
        switchView('chat');
    }

    console.log("📝 捕获用户发言:", content);

    // 新会话逻辑
    if (!window.client.currentSessionId) {
        console.log("🆕 检测到新对话，正在创建 Session...");

        if (!currentUser || !currentUser.uid) {
            console.warn("⚠️ 未登录，消息仅本地显示");
            return;
        }

        try {
            const res = await fetch('/api/v1/chat/chats', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    title: content.substring(0, 20) || "新会话",
                    creator_id: currentUser.uid,
                    initial_message: content
                })
            });

            if (res.ok) {
                const newSession = await res.json();
                window.client.currentSessionId = newSession.chat_id;
                console.log("✅ 会话创建成功 ID:", newSession.chat_id);
                await loadSessionList();
                return; // initial_message 已存，退出
            } else {
                console.error("❌ 创建会话失败", await res.text());
                return;
            }
        } catch (e) {
            console.error("❌ 创建会话异常", e);
            return;
        }
    }

    // 老会话逻辑
    if (window.client.currentSessionId) {
        await saveMessageToBackend(window.client.currentSessionId, 'user', content);
    }
});

// 监听 chat-done (AI 回答完成)
bus.on('chat-done', async (event) => {
    const { content } = event.detail;
    console.log("🤖 AI 回答完毕，准备保存");

    if (window.client.currentSessionId && currentUser) {
        await saveMessageToBackend(window.client.currentSessionId, 'assistant', content);
    } else {
        console.warn("⚠️ 未登录或会话ID缺失，AI 回复不保存");
    }
});

async function saveMessageToBackend(sessionId, role, content) {
    if (!content || !content.trim()) return;
    console.log(`💾 正在保存 ${role} 消息...`);
    try {
        const res = await fetch('/api/v1/chat/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: sessionId,
                role: role,
                content: content
            })
        });
        if (res.ok) console.log(`✅ ${role} 消息保存成功`);
        else console.error(`❌ 保存 ${role} 消息失败`, await res.text());
    } catch (e) {
        console.error(`❌ 保存 ${role} 消息网络异常`, e);
    }
}


// ================= 7. [新增] 侧边栏交互逻辑 =================

/**
 * 切换侧边栏的显示/隐藏
 * 原理：给 body 切换 'layout-collapsed' 类，利用 CSS 控制样式
 */
window.toggleSidebar = function() {
    document.body.classList.toggle('layout-collapsed');
    
    // 调试日志，方便你看是否生效
    const isCollapsed = document.body.classList.contains('layout-collapsed');
    console.log("侧边栏切换状态:", isCollapsed ? "已收起" : "已展开");
};

/**
 * 悬浮条上的"新建对话"代理函数
 * 原理：模拟点击原来的 #newChatBtn 按钮
 */
window.createNewChat = function() {
    const originalBtn = document.getElementById('newChatBtn');
    if (originalBtn) {
        originalBtn.click();
        
        // (可选) 如果你希望点击新建后自动展开侧边栏，把下面这行注释取消掉
        // if (document.body.classList.contains('layout-collapsed')) {
        //     toggleSidebar();
        // }
    } else {
        console.error("找不到新建对话按钮 #newChatBtn");
    }
};
