import { useState } from 'react'
import { Tldraw, type Editor, type TLUiOverrides } from 'tldraw'
import 'tldraw/tldraw.css'
import BoardBar from './ui/BoardBar'
import AlgoToolbar from './ui/AlgoToolbar'
import AlgoContextMenu from './ui/AlgoContextMenu'
import { ArrayShapeUtil } from './shapes/array/ArrayShapeUtil'
import { installArrayArrowSnap } from './shapes/array/arrowSnap'
import { installArrowKeySwitch } from './shapes/array/arrowKeySwitch'
import { ArrayTool } from './tools/ArrayTool'

/**
 * UI 裁剪：把刷题用不上的工具从工具栏摘掉。
 * 这里只删 UI 入口，shape 定义仍保留，将来想加回来把 delete 去掉即可。
 */
const uiOverrides: TLUiOverrides = {
  tools(_editor, tools) {
    const t = tools as Record<string, unknown>
    delete t.asset // 媒体 / 图片
    delete t.note // 便笺
    delete t.comment // 评论（SDK 里不存在时无副作用）
    delete t.laser // 激光笔
    delete t.highlight // 高亮
    return tools
  },
}

export default function App() {
  const [editor, setEditor] = useState<Editor | null>(null)

  const handleMount = (instance: Editor) => {
    // 只删工具栏按钮不够：粘贴图片、拖文件进画布是另一条路径，必须从处理器层面掐断。
    // 传 null 会把该类型的处理器整个移除，putExternalContent 里是可选调用，于是静默忽略。
    instance.registerExternalContentHandler('files', null)
    instance.registerExternalContentHandler('svg-text', null)
    instance.registerExternalContentHandler('embed', null)

    // 箭头端点吸附到数组格子（修正 binding 的 normalizedAnchor）
    installArrayArrowSnap(instance)
    // 选中箭头后，方向键切换指向的格子
    installArrowKeySwitch(instance)

    setEditor(instance)
  }

  return (
    <div className="app">
      <BoardBar editor={editor} />
      <div className="canvas-wrap">
        <Tldraw
          persistenceKey="algoboard-v1"
          shapeUtils={[ArrayShapeUtil]}
          tools={[ArrayTool]}
          onMount={handleMount}
          overrides={uiOverrides}
          /**
           * 官方开关：决定 QuickActions（撤销/重做/删除/复制）和 ActionsMenu 渲染在哪。
           * 'menu' = 左上角菜单栏，'toolbar' = 底部工具栏区域，'auto' = 按屏幕宽度二选一。
           * 默认是 'auto'，大屏会跑到左上角 —— 这就是之前位置不对的原因。
           */
          options={{ actionShortcutsLocation: 'toolbar' }}
          components={{
            SharePanel: null,
            PageMenu: null,
            /**
             * 右键菜单：数组范围内禁用官方菜单（由我们的格子取色菜单接管），
             * 其他地方保持 tldraw 原样（复制/删除/导出等都在）。
             */
            ContextMenu: AlgoContextMenu,
            Toolbar: AlgoToolbar,
          }}
        />
      </div>
    </div>
  )
}
