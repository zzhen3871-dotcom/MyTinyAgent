/* ChartRenderer.js */
class ChartRenderer {
  constructor(chatSelector = 'section:last-of-type .msg-content') {
    this.chatSelector = chatSelector; // 默认取最后一段对话内容
    this.timer = null;                // 防抖定时器
    this.DELAY = 300;                 // 连续调用时，最后一次延迟 ms
  }

  /* 外部唯一接口：多次调用会重置定时器，确保只处理最后一次 */
  render() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this._doRender(), this.DELAY);
  }

  /* 真正干活 */
  _doRender() {
    const contentDiv = document.querySelector(this.chatSelector);
    if (!contentDiv) return;

    const regex = /chart_start([\s\S]*?)chart_end/g; // 全局，支持多图表
    let match;
    while ((match = regex.exec(contentDiv.innerHTML)) !== null) {
      const raw = match[1];
      try {
        const cfg = JSON.parse(raw);
        this._drawChart(cfg, contentDiv, match[0]); // 把整块替换掉
      } catch (e) {
        console.warn('[ChartRenderer] JSON 解析失败', e, raw);
      }
    }
  }

  /* 根据配置画图 */
  _drawChart(cfg, container, matchStr) {
    const { shape, data } = cfg;
    const div = document.createElement('div');
    div.style.width = '400px';
    div.style.height = '400px';

    // 双击放大（可扩展）
    div.ondblclick = () => this._showFull(div);

    let option;
    if (shape === 'pie') {
      option = {
        title: { text: 'Referer of a Website', subtext: 'Fake', left: 'center' },
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left' },
        series: [{ name: 'Access', type: 'pie', radius: '50%', data }]
      };
    } else if (shape === 'bar') {
      option = {
        xAxis: { type: 'category', data: data.label },
        yAxis: { type: 'value' },
        series: [{ data: data.value, type: 'bar' }]
      };
    } else {
      return;
    }

    // 把原文本节点替换成图表
    const textNode = this._findTextNode(container, matchStr);
    if (textNode) {
      textNode.replaceWith(div);
      const chart = echarts.init(div);
      chart.setOption(option);
      window.addEventListener('resize', () => chart.resize());
    }
  }

  /* 找到包含 matchStr 的文本节点，直接替换 */
  _findTextNode(parent, str) {
    const walk = document.createTreeWalker(
      parent,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    let node;
    while ((node = walk.nextNode())) {
      if (node.textContent.includes(str)) return node;
    }
    return null;
  }

  /* 占位：后续可做真正的全屏弹窗 */
  _showFull(div) {
    console.log('双击放大', div);
  }
}