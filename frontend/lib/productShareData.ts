export function productShareData(input: {
  selectedCount: number; files: File[]; target: "facebook" | "zalo";
  title: string; caption: string; url: string; canShare: (data: ShareData) => boolean;
}): ShareData {
  if (!input.selectedCount) return { title: input.title, text: input.caption };
  if (input.files.length !== input.selectedCount) throw new Error("media_incomplete");
  const files = [...input.files.filter(file => file.type.startsWith("video/")),
    ...input.files.filter(file => !file.type.startsWith("video/"))];
  const data: ShareData = input.target === "facebook" ? { files } :
    { files, title: input.title, text: input.caption };
  if (!input.canShare(data)) throw new Error("media_unsupported");
  return data;
}
