async function main(): Promise<void> {
  console.log('Seed inicial: agrega datos cuando se definan los modelos de Prisma.');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
