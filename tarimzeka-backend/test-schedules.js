const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
    try {
        console.log('Checking schedules...\n');

        const schedules = await prisma.irrigationSchedule.findMany({
            orderBy: [
                { status: 'asc' },
                { date: 'desc' }
            ],
            take: 15,
            include: { field: { select: { name: true, userId: true } } }
        });

        console.log('Total schedules:', schedules.length);
        schedules.forEach(s => {
            const dateStr = new Date(s.date).toISOString().split('T')[0];
            console.log(`ID: ${s.id.substring(0, 8)}... | Field: ${s.field.name} | Date: ${dateStr} | Status: ${s.status} | Water: ${s.waterAmount}L`);
        });

        console.log('\n\nSchedules by status:');
        const pending = schedules.filter(s => s.status === 'pending');
        const completed = schedules.filter(s => s.status === 'completed');
        console.log(`Pending: ${pending.length}`);
        console.log(`Completed: ${completed.length}`);

        await prisma.$disconnect();
    } catch (error) {
        console.error('Error:', error.message);
        process.exit(1);
    }
})();
