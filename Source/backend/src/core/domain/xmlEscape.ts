// Escapes a string for safe inclusion in an XML attribute value, so receipt-derived text
// can never break out of an attribute and into prompt instructions (Bedrock prompts use XML
// tag separators — invariant #12 / ai-prompt-extraction-engineer). Shared by every prompt
// builder that interpolates untrusted text into `<tag attr="...">`.
export function escapeXmlAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
