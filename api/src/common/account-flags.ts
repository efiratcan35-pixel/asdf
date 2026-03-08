import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

type AccountFlagsStore = {
  hiddenUserIds: number[];
  lastLoginAtByUserId: Record<string, string>;
  phoneByUserId: Record<string, string>;
};

const dataDir = join(process.cwd(), 'data');
const flagsFile = join(dataDir, 'account-flags.json');

function ensureFlagsFile() {
  if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });
  if (!existsSync(flagsFile)) {
    writeFileSync(
      flagsFile,
        JSON.stringify({ hiddenUserIds: [], lastLoginAtByUserId: {} }, null, 2),
      'utf-8',
    );
  }
}

function readFlags(): AccountFlagsStore {
  ensureFlagsFile();
  try {
    const data = JSON.parse(readFileSync(flagsFile, 'utf-8')) as AccountFlagsStore;
    return {
      hiddenUserIds: Array.isArray(data.hiddenUserIds) ? data.hiddenUserIds : [],
      lastLoginAtByUserId:
        data.lastLoginAtByUserId && typeof data.lastLoginAtByUserId === 'object'
          ? data.lastLoginAtByUserId
          : {},
      phoneByUserId:
        data.phoneByUserId && typeof data.phoneByUserId === 'object'
          ? data.phoneByUserId
          : {},
    };
  } catch {
    return { hiddenUserIds: [], lastLoginAtByUserId: {}, phoneByUserId: {} };
  }
}

function writeFlags(data: AccountFlagsStore) {
  ensureFlagsFile();
  writeFileSync(flagsFile, JSON.stringify(data, null, 2), 'utf-8');
}

export function getHiddenUserIdsSet() {
  return new Set(readFlags().hiddenUserIds);
}

export function isUserHidden(userId: number) {
  return getHiddenUserIdsSet().has(userId);
}

export function setUserHidden(userId: number, hidden: boolean) {
  const store = readFlags();
  const set = new Set(store.hiddenUserIds);
  if (hidden) set.add(userId);
  else set.delete(userId);
  writeFlags({ ...store, hiddenUserIds: Array.from(set) });
}

export function setUserLastLogin(userId: number, isoDate: string) {
  const store = readFlags();
  store.lastLoginAtByUserId[String(userId)] = isoDate;
  writeFlags(store);
}

export function getUserLastLogin(userId: number) {
  const store = readFlags();
  return store.lastLoginAtByUserId[String(userId)] ?? null;
}

export function getUserPhone(userId: number) {
  const store = readFlags();
  return store.phoneByUserId[String(userId)] ?? '';
}

export function setUserPhone(userId: number, phone: string) {
  const store = readFlags();
  store.phoneByUserId[String(userId)] = phone;
  writeFlags(store);
}
