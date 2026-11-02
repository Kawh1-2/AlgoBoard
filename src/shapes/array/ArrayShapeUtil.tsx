import { useEffect, useRef, useState } from 'react'
import {
  BaseBoxShapeUtil,
  DefaultColorStyle,
  DefaultFontStyle,
  DefaultHorizontalAlignStyle,
  DefaultSizeStyle,
  HTMLContainer,
  T,
  createShapePropsMigrationIds,
  createShapePropsMigrationSequence,
  getColorValue,
  useColorMode,
  useEditor,
  useValue,
  type RecordProps,
  type TLBaseShape,
  type TLDefaultColorStyle,
  type TLDefaultFontStyle,
  type TLDefaultHorizontalAlignStyle,
  type TLDefaultSizeStyle,
} from 'tldraw'
import { CellColorMenu } from './CellColorMenu'

/** 单格默认宽度 */
export const ARRAY_CELL_W = 64
/** 格子高度（不含下标区） */
export const ARRAY_CELL_H = 56
/** 下标区高度 */
export const ARRAY_INDEX_H = 22
/** 新建数组的默认格数 */
export const ARRAY_DEFAULT_COUNT = 5
/** 边框宽度（固定，不跟字号联动，否则调字号会把格子撑破） */
const BORDER_WIDTH = 2
const RADIUS = 6
/** 下标字号固定，不跟随文字样式 */
const INDEX_FONT_SIZE = 11

/** 抄自 tldraw 内部 default-shape-constants，含义保持一致 */
const LABEL_FONT_SIZES: Record<string, number> = { s: 1.125, m: 1.375, l: 1.625, xl: 2 }
const FONT_FAMILIES: Record<string, string> = {
  draw: 'var(--tl-font-draw)',
  sans: 'var(--tl-font-sans)',
  serif: 'var(--tl-font-serif)',
  mono: 'var(--tl-font-mono)',
}
const ALIGN_TO_JUSTIFY: Record<string, string> = {
  start: 'flex-start',
  middle: 'center',
  end: 'flex-end',
  'start-legacy': 'flex-start',
  'middle-legacy': 'center',
  'end-legacy': 'flex-end',
}
const ALIGN_TO_TEXT_ALIGN: Record<string, 'left' | 'center' | 'right'> = {
  start: 'left',
  middle: 'center',
  end: 'right',
  'start-legacy': 'left',
  'middle-legacy': 'center',
  'end-legacy': 'right',
}

export type ArrayShapeProps = {
  w: number
  h: number
  /** 每格文本，如 ['10','2','5','?','3'] */
  cells: string[]
  /**
   * 每格文字颜色覆盖。null = 跟随 props.color。
   * 与 cells 等长；长度不一致时按 null 兜底。
   * 存 string 而非 TLDefaultColorStyle：它不作为 StyleProp 注册，
   * 只是普通数据，渲染时再交给 getColorValue 解释。
   */
  cellColors: (string | null)[]
  /** 是否显示下标 */
  showIndex: boolean
  /** 下标起始值，0 或 1 */
  indexStart: number
  /** 文字默认颜色（右侧样式面板绑定的那个） */
  color: TLDefaultColorStyle
  /** 文字大小 */
  size: TLDefaultSizeStyle
  /** 字体 */
  font: TLDefaultFontStyle
  /** 水平对齐 */
  align: TLDefaultHorizontalAlignStyle
  /**
   * 边框颜色。不能也用 DefaultColorStyle —— getShapePropKeysByStyle 规定
   * 同一个 style prop 在一个 shape 里只能出现一次，重复会直接抛错。
   * 所以这里用普通字符串字段，渲染时交给 getColorValue 兜底。
   */
  strokeColor: string
}

/**
 * v5 要求自定义 shape 通过声明合并注册进 TLGlobalShapePropsMap。
 * 注册后 TLShape 联合里才会包含 'algo-array'，TLBaseBoxShape（按 props 里有 w/h 筛选）
 * 也才会把它算进去 —— 否则 BaseBoxShapeUtil 和 createShape 的泛型都过不了。
 */
declare module '@tldraw/tlschema' {
  interface TLGlobalShapePropsMap {
    'algo-array': ArrayShapeProps
  }
}

export type ArrayShape = TLBaseShape<'algo-array', ArrayShapeProps>

const arrayVersions = createShapePropsMigrationIds('algo-array', {
  AddStyleProps: 1,
  AddCellColors: 2,
})

/**
 * 由格数与是否显示下标推导总尺寸。
 * 高度把下标区算进去，这样选中框和导出范围都不会裁掉下标。
 */
export function getArraySize(cellCount: number, showIndex: boolean) {
  return {
    w: ARRAY_CELL_W * Math.max(cellCount, 1),
    h: ARRAY_CELL_H + (showIndex ? ARRAY_INDEX_H : 0),
  }
}

export class ArrayShapeUtil extends BaseBoxShapeUtil<ArrayShape> {
  static override type = 'algo-array' as const

  static override props: RecordProps<ArrayShape> = {
    w: T.number,
    h: T.number,
    cells: T.arrayOf(T.string),
    cellColors: T.arrayOf(T.nullable(T.string)),
    showIndex: T.boolean,
    indexStart: T.number,
    color: DefaultColorStyle,
    size: DefaultSizeStyle,
    font: DefaultFontStyle,
    align: DefaultHorizontalAlignStyle,
    strokeColor: T.string,
  }

  static override migrations = createShapePropsMigrationSequence({
    sequence: [
      {
        // v1：补上样式属性，兼容「只有 w/h/cells」的老数据
        id: arrayVersions.AddStyleProps,
        up: (props: ArrayShapeProps) => {
          props.color ??= 'black'
          props.size ??= 'm'
          props.font ??= 'draw'
          props.align ??= 'middle'
        },
      },
      {
        // v2：补上单格颜色与边框色
        id: arrayVersions.AddCellColors,
        up: (props: ArrayShapeProps) => {
          props.cellColors ??= (props.cells ?? []).map(() => null)
          props.strokeColor ??= 'black'
        },
      },
    ],
  })

  getDefaultProps(): ArrayShape['props'] {
    const cells = ['10', '2', '5', '?', '3']
    return {
      ...getArraySize(cells.length, true),
      cells,
      cellColors: cells.map(() => null),
      showIndex: true,
      indexStart: 0,
      color: 'black',
      size: 'm',
      font: 'draw',
      align: 'middle',
      strokeColor: 'black',
    }
  }

  override component(shape: ArrayShape) {
    return <ArrayComponent shape={shape} />
  }

  /** v5 里 indicator() 已废弃，改为返回 Path2D */
  override getIndicatorPath(shape: ArrayShape) {
    const path = new Path2D()
    path.rect(0, 0, shape.props.w, shape.props.h)
    return path
  }
}

function ArrayComponent({ shape }: { shape: ArrayShape }) {
  const editor = useEditor()
  const theme = useValue('algo-array:theme', () => editor.getCurrentTheme(), [editor])
  const colorMode = useColorMode()

  const { w, h, cells, cellColors, showIndex, indexStart, color, size, font, align, strokeColor } =
    shape.props
  const count = Math.max(cells.length, 1)
  const cellH = showIndex ? h - ARRAY_INDEX_H : h

  const colors = theme.colors[colorMode]
  const strokeColorValue = getColorValue(colors, strokeColor as TLDefaultColorStyle, 'solid')
  const fontFamily = FONT_FAMILIES[font] ?? FONT_FAMILIES.draw
  const fontSize = theme.fontSize * (LABEL_FONT_SIZES[size] ?? LABEL_FONT_SIZES.m)
  const justifyContent = ALIGN_TO_JUSTIFY[align] ?? 'center'
  const textAlign = ALIGN_TO_TEXT_ALIGN[align] ?? 'center'

  const [editing, setEditing] = useState<number | null>(null)
  const [draft, setDraft] = useState('')
  /** 右键菜单：哪一格、在屏幕什么位置 */
  const [menu, setMenu] = useState<{ index: number; x: number; y: number } | null>(null)

  const editingRef = useRef<number | null>(null)
  const draftRef = useRef('')
  const inputRef = useRef<HTMLInputElement>(null)
  /** 自己记一次点击时间，用来判双击（不依赖 event.detail） */
  const lastTapRef = useRef<{ index: number; time: number } | null>(null)

  const setEditIndex = (value: number | null) => {
    editingRef.current = value
    setEditing(value)
  }

  const setDraftValue = (value: string) => {
    draftRef.current = value
    setDraft(value)
  }

  const commit = (index: number, value: string) => {
    const next = cells.slice()
    next[index] = value
    editor.updateShape<ArrayShape>({
      id: shape.id,
      type: 'algo-array',
      props: { cells: next },
    })
  }

  const startEdit = (index: number) => {
    setDraftValue(cells[index] ?? '')
    setEditIndex(index)
  }

  /** move: 0 提交后退出；+1 / -1 提交后跳到相邻格继续编辑 */
  const finish = (index: number, value: string, move: 0 | 1 | -1) => {
    commit(index, value)
    const target = index + move
    if (move !== 0 && target >= 0 && target < count) {
      setDraftValue(cells[target] ?? '')
      setEditIndex(target)
    } else {
      setEditIndex(null)
    }
  }

  // capture 监听器里调用，保证拿到最新闭包
  const finishRef = useRef(finish)
  finishRef.current = finish

  useEffect(() => {
    if (editing === null) return

    const el = inputRef.current
    if (el) {
      el.focus()
      el.select()
    }

    /**
     * Tab 必须在捕获阶段截获，否则会被 SelectTool 的 selectAdjacentShape 吃掉。
     */
    const onCapture = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      if (document.activeElement !== inputRef.current) return
      e.preventDefault()
      e.stopPropagation()
      finishRef.current(editing, draftRef.current, e.shiftKey ? -1 : 1)
    }

    document.addEventListener('keydown', onCapture, true)
    return () => document.removeEventListener('keydown', onCapture, true)
  }, [editing])

  const setCellColor = (index: number, value: TLDefaultColorStyle | null) => {
    const next = Array.from({ length: count }, (_, i) => cellColors[i] ?? null)
    next[index] = value
    editor.updateShape<ArrayShape>({
      id: shape.id,
      type: 'algo-array',
      props: { cellColors: next },
    })
  }

  const setBorderColor = (value: TLDefaultColorStyle) => {
    editor.updateShape<ArrayShape>({
      id: shape.id,
      type: 'algo-array',
      props: { strokeColor: value },
    })
  }

  /** 把 cellColors 补齐到与 cells 等长，避免旧数据长度不一致 */
  const normalizedColors = () => cells.map((_, i) => cellColors[i] ?? null)

  /**
   * 在第 index 格之前 / 之后插入一个空格。
   * 格数一变，总宽度也要跟着重算，否则格子会被压窄。
   */
  const insertCell = (index: number, before: boolean) => {
    const at = before ? index : index + 1
    const nextCells = [...cells.slice(0, at), '', ...cells.slice(at)]
    const nextColors = [...normalizedColors().slice(0, at), null, ...normalizedColors().slice(at)]
    const { w: nextW, h: nextH } = getArraySize(nextCells.length, showIndex)

    editor.updateShape<ArrayShape>({
      id: shape.id,
      type: 'algo-array',
      props: { cells: nextCells, cellColors: nextColors, w: nextW, h: nextH },
    })
  }

  /** 删除第 index 格，后面的格子整体左移，颜色跟着一起移 */
  const deleteCell = (index: number) => {
    if (count <= 1) return
    if (index < 0 || index >= cells.length) return
    const nextCells = cells.filter((_, i) => i !== index)
    const nextColors = normalizedColors().filter((_, i) => i !== index)
    const { w: nextW, h: nextH } = getArraySize(nextCells.length, showIndex)

    editor.updateShape<ArrayShape>({
      id: shape.id,
      type: 'algo-array',
      props: { cells: nextCells, cellColors: nextColors, w: nextW, h: nextH },
    })
  }

  const border = `${BORDER_WIDTH}px solid ${strokeColorValue}`

  return (
    <HTMLContainer
      style={{
        width: w,
        height: h,
        display: 'flex',
        flexDirection: 'column',
        pointerEvents: 'all',
        userSelect: 'none',
        color: strokeColorValue,
        fontFamily,
      }}
    >
      {/* 格子行：外框统一用 border + 圆角，内部只画竖分隔线 */}
      <div
        style={{
          display: 'flex',
          width: w,
          height: cellH,
          boxSizing: 'border-box',
          border,
          borderRadius: RADIUS,
          overflow: 'hidden',
        }}
      >
        {cells.map((cell, i) => {
          const cellColorValue = getColorValue(colors, (cellColors[i] ?? color) as TLDefaultColorStyle, 'solid')

          return (
            <div
              key={i}
              /**
               * 双击必须在 pointerdown 的捕获阶段拦下来。
               * tldraw 的 SelectTool.onDoubleClick 判的是 `info.phase === 'down'`，
               * 在第二次 pointerdown 那一刻就当成双击处理，比 dblclick 早得多；
               * 而 React 的事件委托在 #root，冒泡阶段又晚于 canvas。
               * 只有捕获阶段能抢在它前面。
               */
              onPointerDownCapture={(e) => {
                /**
                 * 右键要在 pointerdown 就拦。
                 * useCanvasEvents 里对 button === 2 且未开 rightClickPanning 的情况，
                 * 会直接 dispatch 一个 canvas pointer 事件去弹 tldraw 自己的上下文菜单 ——
                 * 等到 contextmenu 事件再拦已经晚了。
                 */
                if (e.button === 2) {
                  e.stopPropagation()
                  e.preventDefault()
                  setMenu({ index: i, x: e.clientX, y: e.clientY })
                  return
                }
                if (e.button !== 0) return

                const now = Date.now()
                const last = lastTapRef.current
                const isDouble = !!last && last.index === i && now - last.time < 400
                lastTapRef.current = { index: i, time: now }
                if (!isDouble) return
                lastTapRef.current = null
                e.stopPropagation()
                e.preventDefault()
                startEdit(i)
              }}
              onDoubleClick={() => startEdit(i)}
              onContextMenuCapture={(e) => {
                // 只是阻止浏览器默认菜单；菜单本身在上面 pointerdown 里已经开了
                e.preventDefault()
                e.stopPropagation()
              }}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent,
                borderRight: i < count - 1 ? border : 'none',
                fontSize,
                fontFamily,
                color: cellColorValue,
                lineHeight: 1,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {editing === i ? (
                <input
                  key={`edit-${i}`}
                  ref={inputRef}
                  value={draft}
                  onChange={(e) => setDraftValue(e.target.value)}
                  onBlur={() => {
                    // 焦点已切到别的格子（Tab / Enter 触发），不做处理
                    if (editingRef.current !== i) return
                    finish(i, draftRef.current, 0)
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      finish(i, draftRef.current, 0)
                    } else if (e.key === 'Escape') {
                      setEditIndex(null)
                    }
                  }}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    textAlign,
                    fontSize,
                    fontFamily,
                    color: 'inherit',
                    padding: 0,
                  }}
                />
              ) : (
                cell
              )}
            </div>
          )
        })}
      </div>

      {/* 下标行：字号/字体固定，只跟随格子文字颜色 */}
      {showIndex && (
        <div
          style={{
            display: 'flex',
            width: w,
            height: ARRAY_INDEX_H,
            // 与格子行左右各 2px 的边框对齐，否则下标整体会偏
            padding: `0 ${BORDER_WIDTH}px`,
            boxSizing: 'border-box',
          }}
        >
          {cells.map((_, i) => (
            <div
              key={i}
              style={{
                flex: '1 1 0',
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: INDEX_FONT_SIZE,
                fontFamily: 'var(--tl-font-sans)',
                // 固定用主题的「黑」（深色模式下自动变浅），不跟格子文字色也不跟边框色
                color: getColorValue(colors, 'black', 'solid'),
                opacity: 0.55,
                lineHeight: 1,
              }}
            >
              {i + indexStart}
            </div>
          ))}
        </div>
      )}

      {menu && (
        <CellColorMenu
          x={menu.x}
          y={menu.y}
          cellColor={(cellColors[menu.index] ?? null) as TLDefaultColorStyle | null}
          borderColor={strokeColor as TLDefaultColorStyle}
          canDelete={count > 1}
          onPickCellColor={(value) => {
            setCellColor(menu.index, value)
            setMenu(null)
          }}
          onPickBorderColor={(value) => {
            setBorderColor(value)
            setMenu(null)
          }}
          onInsertBefore={() => {
            insertCell(menu.index, true)
            setMenu(null)
          }}
          onInsertAfter={() => {
            insertCell(menu.index, false)
            setMenu(null)
          }}
          onDelete={() => {
            deleteCell(menu.index)
            setMenu(null)
          }}
          onClose={() => setMenu(null)}
        />
      )}
    </HTMLContainer>
  )
}
