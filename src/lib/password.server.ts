const PREFIX = "pbkdf2-sha256";
function hex(bytes: Uint8Array) { return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(""); }
async function derive(password: string, salt: Uint8Array) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt: new Uint8Array(salt), iterations: 100000, hash: "SHA-256" }, key, 256)));
}
export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `${PREFIX}$${hex(salt)}$${await derive(password, salt)}`;
}
export async function verifyPassword(password: string, stored: string) {
  if (!stored.startsWith(`${PREFIX}$`)) return password === stored;
  const [, salt, expected] = stored.split("$");
  if (!salt || !expected) return false;
  const actual = await derive(password, Uint8Array.from(salt.match(/.{2}/g) ?? [], (byte) => parseInt(byte, 16)));
  let difference = actual.length ^ expected.length;
  for (let i = 0; i < actual.length; i++) difference |= actual.charCodeAt(i) ^ (expected.charCodeAt(i) || 0);
  return difference === 0;
}