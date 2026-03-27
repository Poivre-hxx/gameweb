/**
 * 临时测试工具 - 自动下载生成的代码
 * 
 */

/**
 * 自动触发下载代码到本地
 * @param code 生成的代码
 * @param filename 文件名（可选）
 */
export function downloadGeneratedCode(code: string, filename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultFilename = `game-code-${timestamp}.js`;
  const finalFilename = filename || defaultFilename;

  // 创建 Blob
  const blob = new Blob([code], { type: 'text/javascript;charset=utf-8' });

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  a.style.display = 'none';

  // 触发下载
  document.body.appendChild(a);
  a.click();

  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  console.log(`[TEST] Downloaded: ${finalFilename} Code length: ${code.length} chars`);
}

/**
 * 自动触发下载 JSON 数据到本地
 * @param data JSON 对象或数组
 * @param filename 文件名（可选）
 */
export function downloadJSON(data: any, filename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultFilename = `data-${timestamp}.json`;
  const finalFilename = filename || defaultFilename;

  // 转换为格式化的 JSON 字符串
  const jsonString = JSON.stringify(data, null, 2);

  // 创建 Blob
  const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' });

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  a.style.display = 'none';

  // 触发下载
  document.body.appendChild(a);
  a.click();

  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  console.log(`[TEST] Downloaded JSON: ${finalFilename} JSON size: ${jsonString.length} chars`);
}

/**
 * 自动触发下载文本数据到本地
 * @param text 文本内容
 * @param filename 文件名（可选）
 */
export function downloadText(text: string, filename?: string): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const defaultFilename = `data-${timestamp}.txt`;
  const finalFilename = filename || defaultFilename;

  // 创建 Blob
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });

  // 创建下载链接
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = finalFilename;
  a.style.display = 'none';

  // 触发下载
  document.body.appendChild(a);
  a.click();

  // 清理
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);

  console.log(`[TEST] Downloaded text: ${finalFilename}`);
}
