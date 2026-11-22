/** Excel-safe, RFC 4180 compatible cell for a private, permission-audited export.
 * Leading whitespace and invisible format characters must not bypass formula guarding.
 */
export function rosterCsvCell(raw:string|null|undefined):string{
 const cleaned=String(raw??"").replace(/[\u0000-\u001f\u007f]/g," ");
 const safe=/^[\s\u200b-\u200d\ufeff]*[=+\-@]/u.test(cleaned)?"'"+cleaned:cleaned;
 return '"'+safe.replace(/"/g,'""')+'"';
}
