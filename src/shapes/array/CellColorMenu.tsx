import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import {
  getColorValue,
  useColorMode,
  useEditor,
  useValue,
  type TLDefaultColorStyle,
} from 'tldraw'

const COLOR_NAMES: TLDefaultColorStyle[] = [
  'black',
  'grey',
  'light-violet',
  'violet',
  'blue',
  'light-blue',
  'yellow',
  'orange',
  'green',
  'light-green',
  'light-red',
  'red',
]

type Props = {
  x: number
  y: number
  cellColor: TLDefaultColorStyle | null
  borderColor: TLDefaultColorStyle
  canDelete: boolean
  onPickCellColor: (value: TLDefaultColorStyle | null) => void
  onPickBorderColor: (value: TLDefaultColorStyle) => void
  onInsertBefore: () => void
  onInsertAfter: () => void
  onDelete: () => void
  onClose: () => void
}

/**
 * 单格右键菜单：文字颜色、边框颜色、插入 / 删除格子。
 *
 * 两个关键设计：
 *
 * 1. portal 到 #root 而不是 body。React 17+ 把事件监听统一挂在 root 容器上，
 *    portal 到 body 时元素是 #root 的兄弟而非后代，合成事件根本到不了 root。
 *    而挂到 #root 下没有 transform，position: fixed 仍按视口定位。
 *
 * 2. 点击用**原生** addEventListener 处理。元素上打 data-color / data-action 标记，
 *    不依赖 React 的合成事件链，也不会被外围的 preventDefault 打断。
 */
export function CellColorMenu({
  x,
  y,
  cellColor,
  borderColor,
  canDelete,
  onPickCellColor,
  onPickBorderColor,
  onInsertBefore,
  onInsertAfter,
  onDelete,
  onClose,
}: Props) {
  const editor = useEditor()
  const theme = useValue('algo-array:menu-theme', () => editor.getCurrentTheme(), [editor])
  const colorMode = useColorMode()
  const colors = theme.colors[colorMode]
  const ref = useRef<HTMLDivElement>(null)

  // 点菜单外面关闭
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [onClose])

  // 菜单内所有操作：原生监听，按 data-* 分派
  useEffect(() => {
    const el = ref.current
    if (!el) return

    const handler = (e: Event) => {
      const target = (e.target as HTMLElement | null)?.closest?.(
        '[data-color], [data-action]'
      ) as HTMLElement | null
      if (!target) return
      e.preventDefault()
      e.stopPropagation()

      const action = target.dataset.action
      if (action === 'insert-before') return onInsertBefore()
      if (action === 'insert-after') return onInsertAfter()
      if (action === 'delete') return onDelete()

      const value = target.dataset.color
      const group = target.dataset.group
      if (group === 'border') {
        if (value) onPickBorderColor(value as TLDefaultColorStyle)
        return
      }
      onPickCellColor(value === '__default__' || !value ? null : (value as TLDefaultColorStyle))
    }

    el.addEventListener('pointerdown', handler, true)
    return () => el.removeEventListener('pointerdown', handler, true)
  }, [onPickCellColor, onPickBorderColor, onInsertBefore, onInsertAfter, onDelete])

  const swatches = (group: 'cell' | 'border', current: TLDefaultColorStyle | null) => (
    <div className="algo-swatches">
      {COLOR_NAMES.map((name) => (
        <button
          key={name}
          type="button"
          data-color={name}
          data-group={group}
          className={'algo-swatch' + (current === name ? ' is-active' : '')}
          title={name}
          aria-label={name}
          style={{ background: getColorValue(colors, name, 'solid') }}
        />
      ))}
    </div>
  )

  const portalTarget =
    typeof document === 'undefined' ? null : (document.getElementById('root') ?? document.body)
  if (!portalTarget) return null

  return createPortal(
    <div
      ref={ref}
      className="algo-menu"
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div className="algo-menu-label">此格文字</div>
      {swatches('cell', cellColor)}
      <button type="button" className="algo-menu-text-btn" data-color="__default__" data-group="cell">
        恢复默认颜色
      </button>

      <div className="algo-menu-divider" />

      <div className="algo-menu-label">边框颜色</div>
      {swatches('border', borderColor)}

      <div className="algo-menu-divider" />

      <div className="algo-menu-actions">
        <button type="button" data-action="insert-before" title="在此格之前插入空格">
          ← 前插
        </button>
        <button type="button" data-action="insert-after" title="在此格之后插入空格">
          后插 →
        </button>
        <button
          type="button"
          data-action="delete"
          className="is-danger"
          title={canDelete ? '删除此格' : '至少要保留一格'}
          disabled={!canDelete}
        >
          删除
        </button>
      </div>
    </div>,
    portalTarget
  )
}
