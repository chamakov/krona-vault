# Security Policy — KRONA VAULT™

> 🌐 **Languages / Idiomas**: [ 🇺🇸 English ](./SECURITY.md) · [ 🇲🇽 Español ](./SECURITY.es.md)

Security, ledger integrity, and zero-trust authentication are top priorities for **KRONA VAULT™**.

---

## 🛡️ Supported Versions

Only the latest release on the `main` branch receives active security patches:

| Version | Supported |
| :--- | :--- |
| `1.0.x` / `main` | ✅ Yes |
| Previous versions | ❌ No |

---

## 🔒 Reporting a Vulnerability

**Please DO NOT open a public GitHub Issue for security vulnerabilities, ledger integrity flaws, or authentication bypasses.**

To report a vulnerability responsibly:

1. Use GitHub's **Private Vulnerability Reporting**:
   - Navigate to the **Security** tab of this repository on GitHub.
   - Click **Advisories** and select **New draft security advisory**.
2. Or contact the maintainers directly via contact details on the author's GitHub profile.

### Helpful Information to Include
- Detailed description of the vulnerability and attack vector.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Affected module (`packages/crypto-totp`, `apps/api/src/ledger-engine.ts`, POS endpoints, etc.).
- Potential impact on accounting balances, user data, or credentials.
- Suggested remediation or patch if available.

---

## ⏳ Response Timeline

- **Initial acknowledgment**: Within 48 hours.
- **Triage & PoC validation**: Within 5 business days.
- **Patch release & disclosure coordination**: Handled with urgency according to severity, agreeing on a responsible disclosure date.

---

## 🎯 Threat Model & Architectural Guarantees

When assessing or auditing this codebase, consider our core security assumptions:
1. **Double-Entry Invariant**: Ledger entries cannot be updated or deleted; corrections require auditable counter-entries.
2. **Anti-Replay Protections**: Dynamic QR codes rotate every 30 seconds with single-use nonces; physical receipts feature sequential folios, cryptographic seals, and audited reprint counters.
3. **Four-Eyes Principle (Maker-Checker)**: Critical operations (balance write-offs above threshold, custody releases) strictly require dual authorization, blocking self-approval.
