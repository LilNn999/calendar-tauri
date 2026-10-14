// 临时验证工具：按页解析 PDF 的字体 CMap 并还原文字，用于人工核对分页与内容完整性。
// 用法：node docs/mockups/verify-pdf-text.mjs <pdf路径> [每页最多打印字符数]
import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const path = process.argv[2];
const perPageLimit = Number(process.argv[3] ?? 0);
const buf = readFileSync(path);
const latin = buf.toString("latin1");

/** 解析对象偏移表（支持常规 xref 与对象流之外的简单情形）。 */
function objectAt(offset) {
  const end = latin.indexOf("endobj", offset);
  return latin.slice(offset, end < 0 ? undefined : end);
}

const offsets = new Map();
for (const match of latin.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)) {
  offsets.set(`${match[1]} ${match[2]}`, match.index + match[0].indexOf("obj") + 3);
}

function bodyOf(reference) {
  const offset = offsets.get(reference);
  if (offset === undefined) return null;
  return objectAt(offset);
}

/** 取出对象里的流并解压。 */
function streamOf(objectBody) {
  if (!objectBody) return null;
  const index = objectBody.indexOf("stream");
  if (index < 0) return null;
  let start = index + 6;
  if (objectBody.charCodeAt(start) === 13) start += 1;
  if (objectBody.charCodeAt(start) === 10) start += 1;
  const end = objectBody.lastIndexOf("endstream");
  if (end < 0) return null;
  const raw = Buffer.from(objectBody.slice(start, end), "latin1");
  try {
    return inflateSync(raw).toString("latin1");
  } catch {
    return objectBody.slice(start, end);
  }
}

/** 从 ToUnicode CMap 流建立 glyphId -> 文本 映射。 */
function parseCMap(stream) {
  const table = new Map();
  if (!stream) return table;
  for (const block of stream.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const pair of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      table.set(pair[1].toUpperCase().padStart(4, "0"), hexToText(pair[2]));
    }
  }
  for (const block of stream.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    for (const range of block[1].matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) {
      const from = parseInt(range[1], 16);
      const to = parseInt(range[2], 16);
      const start = parseInt(range[3], 16);
      for (let code = from; code <= to; code += 1) {
        table.set(code.toString(16).toUpperCase().padStart(4, "0"), String.fromCharCode(start + (code - from)));
      }
    }
  }
  return table;
}

function hexToText(hex) {
  let result = "";
  for (let i = 0; i + 4 <= hex.length; i += 4) {
    result += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
  }
  return result;
}

// 收集页面对象与字体资源
const pages = [];
for (const match of latin.matchAll(/(\d+)\s+(\d+)\s+obj\b/g)) {
  const reference = `${match[1]} ${match[2]}`;
  const body = bodyOf(reference);
  if (!body || !/\/Type\s*\/Page[^s]/.test(body)) continue;
  const fontRefs = [...body.matchAll(/\/Font\s*<<([\s\S]*?)>>/g)]
    .flatMap((block) => [...block[1].matchAll(/\/([A-Za-z0-9]+)\s+(\d+)\s+(\d+)\s+R/g)].map((item) => item.slice(2).join(" ")))
    .map((item) => {
      const parts = item.split(" ");
      return `${parts[0]} ${parts[1]}`;
    });
  // 字体对象指向 ToUnicode
  const cmap = new Map();
  for (const reference2 of fontRefs) {
    const fontBody = bodyOf(reference2) ?? "";
    const toUnicode = /\/ToUnicode\s+(\d+)\s+(\d+)\s+R/.exec(fontBody);
    if (!toUnicode) continue;
    const cmapStream = streamOf(bodyOf(`${toUnicode[1]} ${toUnicode[2]}`));
    for (const [key, value] of parseCMap(cmapStream)) cmap.set(key, value);
  }
  const contents = /\/Contents\s+(\d+)\s+(\d+)\s+R/.exec(body);
  const contentStream = contents ? streamOf(bodyOf(`${contents[1]} ${contents[2]}`)) : null;
  pages.push({ reference, cmap, contentStream });
}

console.log(`PAGES=${pages.length}`);

let allText = "";
pages.forEach((page, pageIndex) => {
  let pageText = "";
  if (page.contentStream) {
    for (const item of page.contentStream.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) {
      const hex = item[1];
      for (let i = 0; i + 4 <= hex.length; i += 4) {
        const key = hex.slice(i, i + 4).toUpperCase();
        pageText += page.cmap.get(key) ?? "\uFFFD";
      }
    }
  }
  allText += pageText;
  const label = `第 ${pageIndex + 1} 页`;
  const hasFooter = pageText.includes("未完成母任务及其全部子任务均已保留");
  const pageNumber = /第\s*(\d+)\s*页\s*\/\s*共\s*(\d+)\s*页/.exec(pageText);
  console.log(
    `${label}: chars=${pageText.length} 页脚=${hasFooter} 页码=${pageNumber ? `${pageNumber[1]}/${pageNumber[2]}` : "无"}`,
  );
  if (perPageLimit > 0) console.log(pageText.slice(0, perPageLimit));
});

console.log(`TOTAL_CHARS=${allText.length}`);
console.log(`HAS_URL=${/https?:\/\//.test(allText)}`);
console.log(`HAS_LOCAL_PATH=${/file:|task-export-pdf|AppData/i.test(allText)}`);
console.log(`HAS_SAMPLE_LABEL=${/示例/.test(allText)}`);
for (const needle of process.argv.slice(4)) {
  console.log(`CONTAINS ${JSON.stringify(needle)}=${allText.includes(needle)}`);
}
