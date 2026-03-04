import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Clear existing data
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

  await prisma.user.create({
    data: {
      name: "พนักงานนำเข้าข้อมูล",
      email: "data@test.com",
      password: hashedPassword,
      role: "DATA_ENTRY",
    },
  });

  await prisma.user.create({
    data: {
      name: "พนักงานร้านสวัสดิการ",
      email: "welfare@test.com",
      password: hashedPassword,
      role: "WELFARE_STAFF",
    },
  });

  // Create welfare items
  const items = ["สมุด", "กระเป๋า", "กางเกงพละ", "เสื้อพละ"];
  for (const name of items) {
    await prisma.welfareItem.create({ data: { name } });
  }

  // Create import batch
  const batch = await prisma.importBatch.create({
    data: {
      fileName: "นักเรียนตัวอย่าง.xlsx",
      importedById: admin.id,
      totalStudents: 20,
    },
  });

  // Create sample students
  const prefixes = ["เด็กชาย", "เด็กหญิง", "นาย", "นางสาว"];
  const firstNames = [
    "สมชาย", "สมหญิง", "วิชัย", "วิภา", "ธนา",
    "ปิยะ", "สุดา", "มานะ", "กมล", "จันทร์",
    "สุรีย์", "ประยุทธ์", "ณัฐ", "ภาณุ", "อรุณ",
    "พิมพ์", "กาญจนา", "ศิริ", "อนันต์", "รัตนา",
  ];
  const lastNames = [
    "ใจดี", "รักเรียน", "สุขสม", "มีชัย", "พงศ์พิพัฒน์",
    "แสนดี", "วงศ์ดี", "ศรีสุข", "ทองดี", "พันธ์ดี",
    "สว่าง", "รุ่งเรือง", "เจริญ", "มั่นคง", "สมบูรณ์",
    "ทวีศักดิ์", "อนุรักษ์", "ประเสริฐ", "ชัยชนะ", "เกียรติ",
  ];

  for (let i = 0; i < 20; i++) {
    const isM1 = i < 8;
    const isM4Lang = i >= 15;
    const receiptType = isM1 ? "M1" : isM4Lang ? "M4_LANG" : "M4_GENERAL";
    const level = isM1 ? "ม.1" : "ม.4";
    const room = String((i % 4) + 1);
    const prefixIdx = isM1 ? (i % 2) : (i % 2) + 2;

    await prisma.student.create({
      data: {
        studentCode: `${68000 + i + 1}`,
        prefix: prefixes[prefixIdx],
        firstName: firstNames[i],
        lastName: lastNames[i],
        level,
        room,
        receiptType,
        importBatchId: batch.id,
      },
    });
  }

  console.log("Seed data created successfully!");
  console.log("Admin: test@test.com / admin123");
  console.log("Data Entry: data@test.com / admin123");
  console.log("Welfare Staff: welfare@test.com / admin123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
