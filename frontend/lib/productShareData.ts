export function productShareData(input: {
  selectedCount: number; files: File[]; target: "facebook" | "zalo";
  title: string; caption: string; url: string; canShare: (data: ShareData) => boolean;
}): ShareData {
  if (!input.selectedCount) return { title: input.title, url: input.url };
  if (input.files.length !== input.selectedCount) throw new Error("media_incomplete");
  const data: ShareData = input.target === "facebook" ? { files: input.files } :
    { files: input.files, title: input.title, text: input.caption };
  if (!input.canShare(data)) throw new Error("media_unsupported");
  return data;
}
