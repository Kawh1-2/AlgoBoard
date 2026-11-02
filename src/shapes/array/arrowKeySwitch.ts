import type { Editor } from 'tldraw'
import { ARRAY_INDEX_H, type ArrayShape, type ArrayShapeProps } from './ArrayShapeUtil'

/**
 * 选中「已绑定到数组」的箭头后，用方向键调整它：
 *
 * - `←` / `→`        指向前一个 / 后一个格子（到两端停住）
 * - `Shift + ←/→`    直接跳第一个 / 最后一个格子
 * - `↑` / `↓`        把箭头翻到数组上方 / 下方（翻面）
 *
 * 必须在捕获阶段拦截：tldraw 的 SelectTool 默认用方向键微移选中形状
 * （Shift + 方向键是 10px 微移），冒泡阶段拦不住。
 */
export function installArrowKeySwitch(editor: Editor): () => void {
  const onKeyDown = (e: KeyboardEvent) => {
    const isLeftRight = e.key === 'ArrowLeft' || e.key === 'ArrowRight'
    const isUpDown = e.key === 'ArrowUp' || e.key === 'ArrowDown'
    if (!isLeftRight && !isUpDown) return
    /**
     * Alt + 方向键在浏览器里是「后退 / 前进」，必须挡掉，否则整个页面会被切走。
     * 只 preventDefault、不 stopPropagation —— tldraw 自己的微移仍能收到事件。
     */
    if (e.altKey) {
      e.preventDefault()
      return
    }
    if (e.ctrlKey || e.metaKey) return

    const selectedIds = editor.getSelectedShapeIds()
    if (selectedIds.length !== 1) return

    const arrow = editor.getShape(selectedIds[0])
    if (!arrow || arrow.type !== 'arrow') return

    // 找出这条箭头指向数组的那一端绑定
    const binding = editor
      .getBindingsFromShape(arrow, 'arrow')
      .find((b) => editor.getShape(b.toId)?.type === 'algo-array')

    if (!binding) return

    const array = editor.getShape(binding.toId) as ArrayShape | undefined
    if (!array) return

    const arrayProps = array.props as ArrayShapeProps
    const count = Math.max(arrayProps.cells.length, 1)
    const totalH = arrayProps.h || 1
    const cellRowH = arrayProps.showIndex ? totalH - ARRAY_INDEX_H : totalH
    const cellRowRatio = cellRowH / totalH

    const anchor = binding.props.normalizedAnchor
    const currentIndex = Math.min(count - 1, Math.max(0, Math.floor(anchor.x * count)))
    const isTopSide = anchor.y < cellRowRatio / 2

    // 无论是否真的变化，都要拦住默认行为，否则箭头会被微移
    const stop = () => {
      e.preventDefault()
      e.stopPropagation()
    }

    // ---- 上下：翻面 ----
    if (isUpDown) {
      const wantTopSide = e.key === 'ArrowUp'
      if (wantTopSide === isTopSide) {
        stop()
        return
      }

      stop()

      const targetY = wantTopSide ? 0 : cellRowRatio
      const oldAnchorPageY = array.y + anchor.y * totalH
      const newAnchorPageY = array.y + targetY * totalH

      // 自由端到锚点的纵向距离，翻面后取反（从上方变到下方，反之亦然）
      const freeDelta = getFreeEndPageY(editor, arrow.id, binding.props.terminal) - oldAnchorPageY
      const nextFreePageY = newAnchorPageY - freeDelta

      editor.updateBinding({
        id: binding.id,
        type: 'arrow',
        props: {
          normalizedAnchor: { x: anchor.x, y: targetY },
          isPrecise: true,
        },
      })

      setFreeEndPageY(editor, arrow.id, binding.props.terminal, nextFreePageY)
      return
    }

    // ---- 左右：切换格子 ----
    let nextIndex: number
    if (e.shiftKey) {
      nextIndex = e.key === 'ArrowRight' ? count - 1 : 0
    } else {
      nextIndex = e.key === 'ArrowRight' ? currentIndex + 1 : currentIndex - 1
      nextIndex = Math.min(count - 1, Math.max(0, nextIndex))
    }

    stop()

    if (nextIndex === currentIndex) return

    editor.updateBinding({
      id: binding.id,
      type: 'arrow',
      props: {
        // y 保持不变：原来指上边就还是上边，指下边就还是下边
        normalizedAnchor: { x: (nextIndex + 0.5) / count, y: anchor.y },
        isPrecise: true,
      },
    })
  }

  // 用 window 的捕获阶段：比 document 更靠外，能抢在 tldraw 的按键处理之前
  window.addEventListener('keydown', onKeyDown, true)
  return () => window.removeEventListener('keydown', onKeyDown, true)
}

/** 取箭头自由端的页面 y 坐标 */
function getFreeEndPageY(editor: Editor, arrowId: string, terminal: 'start' | 'end'): number {
  const shape = editor.getShape(arrowId as never)
  if (!shape || shape.type !== 'arrow') return 0
  const free = terminal === 'start' ? shape.props.end : shape.props.start
  return shape.y + free.y
}

/** 设置箭头自由端的页面 y 坐标（x 保持不变，所以仍然垂直） */
function setFreeEndPageY(
  editor: Editor,
  arrowId: string,
  terminal: 'start' | 'end',
  pageY: number
): void {
  const shape = editor.getShape(arrowId as never)
  if (!shape || shape.type !== 'arrow') return
  const free = terminal === 'start' ? shape.props.end : shape.props.start
  const next = { x: free.x, y: pageY - shape.y }

  editor.updateShape({
    id: shape.id,
    type: 'arrow',
    props: terminal === 'start' ? { end: next } : { start: next },
  })
}
