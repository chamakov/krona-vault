import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ControlCreditoEngine } from './ledger-engine.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const DB_PATH = resolve(__dirname, '../data/krona-vault.local.json');

const engine = new ControlCreditoEngine();
const owner = engine.resetToCleanSingleUser();
mkdirSync(dirname(DB_PATH), { recursive: true });
writeFileSync(DB_PATH, JSON.stringify(engine.exportSnapshot(), null, 2), 'utf-8');

console.log('---------------------------------------------------------');
console.log('✅ KRONA VAULT: Base de Datos Local Limpiada Exitosamente');
console.log(`👤 Usuario Propietario: ${owner.fullName} (${owner.alias})`);
console.log(`🆔 Código: ${owner.memberCode} · Rol: ${owner.role}`);
console.log(`📧 Correo: ${owner.email}`);
console.log(`🔑 Contraseña: krona2026 · PIN: 123456`);
console.log(`📁 Archivo persistido: ${DB_PATH}`);
console.log('---------------------------------------------------------');
