/**
 * Utility untuk memastikan semua foto dikonversi ke RGB JPEG
 * sebelum upload untuk mengatasi masalah blank foto di WebView Android
 */
export async function ensureRGBJPEG(input: File | Blob, quality = 0.82): Promise<File> {
  try {
    const blob = input instanceof File ? input : new File([input], 'input', { type: input.type || 'image/jpeg' });
    
    // Decode gambar ke bitmap
    const bmp = await createImageBitmap(blob);
    
    // Buat canvas untuk re-encode
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    
    // Gambar ke canvas (otomatis konversi ke RGB)
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(bmp, 0, 0);
    
    // Convert ke JPEG RGB blob
    const outBlob = await new Promise<Blob>(resolve => 
      canvas.toBlob(blob => resolve(blob!), 'image/jpeg', quality)
    );
    
    // Return sebagai File dengan nama yang proper
    const fileName = (blob as File).name?.replace(/\.\w+$/, '') || 'image';
    return new File([outBlob!], fileName + '.jpg', { type: 'image/jpeg' });
    
  } catch (error) {
    console.warn('[ensureRGBJPEG] Conversion failed, returning original:', error);
    // Fallback: return original file
    return input instanceof File ? input : new File([input], 'fallback.jpg', { type: 'image/jpeg' });
  }
}
