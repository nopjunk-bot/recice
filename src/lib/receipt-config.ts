export type ReceiptTypeKey = "M1" | "M4_GENERAL" | "M4_ENGLISH" | "M4_CHINESE" | "M4_JAPANESE";

export const receiptTypeLabels: Record<string, string> = {
  M1: "ม.1",
  M4_GENERAL: "ม.4 ทั่วไป",
  M4_ENGLISH: "ม.4 อังกฤษ",
  M4_CHINESE: "ม.4 จีน",
  M4_JAPANESE: "ม.4 ญี่ปุ่น",
};

export const receiptConfigs: Record<
  ReceiptTypeKey,
  {
    title: string;
    items: { name: string; amount: number }[];
    total: number;
  }
> = {
  M1: {
    title: "ใบเสร็จรับเงินชั่วคราว (ม.1)",
    items: [
      { name: "ค่าบำรุงการศึกษา ภาคเรียนที่ 1/2569", amount: 2500 },
      { name: "ค่าระบบสารสนเทศ", amount: 150 },
      { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
      { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
      { name: "ค่ากระเป๋าเป้", amount: 280 },
      { name: "ค่าชุดพละ", amount: 460 },
      { name: "ค่าสมุด", amount: 260 },
    ],
    total: 4250,
  },
  M4_GENERAL: {
    title: "ใบเสร็จรับเงินชั่วคราว (ม.4) ทั่วไป",
    items: [
      { name: "ค่าบำรุงการศึกษา ภาคเรียนที่ 1/2569", amount: 2500 },
      { name: "ค่าระบบสารสนเทศ", amount: 150 },
      { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
      { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
      { name: "ค่าชุดพละ", amount: 460 },
      { name: "ค่าสมุด", amount: 260 },
    ],
    total: 3970,
  },
  M4_ENGLISH: {
    title: "ใบเสร็จรับเงินชั่วคราว (ม.4) อังกฤษ",
    items: [
      { name: "ค่าบำรุงการศึกษา ภาคเรียนที่ 1/2569", amount: 3000 },
      { name: "ค่าระบบสารสนเทศ", amount: 150 },
      { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
      { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
      { name: "ค่าชุดพละ", amount: 460 },
      { name: "ค่าสมุด", amount: 260 },
    ],
    total: 4470,
  },
  M4_CHINESE: {
    title: "ใบเสร็จรับเงินชั่วคราว (ม.4) จีน",
    items: [
      { name: "ค่าบำรุงการศึกษา ภาคเรียนที่ 1/2569", amount: 3000 },
      { name: "ค่าระบบสารสนเทศ", amount: 150 },
      { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
      { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
      { name: "ค่าชุดพละ", amount: 460 },
      { name: "ค่าสมุด", amount: 260 },
    ],
    total: 4470,
  },
  M4_JAPANESE: {
    title: "ใบเสร็จรับเงินชั่วคราว (ม.4) ญี่ปุ่น",
    items: [
      { name: "ค่าบำรุงการศึกษา ภาคเรียนที่ 1/2569", amount: 3000 },
      { name: "ค่าระบบสารสนเทศ", amount: 150 },
      { name: "ค่าประกันอุบัติเหตุ", amount: 400 },
      { name: "ค่าสมาคมผู้ปกครองและครู", amount: 200 },
      { name: "ค่าชุดพละ", amount: 460 },
      { name: "ค่าสมุด", amount: 260 },
    ],
    total: 4470,
  },
};
