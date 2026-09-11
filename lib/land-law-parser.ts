export type LandLawItem = {
  ucode: string;
  zoneName: string;
  contents: string;
  level: string;
  lawCode: string;
};

function decodeXml(value: string) {
  const entities: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
  };
  return value
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, name) => entities[name])
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(xml: string, name: string) {
  const match = xml.match(
    new RegExp(`<${name}>([\\s\\S]*?)<\\/${name}>`, "i"),
  );
  return match ? decodeXml(match[1]) : "";
}

export function parseLandLawXml(xml: string) {
  const resultCode = tag(xml, "resultCode");
  if (resultCode && !["0", "00", "000"].includes(resultCode))
    throw new Error(tag(xml, "resultMsg") || `공공데이터 오류 ${resultCode}`);
  const items: LandLawItem[] = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/gi)) {
    const item = match[1];
    const contents = tag(item, "LAW_CONTENTS");
    if (!contents) continue;
    items.push({
      ucode: tag(item, "UCODE"),
      zoneName: tag(item, "UNAME"),
      contents,
      level: tag(item, "LAW_LEVEL"),
      lawCode: tag(item, "LAW_FULL_CD"),
    });
  }
  return items;
}
