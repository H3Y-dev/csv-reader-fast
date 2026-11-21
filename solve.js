export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  const n = text.length;
  let columns = null;
  let width = -1;
  let pos = text.charCodeAt(0) === 0xfeff ? 1 : 0;
  let line = 1;
  let recordLine = 1;
  let recordRow = null;
  let fieldEnded = 0; // 0: END, 1: COMMA, 2: LINE_BREAK

  const at = (i) => (i < n ? text.charCodeAt(i) : 0);
  const fail = (code) => errors.push({ code, line: recordLine, row: recordRow });

  function readUnquoted(initValue, emitJunk) {
    let value = initValue;
    let added = false;
    let start = pos;
    while (pos < n) {
      const c = at(pos);
      if (c === 44) {
        if (pos > start) { value += text.slice(start, pos); added = true; }
        pos++;
        if (emitJunk && added) fail('quote_junk');
        fieldEnded = 1;
        return value;
      }
      if (c === 10) {
        if (pos > start) { value += text.slice(start, pos); added = true; }
        pos++;
        line++;
        if (emitJunk && added) fail('quote_junk');
        fieldEnded = 2;
        return value;
      }
      if (c === 13) {
        if (at(pos + 1) === 10) {
          if (pos > start) { value += text.slice(start, pos); added = true; }
          pos += 2;
          line++;
          if (emitJunk && added) fail('quote_junk');
          fieldEnded = 2;
          return value;
        }
        if (pos > start) { value += text.slice(start, pos); added = true; }
        fail('stray_cr');
        pos++;
        start = pos;
        continue;
      }
      pos++;
    }
    if (pos > start) { value += text.slice(start, pos); added = true; }
    if (emitJunk && added) fail('quote_junk');
    fieldEnded = 0;
    return value;
  }

  function readQuoted() {
    const open = pos;
    const openLine = line;
    pos++;
    const chunks = [];
    let start = pos;
    let closed = false;
    while (pos < n) {
      const c = at(pos);
      if (c === 34) {
        if (at(pos + 1) === 34) {
          chunks.push(text.slice(start, pos), '"');
          pos += 2;
          start = pos;
          continue;
        }
        chunks.push(text.slice(start, pos));
        pos++;
        closed = true;
        break;
      }
      if (c === 13) {
        chunks.push(text.slice(start, pos), '\n');
        pos += at(pos + 1) === 10 ? 2 : 1;
        line++;
        start = pos;
        continue;
      }
      if (c === 10) {
        pos++;
        chunks.push(text.slice(start, pos));
        line++;
        start = pos;
        continue;
      }
      pos++;
    }
    if (!closed) {
      pos = open + 1;
      line = openLine;
      fail('unterminated_quote');
      return readUnquoted('"', false);
    }
    const value = chunks.length === 1 ? chunks[0] : chunks.join('');
    if (pos >= n) { fieldEnded = 0; return value; }
    const c = at(pos);
    if (c === 44) { pos++; fieldEnded = 1; return value; }
    if (c === 10) { pos++; line++; fieldEnded = 2; return value; }
    if (c === 13 && at(pos + 1) === 10) { pos += 2; line++; fieldEnded = 2; return value; }
    return readUnquoted(value, true);
  }

  while (true) {
    while (pos < n) {
      const c = at(pos);
      if (c === 10) { pos++; line++; }
      else if (c === 13 && at(pos + 1) === 10) { pos += 2; line++; }
      else break;
    }
    if (pos >= n) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted = false;
    do {
      quoted = at(pos) === 34;
      fields.push(quoted ? readQuoted() : readUnquoted('', false));
    } while (fieldEnded === 1);

    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }

  return { columns: header ? (columns ?? []) : null, rows, errors };
}
