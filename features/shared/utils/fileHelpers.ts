export async function convertFileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const base64Data = Buffer.from(arrayBuffer).toString('base64');
  return base64Data;
}
