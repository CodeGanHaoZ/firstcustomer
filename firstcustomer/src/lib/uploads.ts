const MAX_FILES_PER_SUBMIT = 3;

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
  return Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer())));
}
