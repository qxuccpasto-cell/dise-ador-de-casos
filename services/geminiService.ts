import { GoogleGenAI, Type, Schema } from "@google/genai";
import { ClinicalCase, Specialty, ChecklistStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const checklistItemSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    id: { type: Type.STRING, description: "Unique ID for the item (e.g., item-1)" },
    text: { type: Type.STRING, description: "The action the student must perform" },
    category: { 
      type: Type.STRING, 
      enum: ['Anamnesis', 'Examen Físico', 'Diagnóstico', 'Tratamiento', 'Comunicación']
    },
    allowPartial: { 
      type: Type.BOOLEAN, 
      description: "Set to TRUE for items like Medications (correct drug/wrong dose) or complex procedures where partial credit is possible." 
    },
    partialCriteria: {
      type: Type.STRING,
      description: "If allowPartial is true, describe what gives partial credit. E.g., 'Menciona el medicamento correcto pero la dosis es errónea'."
    }
  },
  required: ["id", "text", "category"]
};

const caseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    studentInstructions: {
      type: Type.OBJECT,
      properties: {
        context: { type: Type.STRING, description: "Where is the student? e.g. ER, Clinic" },
        caseSummary: { type: Type.STRING, description: "Brief patient intro for the student" },
        tasks: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["context", "caseSummary", "tasks"]
    },
    teacherGuide: {
      type: Type.OBJECT,
      properties: {
        identification: { type: Type.STRING },
        chiefComplaint: { type: Type.STRING },
        hpi: { type: Type.STRING },
        ros: { type: Type.STRING },
        pastMedicalHistory: { type: Type.STRING },
        physicalExam: { type: Type.STRING },
        vitals: { type: Type.STRING },
        labsAndImaging: { type: Type.STRING },
        diagnosis: { type: Type.STRING },
        treatmentPlan: { type: Type.STRING }
      },
      required: ["identification", "chiefComplaint", "hpi", "physicalExam", "diagnosis", "treatmentPlan"]
    },
    standardizedPatient: {
      type: Type.OBJECT,
      properties: {
        script: { type: Type.STRING, description: "Short script for the actor" },
        actingGuidelines: { type: Type.STRING, description: "How to act (pain, confusion, etc)" }
      },
      required: ["script", "actingGuidelines"]
    },
    checklist: {
      type: Type.ARRAY,
      items: checklistItemSchema,
      description: "List of 10-15 distinct items to evaluate the student. Ensure medications have allowPartial: true."
    }
  },
  required: ["studentInstructions", "teacherGuide", "standardizedPatient", "checklist"]
};

export const generateClinicalCase = async (specialty: Specialty, topic: string): Promise<ClinicalCase> => {
  const prompt = `
    Genera un caso clínico detallado para una estación de evaluación médica (ECOE/OSCE).
    Especialidad: ${specialty}
    Patología/Tema: ${topic}
    Nivel: Estudiante de Medicina de Pregrado (Interno). El caso NO debe ser nivel residente/especialista.
    
    El caso debe evaluar el razonamiento diagnóstico y la toma de decisiones acorde a un médico general en formación.
    Incluye una lista de chequeo precisa.
    
    IMPORTANTE SOBRE LA LISTA DE CHEQUEO:
    - Para ítems de Farmacología (medicamentos) o Procedimientos complejos, habilita "allowPartial": true.
    - Define "partialCriteria" explicando que el estudiante recibe medio punto si menciona el medicamento correcto pero falla en dosis/presentación.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: caseSchema,
        temperature: 0.4
      }
    });

    const data = JSON.parse(response.text || "{}");
    
    return {
      specialty,
      topic,
      ...data
    } as ClinicalCase;

  } catch (error) {
    console.error("Error generating case:", error);
    throw new Error("Failed to generate clinical case. Please check API key.");
  }
};

export const generateFeedback = async (
  clinicalCase: ClinicalCase, 
  checklistResults: Record<string, ChecklistStatus>,
  teacherNote?: string
): Promise<{ feedback: string; strengths: string[]; weaknesses: string[] }> => {
  
  const performedFull = clinicalCase.checklist
    .filter(item => checklistResults[item.id] === 'full')
    .map(i => i.text);

  const performedPartial = clinicalCase.checklist
    .filter(item => checklistResults[item.id] === 'partial')
    .map(i => `${i.text} (Realizado parcialmente: ${i.partialCriteria || 'Incompleto'})`);

  const missed = clinicalCase.checklist
    .filter(item => !checklistResults[item.id] || checklistResults[item.id] === 'none')
    .map(i => i.text);

  const prompt = `
    Actúa como un profesor de medicina evaluando un ECOE de ${clinicalCase.topic}.
    Nivel del estudiante: Pregrado (Interno).
    
    Resultados del estudiante:
    - Completos: ${JSON.stringify(performedFull)}
    - Parciales (0.5 ptos): ${JSON.stringify(performedPartial)}
    - Omitidos/Incorrectos: ${JSON.stringify(missed)}

    ${teacherNote ? `NOTA OBSERVACIONAL DEL DOCENTE (Usa esto para personalizar el feedback): "${teacherNote}"` : ''}

    Genera:
    1. Un párrafo de resumen constructivo. Si hay nota del docente, incorpórala en el análisis.
    2. 3 fortalezas.
    3. 3 áreas de mejora.
  `;

  const feedbackSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      feedback: { type: Type.STRING },
      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["feedback", "strengths", "weaknesses"]
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: feedbackSchema
      }
    });

    return JSON.parse(response.text || "{}");
  } catch (error) {
    return {
      feedback: "No se pudo generar retroalimentación automática.",
      strengths: [],
      weaknesses: []
    };
  }
};