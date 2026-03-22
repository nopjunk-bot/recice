import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { receiptConfigs } from "../src/lib/receipt-config.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data (order matters for foreign keys)
  await prisma.welfareDistribution.deleteMany();
  await prisma.receipt.deleteMany();
  await prisma.student.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.welfareItem.deleteMany();
  await prisma.user.deleteMany();

  // Create users
  const hashedPassword = await bcrypt.hash("admin123", 10);

  const admin = await prisma.user.create({
    data: {
      name: "ผู้ดูแลระบบ",
      email: "test@test.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  await prisma.user.createMany({
    data: [
      {
        name: "พนักงานนำเข้าข้อมูล",
        email: "data@test.com",
        password: hashedPassword,
        role: "DATA_ENTRY",
      },
      {
        name: "พนักงานร้านสวัสดิการ",
        email: "welfare@test.com",
        password: hashedPassword,
        role: "WELFARE_STAFF",
      },
      {
        name: "ฝ่ายวิชาการ",
        email: "academic@test.com",
        password: hashedPassword,
        role: "ADMIN",
      },
    ],
  });

  // Create welfare items (batch)
  await prisma.welfareItem.createMany({
    data: [
      { name: "สมุด" },
      { name: "กระเป๋า" },
      { name: "กางเกงพละ" },
      { name: "เสื้อพละ" },
    ],
  });

  // Create import batch
  const batch = await prisma.importBatch.create({
    data: {
      fileName: "นักเรียนตัวอย่าง.xlsx",
      importedById: admin.id,
      totalStudents: 30,
    },
  });

  // Prepare sample students (batch insert)
  const prefixes = ["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"];
  const firstNames = [
    "สมชาย", "สมหญิง", "วิชัย", "วิภา", "ธนา",
    "ปิยะ", "สุดา", "มานะ", "กมล", "จันทร์",
    "สุรีย์", "ประยุทธ์", "ณัฐ", "ภาณุ", "อรุณ",
    "พิมพ์", "กาญจนา", "ศิริ", "อนันต์", "รัตนา",
    "ธีรพล", "นภา", "วรรณา", "สุทัศน์", "เบญจมาศ",
    "ชัยวัฒน์", "ปวีณา", "ธนพล", "สิริกัญญา", "พีรพัฒน์",
  ];
  const lastNames = [
    "ใจดี", "รักเรียน", "สุขสม", "มีชัย", "พงศ์พิพัฒน์",
    "แสนดี", "วงศ์ดี", "ศรีสุข", "ทองดี", "พันธ์ดี",
    "สว่าง", "รุ่งเรือง", "เจริญ", "มั่นคง", "สมบูรณ์",
    "ทวีศักดิ์", "อนุรักษ์", "ประเสริฐ", "ชัยชนะ", "เกียรติ",
    "สุวรรณ", "จิตติ", "พรหมมา", "ศิลป์ชัย", "ดวงดี",
    "สุขเสริม", "ลิ้มสกุล", "ตั้งมั่น", "แก้วกล้า", "วัฒนา",
  ];

  const studentData = [];
  for (let i = 0; i < 30; i++) {
    // M1: 0-11 (12 คน), M4_GENERAL: 12-21 (10 คน), M4_LANG: 22-29 (8 คน)
    const isM1 = i < 12;
    const isM4General = i >= 12 && i < 22;
    const receiptType = isM1 ? "M1" as const : isM4General ? "M4_GENERAL" as const : "M4_LANG" as const;
    const level = isM1 ? "ม.1" : "ม.4";
    const room = String((i % 4) + 1);
    const prefixIdx = isM1 ? (i % 2) : (i % 2) + 2;

    studentData.push({
      studentCode: `${68000 + i + 1}`,
      prefix: prefixes[prefixIdx],
      firstName: firstNames[i],
      lastName: lastNames[i],
      level,
      room,
      receiptType,
      importBatchId: batch.id,
    });
  }

  await prisma.student.createMany({ data: studentData });

  // Create sample receipts for some students (batch insert)
  const students = await prisma.student.findMany({
    orderBy: { studentCode: "asc" },
    take: 10, // สร้างใบเสร็จให้ 10 คนแรก
  });

  const receiptData = students.map((s, idx) => ({
    receiptNumber: `${String(idx + 1).padStart(5, "0")}/1/2569`,
    studentId: s.id,
    receiptType: s.receiptType,
    totalAmount: receiptConfigs[s.receiptType as keyof typeof receiptConfigs].total,
    barcodeData: `${s.studentCode}-${s.receiptType}`,
    generatedById: admin.id,
  }));

  await prisma.receipt.createMany({ data: receiptData });

  console.log("Seed data created successfully!");
  console.log("---");
  console.log("Students: 30 คน (ม.1: 12 คน, ม.4 ทั่วไป: 10 คน, ม.4 อังกฤษ จีน ญี่ปุ่น: 8 คน)");
  console.log("Receipts: 10 ใบ (สร้างให้ 10 คนแรก)");
  console.log("---");
  console.log("Login accounts:");
  console.log("  Admin:         test@test.com / admin123");
  console.log("  Data Entry:    data@test.com / admin123");
  console.log("  Welfare Staff: welfare@test.com / admin123");
  console.log("  Academic:      academic@test.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
