import {
  DefaultColorStyle,
  DefaultFontStyle,
  DefaultHorizontalAlignStyle,
  DefaultSizeStyle,
  createShapeId,
  type Editor,
  type TLShapeId,
  type VecLike,
} from 'tldraw'
import {
  ARRAY_DEFAULT_COUNT,
  getArraySize,
  type ArrayShape,
  type ArrayShapeProps,
} from './ArrayShapeUtil'

type CreateOpts = {
  cells?: string[]
  showIndex?: boolean
  indexStart?: number
}

/**
 * 在指定页面坐标创建数组，以该点为中心。
 * 样式属性取自编辑器"下一形状样式"，和 tldraw 其他图形一致：
 * 用户刚把颜色调成红色，新建的数组也会是红色。
 * @returns 新建 shape 的 id
 */
export function createArrayAt(editor: Editor, point: VecLike, opts: CreateOpts = {}): TLShapeId {
  const cells = opts.cells ?? Array.from({ length: ARRAY_DEFAULT_COUNT }, () => '')
  const showIndex = opts.showIndex ?? true
  const indexStart = opts.indexStart ?? 0
  const { w, h } = getArraySize(cells.length, showIndex)

  const baseColor = editor.getStyleForNextShape(DefaultColorStyle)

  const props: ArrayShapeProps = {
    w,
    h,
    cells,
    cellColors: cells.map(() => null),
    showIndex,
    indexStart,
    color: baseColor,
    size: editor.getStyleForNextShape(DefaultSizeStyle),
    font: editor.getStyleForNextShape(DefaultFontStyle),
    align: editor.getStyleForNextShape(DefaultHorizontalAlignStyle),
    strokeColor: baseColor,
  }
  const id = createShapeId()

  editor.createShape<ArrayShape>({
    id,
    type: 'algo-array',
    x: point.x - w / 2,
    y: point.y - h / 2,
    props,
  })
  editor.select(id)

  return id
}
