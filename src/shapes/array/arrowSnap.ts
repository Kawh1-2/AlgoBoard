import type { Editor, TLArrowBinding, TLShape } from 'tldraw'
import { ARRAY_INDEX_H, type ArrayShapeProps } from './ArrayShapeUtil'

const EPSILON = 1e-4
const MOVE_EPSILON = 0.01
/** 判断"已经垂直"的容差，避免每帧重复写入 */
const VERTICAL_TOLERANCE = 0.5
/** 箭头太短或接近水平时，掰垂直后给这个长度，免得缩成一个点 */
const MIN_ARROW_LENGTH = 64

/**
 * 箭头与数组格子的三件事：
 *
 * 1. **吸附**：把箭头 binding 的 normalizedAnchor 修正到目标格子的边中点。
 *    normalizedAnchor 是目标包围盒内的 0~1 相对坐标，端点就落在这个位置上，
 *    所以不用自定义 binding 类型，数组移动/缩放时 tldraw 也会自动重算端点。
 *
 * 2. **绑定即垂直**：自由端的 x 对齐到格子中点，y 保持不变，
 *    让箭头变成「从上/下方垂直指向某一格中点」。
 *    但只在**刚绑定、换到别的格子、格数变化**时校准一次 ——
 *    之后用户手动拖自由端改角度不再干预，避免拖一下就被掰回去。
 *
 * 3. **平移跟随**：数组整体移动时，箭头未绑定的那一端也要跟着走同样距离，
 *    否则绑定端跟着格子跑、自由端钉在原地，箭头就被"拧"成了另一个角度。
 *    实现上直接 nudge 整条箭头 —— 绑定端会被 binding 拉回格子，
 *    自由端则按位移平移。
 */
export function installArrayArrowSnap(editor: Editor): () => void {
  /** 记录每个数组上一次的位置，用来算平移量 */
  const prevPositions = new Map<string, { x: number; y: number }>()
  /**
   * 每个箭头绑定上一次的「格子索引 + 格数」签名。
   * 只在签名变化时（刚绑定、换格子、改格数）才掰垂直，
   * 用户手动拖自由端改角度时不干预。
   */
  const prevSignatures = new Map<string, string>()

  return editor.store.listen(
    () => {
      const arrays = editor.getCurrentPageShapes().filter((shape) => shape.type === 'algo-array')
      if (!arrays.length) return

      for (const array of arrays) {
        const prev = prevPositions.get(array.id)
        prevPositions.set(array.id, { x: array.x, y: array.y })

        const allBindings = editor.getBindingsInvolvingShape(array.id, 'arrow')
        // 只处理「箭头指向数组」，不处理从数组出发的
        const boundBindings = allBindings.filter((binding) => binding.toId === array.id)

        // ---- 平移跟随 ----
        if (prev) {
          const dx = array.x - prev.x
          const dy = array.y - prev.y
          if (Math.abs(dx) > MOVE_EPSILON || Math.abs(dy) > MOVE_EPSILON) {
            const arrowIds = boundBindings.map((binding) => binding.fromId)
            if (arrowIds.length) {
              editor.nudgeShapes(arrowIds, { x: dx, y: dy })
            }
          }
        }

        /**
         * 拖拽过程中不介入吸附与垂直校准。
         * 否则刚画箭头时，端点会被拽到最近的格子（通常是最中间那个），
         * 松手后才跳回真正指向的格子，看起来就是"先指中间再变回来"。
         * 平移跟随在上面已经处理过了，不受影响。
         */
        if (editor.inputs.getIsPointing()) continue

        // ---- 格子吸附 + 掰垂直 ----
        const props = array.props as ArrayShapeProps
        const count = Math.max(props.cells.length, 1)
        const totalH = props.h || 1
        // 下标区不算格子，所以格子行下边在包围盒里的比例要单独算
        const cellRowH = props.showIndex ? totalH - ARRAY_INDEX_H : totalH
        const cellRowRatio = cellRowH / totalH

        for (const binding of boundBindings) {
          const anchor = binding.props.normalizedAnchor
          const index = Math.min(count - 1, Math.max(0, Math.floor(anchor.x * count)))
          const isTop = anchor.y < cellRowRatio / 2

          const targetX = (index + 0.5) / count
          const targetY = isTop ? 0 : cellRowRatio

          const anchorMoved =
            Math.abs(anchor.x - targetX) > EPSILON || Math.abs(anchor.y - targetY) > EPSILON

          if (anchorMoved) {
            editor.updateBinding({
              id: binding.id,
              type: 'arrow',
              props: {
                normalizedAnchor: { x: targetX, y: targetY },
                // isPrecise: 用精确锚点而不是 shape 中心
                // isExact 保持原值：为 true 会让箭头尖穿进形状内部，我们要它停在边缘
                isPrecise: true,
              },
            })
          }

          /**
           * 只在「刚绑定 / 换到别的格子 / 格数变了」这三种情况下掰一次垂直。
           * 其余时候（比如用户拖自由端改角度）完全放行。
           */
          const signature = `${index}:${count}`
          const isNewOrChanged = prevSignatures.get(binding.id) !== signature
          prevSignatures.set(binding.id, signature)

          if (isNewOrChanged) {
            straightenArrow(editor, array, binding, targetX, targetY, props)
          }
        }
      }
    },
    { scope: 'document' }
  )
}

/**
 * 把箭头掰成垂直线：自由端的 x 对齐到格子中点，y 保持不变。
 * 已经垂直就直接返回，避免每次 store 变化都写一次（也就不会来回抖）。
 */
function straightenArrow(
  editor: Editor,
  array: TLShape,
  binding: TLArrowBinding,
  targetX: number,
  targetY: number,
  arrayProps: ArrayShapeProps
) {
  const arrowShape = editor.getShape(binding.fromId)
  if (!arrowShape || arrowShape.type !== 'arrow') return

  const arrowProps = arrowShape.props
  const isStartBound = binding.props.terminal === 'start'
  const free = isStartBound ? arrowProps.end : arrowProps.start

  const freePageX = arrowShape.x + free.x
  const freePageY = arrowShape.y + free.y

  const anchorPageX = array.x + targetX * (arrayProps.w || 0)
  const anchorPageY = array.y + targetY * (arrayProps.h || 0)

  if (Math.abs(freePageX - anchorPageX) <= VERTICAL_TOLERANCE) return

  // 自由端离锚点太近（几乎水平），掰直后会变成零长度，给个默认长度放到上方
  let nextFreePageY = freePageY
  if (Math.abs(freePageY - anchorPageY) < MIN_ARROW_LENGTH) {
    nextFreePageY = anchorPageY - MIN_ARROW_LENGTH
  }

  editor.updateShape({
    id: arrowShape.id,
    type: 'arrow',
    props: isStartBound
      ? { end: { x: anchorPageX - arrowShape.x, y: nextFreePageY - arrowShape.y } }
      : { start: { x: anchorPageX - arrowShape.x, y: nextFreePageY - arrowShape.y } },
  })
}
