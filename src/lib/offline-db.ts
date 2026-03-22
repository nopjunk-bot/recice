import { openDB, type IDBPDatabase } from "idb";

const DB_NAME = "recice-offline";
const DB_VERSION = 1;

// Types
export type CachedStudent = {
  id: string;
  studentCode: string;
  prefix: string;
  firstName: string;
  lastName: string;
  level: string;
  room: string;
  receiptType: string;
  distributions: {
    id: string;
    itemId: string;
    received: boolean;
    pendingSize: string | null;
    item: { id: string; name: string };
  }[];
};

export type CachedWelfareItem = {
  id: string;
  name: string;
};

export type PendingScan = {
  id?: number; // auto-increment key
  studentId: string;
  studentName: string; // สำหรับแสดงผลใน UI
  items: {
    itemId: string;
    received: boolean;
    reason: string;
    pendingSize: string | null;
  }[];
  timestamp: number;
};

// Open database
let dbPromise: Promise<IDBPDatabase> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // เก็บข้อมูลนักเรียน — key = studentCode
        if (!db.objectStoreNames.contains("students")) {
          db.createObjectStore("students", { keyPath: "studentCode" });
        }
        // เก็บรายการสวัสดิการ — key = id
        if (!db.objectStoreNames.contains("welfareItems")) {
          db.createObjectStore("welfareItems", { keyPath: "id" });
        }
        // เก็บผลสแกนที่รอ sync — auto-increment key
        if (!db.objectStoreNames.contains("pendingScans")) {
          db.createObjectStore("pendingScans", {
            keyPath: "id",
            autoIncrement: true,
          });
        }
        // เก็บ metadata เช่น lastSyncedAt
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
  }
  return dbPromise;
}

// ─── Cache All Data ───
export async function cacheAllData(
  students: CachedStudent[],
  welfareItems: CachedWelfareItem[]
) {
  const db = await getDB();

  // Clear + repopulate students
  const studentTx = db.transaction("students", "readwrite");
  await studentTx.store.clear();
  for (const s of students) {
    await studentTx.store.put(s);
  }
  await studentTx.done;

  // Clear + repopulate welfare items
  const itemTx = db.transaction("welfareItems", "readwrite");
  await itemTx.store.clear();
  for (const item of welfareItems) {
    await itemTx.store.put(item);
  }
  await itemTx.done;

  // Save sync timestamp
  await setLastSyncedAt(new Date());
}

// ─── Lookup Student ───
export async function lookupStudentByBarcode(
  barcode: string
): Promise<CachedStudent | undefined> {
  const db = await getDB();
  // Barcode format: studentCode-receiptType (เหมือน API)
  const studentCode = barcode.split("-")[0];
  // ลองค้นหาด้วย studentCode ก่อน ถ้าไม่เจอลอง barcode ทั้งตัว
  const student = await db.get("students", studentCode);
  if (student) return student as CachedStudent;
  return (await db.get("students", barcode)) as CachedStudent | undefined;
}

// ─── Welfare Items ───
export async function getWelfareItems(): Promise<CachedWelfareItem[]> {
  const db = await getDB();
  return (await db.getAll("welfareItems")) as CachedWelfareItem[];
}

// ─── Pending Scans Queue ───
export async function queueScan(scan: Omit<PendingScan, "id">): Promise<number> {
  const db = await getDB();
  const key = await db.add("pendingScans", scan);
  return (await db.count("pendingScans")) as number;
}

export async function getPendingScans(): Promise<PendingScan[]> {
  const db = await getDB();
  return (await db.getAll("pendingScans")) as PendingScan[];
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB();
  return await db.count("pendingScans");
}

export async function removePendingScan(key: number): Promise<void> {
  const db = await getDB();
  await db.delete("pendingScans", key);
}

// ─── Update cached student distributions (หลัง offline save) ───
export async function updateCachedStudentDistributions(
  studentCode: string,
  items: { itemId: string; received: boolean; pendingSize: string | null }[]
) {
  const db = await getDB();
  const student = (await db.get("students", studentCode)) as CachedStudent | undefined;
  if (!student) return;

  // อัปเดต distributions ตาม items ที่บันทึก
  for (const item of items) {
    const existing = student.distributions.find((d) => d.itemId === item.itemId);
    if (existing) {
      existing.received = item.received;
      existing.pendingSize = item.pendingSize;
    } else {
      // เพิ่ม distribution ใหม่ (id ชั่วคราว)
      const welfareItem = (await db.get("welfareItems", item.itemId)) as CachedWelfareItem | undefined;
      student.distributions.push({
        id: `offline-${Date.now()}`,
        itemId: item.itemId,
        received: item.received,
        pendingSize: item.pendingSize,
        item: welfareItem || { id: item.itemId, name: "" },
      });
    }
  }

  await db.put("students", student);
}

// ─── Meta ───
export async function getLastSyncedAt(): Promise<Date | null> {
  const db = await getDB();
  const val = await db.get("meta", "lastSyncedAt");
  return val ? new Date(val as string) : null;
}

async function setLastSyncedAt(date: Date): Promise<void> {
  const db = await getDB();
  await db.put("meta", date.toISOString(), "lastSyncedAt");
}

export async function getCachedStudentCount(): Promise<number> {
  const db = await getDB();
  return await db.count("students");
}
