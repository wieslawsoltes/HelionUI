import { AUTO_TARGET, Key, Opcode } from '../core/schema.js';
/** Browser boundary only: normalize OS input, pack commands, forward IME commit text. No control hit-testing. */
export class BrowserInput {
  constructor(canvas, commands, invalidate, options = {}) {
    this.options=options;this.canvas = canvas; this.commands = commands; this.invalidate = invalidate; this.abort = new AbortController();
    this.lastPointerDown=null;this.composing = false; this.skipComposition = false; this.proxy = document.createElement('textarea');
    this.proxy.setAttribute('aria-label', 'Helion GPU text input bridge'); this.proxy.setAttribute('autocapitalize', 'off');
    this.proxy.autocomplete = 'off'; this.proxy.spellcheck = false;
    this.proxy.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;padding:0;border:0;';
    this.proxy.tabIndex = -1; document.body.append(this.proxy); canvas.tabIndex = 0;
    this.refreshBounds(); const signal = this.abort.signal;
    const on = (element, type, fn, extra = {}) => element.addEventListener(type, fn, { signal, ...extra });
    const pointer = (kind, event) => {
      const p = this.position(event);
      this.push(kind, { ...p, a: event.pressure || 0, b: kind===Opcode.Down?this.clickCount(event):0, c: (event.pointerType === 'touch' ? 2 : 1) | (((event.shiftKey?1:0)|(event.ctrlKey?2:0)|(event.metaKey?4:0)|(event.altKey?8:0))<<8) });
    };
    on(canvas, 'pointerdown', e => {
      if (!e.isPrimary) return;
      this.refreshBounds(); canvas.setPointerCapture(e.pointerId);
      if (e.pointerType !== 'touch') this.focusTextInput(); else canvas.focus({ preventScroll: true });
      pointer(Opcode.Down, e); e.preventDefault();
    });
    on(canvas, 'pointermove', e => { if (e.isPrimary) pointer(Opcode.Move, e); });
    on(canvas, 'pointerup', e => { if (!e.isPrimary) return; pointer(Opcode.Up, e); if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); });
    on(canvas, 'pointercancel', () => this.push(Opcode.Cancel));
    on(canvas, 'lostpointercapture', () => this.push(Opcode.Cancel));
    on(canvas, 'wheel', e => {
      const factor = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.bounds.height : 1;
      this.push(Opcode.Wheel, { ...this.position(e), a: (e.shiftKey ? e.deltaY : e.deltaX) * factor, b: (e.shiftKey ? 0 : e.deltaY) * factor,c: ((e.shiftKey?1:0)|(e.ctrlKey?2:0)|(e.metaKey?4:0)|(e.altKey?8:0))<<8 }); e.preventDefault();
    }, { passive: false });
    const key = e => {
      if (this.composing || e.isComposing) return;
      if(options.onKey?.(e)===true)return;
      if((e.ctrlKey||e.metaKey)&&['c','x'].includes(e.key.toLowerCase())&&options.onClipboard){e.preventDefault();options.onClipboard(e.key.toLowerCase()==='x');return;}
      const modifiers = (e.shiftKey ? 1 : 0) | (e.ctrlKey ? 2 : 0) | (e.metaKey ? 4 : 0) | (e.altKey ? 8 : 0);
      const name = e.key === ' ' ? 'Space' : (e.ctrlKey||e.metaKey)&&/^[a-z]$/i.test(e.key)?e.key.toUpperCase():['/','[',']','=','-'].includes(e.key)&&(e.ctrlKey||e.metaKey)?({'/':'Slash','[':'BracketLeft',']':'BracketRight','=':'Equal','-':'Minus'})[e.key]:e.key;
      // Letter entries in Key are shortcut aliases, not printable-key handlers.
      // Without Ctrl/Meta, uppercase A/C/etc. must reach beforeinput (or the
      // canvas text path); preventing their default here silently loses text.
      if (Key[name] != null && (e.key.length !== 1 || name === 'Space' || e.ctrlKey || e.metaKey)) {
        this.push(Opcode.Key, { a: modifiers, c: Key[name] }); if(name!=='V'||!(e.ctrlKey||e.metaKey))e.preventDefault();
      } else if (e.target === canvas && e.key.length === 1 && !(e.ctrlKey || e.metaKey || e.altKey)) {
        this.text(e.key); e.preventDefault();
      }
    };
    on(canvas, 'keydown', key); on(this.proxy, 'keydown', key);
    on(this.proxy, 'beforeinput', e => {
      if (this.composing || e.isComposing) return;
      if (this.skipComposition && e.inputType === 'insertFromComposition') { this.skipComposition = false; e.preventDefault(); return; }
      if (e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak') this.push(Opcode.Key, { c: Key.Enter });
      else if (e.inputType.startsWith('insert') && e.data) this.text(e.data);
      else if (e.inputType === 'deleteContentBackward') this.push(Opcode.Key, { c: Key.Backspace });
      else if (e.inputType === 'deleteContentForward') this.push(Opcode.Key, { c: Key.Delete });
      e.preventDefault(); this.proxy.value = '';
    });
    on(this.proxy, 'paste', e => { const text = e.clipboardData?.getData('text/plain'); if (text) this.text(text); e.preventDefault(); });
    on(this.proxy, 'compositionstart', () => { this.composing = true; });
    on(this.proxy, 'compositionend', e => { this.composing = false; if (e.data) this.text(e.data); this.proxy.value = ''; this.skipComposition = true; });
    on(window, 'blur', () => this.push(Opcode.Cancel));
    on(window, 'scroll', () => this.refreshBounds(), { passive: true, capture: true });
  }
  push(kind, payload = {}) { this.commands.push(kind, { target: AUTO_TARGET, ...payload }); this.invalidate(); }
  text(text) { if(this.options.onText?.(text)===true)return; for (const char of text) this.push(Opcode.Text, { c: char.codePointAt(0) }); }
  clickCount(event) {
    const prior=this.lastPointerDown,now=event.timeStamp;const near=prior&&now>=prior.time&&now-prior.time<450&&Math.hypot(event.clientX-prior.x,event.clientY-prior.y)<=5&&prior.type===event.pointerType;
    const count=event.detail>0?event.detail:near&&prior.count<3?prior.count+1:1;
    this.lastPointerDown={x:event.clientX,y:event.clientY,time:now,count,type:event.pointerType};return count;
  }
  position(e) { return { x: e.clientX - this.bounds.left, y: e.clientY - this.bounds.top }; }
  refreshBounds() { this.bounds = this.canvas.getBoundingClientRect(); }
  focusTextInput() { this.proxy.focus({ preventScroll: true }); }
  dispose() { this.abort.abort(); this.proxy.remove(); }
}
