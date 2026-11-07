const MAX_FILES_PER_SUBMIT = 3;
// Leave room for multipart fields and the Server Action envelope on Vercel.
export const hostedUploadLimit = process.env.VERCEL === "1" ? 4 * 1024 * 1024 : undefined;

export async function readUploadedImage(formData: FormData, field: string) {
  const files = await readUploadedFiles(formData, field);
  if (files.length !== 1) throw new Error("请选择一张图片");
  return files[0];
}

export async function readUploadedFiles(formData: FormData, field: string) {
  const files = formData
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_FILES_PER_SUBMIT) {
    throw new Error(`一次最多上传 ${MAX_FILES_PER_SUBMIT} 张截图`);
  }
  if (hostedUploadLimit && files.reduce((total, file) => total + file.size, 0) > hostedUploadLimit) {
    throw new Error("每次上传的文件总大小不能超过 4 MB");
  }
  return Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer())));
}
