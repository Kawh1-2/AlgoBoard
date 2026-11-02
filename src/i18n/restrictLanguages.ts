import { LANGUAGES } from 'tldraw'

/** 只保留简体中文和英文 */
const ALLOWED_LOCALES = ['zh-cn', 'en']

/**
 * 收窄语言列表。
 *
 * 原理：tldraw 的 LanguageMenu 直接遍历 `LANGUAGES` 这个数组渲染选项，
 * 而这个数组是 tlschema 里导出的普通可变数组，所以就地裁剪即可，
 * 不需要覆盖 MainMenu 或重写菜单样式。
 *
 * 副作用（已知且可接受）：
 * - `getDefaultTranslation` 匹配浏览器语言时只会在中英里找，其他语种回落到默认
 * - 已保存的 locale 若是被裁掉的语言，界面会回落到默认语言
 *
 * 注意：本模块必须在渲染任何 tldraw UI 之前被 import（见 main.tsx 第一行）。
 */
type MutableLanguage = { locale: string; label: string }

/**
 * LANGUAGES 在类型上是 `as const` 的只读元组，但运行时就是个普通数组，
 * 这里用断言拿到可变视图就地裁剪（没有 Object.freeze，所以可行）。
 */
const languages = LANGUAGES as unknown as MutableLanguage[]

const kept = languages.filter((language) => ALLOWED_LOCALES.includes(language.locale))

languages.length = 0
languages.push(...kept)
