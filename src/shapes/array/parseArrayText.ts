/** 单个格子内容的最大字符数，超过就不当数组处理 */
const MAX_CELL_LENGTH = 16
/** 最多解析多少格，防止粘贴一大段文本卡死 */
const MAX_CELLS = 200

/**
 * 把粘贴进来的文本解析成数组格子内容。
 *
 * 支持这些写法：
 *   [10, 2, 5, ?, 3]
 *   (10, 2, 5, ?, 3)
 *   10 2 5 ? 3
 *   10,2,5,?,3
 *   10 -> 2 -> 5 -> ? -> 3      （链式）
 *   10 → 2 → 5
 *
 * 解析不出来（比如一整段文章）返回 null，交给默认粘贴逻辑。
 */
export function parseArrayText(raw: string): string[] | null {
  let text = raw.trim()
  if (!text) return null
  // 段落级别的文本直接放弃，避免把文章切成几十个"格子"
  if (text.length > 2000) return null

  // 去掉最外层的一对括号
  const wrappers: Array<[string, string]> = [
    ['[', ']'],
    ['(', ')'],
    ['{', '}'],
    ['【', '】'],
  ]
  let hadWrapper = false
  for (const [open, close] of wrappers) {
    if (text.startsWith(open) && text.endsWith(close) && text.length > 1) {
      text = text.slice(open.length, -close.length).trim()
      hadWrapper = true
      break
    }
  }

  // 链式写法统一成逗号
  text = text.replace(/->|→|=>/g, ',')

  const parts = text
    .split(/[,，、;；\s]+/)
    .map((part) => part.trim())
    // 过滤空项，以及被空格隔开的独立加减号（"10 - 2 - 5" 这种写法里的连接符）
    .filter((part) => part.length > 0 && part !== '-' && part !== '+')

  if (parts.length === 0) return null
  if (parts.length > MAX_CELLS) return null
  // 有任何一项特别长，说明这不是数组，多半是句子或代码
  if (parts.some((part) => part.length > MAX_CELL_LENGTH)) return null

  /**
   * 兜底：既没有外层括号、又只切出一项时，只有它本身像个值才算数组。
   * 否则「这是一段话」这种短句会被当成单格数组。
   */
  if (!hadWrapper && parts.length === 1) {
    const only = parts[0]
    const looksLikeValue =
      /^-?\d+(\.\d+)?$/.test(only) || /^(null|nil|none|undefined|\?|∞|inf|-inf)$/i.test(only)
    if (!looksLikeValue) return null
  }

  return parts
}
