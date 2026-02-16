const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const email = "czudohna@insprotel.cl";

  // ✅ 1) pon tu contraseña aquí (temporal) o usa variable de entorno
  const plainPassword = process.env.SUPERADMIN_PASSWORD || "CAMBIA_ESTA_PASSWORD";

  const hashed = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      role: "SUPERADMIN",
      activo: true,
      empresa: "INSPROTEL",
      password: hashed,
    },
    create: {
      email,
      password: hashed,
      nombre: "Cristian",
      apellido: "Zu-dohna",
      role: "SUPERADMIN",
      activo: true,
      empresa: "INSPROTEL",
    },
    select: { id: true, email: true, role: true, empresa: true, activo: true },
  });

  console.log("✅ SUPERADMIN listo:", user);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => prisma.$disconnect());
