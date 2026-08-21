-- CreateTable
CREATE TABLE "lcat_mappings" (
    "id" TEXT NOT NULL,
    "lcatName" TEXT NOT NULL,
    "socCode" TEXT NOT NULL,
    "socTitle" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "lcat_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lcat_mappings_lcatName_key" ON "lcat_mappings"("lcatName");

-- CreateIndex
CREATE INDEX "lcat_mappings_socCode_idx" ON "lcat_mappings"("socCode");

-- CreateIndex
CREATE INDEX "lcat_mappings_isActive_idx" ON "lcat_mappings"("isActive");

-- INSERT initial LCAT mappings
INSERT INTO "lcat_mappings" ("id", "lcatName", "socCode", "socTitle", "isActive", "isSystem", "createdAt", "updatedAt") VALUES
(gen_random_uuid()::text, 'Business Intelligence Analyst', '15-2051.01', 'Business Intelligence Analysts', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer and Information Research Scientist', '15-1221.00', 'Computer and Information Research Scientists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer and Information Systems Manager', '11-3021.00', 'Computer and Information Systems Managers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Hardware Engineer', '17-2061.00', 'Computer Hardware Engineers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Network Architect', '15-1241.00', 'Computer Network Architects', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Network Support Specialist', '15-1231.00', 'Computer Network Support Specialists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Operator', '43-9061.00', 'Computer Operators', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Programmer', '15-1251.00', 'Computer Programmers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Systems Analyst', '15-1211.00', 'Computer Systems Analysts', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer Systems Engineer/Architect', '15-1299.08', 'Computer Systems Engineers/Architects', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Computer User Support Specialist', '15-1232.00', 'Computer User Support Specialists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Data Warehousing Specialist', '15-1243.01', 'Data Warehousing Specialists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Database Administrator', '15-1242.00', 'Database Administrators', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Database Architect', '15-1243.00', 'Database Architects', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Document Management Specialist', '15-1299.03', 'Document Management Specialists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Geographic Information Systems Technician', '15-1299.02', 'Geospatial Information Scientists and Technologists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Geospatial Information Scientist and Technologist', '15-1299.02', 'Geospatial Information Scientists and Technologists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Information Security Analyst', '15-1212.00', 'Information Security Analysts', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Information Technology Project Manager', '15-1299.09', 'Information Technology Project Managers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Management Analyst', '13-1111.00', 'Management Analysts', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Network and Computer Systems Administrator', '15-1244.00', 'Network and Computer Systems Administrators', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Software Developer, Applications', '15-1252.00', 'Software Developers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Software Developer, Systems Software', '15-1252.00', 'Software Developers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Software Quality Assurance Engineer and Tester', '15-1253.00', 'Software Quality Assurance Analysts and Testers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Technical Writer', '27-3042.00', 'Technical Writers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Telecommunications Engineering Specialist', '15-1241.01', 'Telecommunications Engineering Specialists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Telecommunications Equipment Installer and Repairer', '49-2022.00', 'Telecommunications Equipment Installers and Repairers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Training and Development Specialist', '13-1151.00', 'Training and Development Specialists', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Video Game Designer', '15-1255.01', 'Video Game Designers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Web Administrator', '15-1299.01', 'Web Administrators', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
(gen_random_uuid()::text, 'Web Developer', '15-1254.00', 'Web Developers', true, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
