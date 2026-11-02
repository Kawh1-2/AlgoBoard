/**
 * 工具栏配置。数组顺序 = 按钮从左到右的顺序。
 *
 * 图形部分目前只放矩形和圆（rectangle / ellipse）。
 * 想恢复三角形、菱形、星形等，往这里加一行 id 即可 —— shape 定义一直存在于 tldraw 内核里，
 * 只是没被渲染到工具栏上，所以加回来不需要动任何渲染或交互代码。
 *
 * 可选 id 参考 tldraw 的 DefaultToolbarContent：
 * triangle, diamond, trapezoid, rhombus, pentagon, hexagon, octagon,
 * oval, star, cloud, heart, x-box, check-box,
 * arrow-left, arrow-up, arrow-down, arrow-right
 */
export const TOOLBAR_TOOL_IDS: string[] = [
  'select',
  'hand',
  'draw',
  'eraser',
  'arrow',
  'line',
  'text',
  'rectangle',
  'ellipse',
  'frame',
]

/** 目前允许出现的几何图形，供后续扩展时判断用 */
export const ALLOWED_GEO_TOOLS = ['rectangle', 'ellipse']
