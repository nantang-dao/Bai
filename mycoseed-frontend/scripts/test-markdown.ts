/**
 * 单元测试：任务 Markdown 渲染与摘要
 * npx tsx scripts/test-markdown.ts
 */
import { renderTaskMarkdown, stripTaskMarkdown, applyBoldWrap } from '../utils/markdown'

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message)
}

function testPlainText() {
  const html = renderTaskMarkdown('第一行\n第二行')
  assert(html.includes('第一行'), '应保留纯文本')
  assert(!html.includes('<script'), '不应包含脚本')
  console.log('[OK] plain text')
}

function testBold() {
  const html = renderTaskMarkdown('**重点**')
  assert(html.includes('<strong>') || html.includes('<b>'), '加粗应渲染')
  assert(html.includes('重点'), '加粗文字应保留')
  console.log('[OK] bold')
}

function testApplyBoldWrap() {
  const empty = applyBoldWrap('hello', 5, 5)
  assert(empty.value === 'hello**加粗文字**', '无选中应插入占位加粗')
  assert(empty.selectionStart === 7 && empty.selectionEnd === 11, '应选中占位文字')

  const withSel = applyBoldWrap('hello world', 0, 5)
  assert(withSel.value === '**hello** world', '有选中应包裹加粗')
  assert(withSel.selectionStart === 9 && withSel.selectionEnd === 9, '有选中光标应在加粗块后')
  console.log('[OK] applyBoldWrap')
}

function testList() {
  const html = renderTaskMarkdown('- 条目一\n- 条目二')
  assert(html.includes('<ul>') && html.includes('<li>'), '列表应渲染')
  console.log('[OK] list')
}

function testStrip() {
  const plain = stripTaskMarkdown('**目标**\n- 步骤一\n- 步骤二')
  assert(!plain.includes('**'), '摘要应去掉加粗标记')
  assert(!plain.includes('- '), '摘要应去掉列表标记')
  assert(plain.includes('目标'), '摘要应保留文字')
  console.log('[OK] strip')
}

function testXss() {
  const html = renderTaskMarkdown('<script>alert(1)</script>\n[x](javascript:alert(1))')
  assert(!html.toLowerCase().includes('script'), '脚本应被过滤')
  assert(!html.includes('javascript:'), '危险链接应被过滤')
  console.log('[OK] xss')
}

testPlainText()
testBold()
testApplyBoldWrap()
testList()
testStrip()
testXss()
console.log('All markdown tests passed.')
