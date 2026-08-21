import { Prompt } from '@/features/shared/types';
import { AiSettings } from '@/types';

export const prompts: Prompt[] = [
  {
    id: 'soc-code-mapping',
    creatorId: null,
    title: 'Labor Category to O*NET Code Mapping',
    summary: 'Maps labor categories directly to O*NET-SOC codes',
    description: 'Maps a labor category from a U.S. government IT contract to the appropriate 8-digit O*NET-SOC code',
    instructions: `Map this labor category to the appropriate 8-digit O*NET-SOC 2019 code.

LABOR CATEGORY: {req.laborCategory}
CONTEXT: U.S. government IT contract

=== CLASSIFICATION RULES (apply in priority order) ===

RULE 1 - COMPOUND TITLES: For "/" or "&" titles, classify by the FIRST role.

RULE 2 - NON-IT ENGINEERING (check FIRST - overrides IT defaults):
- Biomedical, Bio-medical → 17-2031.00|Bioengineers and Biomedical Engineers
- Civil, Construction → 17-2051.00|Civil Engineers
- Mechanical → 17-2141.00|Mechanical Engineers
- Human Factors, Ergonomic → 17-2112.01|Human Factors Engineers and Ergonomists
- Industrial Engineer → 17-2112.00|Industrial Engineers
- CAD, Drafter, Drafting → 17-3019.00|Drafters, All Other

RULE 2B - TECHNICIAN/INSTALLER ROLES (hardware, not IT support):
- HVAC, Heating, Air Conditioning, Refrigeration → 49-9021.00|Heating, Air Conditioning, and Refrigeration Mechanics and Installers
- Hardware Installation, Computer Repair, Office Machine → 49-2011.00|Computer, Automated Teller, and Office Machine Repairers

RULE 2C - SCIENTIFIC/HEALTH ROLES:
- Bioinformatician, Bioinformatics, Informatics Specialist → 15-2041.02|Bioinformatics Scientists
- Biostatistician → 15-2041.00|Biostatisticians
- Epidemiologist → 19-1041.00|Epidemiologists
- Medical Billing, Medical Records → 29-2072.00|Medical Records Specialists

RULE 3 - MANAGER OVERRIDE: If title contains "Manager" → 11-3021.00|Computer and Information Systems Managers
EXCEPTIONS:
- Project Manager, Program Manager → 15-1299.09|Information Technology Project Managers
- Customer Service Manager → 43-1011.00|First-Line Supervisors of Office and Administrative Support Workers
- Risk Manager → 13-2099.02|Risk Management Specialists
- Health Insurance Manager → 11-9111.00|Medical and Health Services Managers
- Facilities Manager → 11-3013.00|Facilities Managers

RULE 4 - SECURITY ROLES:
- Security Engineer, Cyber Security Engineer, Information Security Engineer → 15-1299.05|Information Security Engineers
- Security Administrator, Security Analyst, Cyber Security Analyst, Information Security Analyst → 15-1212.00|Information Security Analysts
- Physical Security → 33-1099.02|Security Management Specialists

RULE 5 - DATABASE ROLES:
- Database Administrator, DBA → 15-1242.00|Database Administrators
- Database Architect → 15-1243.00|Database Architects

RULE 6 - DATA/ANALYTICS ROLES:
- Business Intelligence, BI Analyst, BI Developer → 15-2051.01|Business Intelligence Analysts
- Data Scientist, Machine Learning Engineer → 15-2051.00|Data Scientists
- Data Analyst, Data Engineer → 15-2051.01|Business Intelligence Analysts
- Business Analyst (no "Intelligence" or "Data") → 13-1111.00|Management Analysts

RULE 7 - ANALYST ROLES:
- Systems Analyst, Application Analyst, Computer Systems Analyst, Architecture Analyst → 15-1211.00|Computer Systems Analysts
- Financial Analyst, Cost Analyst → 13-2051.00|Financial and Investment Analysts
- Risk Analyst → 13-2099.02|Risk Management Specialists
- Business Analyst, Functional Analyst, Process Analyst, Program Analyst, Policy Analyst, Public Health Analyst, Functional Area Expert → 13-1111.00|Management Analysts

RULE 8 - NETWORK/SYSTEMS:
- Network Engineer, Telecommunications Engineer → 15-1241.00|Computer Network Architects
- Network Administrator, System Administrator → 15-1244.00|Network and Computer Systems Administrators
- Network Technician → 15-1231.00|Computer Network Support Specialists

RULE 9 - DEVELOPMENT:
- Developer, Programmer, Software Engineer → 15-1252.00|Software Developers
- Web Developer → 15-1254.00|Web Developers
- Web Designer, UI Designer, UX Designer → 15-1255.00|Web and Digital Interface Designers
- DevOps, Cloud Engineer, Site Reliability → 15-1244.00|Network and Computer Systems Administrators

RULE 10 - TESTING:
- Test Engineer, Tester, QA Engineer, QA Analyst → 15-1253.00|Software Quality Assurance Analysts and Testers

RULE 11 - SUPPORT:
- Help Desk, Desktop Support, Customer Service Technician, Computer Operator → 15-1232.00|Computer User Support Specialists

RULE 12 - SYSTEMS ENGINEERING:
- System Engineer, System Architect, Integration Engineer → 15-1299.08|Computer Systems Engineers/Architects

RULE 13 - OTHER COMMON ROLES:
- Technical Writer, Technical Editor → 27-3042.00|Technical Writers
- Trainer, Training Specialist → 13-1151.00|Training and Development Specialists
- Administrative Assistant, Clerical → 43-6014.00|Secretaries and Administrative Assistants, Except Legal, Medical, and Executive
- 508 Compliance, Accessibility → 13-1041.00|Compliance Officers
- Scheduler, EVM, Logistics → 13-1081.00|Logisticians
- Librarian → 25-4022.00|Librarians and Media Collections Specialists
- Library Assistant, Library Technician, Library Aide → 25-4031.00|Library Technicians

RULE 14 - IT CONTRACT DEFAULT: Ambiguous "Engineer" or "Architect" → 15-1299.08|Computer Systems Engineers/Architects

=== OUTPUT FORMAT ===

Return ONLY one line in this exact format (no explanation, no markdown):
CODE|TITLE

Use the EXACT official O*NET title from the rules above.

Examples:
15-1252.00|Software Developers
11-3021.00|Computer and Information Systems Managers
13-1111.00|Management Analysts
15-1299.05|Information Security Engineers
15-1212.00|Information Security Analysts`,
    tags: ['rcast', 'soc', 'onet', 'mapping'],
    example: '',
    config: {} as AiSettings,
  },
];
