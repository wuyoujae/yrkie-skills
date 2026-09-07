import { open,lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute,basename } from 'node:path';

export class LocalImageError extends Error {
  constructor(readonly code:string){super(code);}
}
export async function readApprovedImage(path:string) {
  if(!isAbsolute(path) || path.length>4096 || /[\x00-\x1f]/.test(path) || /^[/\\]{2}/.test(path))throw new LocalImageError('image_file_unavailable');
  let file;
  try {
    const link=await lstat(path);if(!link.isFile() || link.isSymbolicLink())throw new LocalImageError('image_file_unavailable');
    file=await open(path,constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const before=await file.stat();
    if(!before.isFile() || before.dev!==link.dev || before.ino!==link.ino)throw new LocalImageError('image_file_unavailable');
    const max=20*1024*1024;
    if(before.size<1||before.size>max)throw new LocalImageError('image_file_too_large');
    const chunks:Buffer[]=[];let size=0;
    for(;;){
      const chunk=Buffer.alloc(Math.min(64*1024,max+1-size));const {bytesRead}=await file.read(chunk,0,chunk.length,null);
      if(!bytesRead)break;size+=bytesRead;if(size>max)throw new LocalImageError('image_file_too_large');chunks.push(chunk.subarray(0,bytesRead));
    }
    const after=await file.stat();
    if(size!==before.size || after.size!==before.size || after.mtimeMs!==before.mtimeMs || after.ctimeMs!==before.ctimeMs)throw new LocalImageError('image_file_changed');
    const bytes=Buffer.concat(chunks);let mime;
    if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))mime='image/png';
    else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)mime='image/jpeg';
    else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')mime='image/webp';
    else throw new LocalImageError('image_file_invalid');
    // The server always performs full decoding. No path or image bytes enter tool output.
    return {bytes,mime,name:basename(path)};
  }catch(error){if(error instanceof LocalImageError)throw error;throw new LocalImageError('image_file_unavailable');}
  finally{await file?.close();}
}
