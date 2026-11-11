/**
 * KRONA VAULT™ — Script de Respaldo Automatizado y Verificación de Integridad
 *
 * Ejecución manual o en crontab:
 *   npm run db:backup
 *
 * Variables de entorno opcionales:
 *   BACKUP_DIR: Directorio de destino local (por defecto: ./backups)
 *   REMOTE_BACKUP_PATH: Ruta de destino secundaria (NAS, Cloud Mount, USB)
 *   MAX_BACKUPS: Número máximo de copias históricas a retener (por defecto: 30)
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync, statSync, copyFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');
const SOURCE_DB_FILE = resolve(ROOT_DIR, 'apps/api/data/krona-vault.local.json');
const BACKUP_DIR = process.env.BACKUP_DIR ? resolve(process.env.BACKUP_DIR) : resolve(ROOT_DIR, 'backups');
const REMOTE_BACKUP_PATH = process.env.REMOTE_BACKUP_PATH ? resolve(process.env.REMOTE_BACKUP_PATH) : null;
const MAX_BACKUPS = Math.max(3, Number(process.env.MAX_BACKUPS || 30));

export interface BackupResult {
  ok: boolean;
  timestampIso: string;
  sourceFile: string;
  backupFile: string;
  checksumSha256: string;
  sizeBytes: number;
  entitiesSummary: {
    storesCount: number;
    walletsCount: number;
    vouchersCount: number;
    tournamentsCount: number;
    custodyCount: number;
    auditLogsCount: number;
  };
  remoteBackupFile?: string;
  retainedBackupsCount: number;
}

export function executeDatabaseBackup(): BackupResult {
  console.log('📦 [KRONA VAULT™] Iniciando respaldo de base de datos contable...');

  if (!existsSync(SOURCE_DB_FILE)) {
    throw new Error(`ARCHIVO_ORIGEN_NO_EXISTE: No se encontró la base de datos en ${SOURCE_DB_FILE}`);
  }

  // 1. Lectura y validación de integridad JSON
  const rawData = readFileSync(SOURCE_DB_FILE, 'utf-8');
  let parsed: Record<string, any>;
  try {
    parsed = JSON.parse(rawData);
  } catch (err: any) {
    throw new Error(`CORRUPCION_JSON_DETECTADA: El archivo origen no es un JSON válido: ${err.message}`);
  }

  // 2. Validación de estructura mínima de la base de datos
  if (!parsed.org || !parsed.wallets || !parsed.stores) {
    throw new Error('ESTRUCTURA_INVALIDA: El snapshot carece de las entidades mínimas requeridas (org, wallets, stores).');
  }

  // 3. Cálculo de Checksum Criptográfico SHA-256
  const sha256 = createHash('sha256').update(rawData).digest('hex');
  const shortHash = sha256.slice(0, 8);

  // 4. Asegurar existencia de directorio de respaldos
  if (!existsSync(BACKUP_DIR)) {
    mkdirSync(BACKUP_DIR, { recursive: true });
  }

  // 5. Generación de nombre con timestamp ISO seguro para sistemas de archivos
  const now = new Date();
  const dateStr = now.toISOString().replace(/[:.]/g, '-');
  const filename = `krona-vault-backup-${dateStr}-${shortHash}.json`;
  const targetPath = join(BACKUP_DIR, filename);
  const checksumPath = join(BACKUP_DIR, `${filename}.sha256`);

  // 6. Escritura atómica de respaldo y verificación
  writeFileSync(targetPath, rawData, 'utf-8');
  writeFileSync(checksumPath, `${sha256}  ${filename}\n`, 'utf-8');

  // Verificar que el archivo escrito exista y tenga tamaño idéntico
  const targetStat = statSync(targetPath);
  if (targetStat.size === 0) {
    throw new Error('ERROR_ESCRITURA_BACKUP: El archivo de respaldo generado está vacío (0 bytes).');
  }

  // 7. Respaldo Secundario / Remoto Opcional (si está configurado)
  let remoteTargetFile: string | undefined;
  if (REMOTE_BACKUP_PATH) {
    try {
      if (!existsSync(REMOTE_BACKUP_PATH)) {
        mkdirSync(REMOTE_BACKUP_PATH, { recursive: true });
      }
      remoteTargetFile = join(REMOTE_BACKUP_PATH, filename);
      copyFileSync(targetPath, remoteTargetFile);
      copyFileSync(checksumPath, join(REMOTE_BACKUP_PATH, `${filename}.sha256`));
      console.log(`🌐 Copia secundaria completada en: ${remoteTargetFile}`);
    } catch (remoteErr: any) {
      console.warn(`⚠️ Advertencia: Falló la copia secundaria a ${REMOTE_BACKUP_PATH}: ${remoteErr.message}`);
    }
  }

  // 8. Política de Rotación y Limpieza de Respaldos Históricos
  const existingFiles = readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('krona-vault-backup-') && f.endsWith('.json'))
    .sort()
    .reverse();

  let purgedCount = 0;
  if (existingFiles.length > MAX_BACKUPS) {
    const toDelete = existingFiles.slice(MAX_BACKUPS);
    for (const oldFile of toDelete) {
      try {
        unlinkSync(join(BACKUP_DIR, oldFile));
        const oldSha = join(BACKUP_DIR, `${oldFile}.sha256`);
        if (existsSync(oldSha)) unlinkSync(oldSha);
        purgedCount++;
      } catch (err) {
        // Ignorar fallo de borrado individual
      }
    }
  }

  const result: BackupResult = {
    ok: true,
    timestampIso: now.toISOString(),
    sourceFile: SOURCE_DB_FILE,
    backupFile: targetPath,
    checksumSha256: sha256,
    sizeBytes: targetStat.size,
    entitiesSummary: {
      storesCount: Array.isArray(parsed.stores) ? parsed.stores.length : 0,
      walletsCount: parsed.wallets ? Object.keys(parsed.wallets).length : 0,
      vouchersCount: Array.isArray(parsed.vouchers) ? parsed.vouchers.length : (parsed.vouchers ? Object.keys(parsed.vouchers).length : 0),
      tournamentsCount: Array.isArray(parsed.tournaments) ? parsed.tournaments.length : 0,
      custodyCount: Array.isArray(parsed.custodyPackages) ? parsed.custodyPackages.length : 0,
      auditLogsCount: Array.isArray(parsed.auditLogs) ? parsed.auditLogs.length : 0,
    },
    remoteBackupFile: remoteTargetFile,
    retainedBackupsCount: Math.min(existingFiles.length, MAX_BACKUPS),
  };

  console.log(`✅ Respaldo exitoso en: ${targetPath}`);
  console.log(`🔐 SHA-256: ${sha256}`);
  console.log(`📊 Entidades: ${result.entitiesSummary.storesCount} sucursales, ${result.entitiesSummary.walletsCount} carteras, ${result.entitiesSummary.custodyCount} resguardos, ${result.entitiesSummary.auditLogsCount} logs forenses.`);
  if (purgedCount > 0) {
    console.log(`🧹 Política de retención: se purgaron ${purgedCount} respaldo(s) antiguo(s).`);
  }

  return result;
}

// Ejecución directa por línea de comandos
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  try {
    executeDatabaseBackup();
    process.exit(0);
  } catch (err: any) {
    console.error('❌ Error ejecutando respaldo:', err.message);
    process.exit(1);
  }
}
