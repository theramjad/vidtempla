/**
 * Converts SRT subtitle content to plain text by stripping
 * sequence numbers, timestamps, and blank lines.
 */
export function srtToPlainText(srt: string): string {
  return srt
    .split(/\r?\n/)
    .filter((line) => {
      // Skip sequence numbers (bare integers)
      if (/^\d+$/.test(line.trim())) return false;
      // Skip timestamp lines (00:00:00,000 --> 00:00:00,000)
      if (/^\d{2}:\d{2}:\d{2}[.,]\d{3}\s*-->/.test(line.trim())) return false;
      // Skip empty lines
      if (line.trim() === '') return false;
      return true;
    })
    .join('\n');
}
