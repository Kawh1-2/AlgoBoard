import { useState } from 'react'
import { useValue, type Editor, type TLPageId } from 'tldraw'
import { exportBackup, importBackup } from './backup'

type Props = {
  editor: Editor | null
}

/**
 * 顶部画板标签条。
 * 直接复用 tldraw 的 page 机制（一页 = 一题），不自己维护多文档。
 */
export default function BoardBar({ editor }: Props) {
  const pages = useValue('algoboard-pages', () => (editor ? editor.getPages() : []), [editor])
  const currentPageId = useValue(
    'algoboard-current-page',
    () => (editor ? editor.getCurrentPageId() : null),
    [editor]
  )

  const [editingId, setEditingId] = useState<TLPageId | null>(null)
  const [draft, setDraft] = useState('')

  const handleAdd = () => {
    if (!editor) return
    const pages = editor.getPages()
    // 取已有「未命名 N」里的最大编号 +1，避免删页后编号撞车
    const maxNo = pages.reduce((max, p) => {
      const m = /^未命名\s*(\d+)$/.exec(p.name)
      return m ? Math.max(max, Number(m[1])) : max
    }, 0)

    const before = new Set(pages.map((p) => p.id))
    // 注意：createPage 返回的是 editor 本身（this），不是新页面对象，所以要靠 diff 找出新页
    editor.createPage({ name: `未命名 ${maxNo + 1}` })
    const created = editor.getPages().find((p) => !before.has(p.id))
    if (created) editor.setCurrentPage(created.id)
  }

  const startRename = (id: TLPageId, name: string) => {
    setEditingId(id)
    setDraft(name)
  }

  const commitRename = () => {
    if (editor && editingId) {
      const name = draft.trim()
      if (name) editor.renamePage(editingId, name)
    }
    setEditingId(null)
  }

  /**
   * 删除画板。
   * 不用 window.confirm —— 内置浏览器 / WebView 经常直接屏蔽它，
   * 表现就是"点了没反应"。点 × 本身已经是明确意图，删完可以用 Ctrl+Z 撤销。
   */
  const handleDelete = (id: TLPageId) => {
    if (!editor) return
    if (editor.getPages().length <= 1) return
    editor.markHistoryStoppingPoint('删除画板')
    editor.deletePage(id)
  }

  return (
    <div className="board-bar">
      {pages.map((page) =>
        editingId === page.id ? (
          <input
            key={page.id}
            className="board-tab-input"
            value={draft}
            autoFocus
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              e.stopPropagation()
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setEditingId(null)
            }}
          />
        ) : (
          <button
            key={page.id}
            type="button"
            className={'board-tab' + (page.id === currentPageId ? ' is-active' : '')}
            title={page.name}
            onClick={() => editor?.setCurrentPage(page.id)}
            onDoubleClick={() => startRename(page.id, page.name)}
            onContextMenu={(e) => {
              e.preventDefault()
              handleDelete(page.id)
            }}
          >
            <span className="board-tab-label">{page.name}</span>
            {pages.length > 1 && (
              <span
                className="board-tab-close"
                role="button"
                aria-label="关闭画板"
                title="关闭画板"
                onClick={(e) => {
                  // 别让点击冒泡到标签本身（否则会先切页再删除）
                  e.stopPropagation()
                  handleDelete(page.id)
                }}
              >
                ×
              </span>
            )}
          </button>
        )
      )}
      <button type="button" className="board-add" title="新建画板" onClick={handleAdd}>
        +
      </button>

      <div className="board-actions">
        <button
          type="button"
          className="board-tool-btn"
          title="导出备份（.tldr）"
          aria-label="导出备份"
          disabled={!editor}
          onClick={() => editor && exportBackup(editor)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 1.5v7.5m0 0L4.2 6.2M7 9l2.8-2.8M2 10.5v1.2A.8.8 0 0 0 2.8 12.5h8.4a.8.8 0 0 0 .8-.8v-1.2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          className="board-tool-btn"
          title="导入备份（覆盖当前内容）"
          aria-label="导入备份"
          disabled={!editor}
          onClick={() => editor && importBackup(editor)}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
            <path
              d="M7 9V1.5m0 0L4.2 4.3M7 1.5l2.8 2.8M2 10.5v1.2a.8.8 0 0 0 .8.8h8.4a.8.8 0 0 0 .8-.8v-1.2"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
