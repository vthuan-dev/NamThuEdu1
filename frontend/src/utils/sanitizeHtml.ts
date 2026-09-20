/**
 * Làm sạch chuỗi HTML trước khi render vào dangerouslySetInnerHTML
 * Loại bỏ script, iframe, object, embed và các inline event handlers (onerror, onclick,...)
 */
export function sanitizeHtml(dirtyHtml: string | null | undefined): string {
  if (!dirtyHtml) return "";

  return dirtyHtml
    // Xóa thẻ script và nội dung bên trong
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gi, "")
    // Xóa thẻ iframe nguy hiểm
    .replace(/<iframe\b[^>]*>([\s\S]*?)<\/iframe>/gi, "")
    // Xóa thẻ object, embed, applet
    .replace(/<(object|embed|applet)\b[^>]*>([\s\S]*?)<\/\1>/gi, "")
    // Xóa inline event handlers như onclick, onerror, onload,...
    .replace(/\s*on[a-zA-Z]+\s*=\s*(["']).*?\1/gi, "")
    .replace(/\s*on[a-zA-Z]+\s*=\s*[^"'\s>]+/gi, "")
    // Xóa giao thức javascript: trong href hoặc src
    .replace(/(href|src)\s*=\s*(["'])\s*javascript:[^"']*\2/gi, '$1="#"');
}
