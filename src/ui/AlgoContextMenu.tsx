import { DefaultContextMenu, useEditor, useValue } from 'tldraw'
import { ARRAY_INDEX_H, type ArrayShapeProps } from '../shapes/array/ArrayShapeUtil'

/**
 * 右键菜单策略：只在右键**落在数组的格子上**时禁用 tldraw 自带菜单，
 * 让位给我们的格子取色菜单；右键边框外沿、下标区、画布其他位置一律放行官方菜单。
 *
 * 为什么用 disabled 而不是拦事件：tldraw 的 ContextMenu 用 Radix 的
 * ContextMenu.Trigger 把整个 Canvas 包起来，事件从格子冒泡上去必然经过它，
 * 靠 stopPropagation 抑制并不可靠（实测两个菜单会一起出现，
 * 而且 Radix 的 Portal 层还会吃掉色块的点击）。
 * `DefaultContextMenu` 的 disabled 会让 Trigger 直接不响应，
 * 同时内部会替我们 preventDefault 掉浏览器原生菜单。
 */
export default function AlgoContextMenu() {
  const editor = useEditor()

  const overCell = useValue(
    'algo-ctx:over-cell',
    () => {
      const point = editor.inputs.getCurrentPagePoint()

      for (const shape of editor.getCurrentPageShapes()) {
        if (shape.type !== 'algo-array') continue
        const props = shape.props as ArrayShapeProps

        // 页面坐标转局部坐标（数组不支持旋转，直接相减即可）
        const localX = point.x - shape.x
        const localY = point.y - shape.y

        if (localX < 0 || localX > props.w || localY < 0 || localY > props.h) continue

        // 落在下标区：放行官方菜单
        const cellRowHeight = props.h - (props.showIndex ? ARRAY_INDEX_H : 0)
        return localY <= cellRowHeight
      }

      return false
    },
    [editor]
  )

  return <DefaultContextMenu disabled={overCell} />
}
