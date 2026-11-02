import { StateNode, type TLPointerEventInfo } from 'tldraw'
import { createArrayAt } from '../shapes/array/createArray'
import { parseArrayText } from '../shapes/array/parseArrayText'

/**
 * 数组工具的 idle 状态：点一下画布，就在点击位置创建一个默认 5 格空数组。
 * 建完自动切回选择工具，跟 tldraw 里矩形、箭头这些工具的行为一致。
 */
class ArrayToolIdle extends StateNode {
  static override id = 'idle'

  override onPointerDown(info: TLPointerEventInfo) {
    if (info.button !== 0) return
    createArrayAt(this.editor, info.point)
    this.editor.setCurrentTool('select')
  }
}

export class ArrayTool extends StateNode {
  static override id = 'algo-array'
  static override initial = 'idle'

  /**
   * 工具激活期间挂上的粘贴监听。
   * 用 window 的捕获阶段，抢在 tldraw 自己的粘贴处理（会生成文本形状）之前。
   */
  private pasteHandler: ((e: ClipboardEvent) => void) | null = null

  static override children() {
    return [ArrayToolIdle]
  }

  private detachPaste() {
    if (this.pasteHandler) {
      window.removeEventListener('paste', this.pasteHandler, true)
      this.pasteHandler = null
    }
  }

  private attachPaste() {
    this.pasteHandler = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text/plain')
      if (!text) return

      const cells = parseArrayText(text)
      // 解析不出来就放行，让默认逻辑把文本粘成普通文本形状
      if (!cells) return

      e.preventDefault()
      e.stopPropagation()

      createArrayAt(this.editor, this.editor.getViewportPageBounds().center, { cells })
      this.editor.setCurrentTool('select')
    }
    window.addEventListener('paste', this.pasteHandler, true)
  }

  override onEnter() {
    this.editor.setCursor({ type: 'cross', rotation: 0 })
    this.detachPaste()
    this.attachPaste()
  }

  override onExit() {
    this.editor.setCursor({ type: 'default', rotation: 0 })
    this.detachPaste()
  }
}
