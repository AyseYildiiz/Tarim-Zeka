-- AlterTable
ALTER TABLE "IrrigationSchedule" ADD COLUMN     "actualWaterUsed" DOUBLE PRECISION,
ADD COLUMN     "completedAt" TIMESTAMP(3);
