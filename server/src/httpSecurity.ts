import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Constant-time string comparison via fixed-length SHA-256 digests. Hashing
 * first means both inputs compare as equal-length buffers, so a plain
 * `timingSafeEqual` can be used even when the attacker-supplied string is a
 * different length than the secret — neither the digest length nor an
 * early exit can leak how much of the secret has been guessed.
 */
function timingSafeStringsEqual(a: string, b: string): boolean {
    const digestA = createHash("sha256").update(a, "utf8").digest();
    const digestB = createHash("sha256").update(b, "utf8").digest();
    return timingSafeEqual(digestA, digestB);
}

/**
 * Checks an `Authorization: Basic <base64>` header against expected
 * credentials. Used to gate `/monitor` in production (ticket 131). Returns
 * false (never throws) for any malformed input — missing header, wrong
 * scheme, invalid base64, or a decoded value with no `:` separator.
 */
export function checkBasicAuth(
    authorizationHeader: string | undefined,
    expectedUser: string,
    expectedPass: string
): boolean {
    if (!authorizationHeader || !authorizationHeader.startsWith("Basic ")) {
        return false;
    }
    let decoded: string;
    try {
        decoded = Buffer.from(authorizationHeader.slice("Basic ".length), "base64").toString("utf8");
    } catch {
        return false;
    }
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) {
        return false;
    }
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    return timingSafeStringsEqual(user, expectedUser) && timingSafeStringsEqual(pass, expectedPass);
}

/**
 * Resolves the `Access-Control-Allow-Origin` value for `/api/questions`
 * (ticket 131): permissive (`*`) outside production, since the Vite dev
 * server's origin varies by machine/port. In production it locks to the
 * configured `CLIENT_ORIGIN`, or `null` when that is unset/blank — callers
 * must omit the header in that case rather than fall back to a wildcard.
 */
export function resolveAllowedOrigin(
    nodeEnv: string | undefined,
    clientOrigin: string | undefined
): string | null {
    if (nodeEnv !== "production") {
        return "*";
    }
    const trimmed = clientOrigin?.trim();
    return trimmed ? trimmed : null;
}
