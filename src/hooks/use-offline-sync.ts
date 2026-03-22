"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  getPendingScans,
  getPendingCount,
  removePendingScan,
} from "@/lib/offline-db";

export function useOfflineSync(isOnline: boolean) {
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const prevOnlineRef = useRef(isOnline);

  // โหลดจำนวน pending ตอนเริ่มต้น
  useEffect(() => {
    getPendingCount().then(setPendingCount);
  }, []);

  // Sync ข้อมูลที่ค้างอยู่ขึ้น server
  const syncPending = useCallback(async (): Promise<{ synced: number; failed: number }> => {
    if (isSyncing) return { synced: 0, failed: 0 };
    setIsSyncing(true);

    let synced = 0;
    let failed = 0;

    try {
      const scans = await getPendingScans();

      for (const scan of scans) {
        try {
          const res = await fetch("/api/scan", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              studentId: scan.studentId,
              items: scan.items,
            }),
          });

          if (res.ok) {
            await removePendingScan(scan.id!);
            synced++;
          } else if (res.status === 401) {
            // Session หมดอายุ — หยุด sync
            failed = scans.length - synced;
            break;
          } else {
            failed++;
          }
        } catch {
          // Network error — หยุด sync
          failed = scans.length - synced;
          break;
        }
      }
    } finally {
      const remaining = await getPendingCount();
      setPendingCount(remaining);
      setIsSyncing(false);
    }

    return { synced, failed };
  }, [isSyncing]);

  // Auto-sync เมื่อกลับมาออนไลน์
  useEffect(() => {
    if (isOnline && !prevOnlineRef.current && pendingCount > 0) {
      syncPending();
    }
    prevOnlineRef.current = isOnline;
  }, [isOnline, pendingCount, syncPending]);

  // อัปเดต pending count
  const refreshPendingCount = useCallback(async () => {
    const count = await getPendingCount();
    setPendingCount(count);
  }, []);

  return { pendingCount, isSyncing, syncPending, refreshPendingCount };
}
