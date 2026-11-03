import type { Editor } from 'tldraw'

/**
 * 导出当前画板为 .tldr 文件（tldraw 的快照格式，就是官方「保存到文件」用的那份 JSON）。
 * 用 Blob + 临时 <a> 触发下载，不依赖任何后端。
 */
export function exportBackup(editor: Editor): void {
  const snapshot = editor.getSnapshot()
  const json = JSON.stringify(snapshot, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  const date = new Date().toISOString().slice(0, 10)
  a.download = `algoboard-${date}.tldr`
  document.body.appendChild(a)
  a.click()
  a.remove()

  // 等浏览器拿到 blob 再释放；不给延迟的话 Safari 偶尔会下载空文件
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 从 .tldr 文件导入，**覆盖**当前所有画板。
 * 用户主动选择文件本身就是明确意图，所以不再二次确认
 * （内置浏览器经常屏蔽 window.confirm，之前在标签删除上踩过）。
 */
export function importBackup(editor: Editor): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.tldr,.json,application/json'

  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const snapshot = JSON.parse(text) as Parameters<Editor['loadSnapshot']>[0]
      // 拦下明显不是画板快照的 JSON，避免把 store 搞坏
      if (!snapshot || typeof snapshot !== 'object' || !('store' in snapshot)) {
        throw new Error('不是有效的画板备份文件')
      }
      editor.loadSnapshot(snapshot)
    } catch (err) {
      const message = err instanceof Error ? err.message : '文件格式不对'
      window.alert(`导入失败：${message}`)
    }
  }

  input.click()
}
