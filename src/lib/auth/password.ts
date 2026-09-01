const PBKDF2_ITERATIONS = 100_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

function toHex(bytes: ArrayBuffer | Uint8Array): string {
	const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
	return Array.from(view, (b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(hex: string): Uint8Array {
	const bytes = new Uint8Array(hex.length / 2);
	for (let i = 0; i < bytes.length; i += 1) {
		bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
	}
	return bytes;
}

async function deriveKey(
	password: string,
	salt: Uint8Array,
): Promise<ArrayBuffer> {
	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(password),
		"PBKDF2",
		false,
		["deriveBits"],
	);

	return crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt as BufferSource,
			iterations: PBKDF2_ITERATIONS,
			hash: "SHA-256",
		},
		keyMaterial,
		KEY_BITS,
	);
}

/** Returns `saltHex:hashHex` using Web Crypto PBKDF2 (Workers-safe). */
export async function hashPassword(password: string): Promise<string> {
	const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
	const derived = await deriveKey(password, salt);
	return `${toHex(salt)}:${toHex(derived)}`;
}

export async function verifyPassword(
	password: string,
	storedHash: string,
): Promise<boolean> {
	const [saltHex, hashHex] = storedHash.split(":");
	if (!saltHex || !hashHex) {
		return false;
	}

	const derived = await deriveKey(password, fromHex(saltHex));
	const candidate = toHex(derived);

	if (candidate.length !== hashHex.length) {
		return false;
	}

	let mismatch = 0;
	for (let i = 0; i < candidate.length; i += 1) {
		mismatch |= candidate.charCodeAt(i) ^ hashHex.charCodeAt(i);
	}
	return mismatch === 0;
}
