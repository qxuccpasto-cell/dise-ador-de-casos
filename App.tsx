import React, { useState, useRef } from 'react';
import { Student, ClinicalCase, Specialty, TOPICS, EvaluationState, ChecklistStatus } from './types';
import { generateClinicalCase, generateFeedback } from './services/geminiService';
import Timer from './components/Timer';
import Checklist from './components/Checklist';
import { 
  User, 
  Stethoscope, 
  FileText, 
  Play, 
  RotateCcw, 
  Download, 
  CheckCircle, 
  AlertCircle, 
  ChevronRight,
  ClipboardList,
  UserCheck,
  BrainCircuit,
  MessageSquarePlus
} from 'lucide-react';

// Use type assertion for jsPDF since we are using CDN
declare const jspdf: any;

type AppStep = 'setup' | 'loading' | 'review' | 'station' | 'results';

function App() {
  // --- State ---
  const [step, setStep] = useState<AppStep>('setup');
  const [student, setStudent] = useState<Student>({ name: '', id: '' });
  const [selectedSpecialty, setSelectedSpecialty] = useState<Specialty>('Medicina Interna');
  const [selectedTopic, setSelectedTopic] = useState<string>(TOPICS['Medicina Interna'][0]);
  const [clinicalCase, setClinicalCase] = useState<ClinicalCase | null>(null);
  const [checkedState, setCheckedState] = useState<Record<string, ChecklistStatus>>({});
  const [teacherNote, setTeacherNote] = useState<string>("");
  const [evaluationResult, setEvaluationResult] = useState<EvaluationState | null>(null);
  const [showPatientScript, setShowPatientScript] = useState(false);
  const [isTimerRunning, setIsTimerRunning] = useState(false);

  // --- Handlers ---

  const handleStartGeneration = async () => {
    if (!student.name || !student.id) {
      alert("Por favor complete los datos del estudiante.");
      return;
    }
    setStep('loading');
    try {
      const generatedCase = await generateClinicalCase(selectedSpecialty, selectedTopic);
      setClinicalCase(generatedCase);
      // Reset checklist state
      const initialChecks: Record<string, ChecklistStatus> = {};
      generatedCase.checklist.forEach(item => initialChecks[item.id] = 'none');
      setCheckedState(initialChecks);
      setTeacherNote("");
      setStep('review');
    } catch (error) {
      console.error(error);
      alert("Error al generar el caso. Verifique su API Key.");
      setStep('setup');
    }
  };

  const handleStartStation = () => {
    setStep('station');
    setIsTimerRunning(true);
  };

  const handleFinishStation = async () => {
    setIsTimerRunning(false);
    if (!clinicalCase) return;

    // Calculate Score
    const totalItems = clinicalCase.checklist.length;
    let earnedPoints = 0;

    Object.values(checkedState).forEach(status => {
      if (status === 'full') earnedPoints += 1;
      if (status === 'partial') earnedPoints += 0.5;
    });

    const finalScore = (earnedPoints / totalItems) * 5.0;
    
    // Generate AI Feedback
    setStep('loading');
    const aiFeedback = await generateFeedback(clinicalCase, checkedState, teacherNote);

    setEvaluationResult({
      checklist: checkedState,
      score: parseFloat(finalScore.toFixed(1)),
      maxScore: 5.0,
      feedback: aiFeedback.feedback,
      strengths: aiFeedback.strengths,
      weaknesses: aiFeedback.weaknesses,
      teacherNote: teacherNote
    });
    setStep('results');
  };

  const toggleCheck = (id: string) => {
    setCheckedState(prev => {
      const current = prev[id] || 'none';
      const item = clinicalCase?.checklist.find(i => i.id === id);
      
      let next: ChecklistStatus = 'full';
      
      if (current === 'none') {
        next = 'full';
      } else if (current === 'full') {
        // If partial is allowed, go to partial, otherwise go to none
        next = item?.allowPartial ? 'partial' : 'none';
      } else if (current === 'partial') {
        next = 'none';
      }

      return { ...prev, [id]: next };
    });
  };

  const generatePDF = () => {
    if (!clinicalCase || !evaluationResult) return;
    const doc = new jspdf.jsPDF();

    let yPos = 20;

    // Helper to handle page breaks
    const checkPageBreak = (heightNeeded: number) => {
      if (yPos + heightNeeded > 270) {
        doc.addPage();
        yPos = 20;
      }
    };

    // Helper to print section
    const printSection = (title: string, content: string) => {
      doc.setFont(undefined, 'bold');
      doc.setFontSize(11);
      checkPageBreak(10);
      doc.text(title, 14, yPos);
      yPos += 5;
      
      doc.setFont(undefined, 'normal');
      doc.setFontSize(10);
      const lines = doc.splitTextToSize(content || "N/A", 180);
      checkPageBreak(lines.length * 5);
      doc.text(lines, 14, yPos);
      yPos += (lines.length * 5) + 5;
    };

    // Header
    doc.setFontSize(18);
    doc.text("Evaluación de Estación Clínica (ECOE)", 14, yPos);
    yPos += 10;
    
    doc.setFontSize(12);
    doc.text(`Estudiante: ${student.name} (${student.id})`, 14, yPos);
    yPos += 6;
    doc.text(`Caso: ${clinicalCase.topic} (${clinicalCase.specialty})`, 14, yPos);
    yPos += 6;
    doc.text(`Calificación Final: ${evaluationResult.score} / 5.0`, 14, yPos);
    yPos += 15;

    // --- Clinical Case Details ---
    doc.setFontSize(14);
    doc.setTextColor(41, 128, 185); // Blue color for section header
    doc.text("Información del Caso Clínico", 14, yPos);
    doc.setTextColor(0, 0, 0); // Reset color
    yPos += 10;

    printSection("Resumen del Caso:", clinicalCase.studentInstructions.caseSummary);
    printSection("Enfermedad Actual (HPI):", clinicalCase.teacherGuide.hpi);
    printSection("Examen Físico:", clinicalCase.teacherGuide.physicalExam);
    printSection("Diagnóstico:", clinicalCase.teacherGuide.diagnosis);
    // Removed Treatment Plan (Plan de Manejo) from export as requested
    
    yPos += 5;

    // --- Feedback ---
    doc.setFontSize(14);
    doc.setTextColor(41, 128, 185);
    checkPageBreak(20);
    doc.text("Retroalimentación y Desempeño", 14, yPos);
    doc.setTextColor(0, 0, 0);
    yPos += 10;
    
    if (evaluationResult.teacherNote) {
      doc.setFont(undefined, 'bold italic');
      doc.text("Nota del Docente:", 14, yPos);
      yPos += 5;
      doc.setFont(undefined, 'normal');
      const noteLines = doc.splitTextToSize(evaluationResult.teacherNote, 180);
      doc.text(noteLines, 14, yPos);
      yPos += (noteLines.length * 5) + 5;
    }

    printSection("Comentarios Generales (IA):", evaluationResult.feedback);

    doc.setFont(undefined, 'bold');
    checkPageBreak(10);
    doc.text("Fortalezas:", 14, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    evaluationResult.strengths.forEach(s => {
      checkPageBreak(5);
      doc.text(`- ${s}`, 14, yPos);
      yPos += 5;
    });
    yPos += 5;

    doc.setFont(undefined, 'bold');
    checkPageBreak(10);
    doc.text("A mejorar:", 14, yPos);
    yPos += 5;
    doc.setFont(undefined, 'normal');
    evaluationResult.weaknesses.forEach(w => {
      checkPageBreak(5);
      doc.text(`- ${w}`, 14, yPos);
      yPos += 5;
    });

    // Checklist Table
    const tableData = clinicalCase.checklist.map(item => {
      const status = evaluationResult.checklist[item.id];
      let statusText = "NO";
      if (status === 'full') statusText = "SÍ (1.0)";
      if (status === 'partial') statusText = "PARCIAL (0.5)";
      return [item.category, item.text, statusText];
    });

    (doc as any).autoTable({
      startY: yPos + 10,
      head: [['Categoría', 'Ítem Evaluado', 'Realizado']],
      body: tableData,
      theme: 'striped',
      headStyles: { fillColor: [41, 128, 185] },
    });

    doc.save(`Evaluacion_${student.name.replace(/\s+/g, '_')}.pdf`);
  };

  // --- Views ---

  if (step === 'setup') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col">
          <div className="bg-blue-600 p-6 text-white">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Stethoscope size={32} /> MediEval
            </h1>
            <p className="opacity-90 mt-2">Sistema de Evaluación de Competencias Clínicas</p>
          </div>
          <div className="p-8 space-y-6 flex-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <User size={20} /> Datos del Estudiante
                </h3>
                <input
                  type="text"
                  placeholder="Nombre Completo"
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={student.name}
                  onChange={(e) => setStudent({ ...student, name: e.target.value })}
                />
                <input
                  type="text"
                  placeholder="Documento de Identidad"
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                  value={student.id}
                  onChange={(e) => setStudent({ ...student, id: e.target.value })}
                />
              </div>
              
              <div className="space-y-4">
                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                  <ClipboardList size={20} /> Configuración de Estación
                </h3>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={selectedSpecialty}
                  onChange={(e) => {
                    const spec = e.target.value as Specialty;
                    setSelectedSpecialty(spec);
                    setSelectedTopic(TOPICS[spec][0]);
                  }}
                >
                  {Object.keys(TOPICS).map(s => <option key={s} value={s}>{s}</option>)}
                </select>
                <select 
                  className="w-full border border-slate-300 rounded-lg p-3 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                >
                  {TOPICS[selectedSpecialty].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            </div>
            
            <button 
              onClick={handleStartGeneration}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-lg transition-all flex items-center justify-center gap-2 shadow-lg mt-4"
            >
              <BrainCircuit size={24} /> Generar Caso Clínico con IA
            </button>
          </div>
          <div className="bg-slate-50 p-4 text-center border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              Diseñada por Jose Alfredo Burbano Martinez
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'loading') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-xl text-slate-600 font-medium animate-pulse">Procesando información con Gemini...</p>
      </div>
    );
  }

  if (step === 'review' && clinicalCase) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <header className="flex justify-between items-center">
            <h1 className="text-2xl font-bold text-slate-800">Revisión del Caso (Vista Docente)</h1>
            <button onClick={() => setStep('setup')} className="text-slate-500 hover:text-slate-800">Cancelar</button>
          </header>

          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-500">
            <h2 className="text-xl font-bold mb-4">{clinicalCase.topic}</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-slate-600 mb-2">Resumen Clínico</h3>
                <p className="text-slate-800 mb-2"><span className="font-semibold">HPI:</span> {clinicalCase.teacherGuide.hpi}</p>
                <p className="text-slate-800 mb-2"><span className="font-semibold">Examen:</span> {clinicalCase.teacherGuide.physicalExam}</p>
                <p className="text-slate-800"><span className="font-semibold">Diagnóstico:</span> {clinicalCase.teacherGuide.diagnosis}</p>
              </div>
              <div className="bg-slate-50 p-4 rounded-lg">
                <h3 className="font-semibold text-slate-600 mb-2">Instrucciones para el Estudiante</h3>
                <p className="italic text-slate-700 mb-2">"{clinicalCase.studentInstructions.caseSummary}"</p>
                <ul className="list-disc pl-5 text-sm text-slate-700">
                  {clinicalCase.studentInstructions.tasks.map((task, i) => <li key={i}>{task}</li>)}
                </ul>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-4">
            <button 
              onClick={handleStartGeneration} 
              className="px-6 py-3 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 font-medium flex items-center gap-2"
            >
               <RotateCcw size={20} /> Regenerar Caso
            </button>
            <button 
              onClick={handleStartStation}
              className="px-8 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-bold shadow-lg flex items-center gap-2"
            >
              <Play size={20} /> Iniciar Estación
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'station' && clinicalCase) {
    const checkedCount = Object.values(checkedState).filter(s => s !== 'none').length;

    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 bg-white border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm">
          <div className="flex items-center gap-4">
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded font-medium text-sm">
              {clinicalCase.specialty}
            </div>
            <h2 className="font-bold text-slate-800 hidden md:block">{student.name} - {clinicalCase.topic}</h2>
          </div>
          <div className="flex items-center gap-4">
            <Timer 
              durationMinutes={8} 
              isRunning={isTimerRunning} 
              onTimeUp={() => {
                alert("¡Tiempo Terminado! Inicie retroalimentación.");
              }} 
            />
            <button 
              onClick={handleFinishStation}
              className="bg-slate-900 text-white px-4 py-2 rounded-lg font-medium hover:bg-slate-800 transition-colors"
            >
              Finalizar Evaluación
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-6 overflow-hidden">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full">
            
            {/* Left Column: Teacher Guide & Context */}
            <div className="lg:col-span-5 space-y-6 overflow-y-auto pb-20 custom-scrollbar">
              {/* Instructions Card */}
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                <h3 className="font-bold text-blue-900 mb-2 flex items-center gap-2">
                  <FileText size={20} /> Instrucciones al Estudiante
                </h3>
                <p className="text-blue-800 text-sm mb-3 leading-relaxed">
                  {clinicalCase.studentInstructions.caseSummary}
                </p>
                <div className="bg-white/60 p-3 rounded-lg">
                  <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Tareas:</p>
                  <ul className="list-disc pl-4 text-sm text-blue-900">
                    {clinicalCase.studentInstructions.tasks.map((t, i) => <li key={i}>{t}</li>)}
                  </ul>
                </div>
              </div>

              {/* Standardized Patient Toggle */}
              {clinicalCase.standardizedPatient && (
                <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                  <button 
                    onClick={() => setShowPatientScript(!showPatientScript)}
                    className="w-full flex justify-between items-center p-4 bg-purple-50 text-purple-900 font-semibold hover:bg-purple-100 transition-colors"
                  >
                    <span className="flex items-center gap-2"><UserCheck size={20}/> Guía Paciente Estandarizado</span>
                    <ChevronRight className={`transform transition-transform ${showPatientScript ? 'rotate-90' : ''}`} />
                  </button>
                  {showPatientScript && (
                    <div className="p-4 bg-white border-t border-slate-100">
                      <div className="mb-3">
                        <span className="text-xs font-bold text-slate-500 uppercase">Actuación</span>
                        <p className="text-slate-800">{clinicalCase.standardizedPatient.actingGuidelines}</p>
                      </div>
                      <div>
                        <span className="text-xs font-bold text-slate-500 uppercase">Guion</span>
                        <p className="text-slate-800 italic">"{clinicalCase.standardizedPatient.script}"</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Clinical Data */}
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4">
                <h3 className="font-bold text-slate-800 border-b pb-2">Información Clínica (Para el Docente)</h3>
                
                {[
                  { label: "Enfermedad Actual", val: clinicalCase.teacherGuide.hpi },
                  { label: "Signos Vitales", val: clinicalCase.teacherGuide.vitals },
                  { label: "Examen Físico", val: clinicalCase.teacherGuide.physicalExam },
                  { label: "Ayudas Diagnósticas", val: clinicalCase.teacherGuide.labsAndImaging },
                  { label: "Plan/Manejo Esperado", val: clinicalCase.teacherGuide.treatmentPlan },
                ].map((item, idx) => (
                  <div key={idx}>
                    <span className="block text-xs font-bold text-slate-500 uppercase mb-1">{item.label}</span>
                    <p className="text-sm text-slate-800 whitespace-pre-line">{item.val}</p>
                  </div>
                ))}
              </div>

              {/* Teacher Notes Input */}
              <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-5">
                <h3 className="font-bold text-amber-900 mb-2 flex items-center gap-2">
                  <MessageSquarePlus size={20} /> Notas del Docente
                </h3>
                <p className="text-xs text-amber-800 mb-2">
                  Escriba observaciones clave sobre la actitud o desempeño. La IA usará esto para la calificación.
                </p>
                <textarea
                  className="w-full p-3 rounded-lg border border-amber-300 focus:ring-2 focus:ring-amber-500 outline-none text-sm"
                  rows={4}
                  placeholder="Ej: El estudiante mostró buena empatía pero dudó mucho al formular la dosis..."
                  value={teacherNote}
                  onChange={(e) => setTeacherNote(e.target.value)}
                ></textarea>
              </div>

            </div>

            {/* Right Column: Interactive Checklist */}
            <div className="lg:col-span-7 h-full flex flex-col">
              <div className="bg-white rounded-xl shadow-md border border-slate-200 flex flex-col h-full overflow-hidden">
                <div className="p-4 border-b border-slate-200 bg-slate-50 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <CheckCircle size={20} className="text-green-600" /> Lista de Chequeo
                  </h3>
                  <span className="text-sm font-medium text-slate-500">
                    Marcados: {checkedCount} / {clinicalCase.checklist.length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 bg-slate-50/50">
                   <Checklist 
                     items={clinicalCase.checklist} 
                     checkedState={checkedState} 
                     onToggle={toggleCheck} 
                   />
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>
    );
  }

  if (step === 'results' && evaluationResult && clinicalCase) {
    return (
      <div className="min-h-screen bg-slate-100 p-6 flex justify-center">
        <div className="max-w-3xl w-full bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className={`p-8 text-center ${evaluationResult.score >= 3 ? 'bg-green-600' : 'bg-amber-600'} text-white`}>
            <h1 className="text-3xl font-bold mb-2">Evaluación Finalizada</h1>
            <div className="inline-block bg-white/20 rounded-full px-6 py-2 mt-2 backdrop-blur-sm">
              <span className="text-5xl font-extrabold">{evaluationResult.score}</span>
              <span className="text-xl opacity-80"> / 5.0</span>
            </div>
            <p className="mt-4 text-lg opacity-90">{student.name}</p>
          </div>

          <div className="p-8 space-y-8">
            {/* Feedback Section */}
            <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
              <h3 className="font-bold text-slate-800 text-lg mb-4 flex items-center gap-2">
                <BrainCircuit className="text-blue-600" /> Retroalimentación
              </h3>
              
              {evaluationResult.teacherNote && (
                <div className="mb-6 p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg">
                   <h4 className="font-bold text-amber-900 text-sm mb-1">Nota del Docente:</h4>
                   <p className="text-amber-800 text-sm italic">"{evaluationResult.teacherNote}"</p>
                </div>
              )}

              <p className="text-slate-700 leading-relaxed mb-6">
                {evaluationResult.feedback}
              </p>
              
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h4 className="font-semibold text-green-700 mb-2 flex items-center gap-2">
                    <CheckCircle size={16} /> Fortalezas
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                    {evaluationResult.strengths.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div>
                  <h4 className="font-semibold text-amber-700 mb-2 flex items-center gap-2">
                    <AlertCircle size={16} /> Oportunidades de Mejora
                  </h4>
                  <ul className="list-disc pl-5 space-y-1 text-sm text-slate-600">
                    {evaluationResult.weaknesses.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
              <button 
                onClick={generatePDF}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Download size={20} /> Descargar Informe PDF
              </button>
              <button 
                onClick={() => {
                  setStudent({ name: '', id: '' });
                  setClinicalCase(null);
                  setEvaluationResult(null);
                  setStep('setup');
                }}
                className="flex-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold py-3 rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <RotateCcw size={20} /> Nueva Evaluación
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default App;