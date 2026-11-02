import { DefaultToolbar, TldrawUiTooltip, ToolbarItem, useEditor, useValue } from 'tldraw'
import { TOOLBAR_TOOL_IDS } from '../config/toolbar'
import { ArrayTool } from '../tools/ArrayTool'

/**
 * 自定义工具栏。
 *
 * 不用默认的 DefaultToolbarContent（它把 20 种几何图形和媒体、便笺全平铺出来），
 * 改为按 config/toolbar.ts 里的清单渲染。DefaultToolbar 本身仍然沿用，
 * 这样溢出折叠、工具提示、锁定按钮这些行为都保留。
 */
export default function AlgoToolbar() {
  const editor = useEditor()
  const currentToolId = useValue('algo-toolbar:tool', () => editor.getCurrentToolId(), [editor])
  const isArrayTool = currentToolId === ArrayTool.id

  return (
    <DefaultToolbar maxItems={12} maxSizePx={780}>
      {TOOLBAR_TOOL_IDS.map((id) => (
        <ToolbarItem key={id} tool={id} />
      ))}

      <TldrawUiTooltip content="数组格子" side="top">
        <button
          type="button"
          className="tlui-button tlui-button__tool"
          aria-label="数组格子"
          aria-pressed={isArrayTool}
          onClick={() => editor.setCurrentTool(ArrayTool.id)}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <rect
              x="1"
              y="5.5"
              width="4.6"
              height="7"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <rect
              x="6.7"
              y="5.5"
              width="4.6"
              height="7"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
            <rect
              x="12.4"
              y="5.5"
              width="4.6"
              height="7"
              rx="1"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
            />
          </svg>
        </button>
      </TldrawUiTooltip>
    </DefaultToolbar>
  )
}
