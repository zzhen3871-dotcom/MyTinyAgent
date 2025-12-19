class TagMachine {
  static ST = { TEXT: 0, OPEN: 1, TAG: 2 };

  // 白名单直接写结束标签名字
  static DEFAULT_ALLOW_TAGS = new Set(['think', '/think', 'chart', '/chart']);

  constructor(allowTags = TagMachine.DEFAULT_ALLOW_TAGS) {
    this.allowTags = new Set([...allowTags].map(t => t.toLowerCase()));
    this.reset();
  }
  reset()
  {
    this.tokenList = [];
    this.state = TagMachine.ST.TEXT;
    this.buf = '';
    this.tagName = '';
  }

  putText(str) {
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      this._read(ch)
    }
    if (state !== TagMachine.ST.TEXT) buf = `<${tagName}${buf}`;
    if (buf) tokenList.push({ type: 'text', content: buf });

    return tokenList;
  }

  _read(ch ){
      switch (this.state) {
        case TagMachine.ST.TEXT:
          if (ch === '<' && /[a-zA-Z\/]/.test(str[i + 1] || '')) { // 第二个字符可以是字母或 /
            if (this.buf) this.tokenList.push({ type: 'text', content: buf }), buf = '';
            this.state = TagMachine.ST.OPEN;
          } else {
            buf += ch;
          }
          break;

        case TagMachine.ST.OPEN:
          // 首字符可以是字母或 / （处理 </think>）
          if (/[a-zA-Z0-9\/]/.test(ch)) {
            this.tagName = ch.toLowerCase();
            this.state = TagMachine.ST.TAG;
          } else {
            this.buf += '<' + ch;
            this.state = TagMachine.ST.TEXT;
          }
          break;

        case TagMachine.ST.TAG:
          if (ch === '>') {
            if (this.allowTags.has(this.tagName)) {
              this.tokenList.push({ type: 'tag', name: this.tagName, full: `<${this.tagName}>` });
            } else {
              this.buf += `<${this.tagName}>`;
            }
            this.tagName = '';
            this.state = TagMachine.ST.TEXT;
          } else if (/[a-zA-Z0-9\/]/.test(ch)) { // 把 / 也视为合法字符
            this.tagName += ch.toLowerCase();
          } else {
            this.buf += `<${this.tagName}${ch}`;
            this.tagName = '';
            this.state = TagMachine.ST.TEXT;
          }
          break;
      }
    }
}
