export type Specialty = 'Cirugía General' | 'Urgencias' | 'Medicina Interna' | 'Ginecología' | 'Pediatría';

export interface Student {
  name: string;
  id: string;
}

export type ChecklistStatus = 'none' | 'partial' | 'full';

export interface ChecklistItem {
  id: string;
  text: string;
  category: 'Anamnesis' | 'Examen Físico' | 'Diagnóstico' | 'Tratamiento' | 'Comunicación';
  allowPartial?: boolean; // If true, allows 0.5 score
  partialCriteria?: string; // Description of what counts as partial (e.g., "Correct drug, wrong dose")
}

export interface ClinicalCase {
  specialty: Specialty;
  topic: string;
  studentInstructions: {
    context: string; // Clinical setting (e.g., ER, Outpatient)
    caseSummary: string; // Brief presentation for student
    tasks: string[]; // Specific commands (e.g., "Perform focused history")
  };
  teacherGuide: {
    identification: string;
    chiefComplaint: string;
    hpi: string; // History of Present Illness
    ros: string; // Review of Systems
    pastMedicalHistory: string;
    physicalExam: string;
    vitals: string;
    labsAndImaging: string;
    diagnosis: string;
    treatmentPlan: string;
  };
  standardizedPatient?: {
    script: string;
    actingGuidelines: string;
  };
  checklist: ChecklistItem[];
}

export interface EvaluationState {
  checklist: Record<string, ChecklistStatus>; // itemId -> status
  score: number;
  maxScore: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  teacherNote?: string;
}

export const TOPICS: Record<Specialty, string[]> = {
  'Cirugía General': [
    'Apendicitis aguda',
    'Colelitiasis con colecistitis (Tokio II)',
    'Obstrucción intestinal'
  ],
  'Urgencias': [
    'Taquicardia supraventricular inestable',
    'Fibrilación ventricular',
    'Taquicardia ventricular'
  ],
  'Medicina Interna': [
    'Infarto agudo de miocardio con elevación del ST',
    'Tromboembolismo pulmonar agudo',
    'EPOC exacerbado sobreinfectado',
    'Accidente cerebrovascular'
  ],
  'Ginecología': [
    'Preeclampsia',
    'Amenaza de parto pretérmino',
    'Sepsis puerperal',
    'Código rojo'
  ],
  'Pediatría': [
    'Otitis media aguda (AIEPI)',
    'Neumonía (AIEPI)'
  ]
};