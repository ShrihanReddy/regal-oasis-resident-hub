/** Minimal uncompressed ZIP builder for modest rent-proof archives. No network dependencies. */
const encoder = new TextEncoder();
function crc32(data: Uint8Array) { let c = -1; for (const byte of data) { c ^= byte; for (let i=0;i<8;i++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return (c ^ -1) >>> 0; }
function u16(d: DataView, o: number, x: number) { d.setUint16(o,x,true); }
function u32(d: DataView, o: number, x: number) { d.setUint32(o,x,true); }
export function createZip(files: {name:string;data:Uint8Array}[]): Blob {
  if (files.length > 65535) throw Error('Too many archive files');
  const parts: BlobPart[]=[]; const directory: BlobPart[]=[]; let offset=0; let dirSize=0;
  for (const file of files) {
    const name=encoder.encode(file.name.replace(/[^a-zA-Z0-9_./-]/g,'_'));
    const crc=crc32(file.data); const len=file.data.byteLength;
    const local=new Uint8Array(30+name.length); const h=new DataView(local.buffer);
    u32(h,0,0x04034b50);u16(h,4,20);u16(h,8,0);u32(h,14,crc);u32(h,18,len);u32(h,22,len);u16(h,26,name.length);local.set(name,30);
    parts.push(local as BlobPart,file.data.slice() as BlobPart);
    const central=new Uint8Array(46+name.length);const c=new DataView(central.buffer);
    u32(c,0,0x02014b50);u16(c,4,20);u16(c,6,20);u32(c,16,crc);u32(c,20,len);u32(c,24,len);u16(c,28,name.length);u32(c,42,offset);central.set(name,46);directory.push(central);dirSize+=central.length;offset+=local.length+len;
  }
  const end=new Uint8Array(22);const e=new DataView(end.buffer);u32(e,0,0x06054b50);u16(e,8,files.length);u16(e,10,files.length);u32(e,12,dirSize);u32(e,16,offset);
  return new Blob([...parts,...directory,end],{type:'application/zip'});
}
export function downloadBlob(blob: Blob, name: string) { const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000); }
