const MAX_FILES_PER_SUBMIT = 3;

export async function readUploadedFiles(formData: FormData, field: string) {
  const files = formData
    .getAll(field)
    .filter((value): value is File => value instanceof File && value.size > 0);
  if (files.length > MAX_FILES_PER_SUBMIT) {
    throw new Error(`一次最多上传 ${MAX_FILES_PER_SUBMIT} 张截图`);
  }
  return Promise.all(files.map(async (file) => new Uint8Array(await file.arrayBuffer())));
}
