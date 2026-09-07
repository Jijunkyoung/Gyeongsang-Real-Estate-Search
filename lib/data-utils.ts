export function optionalCount(value:unknown):number|null {
 if(value==null||typeof value==='boolean')return null;
 const text=String(value).trim().replace(/,/g,'');
 if(!/^\d+$/.test(text))return null;
 const n=Number(text);return Number.isSafeInteger(n)?n:null;
}
