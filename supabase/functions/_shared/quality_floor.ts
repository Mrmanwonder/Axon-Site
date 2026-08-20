// The do-this-next quality floor.
//
// The explanation prompt asks for something specific to this answer and
// performable during an exam. This is the backstop for when what comes back is
// neither. A line that matches one of these shapes is dropped and the slot is
// left empty, because an empty slot is honest and generic advice is not — and
// once a student learns this line says nothing, they stop reading the
// explanation above it too.
//
// A pattern list cannot catch everything and is not meant to. It catches the
// failure that recurs, which is advice about studying rather than about writing.

export function clearsTheFloor(line: string | null | undefined): boolean {
  if (!line) return false;
  const text = line.trim();
  // Too short to name anything specific to one answer.
  if (text.length < 25) return false;
  const generic = [
    /\brevis(e|ing)\b/i,
    /\bpractic(e|ing)\s+(more|regularly|daily)/i,
    /\bstudy\s+(more|harder|the\s+chapter)/i,
    /\bread\s+the\s+(chapter|textbook|ncert)\b/i,
    /\bbe\s+(more\s+)?careful\b/i,
    /\bpay\s+(more\s+)?attention\b/i,
    /\bmanage\s+your\s+time\b/i,
    /\bunderstand\s+the\s+concept\b/i,
    /\bwork\s+on\s+(your|this)\b/i,
  ];
  return !generic.some((re) => re.test(text));
}
